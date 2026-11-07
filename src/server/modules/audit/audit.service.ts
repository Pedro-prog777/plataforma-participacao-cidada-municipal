/**
 * Trilha de auditoria (RF057, RF058, RNF08, RS013).
 *  - Somente acréscimo: gatilho no banco recusa UPDATE/DELETE/TRUNCATE.
 *  - Encadeada por hash: hash = SHA-256(hash anterior + JSON canônico do registro).
 *  - Nunca registra senhas, tokens, CPF, valores de campos pessoais ou conteúdo de votos.
 *  - Deve ser chamada dentro da mesma transação do ato administrativo: se a auditoria
 *    falhar, o ato é desfeito (RF057).
 */
import { and, asc, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { canonicalJson, sha256 } from "../../lib/crypto";
import { clock } from "../../lib/clock";
import { getDb, type DbOrTx } from "../../db/client";
import { auditLog } from "../../db/schema";

export const GENESIS_HASH = "0".repeat(64);
const AUDIT_LOCK = 774411;

export type AuditEntry = {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  objectType?: string | null;
  objectId?: string | null;
  result?: "sucesso" | "negado" | "falha";
  justification?: string | null;
  details?: Record<string, unknown> | null;
};

/** Campos proibidos em detalhes de auditoria (defesa contra vazamento acidental). */
const FORBIDDEN_KEYS = /senha|password|token|cpf|codigo|code|alternativ|voto|vote|choice|secret/i;

function sanitizeDetails(details?: Record<string, unknown> | null) {
  if (!details) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    out[k] = v;
  }
  return out;
}

function computeHash(prevHash: string, r: { occurredAt: Date; actorId: string | null; actorRole: string | null; action: string; objectType: string | null; objectId: string | null; result: string; justification: string | null; details: Record<string, unknown> | null }) {
  return sha256(prevHash + canonicalJson({ ...r, occurredAt: r.occurredAt.toISOString() }));
}

export async function audit(db: DbOrTx, entry: AuditEntry) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_LOCK})`);
    const [last] = await tx.select({ hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.id)).limit(1);
    const prevHash = last?.hash ?? GENESIS_HASH;
    const record = {
      occurredAt: clock.now(),
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      objectType: entry.objectType ?? null,
      objectId: entry.objectId ?? null,
      result: entry.result ?? "sucesso",
      justification: entry.justification ?? null,
      details: sanitizeDetails(entry.details),
    };
    await tx.insert(auditLog).values({ ...record, prevHash, hash: computeHash(prevHash, record) });
  });
}

/** Verifica o encadeamento completo. Retorna o primeiro registro inconsistente, se houver (RF058). */
export async function verifyAuditChain(db: DbOrTx = getDb()): Promise<{ ok: boolean; total: number; firstInvalidId: number | null; reason: string | null }> {
  const rows = await db.select().from(auditLog).orderBy(asc(auditLog.id));
  let prev = GENESIS_HASH;
  for (const r of rows) {
    if (r.prevHash !== prev) return { ok: false, total: rows.length, firstInvalidId: r.id, reason: "hash anterior não confere (registro removido ou inserido fora de ordem)" };
    const expected = computeHash(prev, {
      occurredAt: r.occurredAt,
      actorId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      objectType: r.objectType,
      objectId: r.objectId,
      result: r.result,
      justification: r.justification,
      details: (r.details as Record<string, unknown> | null) ?? null,
    });
    if (expected !== r.hash) return { ok: false, total: rows.length, firstInvalidId: r.id, reason: "conteúdo do registro foi alterado" };
    prev = r.hash;
  }
  return { ok: true, total: rows.length, firstInvalidId: null, reason: null };
}

export type AuditFilter = { from?: string; to?: string; actorId?: string; action?: string; objectType?: string; objectId?: string; result?: string };

export async function searchAudit(filter: AuditFilter, limit = 200, db: DbOrTx = getDb()) {
  const conds: SQL[] = [];
  if (filter.from) conds.push(gte(auditLog.occurredAt, new Date(`${filter.from}T00:00:00-03:00`)));
  if (filter.to) conds.push(lte(auditLog.occurredAt, new Date(`${filter.to}T23:59:59-03:00`)));
  if (filter.actorId) conds.push(eq(auditLog.actorId, filter.actorId));
  if (filter.action) conds.push(ilike(auditLog.action, `%${filter.action}%`));
  if (filter.objectType) conds.push(eq(auditLog.objectType, filter.objectType));
  if (filter.objectId) conds.push(eq(auditLog.objectId, filter.objectId));
  if (filter.result) conds.push(eq(auditLog.result, filter.result));
  return db
    .select()
    .from(auditLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(limit);
}
