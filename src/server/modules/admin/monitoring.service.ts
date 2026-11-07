/**
 * Painel de acompanhamento (RF048) e relatórios agregados (RF049).
 * NUNCA expõe contagem por alternativa durante a votação, para nenhum perfil (RN16, RS008).
 * Grupos com menos de 10 pessoas são exibidos como "menos de 10" (RF049, RS002).
 */
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { auditLog, citizenProposals, consultations, contentReports, incidents, participations } from "../../db/schema";
import { clock, DAY } from "../../lib/clock";
import { getSetting } from "../../lib/settings";
import { assertPermission, type Actor } from "../access/access.service";
import { audit } from "../audit/audit.service";

export async function monitoringPanel(actor: Actor, db: DbOrTx = getDb()) {
  await assertPermission(actor, "consultas.acompanhar", {}, db);
  const now = clock.now();
  const active = await db.select().from(consultations).where(inArray(consultations.status, ["agendada", "aberta", "suspensa", "encerrada", "apurada", "em_analise", "aprovada"])).orderBy(consultations.closesAt);
  const lowPct = await getSetting("consulta.baixa_participacao_percentual", db);
  const suggestDays = await getSetting("divulgacao.sugerir_dias_antes", db);
  return Promise.all(
    active.map(async (c) => {
      const [{ n: total }] = await db.select({ n: count() }).from(participations).where(eq(participations.consultationId, c.id));
      // Evolução diária: participações por DATA (a participação não guarda hora).
      const daily = await db
        .select({ day: participations.participatedOn, n: count() })
        .from(participations)
        .where(eq(participations.consultationId, c.id))
        .groupBy(participations.participatedOn)
        .orderBy(participations.participatedOn);
      // Tentativas recusadas por motivo (auditoria; sem alternativa).
      const refused = await db
        .select({ motivo: sql<string>`${auditLog.details}->>'motivo'`, n: count() })
        .from(auditLog)
        .where(and(eq(auditLog.action, "voto_recusado"), eq(auditLog.objectId, c.id)))
        .groupBy(sql`${auditLog.details}->>'motivo'`);
      const [{ n: openIncidents }] = await db.select({ n: count() }).from(incidents).where(and(eq(incidents.consultationId, c.id), inArray(incidents.status, ["aberto", "em_analise"])));
      const pendencias: string[] = [];
      if (c.status === "em_analise" && c.exceptionalDeadline && c.deadlineAuthorization === "pendente") pendencias.push("Decisão sobre prazo excepcional");
      if (c.status === "em_analise") pendencias.push("Aguardando aprovação");
      if (c.status === "aprovada") pendencias.push("Aguardando publicação");
      if (c.status === "apurada") pendencias.push("Resultado aguardando homologação");
      const eligible = c.estimatedEligible ?? null;
      const half = c.opensAt && c.closesAt ? c.opensAt.getTime() + (c.closesAt.getTime() - c.opensAt.getTime()) / 2 : null;
      const lowParticipation = c.status === "aberta" && !!eligible && !!half && now.getTime() > half && (total / eligible) * 100 < lowPct;
      const suggestDissemination = c.status === "aberta" && !!c.closesAt && c.closesAt.getTime() - now.getTime() <= suggestDays * DAY;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        opensAt: c.opensAt,
        closesAt: c.closesAt,
        msToClose: c.closesAt ? c.closesAt.getTime() - now.getTime() : null,
        participations: total,
        estimatedEligible: eligible,
        daily,
        refused,
        openIncidents,
        pendencias,
        alerts: { lowParticipation, incidents: openIncidents > 0, suggestDissemination },
      };
    }),
  );
}

export async function moderationPendingCount(db: DbOrTx = getDb()) {
  const [{ n }] = await db.select({ n: count() }).from(contentReports).where(eq(contentReports.status, "pendente"));
  return n;
}

function suppress(n: number, min: number): number | string {
  return n > 0 && n < min ? `menos de ${min}` : n;
}

export type ReportFilter = { from?: string; to?: string; themeId?: string; regionId?: string; status?: string };

export async function generateReport(actor: Actor, filter: ReportFilter, opts: { export?: string } = {}, db: DbOrTx = getDb()) {
  await assertPermission(actor, "relatorios.gerar", {}, db);
  const min = await getSetting("relatorio.supressao_minima", db);
  const from = filter.from ? new Date(`${filter.from}T00:00:00-03:00`) : new Date(clock.now().getTime() - 365 * DAY);
  const to = filter.to ? new Date(`${filter.to}T23:59:59-03:00`) : clock.now();
  const cConds = [gte(consultations.createdAt, from), lte(consultations.createdAt, to)];
  if (filter.themeId) cConds.push(eq(consultations.themeId, filter.themeId));
  if (filter.regionId) cConds.push(eq(consultations.regionId, filter.regionId));
  if (filter.status) cConds.push(eq(consultations.status, filter.status as "aberta"));

  const byStatus = await db.select({ status: consultations.status, n: count() }).from(consultations).where(and(...cConds)).groupBy(consultations.status);
  const participationByConsultation = await db
    .select({ title: consultations.title, status: consultations.status, n: sql<number>`(select count(*)::int from participations p where p.consultation_id = ${consultations.id})` })
    .from(consultations)
    .where(and(...cConds, inArray(consultations.status, ["aberta", "encerrada", "apurada", "finalizada", "suspensa", "cancelada"])))
    .orderBy(desc(consultations.createdAt));
  const regs = await db.execute(sql`
    select coalesce(r.name, 'Fora do município') as regiao, count(u.id)::int as n
    from users u left join districts d on d.id = u.district_id left join regions r on r.id = d.region_id
    where u.kind = 'cidadao' and u.created_at between ${from} and ${to}
    group by 1 order by 1`);
  const proposals = await db
    .select({ status: citizenProposals.status, n: count() })
    .from(citizenProposals)
    .where(and(gte(citizenProposals.createdAt, from), lte(citizenProposals.createdAt, to), filter.themeId ? eq(citizenProposals.themeId, filter.themeId) : undefined))
    .groupBy(citizenProposals.status);
  const tramitacao = await db.execute(sql`
    select round(avg(extract(epoch from (e.created_at - p.created_at)) / 86400)::numeric, 1) as dias
    from citizen_proposals p
    join lateral (select min(created_at) as created_at from citizen_proposal_events ev where ev.proposal_id = p.id and ev.status = 'respondida') e on true
    where e.created_at is not null and p.created_at between ${from} and ${to}`);
  const report = {
    periodo: { de: from.toISOString(), ate: to.toISOString() },
    consultasPorSituacao: byStatus.map((r) => ({ situacao: r.status, quantidade: r.n })),
    participacaoPorConsulta: participationByConsultation.map((r) => ({ consulta: r.title, situacao: r.status, participacoes: suppress(r.n, min) })),
    cadastrosPorRegiao: (regs.rows as { regiao: string; n: number }[]).map((r) => ({ regiao: r.regiao, cadastros: suppress(r.n, min) })),
    propostasPorEstado: proposals.map((r) => ({ estado: r.status, quantidade: r.n })),
    tempoMedioRespostaPropostasDias: (tramitacao.rows[0] as { dias: string | null })?.dias ?? null,
    supressao: `Grupos com menos de ${min} pessoas são exibidos como "menos de ${min}".`,
  };
  if (opts.export) await audit(db, { actorId: actor.id, actorRole: "acompanhamento", action: "relatorio_exportado", objectType: "relatorio", objectId: "agregado", details: { formato: opts.export } });
  return report;
}
