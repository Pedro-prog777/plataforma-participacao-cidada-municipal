/**
 * Comentários e perguntas (RF064 — condicionado à validação *), denúncias (RF065) e moderação (RF066).
 * A moderação nunca atua sobre votos, participações ou resultados (RN39).
 * O denunciante nunca é revelado ao autor.
 */
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { citizenProposals, commentHelpful, comments, consultations, contentReports, moderationDecisions, users } from "../../db/schema";
import { clock } from "../../lib/clock";
import { protocol } from "../../lib/crypto";
import { DomainError, NotFoundError, ValidationError } from "../../lib/errors";
import { getSetting } from "../../lib/settings";
import { sanitizePlainText } from "@/lib/text";
import { REPORT_PRIORITY, REPORT_REASONS } from "@/lib/labels";
import { audit } from "../audit/audit.service";
import { assertPermission, usersWithPermission, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";

/** Termos sinalizados para revisão humana — sem bloqueio automático (RF064). */
const FLAG_TERMS = ["idiota", "imbecil", "lixo", "vagabundo", "burro", "otario", "otário", "safado", "canalha", "corrupto"];
const PII = [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, /\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/, /[\w.+-]+@[\w-]+\.[\w.]+/];

export function shouldFlag(text: string) {
  const t = text.toLowerCase();
  return FLAG_TERMS.some((w) => t.includes(w)) || PII.some((r) => r.test(text));
}

async function targetIsPublic(db: DbOrTx, targetType: string, targetId: string) {
  if (targetType === "consultation") {
    const [c] = await db.select({ status: consultations.status, commentsEnabled: consultations.commentsEnabled }).from(consultations).where(eq(consultations.id, targetId));
    return !!c && c.commentsEnabled && ["agendada", "aberta", "suspensa", "encerrada", "apurada", "finalizada"].includes(c.status);
  }
  if (targetType === "citizen_proposal") {
    const [p] = await db.select({ status: citizenProposals.status, hidden: citizenProposals.hidden }).from(citizenProposals).where(eq(citizenProposals.id, targetId));
    return !!p && p.status === "publicada" && !p.hidden;
  }
  return false;
}

export async function postComment(userId: string, input: { targetType: "consultation" | "citizen_proposal"; targetId: string; body: string; kind: "comentario" | "pergunta" }, db: DbOrTx = getDb()) {
  if (!(await getSetting("recursos.comentarios", db))) throw new DomainError("Comentários não estão habilitados nesta versão.", "recurso_desabilitado");
  const body = sanitizePlainText(input.body ?? "");
  if (!body) throw new ValidationError({ body: ["Escreva o comentário."] });
  if (body.length > 1000) throw new ValidationError({ body: ["Máximo de 1.000 caracteres."] });
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "cidadao" || u.status !== "ativa") throw new DomainError("Apenas cidadãos com conta ativa podem comentar.");
  if (!(await targetIsPublic(db, input.targetType, input.targetId))) throw new DomainError("Comentários não estão disponíveis para este conteúdo.");
  const flagged = shouldFlag(body);
  const preModeration = await getSetting("comentarios.moderacao_previa", db);
  // Nome de exibição: nome social ou primeiro nome + inicial; nunca CPF ou e-mail.
  const parts = (u.socialName || u.fullName).split(" ");
  const displayName = parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
  const [c] = await db
    .insert(comments)
    .values({ targetType: input.targetType, targetId: input.targetId, authorId: userId, displayName, kind: input.kind, body, flagged, status: flagged && preModeration ? "pendente" : "publicado", createdAt: clock.now() })
    .returning();
  if (input.kind === "pergunta" && input.targetType === "consultation") {
    for (const r of await usersWithPermission("consultas.conduzir", db)) await notifyUser(db, r.id, { type: "conta", title: "Nova pergunta em consulta", body: body.slice(0, 200), link: `/admin/moderacao` });
  }
  await audit(db, { actorId: userId, actorRole: "cidadao", action: "comentario_publicado", objectType: input.targetType, objectId: input.targetId, details: { comentario: c.id, sinalizado: flagged } });
  return c;
}

export async function officialAnswer(actor: Actor, commentId: string, body: string, db: DbOrTx = getDb()) {
  await assertPermission(actor, "consultas.conduzir", { objectType: "comentario", objectId: commentId }, db);
  const text = sanitizePlainText(body ?? "");
  if (!text) throw new ValidationError({ body: ["Escreva a resposta."] });
  const [parent] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!parent) throw new NotFoundError();
  await db.insert(comments).values({ targetType: parent.targetType, targetId: parent.targetId, authorId: actor.id, displayName: "Resposta oficial da Prefeitura", kind: "resposta_oficial", parentId: commentId, body: text.slice(0, 1000), createdAt: clock.now() });
  await notifyUser(db, parent.authorId, { type: "respostas_propostas", title: "Sua pergunta recebeu resposta oficial", body: text.slice(0, 300) });
  await audit(db, { actorId: actor.id, actorRole: "admin", action: "resposta_oficial", objectType: "comentario", objectId: commentId });
}

export async function listComments(targetType: string, targetId: string, order: "recentes" | "uteis" = "recentes", db: DbOrTx = getDb()) {
  const rows = await db
    .select({ c: comments, helpful: sql<number>`(select count(*)::int from comment_helpful h where h.comment_id = ${comments.id})` })
    .from(comments)
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId), eq(comments.status, "publicado")))
    .orderBy(order === "uteis" ? desc(sql`(select count(*) from comment_helpful h where h.comment_id = ${comments.id})`) : desc(comments.createdAt));
  return rows;
}

export async function markHelpful(userId: string, commentId: string, db: DbOrTx = getDb()) {
  await db.insert(commentHelpful).values({ commentId, userId }).onConflictDoNothing();
}

/* ------------------------------ RF065 ------------------------------ */
export async function reportContent(userId: string, input: { targetType: "comment" | "citizen_proposal"; targetId: string; reason: string; details?: string }, db: DbOrTx = getDb()) {
  if (!(input.reason in REPORT_REASONS)) throw new ValidationError({ reason: ["Selecione o motivo."] });
  const exists =
    input.targetType === "comment"
      ? (await db.select({ id: comments.id }).from(comments).where(eq(comments.id, input.targetId))).length
      : (await db.select({ id: citizenProposals.id }).from(citizenProposals).where(and(eq(citizenProposals.id, input.targetId), eq(citizenProposals.status, "publicada")))).length;
  if (!exists) throw new NotFoundError();
  const proto = protocol("DEN");
  // Denúncia repetida do mesmo usuário: ignorada (índice único).
  const inserted = await db
    .insert(contentReports)
    .values({ protocol: proto, targetType: input.targetType, targetId: input.targetId, reporterId: userId, reason: input.reason, details: sanitizePlainText(input.details ?? "").slice(0, 500) || null, createdAt: clock.now() })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return { protocol: null, repeated: true };
  const threshold = await getSetting("denuncia.limite_ocultacao", db);
  const [{ n }] = await db.select({ n: count() }).from(contentReports).where(and(eq(contentReports.targetType, input.targetType), eq(contentReports.targetId, input.targetId), eq(contentReports.status, "pendente")));
  if (n >= threshold) {
    // Ocultação preventiva até a decisão (RF065, RS011).
    if (input.targetType === "comment") await db.update(comments).set({ status: "oculto" }).where(and(eq(comments.id, input.targetId), eq(comments.status, "publicado")));
    else await db.update(citizenProposals).set({ hidden: true }).where(eq(citizenProposals.id, input.targetId));
  }
  await audit(db, { actorId: userId, actorRole: "cidadao", action: "denuncia_registrada", objectType: input.targetType, objectId: input.targetId, details: { motivo: input.reason, protocolo: proto } });
  return { protocol: proto, repeated: false };
}

/* ------------------------------ RF066 ------------------------------ */
export async function moderationQueue(db: DbOrTx = getDb()) {
  const reports = await db.select().from(contentReports).where(eq(contentReports.status, "pendente")).orderBy(asc(contentReports.createdAt));
  const groups = new Map<string, { targetType: string; targetId: string; reasons: Record<string, number>; first: Date; priority: number; count: number }>();
  for (const r of reports) {
    const k = `${r.targetType}:${r.targetId}`;
    const g = groups.get(k) ?? { targetType: r.targetType, targetId: r.targetId, reasons: {}, first: r.createdAt, priority: 99, count: 0 };
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    g.priority = Math.min(g.priority, REPORT_PRIORITY[r.reason] ?? 9);
    g.count++;
    groups.set(k, g);
  }
  const reviews = await db.select().from(moderationDecisions).where(sql`${moderationDecisions.reviewRequestedAt} is not null`);
  const reviewed = new Set((await db.select().from(moderationDecisions).where(eq(moderationDecisions.isReview, true))).map((d) => `${d.targetType}:${d.targetId}`));
  const pendingReviews = reviews.filter((d) => !reviewed.has(`${d.targetType}:${d.targetId}`));
  const items = await Promise.all(
    [...groups.values()].sort((a, b) => a.priority - b.priority || a.first.getTime() - b.first.getTime()).map(async (g) => ({ ...g, content: await loadTarget(db, g.targetType, g.targetId) })),
  );
  const reviewItems = await Promise.all(pendingReviews.map(async (d) => ({ decision: d, content: await loadTarget(db, d.targetType, d.targetId) })));
  return { items, reviewItems };
}

async function loadTarget(db: DbOrTx, type: string, id: string) {
  if (type === "comment") {
    const [c] = await db.select().from(comments).where(eq(comments.id, id));
    return c ? { title: c.kind === "pergunta" ? "Pergunta" : "Comentário", text: c.body, authorId: c.authorId, status: c.status } : null;
  }
  const [p] = await db.select().from(citizenProposals).where(eq(citizenProposals.id, id));
  return p ? { title: `Proposta ${p.protocol}: ${p.title}`, text: `${p.problem}\n\n${p.solution}`, authorId: p.authorId, status: p.hidden ? "oculto" : "publicado" } : null;
}

export async function decideModeration(actor: Actor, input: { targetType: "comment" | "citizen_proposal"; targetId: string; decision: "manter" | "ocultar_trecho" | "remover"; justification: string; redactedText?: string }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "moderacao.moderar", { objectType: input.targetType, objectId: input.targetId }, db);
  const justification = sanitizePlainText(input.justification ?? "");
  if (!justification) throw new ValidationError({ justification: ["Justifique a decisão com base na política de uso (RN11)."] });
  if (input.decision === "ocultar_trecho" && !sanitizePlainText(input.redactedText ?? "")) throw new ValidationError({ redactedText: ["Informe o texto com o trecho ocultado."] });
  await db.transaction(async (tx) => {
    const target = await loadTarget(tx, input.targetType, input.targetId);
    if (!target) throw new NotFoundError();
    // Moderador não pode ser autor nem denunciante.
    const reporters = await tx.select({ id: contentReports.reporterId }).from(contentReports).where(and(eq(contentReports.targetType, input.targetType), eq(contentReports.targetId, input.targetId)));
    if (target.authorId === actor.id || reporters.some((r) => r.id === actor.id)) throw new DomainError("Moderador que é autor ou denunciante não pode decidir (RF066).", "conflito_moderacao");
    const previous = await tx.select().from(moderationDecisions).where(and(eq(moderationDecisions.targetType, input.targetType), eq(moderationDecisions.targetId, input.targetId))).orderBy(desc(moderationDecisions.createdAt));
    const isReview = previous.some((d) => d.reviewRequestedAt);
    if (isReview) {
      if (previous.some((d) => d.isReview)) throw new DomainError("A revisão já foi decidida em definitivo.");
      if (previous.some((d) => d.moderatorId === actor.id)) throw new DomainError("A revisão deve ser feita por outro moderador.", "conflito_moderacao");
    } else if (previous.length && !isReview) throw new DomainError("Este conteúdo já foi moderado. Aguarde eventual pedido de revisão do autor.");
    await applyDecision(tx, input.targetType, input.targetId, input.decision, sanitizePlainText(input.redactedText ?? ""));
    await tx.insert(moderationDecisions).values({ targetType: input.targetType, targetId: input.targetId, decision: input.decision, redactedText: input.redactedText ? sanitizePlainText(input.redactedText) : null, justification, moderatorId: actor.id, isReview, createdAt: clock.now() });
    await tx.update(contentReports).set({ status: "decidida" }).where(and(eq(contentReports.targetType, input.targetType), eq(contentReports.targetId, input.targetId)));
    const label = { manter: "mantido", ocultar_trecho: "publicado com trecho ocultado", remover: "removido" }[input.decision];
    await notifyUser(tx, target.authorId, {
      type: "moderacao",
      title: isReview ? "Revisão de moderação concluída (decisão definitiva)" : "Decisão de moderação sobre seu conteúdo",
      body: `Seu conteúdo foi ${label}. Justificativa: ${justification}${isReview ? "" : "\nVocê pode pedir uma revisão, que será feita por outro moderador."}`,
      link: "/conta/avisos",
    });
    await audit(tx, { actorId: actor.id, actorRole: "moderacao", action: isReview ? "moderacao_revisao" : "moderacao_decisao", objectType: input.targetType, objectId: input.targetId, justification, details: { decisao: input.decision } });
  });
}

async function applyDecision(db: DbOrTx, type: string, id: string, decision: string, redacted: string) {
  if (type === "comment") {
    if (decision === "manter") await db.update(comments).set({ status: "publicado", flagged: false }).where(eq(comments.id, id));
    if (decision === "ocultar_trecho") await db.update(comments).set({ status: "publicado", body: redacted.slice(0, 1000), flagged: false }).where(eq(comments.id, id));
    if (decision === "remover") await db.update(comments).set({ status: "removido" }).where(eq(comments.id, id));
  } else {
    if (decision === "manter") await db.update(citizenProposals).set({ hidden: false }).where(eq(citizenProposals.id, id));
    if (decision === "ocultar_trecho") await db.update(citizenProposals).set({ hidden: false, solution: redacted.slice(0, 5000) }).where(eq(citizenProposals.id, id));
    if (decision === "remover") await db.update(citizenProposals).set({ hidden: true }).where(eq(citizenProposals.id, id));
  }
}

/** Autor pede revisão (uma vez). */
export async function requestModerationReview(userId: string, decisionId: string, reason: string, db: DbOrTx = getDb()) {
  const [d] = await db.select().from(moderationDecisions).where(eq(moderationDecisions.id, decisionId));
  if (!d) throw new NotFoundError();
  const target = await loadTarget(db, d.targetType, d.targetId);
  if (!target || target.authorId !== userId) throw new NotFoundError();
  if (d.isReview || d.reviewRequestedAt) throw new DomainError("A revisão já foi solicitada ou decidida.");
  // A tabela é somente de acréscimo: o pedido é registrado como nova linha que referencia a decisão.
  await db.insert(moderationDecisions).values({ targetType: d.targetType, targetId: d.targetId, decision: d.decision, justification: d.justification, moderatorId: d.moderatorId, reviewRequestedAt: clock.now(), reviewRequestReason: sanitizePlainText(reason ?? "").slice(0, 1000), createdAt: clock.now() });
  await audit(db, { actorId: userId, actorRole: "cidadao", action: "moderacao_revisao_solicitada", objectType: d.targetType, objectId: d.targetId });
}

export async function myModerationDecisions(userId: string, db: DbOrTx = getDb()) {
  const myComments = (await db.select({ id: comments.id }).from(comments).where(eq(comments.authorId, userId))).map((c) => c.id);
  const myProps = (await db.select({ id: citizenProposals.id }).from(citizenProposals).where(eq(citizenProposals.authorId, userId))).map((p) => p.id);
  const ids = [...myComments, ...myProps];
  if (!ids.length) return [];
  return db.select({ id: moderationDecisions.id, decision: moderationDecisions.decision, justification: moderationDecisions.justification, isReview: moderationDecisions.isReview, reviewRequestedAt: moderationDecisions.reviewRequestedAt, createdAt: moderationDecisions.createdAt, targetType: moderationDecisions.targetType }).from(moderationDecisions).where(inArray(moderationDecisions.targetId, ids)).orderBy(desc(moderationDecisions.createdAt));
}
