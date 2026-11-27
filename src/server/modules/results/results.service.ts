/**
 * Integridade, apuração, homologação e publicação de resultados (RF042, RF043, RF044, RF059).
 */
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb, getDbKind, type DbOrTx } from "../../db/client";
import { alternatives, integrityChecks, participations, results, votes, type ResultData } from "../../db/schema";
import { canonicalJson, sha256 } from "../../lib/crypto";
import { clock } from "../../lib/clock";
import { DomainError, ValidationError } from "../../lib/errors";
import { sanitizePlainText } from "@/lib/text";
import { brDate } from "../../lib/clock";
import { audit } from "../audit/audit.service";
import { assertConsultationRole, usersWithPermission, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";
import { notifyVoters } from "../notifications/dispatch";
import { openIncident } from "../integrity/incidents.service";
import { getConsultationOrThrow, recordPublicEvent } from "../consultations/common";
import { ConsultaRepository } from "../../repositories/consulta.repository";
import { tally } from "./tally";

/** Hash da base apurada (RNF07): votos ordenados por id — reprodutível e sem dados pessoais. */
async function voteBase(db: DbOrTx, consultationId: string) {
  const rows = await db
    .select({ id: votes.id, alternativeId: votes.alternativeId, abstention: votes.abstention })
    .from(votes)
    .where(eq(votes.consultationId, consultationId))
    .orderBy(asc(votes.id));
  return { rows, baseHash: sha256(canonicalJson(rows)) };
}

export function resultHash(data: ResultData, baseHash: string) {
  const { computedAt: _c, ...stable } = data;
  return sha256(canonicalJson(stable) + baseHash);
}

async function computeResult(db: DbOrTx, consultationId: string) {
  const c = await getConsultationOrThrow(db, consultationId);
  const alts = await db.select().from(alternatives).where(eq(alternatives.consultationId, consultationId));
  const { rows, baseHash } = await voteBase(db, consultationId);
  const [{ n: nPart }] = await db.select({ n: count() }).from(participations).where(eq(participations.consultationId, consultationId));
  const snapshotEligible = (c.openSnapshot?.estimatedEligible as number | undefined) ?? c.estimatedEligible ?? null;
  const data = tally({
    countingRule: c.countingRule,
    alternatives: alts.map((a) => ({ id: a.id, label: a.label, position: a.position })),
    votes: rows,
    participations: nPart,
    estimatedEligible: snapshotEligible,
    quorumType: c.quorumType,
    quorumValue: c.quorumValue,
    computedAt: clock.now().toISOString(),
  });
  return { c, alts, rows, data, baseHash, hash: resultHash(data, baseHash), participations: nPart };
}

/* ------------------------------------------------------------------ */
/* RF059 — Verificação de integridade                                  */
/* ------------------------------------------------------------------ */
export async function verifyIntegrity(consultationId: string, stage: "encerramento" | "apuracao" | "sob_demanda" | "publicacao", db: DbOrTx = getDb()) {
  const first = await computeResult(db, consultationId);
  const { c, alts, rows, data } = first;
  const report: { check: string; ok: boolean; detail: string }[] = [];
  report.push({ check: "Votos iguais a participações", ok: rows.length === first.participations, detail: `${rows.length} votos / ${first.participations} participações` });
  const altIds = new Set(alts.map((a) => a.id));
  const invalid = rows.filter((v) => (v.abstention ? v.alternativeId !== null || !c.allowAbstention : !v.alternativeId || !altIds.has(v.alternativeId))).length;
  report.push({ check: "Votos apenas em alternativas válidas", ok: invalid === 0, detail: `${invalid} voto(s) inválido(s)` });
  const dup = await db.execute(sql`select count(*)::int as n from (select citizen_id from participations where consultation_id = ${consultationId} group by citizen_id having count(*) > 1) d`);
  const nDup = Number((dup.rows[0] as { n: number }).n);
  const [outOfPeriod] =
    c.opensAt && c.closesAt
      ? await db
          .select({ n: count() })
          .from(participations)
          .where(and(eq(participations.consultationId, consultationId), sql`(${participations.participatedOn} < ${brDate(c.opensAt)} or ${participations.participatedOn} > ${brDate(c.closesAt)})`))
      : [{ n: 0 }];
  report.push({ check: "Nenhuma participação duplicada ou fora do período", ok: nDup === 0 && outOfPeriod.n === 0, detail: `${nDup} duplicada(s), ${outOfPeriod.n} fora do período` });
  const sum = data.alternatives.reduce((a, b) => a + b.votes, 0) + data.abstentions;
  report.push({ check: "Soma por alternativa igual ao total", ok: sum === data.totalVotes, detail: `${sum} = ${data.totalVotes}` });
  const pctSum = data.alternatives.reduce((a, b) => a + Number(b.percentage), 0);
  report.push({ check: "Percentuais somam 100% (tolerância 0,01)", ok: data.validVotes === 0 || Math.abs(pctSum - 100) <= 0.01, detail: `${pctSum.toFixed(2)}%` });
  const second = await computeResult(db, consultationId);
  report.push({ check: "Nova apuração com mesmo resultado e hash", ok: second.hash === first.hash, detail: first.hash.slice(0, 16) });
  const [prelim] = await db.select().from(results).where(and(eq(results.consultationId, consultationId), eq(results.kind, "preliminar"))).orderBy(desc(results.createdAt)).limit(1);
  if (prelim && stage === "publicacao") report.push({ check: "Resultado preliminar confere com a base atual", ok: prelim.hash === first.hash, detail: prelim.hash.slice(0, 16) });
  const passed = report.every((r) => r.ok);
  await db.insert(integrityChecks).values({ consultationId, stage, passed, report, createdAt: clock.now() });
  if (!passed) {
    await openIncident(db, { severity: "alta", type: "falha_integridade", consultationId, description: `Falha na verificação de integridade (${stage}) da consulta "${c.title}". Apuração/publicação bloqueada.`, evidence: { falhas: report.filter((r) => !r.ok) } });
  }
  return { passed, report, hash: first.hash, baseHash: first.baseHash };
}

/* ------------------------------------------------------------------ */
/* RF042 — Apuração (somente o sistema)                                */
/* ------------------------------------------------------------------ */
export async function tallyConsultation(consultationId: string, db: DbOrTx = getDb(), opts: { recount?: boolean } = {}) {
  return db.transaction(async (tx) => {
    const repositorio = new ConsultaRepository(tx);
    const c = await getConsultationOrThrow(tx, consultationId, { forUpdate: true });
    const consulta = repositorio.deRegistro(c);
    consulta.garantirApuracaoPermitida(!!opts.recount);
    // "Bloqueia a base de votos": impede qualquer escrita concorrente durante a contagem.
    if (getDbKind() === "pg") await tx.execute(sql`LOCK TABLE votes IN SHARE MODE`);
    const integrity = await verifyIntegrity(consultationId, "apuracao", tx);
    if (!integrity.passed) return { ok: false as const, integrity };
    const { data, baseHash, hash } = await computeResult(tx, consultationId);
    let comparison: { previousHash: string; equal: boolean } | null = null;
    if (opts.recount) {
      const [prev] = await tx.select().from(results).where(and(eq(results.consultationId, consultationId), eq(results.kind, "preliminar"))).orderBy(desc(results.createdAt)).limit(1);
      comparison = prev ? { previousHash: prev.hash, equal: prev.hash === hash } : null;
      if (comparison && !comparison.equal) {
        await openIncident(tx, { severity: "alta", type: "recontagem_divergente", consultationId, description: "A recontagem produziu resultado diferente da apuração anterior.", evidence: { anterior: prev!.hash, atual: hash } });
      }
    }
    await tx.insert(results).values({ consultationId, kind: "preliminar", data, hash, baseHash, createdAt: clock.now() });
    if (!opts.recount) {
      consulta.registrarApuracao();
      await repositorio.salvar(consulta);
      await recordPublicEvent(tx, consultationId, "apuracao", "Votos contados automaticamente. Resultado preliminar aguardando conferência.", null, { hashBase: baseHash });
      for (const u of await usersWithPermission("resultados.publicar", tx)) {
        await notifyUser(tx, u.id, { type: "conta", title: "Resultado preliminar disponível", body: `A consulta "${c.title}" foi apurada e aguarda homologação.`, link: `/admin/consultas/${consultationId}/resultado` });
      }
    }
    await audit(tx, { action: opts.recount ? "recontagem" : "apuracao", objectType: "consulta", objectId: consultationId, details: { hash, hashBase: baseHash, iguais: comparison?.equal ?? null } });
    return { ok: true as const, data, hash, baseHash, comparison };
  });
}

export async function recount(actor: Actor, consultationId: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, consultationId, "publicacao_resultados", db);
  return tallyConsultation(consultationId, db, { recount: true });
}

/* ------------------------------------------------------------------ */
/* RF043 — Homologar e publicar; retificação                           */
/* ------------------------------------------------------------------ */
export async function publishFinalResult(actor: Actor, consultationId: string, note: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, consultationId, "publicacao_resultados", db);
  const n = sanitizePlainText(note ?? "");
  if (n.length < 20) throw new ValidationError({ note: ["A nota oficial é obrigatória: explique a natureza consultiva e os próximos passos (RN34)."] });
  return db.transaction(async (tx) => {
    const repositorio = new ConsultaRepository(tx);
    const c = await getConsultationOrThrow(tx, consultationId, { forUpdate: true });
    const consulta = repositorio.deRegistro(c);
    // Só homologa consulta Apurada; a mudança só é gravada depois da integridade e do resultado final.
    consulta.homologarResultado();
    const integrity = await verifyIntegrity(consultationId, "publicacao", tx);
    if (!integrity.passed) throw new DomainError("A verificação de integridade falhou. A publicação está bloqueada e um incidente foi aberto (RF059).", "integridade");
    const [prelim] = await tx.select().from(results).where(and(eq(results.consultationId, consultationId), eq(results.kind, "preliminar"))).orderBy(desc(results.createdAt)).limit(1);
    if (!prelim) throw new DomainError("Não há resultado preliminar.");
    const [final] = await tx
      .insert(results)
      .values({ consultationId, kind: "final", data: prelim.data, hash: prelim.hash, baseHash: prelim.baseHash, note: n, createdBy: actor.id, createdAt: clock.now() })
      .returning();
    await repositorio.salvar(consulta);
    await recordPublicEvent(tx, consultationId, "resultado", "Resultado final conferido e publicado.", n, { hash: final.hash });
    await audit(tx, { actorId: actor.id, actorRole: "publicacao_resultados", action: "resultado_publicado", objectType: "consulta", objectId: consultationId, details: { hash: final.hash } });
    await notifyVoters(tx, consultationId, "resultado", `Resultado publicado: ${c.title}`, `O resultado da consulta "${c.title}" foi publicado. Lembre-se: a votação é consultiva e orienta a administração.`, `/consultas/${c.slug}/resultado`);
    return final;
  });
}

export async function publishRectification(actor: Actor, consultationId: string, input: { justification: string; note: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, consultationId, "publicacao_resultados", db);
  const j = sanitizePlainText(input.justification ?? "");
  const n = sanitizePlainText(input.note ?? "");
  if (!j) throw new ValidationError({ justification: ["A retificação exige justificativa com o erro comprovado (RN11)."] });
  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, consultationId, { forUpdate: true });
    new ConsultaRepository(tx).deRegistro(c).garantirResultadoPublicado();
    const integrity = await verifyIntegrity(consultationId, "sob_demanda", tx);
    if (!integrity.passed) throw new DomainError("A verificação de integridade falhou; resolva o incidente antes de retificar.");
    const { data, baseHash, hash } = await computeResult(tx, consultationId);
    const [prev] = await tx.select().from(results).where(eq(results.consultationId, consultationId)).orderBy(desc(results.createdAt)).limit(1);
    const [r] = await tx
      .insert(results)
      .values({ consultationId, kind: "retificacao", data, hash, baseHash, note: n || prev?.note, justification: j, rectifiesId: prev?.id, createdBy: actor.id, createdAt: clock.now() })
      .returning();
    await recordPublicEvent(tx, consultationId, "retificacao", "Resultado corrigido oficialmente. O resultado original continua visível.", j, { hash });
    await audit(tx, { actorId: actor.id, actorRole: "publicacao_resultados", action: "resultado_retificado", objectType: "consulta", objectId: consultationId, justification: j });
    await notifyVoters(tx, consultationId, "resultado", `Resultado corrigido: ${c.title}`, `O resultado da consulta foi corrigido oficialmente. Justificativa: ${j}`, `/consultas/${c.slug}/resultado`);
    return r;
  });
}

/* ------------------------------------------------------------------ */
/* RF044 — Leitura pública (somente agregados)                         */
/* ------------------------------------------------------------------ */
export async function publicResults(consultationId: string, db: DbOrTx = getDb()) {
  const c = await getConsultationOrThrow(db, consultationId);
  const all = await db.select().from(results).where(eq(results.consultationId, consultationId)).orderBy(asc(results.createdAt));
  const showPreliminary = (await import("../../lib/settings")).getSetting("resultado.publicar_preliminar", db);
  const published = all.filter((r) => r.kind === "final" || r.kind === "retificacao");
  const current = published.at(-1) ?? null;
  const preliminary = (await showPreliminary) && c.status === "apurada" ? (all.filter((r) => r.kind === "preliminar").at(-1) ?? null) : null;
  return { consultation: c, current, history: published, preliminary };
}

export async function latestIntegrity(consultationId: string, db: DbOrTx = getDb()) {
  return db.select().from(integrityChecks).where(eq(integrityChecks.consultationId, consultationId)).orderBy(desc(integrityChecks.createdAt)).limit(5);
}

export async function adminResults(consultationId: string, db: DbOrTx = getDb()) {
  return db.select().from(results).where(eq(results.consultationId, consultationId)).orderBy(asc(results.createdAt));
}
