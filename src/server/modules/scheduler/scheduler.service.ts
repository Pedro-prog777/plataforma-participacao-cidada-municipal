/**
 * Rotina automática executada a cada minuto (RF019): abertura (RF031), encerramento (RF035),
 * integridade + apuração (RF059, RF042), lembretes 48 h (RF055), prazos de propostas (RF021),
 * fila de e-mails (RF053), limpeza de cópias LGPD (RF015) e reordenação física dos votos.
 * Sempre pelo horário do servidor. Transições inválidas são recusadas e registradas.
 */
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { getDb, getDbKind, type DbOrTx } from "../../db/client";
import { alternatives, audienceCriteria, auditLog, citizenProposalEvents, citizenProposals, consultations, dataExports } from "../../db/schema";
import { clock, HOUR, MINUTE } from "../../lib/clock";
import { getSetting } from "../../lib/settings";
import { audit } from "../audit/audit.service";
import { notifyUser, processOutbox } from "../notifications/notifications.service";
import { notifyOpened, notifyReminder, notifyVoters } from "../notifications/dispatch";
import { recordPublicEvent } from "../consultations/common";
import { estimateEligible } from "../consultations/lifecycle.service";
import { tallyConsultation, verifyIntegrity } from "../results/results.service";

export async function openDueConsultations(db: DbOrTx = getDb()) {
  const now = clock.now();
  const due = await db.select().from(consultations).where(and(eq(consultations.status, "agendada"), lte(consultations.opensAt, now)));
  for (const c of due) {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(consultations).where(eq(consultations.id, c.id)).for("update");
      // Suspensa antes da abertura: aguarda a retomada (o status não é "agendada").
      if (cur.status !== "agendada") return;
      const alts = await tx.select({ id: alternatives.id, label: alternatives.label }).from(alternatives).where(eq(alternatives.consultationId, c.id)).orderBy(asc(alternatives.position));
      const crit = await tx.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, c.id));
      const estimated = await estimateEligible(
        tx,
        cur.audienceOpen,
        crit.map((x) => ({ type: x.type, districtIds: x.params.districtIds, regionIds: x.params.regionIds, minAge: x.params.minAge, maxAge: x.params.maxAge })),
      );
      // Retrato dos parâmetros vigentes na abertura (RF031).
      const snapshot = { alternatives: alts, audienceOpen: cur.audienceOpen, criteria: crit.map((x) => ({ type: x.type, publicText: x.publicText })), quorumType: cur.quorumType, quorumValue: cur.quorumValue, estimatedEligible: estimated, countingRule: cur.countingRule, takenAt: now.toISOString() };
      await tx.update(consultations).set({ status: "aberta", openedAt: now, openSnapshot: snapshot, estimatedEligible: estimated }).where(eq(consultations.id, c.id));
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
      const [cur] = await tx.select().from(consultations).where(eq(consultations.id, c.id)).for("update");
      if (cur.status !== "aberta") return;
      await tx.update(consultations).set({ status: "encerrada", closedAt: now }).where(eq(consultations.id, c.id));
      await recordPublicEvent(tx, c.id, "encerramento", "Votação encerrada automaticamente no horário divulgado.");
      await audit(tx, { action: "consulta_encerrada", objectType: "consulta", objectId: c.id });
      await notifyVoters(tx, c.id, "resultado", `Consulta encerrada: ${c.title}`, "A votação foi encerrada. A apuração é automática e o resultado será publicado após a homologação.", `/consultas/${c.slug}`);
    });
    await shuffleVotes(db);
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
      await tx.update(citizenProposals).set({ status: "encerrada", updatedAt: clock.now() }).where(eq(citizenProposals.id, p.id));
      await tx.insert(citizenProposalEvents).values({ proposalId: p.id, status: "encerrada", note, createdAt: clock.now() });
      await notifyUser(tx, p.authorId, { type: "respostas_propostas", title: `Proposta ${p.protocol} encerrada`, body: note, link: `/conta/propostas/${p.id}` });
      await audit(tx, { action: "proposta_cidada_encerrada_prazo", objectType: "proposta_cidada", objectId: p.id });
    });
  }
  return due.length;
}

let lastShuffle = 0;
/**
 * Reordena fisicamente a tabela de votos por uma chave aleatória (CLUSTER), eliminando a
 * correlação entre a ordem de gravação de participações e de votos (mitigação de RS002
 * contra quem tem acesso ao armazenamento do banco). Ver DECISOES_TECNICAS DT-05.
 */
export async function shuffleVotes(db: DbOrTx = getDb(), force = false) {
  if (!force && Date.now() - lastShuffle < 15 * MINUTE) return false;
  try {
    await db.execute(sql`CLUSTER votes USING votes_shuffle_idx`);
    lastShuffle = Date.now();
    return true;
  } catch {
    return false;
  }
}

export async function purgeExpiredExports(db: DbOrTx = getDb()) {
  await db.delete(dataExports).where(lt(dataExports.expiresAt, clock.now()));
}

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
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from consultations where status = 'aberta'`)).rows as { n: number }[];
    if (n > 0) summary.shuffled = await shuffleVotes(db);
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
