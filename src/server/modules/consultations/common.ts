import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { consultationEvents, consultations, entityVersions, organs } from "../../db/schema";
import { clock } from "../../lib/clock";
import { NotFoundError } from "../../lib/errors";

export type ConsultationRow = typeof consultations.$inferSelect;

export async function getConsultationOrThrow(db: DbOrTx, id: string, opts: { forUpdate?: boolean } = {}): Promise<ConsultationRow> {
  const q = db.select().from(consultations).where(eq(consultations.id, id));
  const [c] = opts.forUpdate ? await q.for("update") : await q;
  if (!c) throw new NotFoundError("Consulta não encontrada.");
  return c;
}

/** Linha do tempo pública (RF051): data, hora, justificativa e unidade responsável. */
export async function recordPublicEvent(db: DbOrTx, consultationId: string, type: string, description: string, justification?: string | null, details?: Record<string, unknown>) {
  const [c] = await db
    .select({ organ: organs.name })
    .from(consultations)
    .leftJoin(organs, eq(organs.id, consultations.organId))
    .where(eq(consultations.id, consultationId));
  await db.insert(consultationEvents).values({
    consultationId,
    type,
    description,
    justification: justification ?? null,
    unitName: c?.organ ?? null,
    details: details ?? null,
    occurredAt: clock.now(),
  });
}

/** Snapshot dos campos editáveis para versionamento (RF024, RF032). */
export function consultationSnapshot(c: ConsultationRow) {
  const { searchText: _s, updatedAt: _u, lastShuffledAt: _l, ...rest } = c;
  return rest;
}

export async function saveVersion(db: DbOrTx, entityType: string, entityId: string, version: number, data: unknown, authorId: string | null, reason?: string) {
  await db.insert(entityVersions).values({ entityType, entityId, version, data: JSON.parse(JSON.stringify(data)), authorId, reason: reason ?? null, createdAt: clock.now() });
}

export async function listVersions(db: DbOrTx, entityType: string, entityId: string) {
  return db
    .select()
    .from(entityVersions)
    .where(and(eq(entityVersions.entityType, entityType), eq(entityVersions.entityId, entityId)))
    .orderBy(entityVersions.version, entityVersions.id);
}
