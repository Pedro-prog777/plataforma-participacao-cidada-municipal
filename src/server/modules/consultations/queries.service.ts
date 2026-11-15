/** Consultas de leitura para o portal público e a administração (RF016–RF018, RF048, RF050, RF051, RF056). */
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import {
  alternatives,
  attachments,
  audienceCriteria,
  citizenProposals,
  consultationEvents,
  consultations,
  districts,
  municipalProposals,
  organs,
  outcomeEntries,
  outcomes,
  participations,
  regions,
  results,
  themes,
  users,
} from "../../db/schema";
import { clock } from "../../lib/clock";
import { normalizeSearch } from "@/lib/text";
import { ARCHIVE_STATUSES, PUBLIC_STATUSES, type ConsultationStatus } from "@/lib/labels";
import { evaluateEligibility, loadAudienceCriteria, loadEligibilityUser } from "../voting/eligibility";

export const PAGE_SIZE = 12;

export type ConsultationFilter = {
  q?: string;
  status?: string;
  themeId?: string;
  regionId?: string;
  from?: string;
  to?: string;
  page?: number;
  year?: string;
  archive?: boolean;
  notParticipated?: boolean;
  canParticipate?: boolean;
};

const baseSelect = {
  id: consultations.id,
  slug: consultations.slug,
  title: consultations.title,
  summary: consultations.summary,
  status: consultations.status,
  opensAt: consultations.opensAt,
  closesAt: consultations.closesAt,
  exceptionalDeadline: consultations.exceptionalDeadline,
  audienceOpen: consultations.audienceOpen,
  theme: themes.name,
  themeId: consultations.themeId,
  region: regions.name,
  organ: organs.name,
  participations: sql<number>`(select count(*)::int from participations p where p.consultation_id = ${consultations.id})`,
};

/** RF016/RF017/RF056 — listagem pública com busca sem acentos e filtros. */
export async function listPublicConsultations(filter: ConsultationFilter, viewerId?: string | null, db: DbOrTx = getDb()) {
  const conds: SQL[] = [inArray(consultations.status, filter.archive ? ARCHIVE_STATUSES : PUBLIC_STATUSES)];
  if (filter.q) {
    const terms = normalizeSearch(filter.q).split(" ").filter(Boolean).slice(0, 8);
    for (const t of terms) conds.push(ilike(consultations.searchText, `%${t.replace(/[%_]/g, "")}%`));
  }
  if (filter.status && (PUBLIC_STATUSES as string[]).includes(filter.status)) conds.push(eq(consultations.status, filter.status as ConsultationStatus));
  if (filter.themeId) conds.push(eq(consultations.themeId, filter.themeId));
  if (filter.regionId) conds.push(eq(consultations.regionId, filter.regionId));
  if (filter.from) conds.push(gte(consultations.closesAt, new Date(`${filter.from}T00:00:00-03:00`)));
  if (filter.to) conds.push(lte(consultations.opensAt, new Date(`${filter.to}T23:59:59-03:00`)));
  if (filter.year) conds.push(sql`extract(year from ${consultations.closesAt} at time zone 'America/Sao_Paulo') = ${Number(filter.year)}`);
  if (viewerId && filter.notParticipated) conds.push(sql`not exists (select 1 from participations p where p.consultation_id = ${consultations.id} and p.citizen_id = ${viewerId})`);

  const order = [
    sql`case ${consultations.status} when 'aberta' then 0 when 'agendada' then 1 when 'suspensa' then 2 else 3 end`,
    sql`case when ${consultations.status} in ('aberta','agendada','suspensa') then ${consultations.closesAt} end asc`,
    desc(consultations.closesAt),
  ];
  let rows = await db
    .select(baseSelect)
    .from(consultations)
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .leftJoin(regions, eq(regions.id, consultations.regionId))
    .leftJoin(organs, eq(organs.id, consultations.organId))
    .where(and(...conds))
    .orderBy(...order);

  // Indicação ao cidadão: onde já participou ou não se enquadra (RF016) e filtro "posso participar" (RF017).
  let viewer: Awaited<ReturnType<typeof loadEligibilityUser>> = null;
  const participatedIds = new Set<string>();
  if (viewerId) {
    viewer = await loadEligibilityUser(viewerId, db);
    const ps = await db.select({ id: participations.consultationId }).from(participations).where(eq(participations.citizenId, viewerId));
    ps.forEach((p) => participatedIds.add(p.id));
  }
  // Critérios de todas as consultas abertas em uma única consulta ao banco (antes: duas por consulta).
  const criteria = viewer ? await loadAudienceCriteria(rows.filter((r) => r.status === "aberta" && !participatedIds.has(r.id)).map((r) => r.id), db) : new Map();
  const enriched = rows.map((r) => {
    let viewerState: "participou" | "pode_participar" | "nao_se_enquadra" | null = null;
    let viewerReason: string | null = null;
    if (viewer) {
      if (participatedIds.has(r.id)) viewerState = "participou";
      else if (r.status === "aberta") {
        const el = evaluateEligibility(viewer, { status: r.status, opensAt: r.opensAt, closesAt: r.closesAt, audienceOpen: r.audienceOpen, criteria: criteria.get(r.id) ?? [] }, false);
        viewerState = el.eligible ? "pode_participar" : "nao_se_enquadra";
        viewerReason = el.eligible ? null : el.reason;
      }
    }
    return { ...r, viewerState, viewerReason };
  });
  rows = enriched;
  const filtered = viewerId && filter.canParticipate ? enriched.filter((r) => r.viewerState === "pode_participar") : enriched;
  const page = Math.max(1, filter.page ?? 1);
  return { total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

/** RF018 — página pública da consulta (sem dados pessoais). */
export async function getPublicConsultation(slug: string, db: DbOrTx = getDb()) {
  const [row] = await db
    .select({ c: consultations, theme: themes.name, region: regions.name, organ: organs.name, organAcronym: organs.acronym, proposal: municipalProposals })
    .from(consultations)
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .leftJoin(regions, eq(regions.id, consultations.regionId))
    .leftJoin(organs, eq(organs.id, consultations.organId))
    .leftJoin(municipalProposals, eq(municipalProposals.id, consultations.municipalProposalId))
    .where(and(eq(consultations.slug, slug), inArray(consultations.status, PUBLIC_STATUSES)));
  if (!row) return null;
  const id = row.c.id;
  const [alts, criteria, files, [{ n }], events] = await Promise.all([
    db.select().from(alternatives).where(eq(alternatives.consultationId, id)).orderBy(asc(alternatives.position)),
    db.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, id)),
    db
      .select()
      .from(attachments)
      .where(or(and(eq(attachments.ownerType, "consultation"), eq(attachments.ownerId, id)), and(eq(attachments.ownerType, "municipal_proposal"), eq(attachments.ownerId, row.c.municipalProposalId))))
      .orderBy(asc(attachments.createdAt)),
    db.select({ n: count() }).from(participations).where(eq(participations.consultationId, id)),
    db.select().from(consultationEvents).where(eq(consultationEvents.consultationId, id)).orderBy(asc(consultationEvents.occurredAt)),
  ]);
  return { ...row, alternatives: alts, criteria, attachments: files, participations: n, events };
}

export async function getConsultationIdBySlug(slug: string, db: DbOrTx = getDb()) {
  const [r] = await db.select({ id: consultations.id }).from(consultations).where(eq(consultations.slug, slug));
  return r?.id ?? null;
}

/** RF050 — indicadores gerais do portal (somente agregados). */
export async function portalIndicators(db: DbOrTx = getDb()) {
  const r = await db.execute(sql`
    select
      (select count(*)::int from consultations where status = 'aberta') as abertas,
      (select count(*)::int from consultations where status = 'agendada') as agendadas,
      (select count(*)::int from consultations where status in ('agendada','aberta','suspensa','encerrada','apurada','finalizada','cancelada')) as publicadas,
      (select count(*)::int from consultations where status = 'finalizada') as finalizadas,
      (select count(*)::int from participations) as participacoes,
      (select count(*)::int from citizen_proposals where status = 'publicada' and hidden = false) as propostas_publicadas,
      (select count(*)::int from citizen_proposals) as propostas_recebidas,
      (select count(*)::int from outcomes) as encaminhamentos,
      (select count(*)::int from users where kind = 'cidadao' and status = 'ativa') as cidadaos
  `);
  return r.rows[0] as Record<string, number>;
}

/** Participações por tema (portal) — agregados. */
export async function participationByTheme(db: DbOrTx = getDb()) {
  const r = await db.execute(sql`
    select t.name as tema, count(p.id)::int as participacoes, count(distinct c.id)::int as consultas
    from consultations c
    join themes t on t.id = c.theme_id
    left join participations p on p.consultation_id = c.id
    where c.status in ('agendada','aberta','suspensa','encerrada','apurada','finalizada','cancelada')
    group by t.name order by participacoes desc`);
  return r.rows as { tema: string; participacoes: number; consultas: number }[];
}

/** RF063/RF050 — encaminhamentos públicos com a situação mais recente. */
export async function listPublicOutcomes(filter: { consultationId?: string; limit?: number } = {}, db: DbOrTx = getDb()) {
  const query = db
    .select({ o: outcomes, organ: organs.name, consultation: consultations.title, slug: consultations.slug })
    .from(outcomes)
    .innerJoin(organs, eq(organs.id, outcomes.organId))
    .innerJoin(consultations, eq(consultations.id, outcomes.consultationId))
    .where(filter.consultationId ? eq(outcomes.consultationId, filter.consultationId) : undefined)
    .orderBy(desc(outcomes.createdAt));
  const rows = await (filter.limit ? query.limit(filter.limit) : query);
  const ids = rows.map((r) => r.o.id);
  const entries = ids.length ? await db.select().from(outcomeEntries).where(inArray(outcomeEntries.outcomeId, ids)).orderBy(asc(outcomeEntries.createdAt)) : [];
  return rows.map((r) => {
    const hist = entries.filter((e) => e.outcomeId === r.o.id);
    return { ...r, entries: hist, current: hist.at(-1) ?? null };
  });
}

export async function listPublishedResults(limit?: number, db: DbOrTx = getDb()) {
  const query = db
    .select({ id: consultations.id, slug: consultations.slug, title: consultations.title, closesAt: consultations.closesAt, theme: themes.name, kind: results.kind, data: results.data, publishedAt: results.createdAt })
    .from(results)
    .innerJoin(consultations, eq(consultations.id, results.consultationId))
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .where(and(inArray(results.kind, ["final", "retificacao"]), eq(consultations.status, "finalizada")))
    .orderBy(desc(results.createdAt));
  return limit ? query.limit(limit) : query;
}

export async function referenceData(db: DbOrTx = getDb()) {
  const [t, r, d, o] = await Promise.all([
    db.select().from(themes).orderBy(asc(themes.name)),
    db.select().from(regions).orderBy(asc(regions.name)),
    db.select({ id: districts.id, name: districts.name, regionId: districts.regionId }).from(districts).orderBy(asc(districts.name)),
    db.select().from(organs).orderBy(asc(organs.name)),
  ]);
  return { themes: t, regions: r, districts: d, organs: o };
}

/** Administração: lista todas as consultas (todas as situações). */
export async function listAdminConsultations(filter: { status?: string; q?: string } = {}, db: DbOrTx = getDb()) {
  const conds: SQL[] = [];
  if (filter.status) conds.push(eq(consultations.status, filter.status as ConsultationStatus));
  if (filter.q) conds.push(ilike(consultations.searchText, `%${normalizeSearch(filter.q).replace(/[%_]/g, "")}%`));
  return db
    .select({ ...baseSelect, version: consultations.version, updatedAt: consultations.updatedAt, author: users.fullName })
    .from(consultations)
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .leftJoin(regions, eq(regions.id, consultations.regionId))
    .leftJoin(organs, eq(organs.id, consultations.organId))
    .leftJoin(users, eq(users.id, consultations.createdBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(consultations.updatedAt));
}

export async function statusCounts(db: DbOrTx = getDb()) {
  const rows = await db.select({ status: consultations.status, n: count() }).from(consultations).groupBy(consultations.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

export async function pendingCitizenProposals(db: DbOrTx = getDb()) {
  const [r] = await db.select({ n: count() }).from(citizenProposals).where(inArray(citizenProposals.status, ["recebida", "em_analise"]));
  return r?.n ?? 0;
}

export { clock };
