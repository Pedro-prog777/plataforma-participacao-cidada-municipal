/** Inconsistências e incidentes (RF060). Suspensão sugerida depende SEMPRE de confirmação humana. */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { consultations, incidents } from "../../db/schema";
import { clock } from "../../lib/clock";
import { DomainError, ValidationError } from "../../lib/errors";
import { sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertPermission, usersWithPermission, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";

export type IncidentInput = { severity: "baixa" | "media" | "alta"; type: string; consultationId?: string | null; description: string; evidence?: Record<string, unknown> };

export async function openIncident(db: DbOrTx, input: IncidentInput) {
  let suggestion: string | null = null;
  if (input.severity === "alta" && input.consultationId) {
    const [c] = await db.select({ status: consultations.status }).from(consultations).where(eq(consultations.id, input.consultationId));
    if (c?.status === "aberta") suggestion = "Severidade alta com consulta Aberta: avalie suspender a consulta (requer confirmação humana — RF033).";
  }
  const [inc] = await db
    .insert(incidents)
    .values({ severity: input.severity, type: input.type, consultationId: input.consultationId ?? null, description: input.description, evidence: input.evidence ?? {}, suggestion, createdAt: clock.now() })
    .returning();
  await audit(db, { action: "incidente_aberto", objectType: "incidente", objectId: inc.id, details: { tipo: input.type, severidade: input.severity } });
  for (const u of await usersWithPermission("incidentes.tratar", db)) {
    await notifyUser(db, u.id, { type: "conta", title: `Alerta de integridade (${input.severity})`, body: input.description, link: `/admin/incidentes/${inc.id}` });
  }
  return inc;
}

export async function listIncidents(filter: { status?: string } = {}, db: DbOrTx = getDb()) {
  return db
    .select({ i: incidents, consultation: consultations.title })
    .from(incidents)
    .leftJoin(consultations, eq(consultations.id, incidents.consultationId))
    .where(filter.status ? eq(incidents.status, filter.status) : undefined)
    .orderBy(desc(incidents.createdAt));
}

export async function getIncident(id: string, db: DbOrTx = getDb()) {
  const [r] = await db.select({ i: incidents, consultation: consultations.title, slug: consultations.slug }).from(incidents).leftJoin(consultations, eq(consultations.id, incidents.consultationId)).where(eq(incidents.id, id));
  return r ?? null;
}

export async function registerIncident(actor: Actor, input: IncidentInput, db: DbOrTx = getDb()) {
  await assertPermission(actor, "incidentes.tratar", {}, db);
  const description = sanitizePlainText(input.description);
  if (!description) throw new ValidationError({ description: ["Descreva o incidente."] });
  return openIncident(db, { ...input, description });
}

export async function updateIncident(actor: Actor, id: string, input: { status: "em_analise" | "encerrado"; conclusion?: string }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "incidentes.tratar", { objectType: "incidente", objectId: id }, db);
  const conclusion = sanitizePlainText(input.conclusion ?? "");
  if (input.status === "encerrado" && !conclusion) throw new ValidationError({ conclusion: ["O encerramento exige conclusão justificada."] });
  await db.transaction(async (tx) => {
    const [i] = await tx.select().from(incidents).where(eq(incidents.id, id)).for("update");
    if (!i) throw new DomainError("Incidente não encontrado.");
    if (i.status === "encerrado") throw new DomainError("Incidente já encerrado.");
    await tx
      .update(incidents)
      .set({ status: input.status, conclusion: conclusion || i.conclusion, closedBy: input.status === "encerrado" ? actor.id : null, closedAt: input.status === "encerrado" ? clock.now() : null })
      .where(eq(incidents.id, id));
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: input.status === "encerrado" ? "incidente_encerrado" : "incidente_em_analise", objectType: "incidente", objectId: id, justification: conclusion || null });
  });
}

export async function openIncidentsCount(db: DbOrTx = getDb()) {
  const rows = await db.select({ id: incidents.id, consultationId: incidents.consultationId, severity: incidents.severity }).from(incidents).where(inArray(incidents.status, ["aberto", "em_analise"]));
  return rows;
}

export { and };
