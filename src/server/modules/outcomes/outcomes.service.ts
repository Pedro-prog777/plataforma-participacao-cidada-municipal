/** Encaminhamentos (RF063; RN11, RN28, RN42). O sistema não cria compromissos: só publica o que for registrado. */
import { eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { organs, outcomeEntries, outcomes } from "../../db/schema";
import { clock } from "../../lib/clock";
import { DomainError, NotFoundError, ValidationError, type FieldErrors } from "../../lib/errors";
import { sanitizePlainText } from "@/lib/text";
import { OUTCOME_STATUS } from "@/lib/labels";
import { audit } from "../audit/audit.service";
import { assertConsultationRole, type Actor } from "../access/access.service";
import { notifyVoters } from "../notifications/dispatch";
import { getConsultationOrThrow, recordPublicEvent } from "../consultations/common";

type Status = keyof typeof OUTCOME_STATUS;

function validateEntry(status: string, justification: string, expectedDate: string | null, errors: FieldErrors) {
  if (!(status in OUTCOME_STATUS)) errors.status = ["Selecione a situação."];
  if (status === "nao_realizada" && !justification) errors.justification = ['"Não realizada" exige justificativa.'];
  if (expectedDate && !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) errors.expectedDate = ["Data inválida."];
}

export async function registerOutcome(actor: Actor, consultationId: string, input: { decision: string; actions: string; organId: string; status: string; justification?: string; expectedDate?: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, consultationId, "encaminhamentos", db);
  const decision = sanitizePlainText(input.decision ?? "");
  const actions = sanitizePlainText(input.actions ?? "");
  const justification = sanitizePlainText(input.justification ?? "");
  const expectedDate = input.expectedDate || null;
  const errors: FieldErrors = {};
  if (!decision) errors.decision = ["Informe a decisão relacionada."];
  if (!actions) errors.actions = ["Informe as providências."];
  validateEntry(input.status, justification, expectedDate, errors);
  const [organ] = input.organId ? await db.select().from(organs).where(eq(organs.id, input.organId)) : [];
  if (!organ) errors.organId = ["Selecione o órgão responsável."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, consultationId);
    // Pré-condição: resultado publicado.
    if (c.status !== "finalizada") throw new DomainError("Encaminhamentos são registrados após a publicação do resultado final.");
    const [o] = await tx.insert(outcomes).values({ consultationId, decision, actions, organId: organ.id, createdBy: actor.id, createdAt: clock.now() }).returning();
    await tx.insert(outcomeEntries).values({ outcomeId: o.id, status: input.status as Status, justification: justification || null, expectedDate, createdBy: actor.id, createdAt: clock.now() });
    await recordPublicEvent(tx, consultationId, "encaminhamento", `Encaminhamento registrado (${OUTCOME_STATUS[input.status as Status].label}): ${decision}`, justification || null);
    await audit(tx, { actorId: actor.id, actorRole: "encaminhamentos", action: "encaminhamento_registrado", objectType: "consulta", objectId: consultationId, details: { encaminhamento: o.id } });
    await notifyVoters(tx, consultationId, "encaminhamentos", `Novo encaminhamento: ${c.title}`, `${decision}\nSituação: ${OUTCOME_STATUS[input.status as Status].label}`, `/consultas/${c.slug}#encaminhamentos`);
    return o;
  });
}

/** Atualização: novo estado datado; o anterior permanece (RF063). */
export async function updateOutcomeStatus(actor: Actor, outcomeId: string, input: { status: string; justification?: string; expectedDate?: string }, db: DbOrTx = getDb()) {
  const [o] = await db.select().from(outcomes).where(eq(outcomes.id, outcomeId));
  if (!o) throw new NotFoundError();
  await assertConsultationRole(actor, o.consultationId, "encaminhamentos", db);
  const justification = sanitizePlainText(input.justification ?? "");
  const errors: FieldErrors = {};
  validateEntry(input.status, justification, input.expectedDate || null, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, o.consultationId);
    await tx.insert(outcomeEntries).values({ outcomeId, status: input.status as Status, justification: justification || null, expectedDate: input.expectedDate || null, createdBy: actor.id, createdAt: clock.now() });
    await recordPublicEvent(tx, o.consultationId, "encaminhamento", `Encaminhamento atualizado para "${OUTCOME_STATUS[input.status as Status].label}": ${o.decision}`, justification || null);
    await audit(tx, { actorId: actor.id, actorRole: "encaminhamentos", action: "encaminhamento_atualizado", objectType: "consulta", objectId: o.consultationId, details: { encaminhamento: outcomeId, situacao: input.status } });
    await notifyVoters(tx, o.consultationId, "encaminhamentos", `Encaminhamento atualizado: ${c.title}`, `${o.decision}\nNova situação: ${OUTCOME_STATUS[input.status as Status].label}`, `/consultas/${c.slug}#encaminhamentos`);
  });
}
