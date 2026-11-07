"use server";
/** Ações de cadastro e autenticação (RF001–RF008, RF046 convite). */
import { redirect } from "next/navigation";
import { acceptInvite, confirmEmail, login, registerCitizen, requestPasswordReset, resendConfirmation, resetPassword, verifySecondFactor } from "../modules/auth/auth.service";
import { revokeSession } from "../modules/auth/session.service";
import { audit } from "../modules/audit/audit.service";
import { getDb } from "../db/client";
import { createCaptcha } from "../lib/captcha";
import { clientIp, ipHash, userAgent } from "../lib/request";
import { clearSessionCookie, getSession, sessionToken, setSessionCookie } from "../auth/current";
import { ensureDatabase } from "../db/bootstrap";
import { attempt, obj, str, withValues, type FormState } from "./helpers";

function safeNext(next: string, fallback: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  await ensureDatabase();
  const r = await attempt(() => registerCitizen(obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  redirect("/entrar?ok=cadastro");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  await ensureDatabase();
  const ip = await clientIp();
  const res = await login(
    { identifier: str(fd, "identifier"), password: str(fd, "password"), captchaToken: str(fd, "captchaToken"), captchaAnswer: str(fd, "captchaAnswer") },
    { ipHash: ipHash(ip), userAgent: await userAgent() },
  );
  if (!res.ok) {
    return withValues(
      { ok: false, message: res.message, data: { captcha: res.needCaptcha ? createCaptcha() : null, pendingEmail: !!res.pendingEmail } },
      fd,
    );
  }
  await setSessionCookie(res.token);
  if (res.needsMfa) redirect("/entrar/segundo-fator");
  redirect(safeNext(str(fd, "proximo"), res.kind === "admin" ? "/admin" : "/conta"));
}

export async function mfaAction(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const token = await sessionToken();
  const r = await attempt(() => verifySecondFactor(token ?? "", str(fd, "code"), ipHash(ip)));
  if (!r.ok) return r.state;
  redirect("/admin");
}

export async function logoutAction() {
  const token = await sessionToken();
  const s = await getSession();
  if (token) await revokeSession(getDb(), token);
  if (s) await audit(getDb(), { actorId: s.userId, actorRole: s.kind, action: "logout", objectType: "usuario", objectId: s.userId });
  await clearSessionCookie();
  redirect("/entrar?ok=saiu");
}

export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const r = await attempt(() => requestPasswordReset(str(fd, "identifier"), ipHash(ip)));
  if (!r.ok) return r.state;
  return { ok: true, message: "Se houver uma conta com esses dados, enviaremos um link para redefinir a senha. O link vale por 30 minutos e só pode ser usado uma vez." };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await attempt(() => resetPassword(str(fd, "token"), str(fd, "password"), str(fd, "passwordConfirm")));
  if (!r.ok) return r.state;
  redirect("/entrar?ok=senha_redefinida");
}

export async function resendConfirmationAction(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const r = await attempt(() => resendConfirmation(str(fd, "email"), ipHash(ip)));
  if (!r.ok) return r.state;
  return { ok: true, message: "Se houver um cadastro pendente com esse e-mail, um novo link foi enviado." };
}

export async function confirmEmailAction(token: string, _: FormState): Promise<FormState> {
  const r = await attempt(() => confirmEmail(token));
  if (!r.ok) return r.state;
  redirect(r.value.kind === "troca" ? "/conta?ok=email_trocado" : "/entrar?ok=email_confirmado");
}

export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await attempt(() => acceptInvite({ token: str(fd, "token"), password: str(fd, "password"), confirm: str(fd, "confirm"), totpSecret: str(fd, "totpSecret"), totpCode: str(fd, "totpCode") }));
  if (!r.ok) return r.state;
  redirect("/entrar?ok=convite_aceito");
}
