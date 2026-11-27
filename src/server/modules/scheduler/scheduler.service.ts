/**
 * Rotina automática executada a cada minuto (RF019): abertura (RF031), encerramento (RF035),
 * integridade + apuração (RF059, RF042), lembretes 48 h (RF055), prazos de propostas (RF021),
 * fila de e-mails (RF053), limpeza de cópias LGPD (RF015) e reordenação física dos votos.
 * Sempre pelo horário do servidor. Transições inválidas são recusadas e registradas.
 */
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { getDb, getDbKind, type DbOrTx } from "../../db/client";
import { alternatives, audienceCriteria, auditLog, citizenProposalEvents, citizenProposals, consultations, dataExports, votes } from "../../db/schema";
import { clock, HOUR, MINUTE } from "../../lib/clock";
import { getSetting } from "../../lib/settings";
import { audit } from "../audit/audit.service";
import { notifyUser, processOutbox } from "../notifications/notifications.service";
import { notifyOpened, notifyReminder, notifyVoters } from "../notifications/dispatch";
import { recordPublicEvent } from "../consultations/common";
import { estimateEligible } from "../consultations/lifecycle.service";
import { tallyConsultation, verifyIntegrity } from "../results/results.service";
import { checkExternalLinks } from "../attachments/attachments.service";
import { ConsultaRepository } from "../../repositories/consulta.repository";
import { PropostaCidadaRepository } from "../../repositories/proposta-cidada.repository";

export async function openDueConsultations(db: DbOrTx = getDb()) {
  const now = clock.now();
  const due = await db.select().from(consultations).where(and(eq(consultations.status, "agendada"), lte(consultations.opensAt, now)));
  for (const c of due) {
    await db.transaction(async (tx) => {
      const repositorio = new ConsultaRepository(tx);
      const [cur] = await tx.select().from(consultations).where(eq(consultations.id, c.id)).for("update");
      const consulta = repositorio.deRegistro(cur);
      // Suspensa antes da abertura: aguarda a retomada (a situação não é "agendada").
      if (!consulta.estaEm("agendada")) return;
      const alts = await tx.select({ id: alternatives.id, label: alternatives.label }).from(alternatives).where(eq(alternatives.consultationId, c.id)).orderBy(asc(alternatives.position));
      const crit = await tx.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, c.id));
      const estimated = await estimateEligible(
        tx,
        cur.audienceOpen,
        crit.map((x) => ({ type: x.type, districtIds: x.params.districtIds, regionIds: x.params.regionIds, minAge: x.params.minAge, maxAge: x.params.maxAge })),
      );
      // Retrato dos parâmetros vigentes na abertura (RF031).
      const snapshot = { alternatives: alts, audienceOpen: cur.audienceOpen, criteria: crit.map((x) => ({ type: x.type, publicText: x.publicText })), quorumType: cur.quorumType, quorumValue: cur.quorumValue, estimatedEligible: estimated, countingRule: cur.countingRule, takenAt: now.toISOString() };
      consulta.abrir(now, snapshot, estimated);
      await repositorio.salvar(consulta);
      await recordPublicEvent(tx, c.id, "abertura", "Votação aberta automaticamente no horário programado.");
      await audit(tx, { action: "consulta_aberta", objectType: "consulta", objectId: c.id, details: { elegiveisEstimados: estimated } });
      await notifyOpened(tx, c.id);
    });
  }
  return due.length;
}

export async function closeDueConsultations(db: DbOrTx = getDb()) {
  const now = clock.now();
  const due = await db.select().from(consultations).where(and(eq(consultations.status, "aberta"), lte(consultations.closesAt, now)));
  for (const c of due) {
    await db.transaction(async (tx) => {
      // O UPDATE aguarda os votos em andamento (que bloqueiam a linha em modo compartilhado).
      const repositorio = new ConsultaRepository(tx);
      const consulta = await repositorio.obter(c.id, { paraAtualizar: true });
      if (!consulta.estaEm("aberta")) return;
      consulta.encerrarNoHorario(now);
      await repositorio.salvar(consulta);
      await recordPublicEvent(tx, c.id, "encerramento", "Votação encerrada automaticamente no horário divulgado.");
      await audit(tx, { action: "consulta_encerrada", objectType: "consulta", objectId: c.id });
      await notifyVoters(tx, c.id, "resultado", `Consulta encerrada: ${c.title}`, "A votação foi encerrada. Os votos são contados automaticamente e o resultado será publicado depois da conferência.", `/consultas/${c.slug}`);
    });
    // Encerramento: reembaralhamento forçado, para que nenhum voto da consulta fique ligável ao eleitor.
    await shuffleVotes(db, true);
    const integrity = await verifyIntegrity(c.id, "encerramento", db);
    // Totais divergentes: apuração bloqueada e incidente aberto (RF035, RF060).
    if (integrity.passed) await tallyConsultation(c.id, db);
  }
  return due.length;
}

/** Tenta apurar consultas encerradas cuja apuração ficou pendente (ex.: após resolver incidente). */
export async function tallyPending(db: DbOrTx = getDb()) {
  const pending = await db.select({ id: consultations.id }).from(consultations).where(eq(consultations.status, "encerrada"));
  for (const c of pending) {
    const [last] = await db.execute(sql`select 1 from integrity_checks where consultation_id = ${c.id} and passed = false and created_at > now() - interval '1 hour' limit 1`).then((r) => r.rows);
    if (last) continue;
    await tallyConsultation(c.id, db).catch(() => undefined);
  }
}

async function alreadyLogged(db: DbOrTx, action: string, objectId: string) {
  const [r] = await db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.action, action), eq(auditLog.objectId, objectId))).limit(1);
  return !!r;
}

export async function sendReminders(db: DbOrTx = getDb()) {
  const hours = await getSetting("lembrete.horas_antes", db);
  const limit = new Date(clock.now().getTime() + hours * HOUR);
  const open = await db.select().from(consultations).where(and(eq(consultations.status, "aberta"), lte(consultations.closesAt, limit)));
  let sent = 0;
  for (const c of open) {
    // Suspensa no horário do lembrete: não está "aberta" e o envio fica para depois da retomada.
    if (await alreadyLogged(db, "lembrete_enviado", c.id)) continue;
    await db.transaction(async (tx) => {
      await notifyReminder(tx, c.id);
      await audit(tx, { action: "lembrete_enviado", objectType: "consulta", objectId: c.id });
    });
    sent++;
  }
  return sent;
}

/** Ajuste sem retorno no prazo: proposta encerrada com justificativa (RF021). */
export async function expireProposalAdjustments(db: DbOrTx = getDb()) {
  const due = await db.select().from(citizenProposals).where(and(eq(citizenProposals.status, "ajuste_solicitado"), lt(citizenProposals.adjustmentDeadline, clock.now())));
  for (const p of due) {
    await db.transaction(async (tx) => {
      const note = "Encerrada automaticamente: o ajuste solicitado não foi atendido no prazo.";
      const repositorio = new PropostaCidadaRepository(tx);
      const proposta = await repositorio.obter(p.id, { paraAtualizar: true });
      if (!proposta.estaEm("ajuste_solicitado")) return;
      proposta.encerrarPorAjusteVencido(clock.now());
      await repositorio.salvar(proposta);
      await tx.insert(citizenProposalEvents).values({ proposalId: p.id, status: "encerrada", note, createdAt: clock.now() });
      await notifyUser(tx, p.authorId, { type: "respostas_propostas", title: `Proposta ${p.protocol} encerrada`, body: note, link: `/conta/propostas/${p.id}` });
      await audit(tx, { action: "proposta_cidada_encerrada_prazo", objectType: "proposta_cidada", objectId: p.id });
    });
  }
  return due.length;
}

let lastShuffle = 0;
/**
 * Sigilo contra quem acessa o banco diretamente (RS002; DECISOES_TECNICAS DT-05 e DT-31).
 *  1) Participação e voto nascem na mesma transação e, por isso, com o mesmo `xmin` (coluna de
 *     sistema do PostgreSQL). As consultas que ainda têm algum voto nessa situação recebem nova
 *     chave aleatória para TODOS os seus votos, numa única instrução: todos passam a ter o mesmo
 *     `xmin`, e nenhum JOIN por `xmin` liga mais voto a eleitor.
 *  2) CLUSTER reordena fisicamente a tabela pela chave aleatória e descarta as versões antigas.
 * O gatilho de `votes` só admite a troca de `shuffle_key` (migração 0004); o hash da base apurada
 * não muda, porque não inclui essa chave. Resíduo: WAL e cópias anteriores (restringir acesso).
 */
export async function shuffleVotes(db: DbOrTx = getDb(), force = false) {
  if (!force && Date.now() - lastShuffle < 15 * MINUTE) return false;
  try {
    const pending = (await db.execute(sql`select distinct v.consultation_id as id from votes v join participations p on p.xmin = v.xmin`)).rows as { id: string }[];
    if (!pending.length && !force) {
      lastShuffle = Date.now();
      return false;
    }
    if (pending.length) {
      await db
        .update(votes)
        .set({ shuffleKey: sql`gen_random_uuid()` })
        .where(inArray(votes.consultationId, pending.map((r) => r.id)));
    }
    await db.execute(sql`CLUSTER votes USING votes_shuffle_idx`);
    lastShuffle = Date.now();
    return true;
  } catch (e) {
    console.error("[ppcm] falha ao reembaralhar os votos:", (e as Error).message);
    return false;
  }
}

export async function purgeExpiredExports(db: DbOrTx = getDb()) {
  await db.delete(dataExports).where(lt(dataExports.expiresAt, clock.now()));
}

let lastLinkCheck = Date.now();
let running = false;
export async function runSchedulerTick(db: DbOrTx = getDb()) {
  if (running) return { skipped: true };
  running = true;
  const summary: Record<string, unknown> = {};
  try {
    summary.opened = await openDueConsultations(db);
    summary.closed = await closeDueConsultations(db);
    await tallyPending(db);
    summary.reminders = await sendReminders(db);
    summary.proposalsExpired = await expireProposalAdjustments(db);
    await purgeExpiredExports(db);
    // Qualquer consulta com voto ainda ligável à participação (aberta, encerrada ou cancelada), no máximo a cada 15 min.
    summary.shuffled = await shuffleVotes(db);
    // Links externos: uma vez por dia (RF023).
    if (Date.now() - lastLinkCheck > 24 * HOUR) {
      lastLinkCheck = Date.now();
      summary.linksChanged = await checkExternalLinks(db).catch(() => 0);
    }
    summary.outbox = await processOutbox(db);
    summary.db = getDbKind();
  } catch (e) {
    console.error("[ppcm] falha na rotina automática:", (e as Error).message);
    summary.error = (e as Error).message;
  } finally {
    running = false;
  }
  return summary;
}

export { inArray };
