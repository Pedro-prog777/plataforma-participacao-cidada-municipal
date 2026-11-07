/**
 * Sessão atual na camada web (RF009). Toda página/ação protegida chama um destes guardas;
 * os serviços repetem as verificações de permissão (defesa em profundidade).
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../lib/env";
import { SESSION_ABSOLUTE_MS, SESSION_COOKIE, validateSession } from "../modules/auth/session.service";
import { can, loadActor, type Actor } from "../modules/access/access.service";
import { audit } from "../modules/audit/audit.service";
import { getDb } from "../db/client";
import { ensureDatabase } from "../db/bootstrap";
import type { Permission } from "@/lib/permissions";

export const getSession = cache(async () => {
  await ensureDatabase();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(token);
});

/** Ator autenticado (administrador só após o segundo fator). */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const s = await getSession();
  if (!s) return null;
  if (s.kind === "admin" && !s.mfaVerified) return null;
  return loadActor(s.userId);
});

export async function requireCitizen(next = "/conta"): Promise<Actor> {
  const a = await getCurrentActor();
  if (!a) redirect(`/entrar?proximo=${encodeURIComponent(next)}`);
  if (a.kind !== "cidadao") redirect("/admin");
  return a;
}

export async function requireAdmin(permission?: Permission, objectId?: string): Promise<Actor> {
  const a = await getCurrentActor();
  if (!a) redirect(`/entrar?proximo=${encodeURIComponent("/admin")}`);
  if (a.kind !== "admin") {
    await audit(getDb(), { actorId: a.id, action: "acesso_negado", result: "negado", objectType: "area", objectId: "administracao" });
    redirect("/acesso-negado");
  }
  if (permission && !can(a, permission)) {
    await audit(getDb(), { actorId: a.id, action: "acesso_negado", result: "negado", objectType: "permissao", objectId: objectId ?? permission });
    redirect("/admin/acesso-negado");
  }
  return a;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}
