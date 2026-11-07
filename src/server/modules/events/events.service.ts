/**
 * Eventos participativos e perguntas (RF068 — condicionado à validação *).
 * A plataforma não transmite vídeo: guarda apenas o link do serviço externo. O evento não
 * substitui o rito legal da audiência pública.
 */
import { asc, desc, eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { consultations, eventQuestions, participatoryEvents, users } from "../../db/schema";
import { clock } from "../../lib/clock";
import { protocol } from "../../lib/crypto";
import { DomainError, NotFoundError, ValidationError, type FieldErrors } from "../../lib/errors";
import { getSetting } from "../../lib/settings";
import { parseLocalDateTime } from "@/lib/labels";
import { sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertPermission, type Actor } from "../access/access.service";

async function enabled(db: DbOrTx) {
  if (!(await getSetting("recursos.eventos", db))) throw new DomainError("Eventos participativos não estão habilitados nesta versão.", "recurso_desabilitado");
}

export async function createEvent(actor: Actor, input: Record<string, string>, db: DbOrTx = getDb()) {
  await enabled(db);
  await assertPermission(actor, "eventos.gerenciar", {}, db);
  const errors: FieldErrors = {};
  const title = sanitizePlainText(input.title ?? "");
  const agenda = sanitizePlainText(input.agenda ?? "");
  const location = sanitizePlainText(input.location ?? "");
  const startsAt = parseLocalDateTime(input.startsAt);
  if (!title) errors.title = ["Informe o título."];
  if (!agenda) errors.agenda = ["Informe a pauta."];
  if (!location) errors.location = ["Informe o local."];
  if (!startsAt) errors.startsAt = ["Informe data e hora."];
  if (!["audiencia", "reuniao", "debate"].includes(input.kind)) errors.kind = ["Selecione o tipo."];
  if (input.streamUrl && !/^https:\/\//.test(input.streamUrl)) errors.streamUrl = ["Use um link https://."];
  const [c] = input.consultationId ? await db.select().from(consultations).where(eq(consultations.id, input.consultationId)) : [];
  if (!c) errors.consultationId = ["Selecione a consulta vinculada."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const [e] = await db
    .insert(participatoryEvents)
    .values({ consultationId: c.id, kind: input.kind, title, agenda, startsAt: startsAt!, location, streamUrl: input.streamUrl || null, createdBy: actor.id, createdAt: clock.now() })
    .returning();
  await audit(db, { actorId: actor.id, actorRole: "responsavel", action: "evento_cadastrado", objectType: "evento", objectId: e.id });
  return e;
}

export async function updateEventMaterials(actor: Actor, id: string, input: { recordingUrl?: string; minutes?: string; summary?: string; status?: string }, db: DbOrTx = getDb()) {
  await enabled(db);
  await assertPermission(actor, "eventos.gerenciar", { objectType: "evento", objectId: id }, db);
  if (input.recordingUrl && !/^https:\/\//.test(input.recordingUrl)) throw new ValidationError({ recordingUrl: ["Use um link https://."] });
  await db
    .update(participatoryEvents)
    .set({ recordingUrl: input.recordingUrl || null, minutes: sanitizePlainText(input.minutes ?? "") || null, summary: sanitizePlainText(input.summary ?? "") || null, status: ["agendado", "realizado", "transmissao_indisponivel"].includes(input.status ?? "") ? input.status : "agendado" })
    .where(eq(participatoryEvents.id, id));
  await audit(db, { actorId: actor.id, actorRole: "responsavel", action: "evento_atualizado", objectType: "evento", objectId: id });
}

export async function listEvents(db: DbOrTx = getDb()) {
  return db.select({ e: participatoryEvents, consultation: consultations.title, slug: consultations.slug }).from(participatoryEvents).innerJoin(consultations, eq(consultations.id, participatoryEvents.consultationId)).orderBy(desc(participatoryEvents.startsAt));
}

export async function getEvent(id: string, db: DbOrTx = getDb()) {
  const [e] = await db.select({ e: participatoryEvents, consultation: consultations.title, slug: consultations.slug }).from(participatoryEvents).innerJoin(consultations, eq(consultations.id, participatoryEvents.consultationId)).where(eq(participatoryEvents.id, id));
  if (!e) return null;
  const questions = await db.select({ q: eventQuestions, author: users.socialName }).from(eventQuestions).leftJoin(users, eq(users.id, eventQuestions.authorId)).where(eq(eventQuestions.eventId, id)).orderBy(asc(eventQuestions.createdAt));
  return { ...e, questions: questions.map((q) => ({ id: q.q.id, body: q.q.body, channel: q.q.channel, protocol: q.q.protocol, createdAt: q.q.createdAt })) };
}

/** Pergunta antecipada/ao vivo (cidadão) ou por telefone (atendente, com protocolo). */
export async function askQuestion(input: { eventId: string; body: string; authorId?: string | null; registeredBy?: Actor | null; channel: "antecipada" | "ao_vivo" | "telefone" }, db: DbOrTx = getDb()) {
  await enabled(db);
  if (input.channel === "telefone") await assertPermission(input.registeredBy ?? null, "atendimento.registrar", {}, db);
  const body = sanitizePlainText(input.body ?? "");
  if (!body) throw new ValidationError({ body: ["Escreva a pergunta."] });
  const [e] = await db.select().from(participatoryEvents).where(eq(participatoryEvents.id, input.eventId));
  if (!e) throw new NotFoundError();
  const proto = protocol("PERG");
  await db.insert(eventQuestions).values({ eventId: e.id, authorId: input.authorId ?? null, channel: input.channel, protocol: proto, body: body.slice(0, 1000), registeredBy: input.registeredBy?.id ?? null, createdAt: clock.now() });
  await audit(db, { actorId: input.registeredBy?.id ?? input.authorId ?? null, action: "pergunta_evento_registrada", objectType: "evento", objectId: e.id, details: { canal: input.channel, protocolo: proto } });
  return proto;
}
