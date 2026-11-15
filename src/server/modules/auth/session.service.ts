/**
 * Sessões no servidor (RF005, RF006, RN26). O cookie guarda um token aleatório; o banco guarda
 * apenas o SHA-256 do token. Expiração por inatividade (parâmetro) e absoluta (12 h).
 */
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { sessions, users } from "../../db/schema";
import { randomToken, sha256 } from "../../lib/crypto";
import { clock, HOUR, MINUTE } from "../../lib/clock";
import { getSetting } from "../../lib/settings";

export const SESSION_COOKIE = "ppcm_sessao";
export const SESSION_ABSOLUTE_MS = 12 * HOUR;

export async function createSession(db: DbOrTx, userId: string, opts: { mfaVerified: boolean; ipHash?: string; userAgent?: string }) {
  const token = randomToken(32);
  const now = clock.now();
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    mfaVerified: opts.mfaVerified,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
    ipHash: opts.ipHash,
    userAgent: opts.userAgent,
  });
  return token;
}

export type SessionInfo = { sessionId: string; userId: string; kind: "cidadao" | "admin"; mfaVerified: boolean; status: string; /** Nome de exibição (nome social, se houver). */ name: string };

/** Valida o token e renova a atividade. Retorna null se expirada, revogada ou inativa. */
export async function validateSession(token: string | undefined | null, db: DbOrTx = getDb()): Promise<SessionInfo | null> {
  if (!token || token.length > 200) return null;
  const id = sha256(token);
  const now = clock.now();
  const [row] = await db
    .select({ s: sessions, kind: users.kind, status: users.status, fullName: users.fullName, socialName: users.socialName })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
  if (!row) return null;
  if (row.status !== "ativa") return null;
  const idleMin = row.kind === "admin" ? await getSetting("sessao.inatividade_admin_minutos", db) : await getSetting("sessao.inatividade_minutos", db);
  if (now.getTime() - row.s.lastActivityAt.getTime() > idleMin * MINUTE) {
    await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, id));
    return null;
  }
  if (now.getTime() - row.s.lastActivityAt.getTime() > 30_000) {
    await db.update(sessions).set({ lastActivityAt: now }).where(eq(sessions.id, id));
  }
  return { sessionId: id, userId: row.s.userId, kind: row.kind, mfaVerified: row.s.mfaVerified, status: row.status, name: row.socialName || row.fullName };
}

/** Sessão com segundo fator ainda pendente (somente para a etapa de MFA). */
export async function getPendingMfaSession(token: string | undefined | null, db: DbOrTx = getDb()) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, clock.now()), eq(sessions.mfaVerified, false)));
  if (!row || clock.now().getTime() - row.createdAt.getTime() > 10 * MINUTE) return null;
  return row;
}

export async function markMfaVerified(db: DbOrTx, sessionId: string) {
  await db.update(sessions).set({ mfaVerified: true, lastActivityAt: clock.now() }).where(eq(sessions.id, sessionId));
}

export async function revokeSession(db: DbOrTx, token: string) {
  await db.update(sessions).set({ revokedAt: clock.now() }).where(eq(sessions.id, sha256(token)));
}

export async function revokeAllSessions(db: DbOrTx, userId: string, exceptSessionId?: string) {
  await db
    .update(sessions)
    .set({ revokedAt: clock.now() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined));
}

export async function listActiveSessions(userId: string, db: DbOrTx = getDb()) {
  return db
    .select({ id: sessions.id, createdAt: sessions.createdAt, lastActivityAt: sessions.lastActivityAt, userAgent: sessions.userAgent })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, clock.now())))
    .orderBy(desc(sessions.lastActivityAt));
}
