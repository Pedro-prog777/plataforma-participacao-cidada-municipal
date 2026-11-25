/**
 * Cadastro e autenticação (RF001, RF002, RF003, RF005, RF007, RF008, RF010, RF046-convite).
 */
import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "../../db/client";
import { authFailures, districts, organs, tokens, users } from "../../db/schema";
import { isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { cpfHmac, decrypt, encrypt, randomToken, sha256 } from "../../lib/crypto";
import { clock, HOUR, MINUTE } from "../../lib/clock";
import { DomainError, parseOrThrow, ValidationError, type FieldErrors } from "../../lib/errors";
import { dummyVerify, hashPassword, passwordPolicyErrors, verifyPassword } from "../../lib/password";
import { getSetting } from "../../lib/settings";
import { hit } from "../../lib/rate-limit";
import { verifyCaptcha } from "../../lib/captcha";
import { generateTotpSecret, verifyTotp } from "../../lib/totp";
import { audit } from "../audit/audit.service";
import { notifyUser, queueEmail } from "../notifications/notifications.service";
import { createSession, getPendingMfaSession, markMfaVerified, revokeAllSessions } from "./session.service";
import { IDADE_MINIMA, temIdadeMinima } from "../voting/eligibility";
import { env } from "../../lib/env";

/* ------------------------------------------------------------------ */
/* Validação cadastral (RF002)                                         */
/* ------------------------------------------------------------------ */
const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} é obrigatório.` })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(min, `${label} é obrigatório.`).max(max, `${label}: máximo de ${max} caracteres.`));

export const birthDateSchema = z
  .string({ error: "Informe a data de nascimento." })
  .trim()
  .transform((v, ctx) => {
    let iso = v;
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = m ? new Date(`${iso}T12:00:00Z`) : null;
    if (!m || !d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
      ctx.addIssue({ code: "custom", message: "Data inválida. Use DD/MM/AAAA." });
      return z.NEVER;
    }
    if (d > clock.now() || Number(m[1]) < 1900) {
      ctx.addIssue({ code: "custom", message: "Informe uma data de nascimento válida." });
      return z.NEVER;
    }
    return iso;
  });

/**
 * Data de nascimento de quem tem 18 anos completos: a plataforma é só para maiores de idade (DT-33).
 * A regra de idade vem de `voting/eligibility.ts` (fonte única, também usada no voto).
 */
export function adultBirthDateSchema(message = `É preciso ter ${IDADE_MINIMA} anos completos para criar uma conta.`) {
  return birthDateSchema.refine((iso) => typeof iso !== "string" || temIdadeMinima(iso), message);
}

const phoneSchema = z
  .string()
  .optional()
  .transform((v) => onlyDigits(v ?? ""))
  .refine((d) => d === "" || d.length === 10 || d.length === 11, "Celular inválido. Use (XX) XXXXX-XXXX.")
  .transform((d) => (d ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : null));

export const addressSchema = z.object({
  cep: z
    .string({ error: "Informe o CEP." })
    .transform(onlyDigits)
    .refine((d) => d.length === 8, "CEP inválido. Use XXXXX-XXX.")
    .transform((d) => `${d.slice(0, 5)}-${d.slice(5)}`),
  street: trimmed(2, 150, "Logradouro"),
  number: trimmed(1, 10, "Número"),
  complement: z.string().optional().transform((v) => v?.trim() || null),
  district: z.string({ error: "Selecione o bairro." }).min(1, "Selecione o bairro."),
  externalCity: z.string().optional().transform((v) => v?.trim() || null),
});

export const emailSchema = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email("E-mail inválido. Use o formato nome@dominio.com.").max(254));

const registrationSchema = z
  .object({
    fullName: trimmed(3, 150, "Nome completo"),
    cpf: z.string({ error: "Informe o CPF." }).refine(isValidCpf, "CPF inválido (confira os dígitos)."),
    birthDate: adultBirthDateSchema(),
    email: emailSchema,
    phone: phoneSchema,
    password: z.string({ error: "Informe a senha." }),
    passwordConfirm: z.string({ error: "Confirme a senha." }),
    acceptTerms: z.literal("on", { error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }),
  })
  .and(addressSchema);

async function resolveDistrict(db: DbOrTx, district: string, externalCity: string | null, errors: FieldErrors) {
  if (district === "fora") {
    if (!externalCity) errors.externalCity = ["Informe o município onde você reside."];
    return null;
  }
  const [d] = await db.select({ id: districts.id }).from(districts).where(eq(districts.id, district));
  if (!d) errors.district = ["Bairro inválido."];
  return d?.id ?? null;
}

export async function registerCitizen(input: Record<string, unknown>, db: DbOrTx = getDb()) {
  const result = registrationSchema.safeParse(input);
  const errors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) (errors[String(issue.path[0] ?? "_")] ??= []).push(issue.message);
  }
  // Política de senha (RN23) — validada mesmo que outros campos falhem, para devolver tudo de uma vez.
  const pw = String(input.password ?? "");
  const pwErrors = passwordPolicyErrors(pw, { cpf: String(input.cpf ?? ""), birthDate: result.success ? result.data.birthDate : undefined, email: String(input.email ?? "") });
  if (pwErrors.length) errors.password = [...(errors.password ?? []), ...pwErrors];
  if (pw !== String(input.passwordConfirm ?? "")) errors.passwordConfirm = ["As senhas não conferem."];
  if (!result.success || Object.keys(errors).length) throw new ValidationError(errors);
  const data = result.data;
  const districtId = await resolveDistrict(db, data.district, data.externalCity, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const cpf = onlyDigits(data.cpf);
  const hmacValue = cpfHmac(cpf);
  // Unicidade (RN02): CPF entre todas as contas (inclusive desativadas — RN33) e e-mail entre cidadãos.
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.cpfHmac, hmacValue), and(eq(users.kind, "cidadao"), eq(users.email, data.email))))
    .limit(1);
  if (dup) {
    // Não revela qual dado existe nem se a conta existe (RF001): oferece recuperação de acesso.
    throw new DomainError("Não foi possível concluir o cadastro com estes dados. Se você já possui conta, recupere o acesso.", "cadastro_existente");
  }

  const termsVersion = await getSetting("termos.versao", db);
  const passwordHash = await hashPassword(pw);
  const now = clock.now();
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        kind: "cidadao",
        fullName: data.fullName,
        email: data.email,
        cpfHmac: hmacValue,
        cpfMasked: maskCpf(cpf),
        birthDate: data.birthDate,
        phone: data.phone,
        cep: data.cep,
        street: data.street,
        number: data.number,
        complement: data.complement,
        districtId,
        externalCity: districtId ? null : data.externalCity,
        passwordHash,
        status: "pendente",
        verificationLevel: "nao_verificado",
        termsVersion,
        termsAcceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });
    await sendEmailConfirmation(tx, u.id, data.email);
    await audit(tx, { actorId: u.id, actorRole: "cidadao", action: "cadastro_cidadao", objectType: "usuario", objectId: u.id, details: { versaoTermos: termsVersion } });
    return u.id;
  });
  return { userId };
}

async function issueToken(db: DbOrTx, userId: string, purpose: string, ttlMs: number, meta?: Record<string, unknown>) {
  const token = randomToken(32);
  await db.insert(tokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(clock.now().getTime() + ttlMs), meta });
  return token;
}

async function consumeToken(db: DbOrTx, token: string, purpose: string) {
  if (!token || token.length > 200) return null;
  const now = clock.now();
  const [t] = await db
    .select()
    .from(tokens)
    .where(and(eq(tokens.tokenHash, sha256(token)), eq(tokens.purpose, purpose), isNull(tokens.usedAt), gt(tokens.expiresAt, now)));
  if (!t) return null;
  // Uso único: marca como usado de forma atômica.
  const updated = await db
    .update(tokens)
    .set({ usedAt: now })
    .where(and(eq(tokens.id, t.id), isNull(tokens.usedAt)))
    .returning({ id: tokens.id });
  return updated.length ? t : null;
}

/* ------------------------------------------------------------------ */
/* Confirmação de e-mail (RF003)                                       */
/* ------------------------------------------------------------------ */
export async function sendEmailConfirmation(db: DbOrTx, userId: string, email: string, purpose = "confirmar_email") {
  const token = await issueToken(db, userId, purpose, 24 * HOUR);
  await queueEmail(
    db,
    email,
    "Confirme seu e-mail — Participação Cidadã",
    `Olá! Para ${purpose === "confirmar_email" ? "ativar sua conta" : "confirmar seu novo e-mail"}, acesse o link abaixo (válido por 24 horas e de uso único):\n\n${env.appUrl}/confirmar-email?token=${token}\n\nSe você não fez esta solicitação, ignore esta mensagem.`,
  );
}

export async function confirmEmail(token: string, db: DbOrTx = getDb()) {
  return db.transaction(async (tx) => {
    const t = (await consumeToken(tx, token, "confirmar_email")) ?? (await consumeToken(tx, token, "trocar_email"));
    if (!t) throw new DomainError("Link inválido, expirado ou já utilizado. Solicite um novo link.", "token_invalido");
    const [u] = await tx.select().from(users).where(eq(users.id, t.userId));
    if (!u) throw new DomainError("Conta não encontrada.");
    const now = clock.now();
    if (t.purpose === "trocar_email") {
      const newEmail = (t.meta?.email as string) || u.pendingEmail;
      if (!newEmail) throw new DomainError("Solicitação de troca de e-mail inválida.");
      const oldEmail = u.email;
      await tx.update(users).set({ email: newEmail, pendingEmail: null, emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, u.id));
      // RF013: o endereço anterior é avisado.
      await queueEmail(tx, oldEmail, "Seu e-mail foi alterado", `O e-mail da sua conta na Plataforma de Participação Cidadã foi alterado. Se não foi você, entre em contato com a Prefeitura.`);
      await audit(tx, { actorId: u.id, actorRole: u.kind, action: "email_alterado", objectType: "usuario", objectId: u.id });
      return { kind: "troca" as const };
    }
    await tx
      .update(users)
      .set({ status: u.status === "pendente" ? "ativa" : u.status, emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, u.id));
    await audit(tx, { actorId: u.id, actorRole: u.kind, action: "email_confirmado", objectType: "usuario", objectId: u.id });
    return { kind: "ativacao" as const };
  });
}

/** Reenvio limitado a 3 por hora, sem revelar se o e-mail existe (RF003). */
export async function resendConfirmation(emailInput: string, ip: string, db: DbOrTx = getDb()) {
  const email = String(emailInput || "").trim().toLowerCase();
  if (hit(`reenvio:${email}`, HOUR) > 3 || hit(`reenvio-ip:${ip}`, HOUR) > 10) {
    throw new DomainError("Limite de reenvios atingido. Tente novamente em uma hora.", "limite");
  }
  const [u] = await db.select().from(users).where(and(eq(users.email, email), eq(users.kind, "cidadao"), eq(users.status, "pendente")));
  if (u) await sendEmailConfirmation(db, u.id, u.email);
}

/* ------------------------------------------------------------------ */
/* Login, segundo fator e tentativas (RF005, RF010, RN24)              */
/* ------------------------------------------------------------------ */
export type LoginResult =
  | { ok: true; token: string; needsMfa: boolean; kind: "cidadao" | "admin" }
  | { ok: false; message: string; needCaptcha?: boolean; pendingEmail?: boolean };

const GENERIC_LOGIN_ERROR = "CPF/e-mail ou senha incorretos.";

async function ipFailures(db: DbOrTx, ipH: string) {
  const [r] = await db
    .select({ n: count() })
    .from(authFailures)
    .where(and(eq(authFailures.ipHash, ipH), gt(authFailures.createdAt, new Date(clock.now().getTime() - HOUR))));
  return r?.n ?? 0;
}

export async function requiresCaptcha(ipH: string, db: DbOrTx = getDb()) {
  return (await ipFailures(db, ipH)) >= (await getSetting("login.captcha_falhas_ip", db));
}

/** Registra falha por conta e IP; bloqueia a conta no limite (RF010). */
export async function recordAuthFailure(db: DbOrTx, userId: string | null, ipH: string, reason: string) {
  await db.insert(authFailures).values({ userId, ipHash: ipH, createdAt: clock.now() });
  if (!userId) {
    await audit(db, { action: "login_falha", result: "falha", objectType: "conta", objectId: null, details: { motivo: reason } });
    return;
  }
  const [u] = await db.select({ failed: users.failedLoginCount, kind: users.kind }).from(users).where(eq(users.id, userId));
  const max = await getSetting("login.max_falhas", db);
  const failed = (u?.failed ?? 0) + 1;
  if (failed >= max) {
    const minutes = await getSetting("login.bloqueio_minutos", db);
    const until = new Date(clock.now().getTime() + minutes * MINUTE);
    await db.update(users).set({ failedLoginCount: 0, lockedUntil: until }).where(eq(users.id, userId));
    await audit(db, { actorId: userId, actorRole: u?.kind, action: "conta_bloqueada_temporariamente", result: "falha", objectType: "usuario", objectId: userId, details: { minutos: minutes } });
    await notifyUser(db, userId, {
      type: "conta",
      title: "Sua conta foi bloqueada temporariamente",
      body: `Detectamos ${max} tentativas de acesso sem sucesso. Por segurança, a conta ficará bloqueada por ${minutes} minutos. Se não foi você, recomendamos redefinir sua senha.`,
      link: "/recuperar-senha",
    });
  } else {
    await db.update(users).set({ failedLoginCount: failed }).where(eq(users.id, userId));
    await audit(db, { actorId: userId, actorRole: u?.kind, action: "login_falha", result: "falha", objectType: "usuario", objectId: userId, details: { motivo: reason } });
  }
}

export async function login(
  input: { identifier: string; password: string; captchaToken?: string; captchaAnswer?: string },
  ctx: { ipHash: string; userAgent: string },
  db: DbOrTx = getDb(),
): Promise<LoginResult> {
  const identifier = String(input.identifier || "").trim();
  const password = String(input.password || "");
  if (!identifier || !password) return { ok: false, message: "Informe CPF ou e-mail e a senha." };

  if (await requiresCaptcha(ctx.ipHash, db)) {
    if (!verifyCaptcha(input.captchaToken, input.captchaAnswer)) {
      return { ok: false, message: "Muitas tentativas a partir desta rede. Responda à verificação abaixo.", needCaptcha: true };
    }
  }

  const digits = onlyDigits(identifier);
  const candidates =
    !identifier.includes("@") && digits.length === 11 && isValidCpf(digits)
      ? await db.select().from(users).where(eq(users.cpfHmac, cpfHmac(digits)))
      : await db.select().from(users).where(eq(users.email, identifier.toLowerCase()));

  const now = clock.now();
  let matched: (typeof candidates)[number] | null = null;
  for (const u of candidates) {
    if (u.status === "desativada") continue;
    if (u.lockedUntil && u.lockedUntil > now) {
      const at = u.lockedUntil.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      await audit(db, { actorId: u.id, actorRole: u.kind, action: "login_bloqueado", result: "negado", objectType: "usuario", objectId: u.id });
      return { ok: false, message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente após ${at} ou redefina sua senha.` };
    }
    if (await verifyPassword(u.passwordHash, password)) {
      matched = u;
      break;
    }
  }
  if (!matched) {
    if (!candidates.length) await dummyVerify(password);
    const target = candidates.find((c) => c.status !== "desativada");
    await recordAuthFailure(db, target?.id ?? null, ctx.ipHash, "credenciais_invalidas");
    return { ok: false, message: GENERIC_LOGIN_ERROR, needCaptcha: await requiresCaptcha(ctx.ipHash, db) };
  }
  const u = matched;
  if (u.status === "pendente") {
    return u.kind === "cidadao"
      ? { ok: false, message: "Sua conta ainda não foi ativada. Confirme seu e-mail pelo link enviado ou peça um novo link.", pendingEmail: true }
      : { ok: false, message: "Conta administrativa ainda não ativada. Conclua o convite recebido por e-mail." };
  }
  if (u.status === "bloqueada") return { ok: false, message: "Esta conta está bloqueada pela administração. Procure o atendimento da Prefeitura." };

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }).where(eq(users.id, u.id));
  const needsMfa = u.kind === "admin";
  const token = await createSession(db, u.id, { mfaVerified: !needsMfa, ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await audit(db, { actorId: u.id, actorRole: u.kind, action: needsMfa ? "login_senha_ok_aguardando_2fa" : "login", objectType: "usuario", objectId: u.id });
  return { ok: true, token, needsMfa, kind: u.kind };
}

/** Segundo fator (TOTP) das contas administrativas (RF005, RS006). */
export async function verifySecondFactor(sessionToken: string, code: string, ipH: string, db: DbOrTx = getDb()) {
  const s = await getPendingMfaSession(sessionToken, db);
  if (!s) throw new DomainError("Sessão de login expirada. Entre novamente.", "sessao_expirada");
  const [u] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!u?.mfaSecretEnc) throw new DomainError("Segundo fator não configurado para esta conta.");
  if (!verifyTotp(decrypt(u.mfaSecretEnc), code)) {
    await recordAuthFailure(db, u.id, ipH, "segundo_fator_invalido");
    throw new DomainError("Código de verificação inválido.", "mfa_invalido");
  }
  await markMfaVerified(db, s.id);
  await audit(db, { actorId: u.id, actorRole: "admin", action: "login", objectType: "usuario", objectId: u.id, details: { segundoFator: true } });
}

/* ------------------------------------------------------------------ */
/* Recuperação e alteração de senha (RF007, RF008, RN25)               */
/* ------------------------------------------------------------------ */
export async function requestPasswordReset(identifier: string, ip: string, db: DbOrTx = getDb()) {
  const id = String(identifier || "").trim();
  if (hit(`recuperar:${id.toLowerCase()}`, HOUR) > 3 || hit(`recuperar-ip:${ip}`, HOUR) > 10) {
    throw new DomainError("Limite de solicitações atingido. Tente novamente em uma hora.", "limite");
  }
  const digits = onlyDigits(id);
  const rows =
    !id.includes("@") && digits.length === 11 && isValidCpf(digits)
      ? await db.select().from(users).where(eq(users.cpfHmac, cpfHmac(digits)))
      : await db.select().from(users).where(eq(users.email, id.toLowerCase()));
  for (const u of rows.filter((r) => r.status === "ativa" || r.status === "pendente")) {
    const token = await issueToken(db, u.id, "recuperar_senha", 30 * MINUTE);
    await queueEmail(
      db,
      u.email,
      "Redefinição de senha — Participação Cidadã",
      `Recebemos um pedido para redefinir sua senha. Use o link abaixo em até 30 minutos (uso único):\n\n${env.appUrl}/redefinir-senha?token=${token}\n\nSe não foi você, ignore esta mensagem — sua senha continua a mesma.`,
    );
    await audit(db, { actorId: u.id, actorRole: u.kind, action: "recuperacao_senha_solicitada", objectType: "usuario", objectId: u.id });
  }
  // Resposta sempre genérica, exista ou não a conta (RF007).
}

export async function resetPassword(token: string, password: string, confirm: string, db: DbOrTx = getDb()) {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tokens)
      .where(and(eq(tokens.tokenHash, sha256(token || "")), eq(tokens.purpose, "recuperar_senha"), isNull(tokens.usedAt), gt(tokens.expiresAt, clock.now())));
    if (!t) throw new DomainError("Link inválido, expirado ou já utilizado. Faça uma nova solicitação.", "token_invalido");
    const [u] = await tx.select().from(users).where(eq(users.id, t.userId));
    const errs = passwordPolicyErrors(password, { email: u.email, birthDate: u.birthDate ?? undefined });
    if (password !== confirm) throw new ValidationError({ passwordConfirm: ["As senhas não conferem."] });
    if (errs.length) throw new ValidationError({ password: errs });
    if (!(await consumeToken(tx, token, "recuperar_senha"))) throw new DomainError("Link já utilizado.", "token_invalido");
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null, updatedAt: clock.now() })
      .where(eq(users.id, u.id));
    await revokeAllSessions(tx, u.id);
    await notifyUser(tx, u.id, { type: "conta", title: "Sua senha foi redefinida", body: "A senha da sua conta foi redefinida e todas as sessões foram encerradas. Se não foi você, procure a Prefeitura imediatamente." });
    await audit(tx, { actorId: u.id, actorRole: u.kind, action: "senha_redefinida", objectType: "usuario", objectId: u.id });
  });
}

export async function changePassword(userId: string, sessionId: string, input: { current: string; password: string; confirm: string }, ipH: string, db: DbOrTx = getDb()) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new DomainError("Conta não encontrada.");
  if (!(await verifyPassword(u.passwordHash, input.current || ""))) {
    await recordAuthFailure(db, u.id, ipH, "senha_atual_incorreta");
    throw new ValidationError({ current: ["Senha atual incorreta."] });
  }
  const errs = passwordPolicyErrors(input.password || "", { email: u.email, birthDate: u.birthDate ?? undefined });
  const fe: FieldErrors = {};
  if (errs.length) fe.password = errs;
  if (input.password !== input.confirm) fe.confirm = ["As senhas não conferem."];
  if (input.password === input.current) (fe.password ??= []).push("A nova senha deve ser diferente da atual.");
  if (Object.keys(fe).length) throw new ValidationError(fe);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(input.password), updatedAt: clock.now() }).where(eq(users.id, u.id));
    await revokeAllSessions(tx, u.id, sessionId);
    await notifyUser(tx, u.id, { type: "conta", title: "Senha alterada", body: "A senha da sua conta foi alterada e as demais sessões foram encerradas." });
    await audit(tx, { actorId: u.id, actorRole: u.kind, action: "senha_alterada", objectType: "usuario", objectId: u.id });
  });
}

/* ------------------------------------------------------------------ */
/* Convite de conta administrativa (RF046)                             */
/* ------------------------------------------------------------------ */
export async function createInvite(db: DbOrTx, userId: string, email: string) {
  const token = await issueToken(db, userId, "convite", 72 * HOUR);
  await queueEmail(
    db,
    email,
    "Convite — conta administrativa da Plataforma de Participação Cidadã",
    `Você foi convidado(a) para uma conta administrativa. Defina sua senha e o segundo fator em até 72 horas:\n\n${env.appUrl}/convite?token=${token}`,
  );
  return token;
}

export async function inspectInvite(token: string, db: DbOrTx = getDb()) {
  const [t] = await db
    .select({ userId: tokens.userId, name: users.fullName, email: users.email, organ: organs.name })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .leftJoin(organs, eq(organs.id, users.organId))
    .where(and(eq(tokens.tokenHash, sha256(token || "")), eq(tokens.purpose, "convite"), isNull(tokens.usedAt), gt(tokens.expiresAt, clock.now())));
  return t ?? null;
}

export function newTotpEnrollment() {
  return generateTotpSecret();
}

export async function acceptInvite(input: { token: string; password: string; confirm: string; totpSecret: string; totpCode: string }, db: DbOrTx = getDb()) {
  const inv = await inspectInvite(input.token, db);
  if (!inv) throw new DomainError("Convite inválido, expirado ou já utilizado.", "token_invalido");
  const fe: FieldErrors = {};
  const errs = passwordPolicyErrors(input.password, { email: inv.email });
  if (errs.length) fe.password = errs;
  if (input.password !== input.confirm) fe.confirm = ["As senhas não conferem."];
  if (!/^[A-Z2-7]{32}$/.test(input.totpSecret) || !verifyTotp(input.totpSecret, input.totpCode)) fe.totpCode = ["Código do aplicativo autenticador inválido."];
  if (Object.keys(fe).length) throw new ValidationError(fe);
  await db.transaction(async (tx) => {
    if (!(await consumeToken(tx, input.token, "convite"))) throw new DomainError("Convite já utilizado.");
    const now = clock.now();
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(input.password), mfaSecretEnc: encrypt(input.totpSecret), mfaEnabledAt: now, status: "ativa", emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, inv.userId));
    await audit(tx, { actorId: inv.userId, actorRole: "admin", action: "convite_aceito", objectType: "usuario", objectId: inv.userId, details: { segundoFator: "totp" } });
  });
}

export const _test = { registrationSchema, consumeToken, issueToken };
export { parseOrThrow };
