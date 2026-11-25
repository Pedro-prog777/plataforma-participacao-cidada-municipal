/** Cadastro e autenticação — RF001–RF010; RN02, RN23–RN26, RN33; RS004, RS007. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen, PASSWORD, TOTP_SECRET } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { districts, emailOutbox, sessions, users } from "@/server/db/schema";
import { changePassword, confirmEmail, login, registerCitizen, requestPasswordReset, resetPassword, verifySecondFactor } from "@/server/modules/auth/auth.service";
import { validateSession } from "@/server/modules/auth/session.service";
import { deactivateAccount } from "@/server/modules/profile/profile.service";
import { assertPermission, loadActor } from "@/server/modules/access/access.service";
import { searchAudit } from "@/server/modules/audit/audit.service";
import { generateCpf, formatCpf } from "@/lib/cpf";
import { totp } from "@/server/lib/totp";
import { clock } from "@/server/lib/clock";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { ForbiddenError, ValidationError } from "@/server/lib/errors";

let db: Db;
let districtId: string;
beforeAll(async () => {
  db = await createTestDb();
  [{ id: districtId }] = await db.select({ id: districts.id }).from(districts).limit(1);
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

const ctx = { ipHash: "ip-teste", userAgent: "vitest" };
function form(over: Record<string, unknown> = {}) {
  const cpf = generateCpf();
  return {
    fullName: "Maria das Dores Fictícia",
    cpf: formatCpf(cpf),
    birthDate: "15/03/1988",
    email: `maria-${Math.random().toString(36).slice(2, 8)}@exemplo.test`,
    phone: "(82) 99999-0000",
    cep: "57000-000",
    street: "Rua das Flores",
    number: "100",
    district: districtId,
    password: "flor2026segura",
    passwordConfirm: "flor2026segura",
    acceptTerms: "on",
    ...over,
  };
}
const lastEmail = async (to?: string) => {
  const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt));
  return rows.find((r) => !to || r.toAddress === to)!;
};

describe("Cadastro (RF001, RF002)", () => {
  it("recusa CPF inválido e devolve TODOS os erros por campo de uma vez", async () => {
    try {
      await registerCitizen(form({ cpf: "111.111.111-11", email: "invalido", password: "abc", acceptTerms: undefined }), db);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const fe = (e as ValidationError).fieldErrors;
      expect(Object.keys(fe)).toEqual(expect.arrayContaining(["cpf", "email", "password", "acceptTerms"]));
    }
    expect(await db.select().from(users).where(eq(users.fullName, "Maria das Dores Fictícia"))).toHaveLength(0);
  });

  it("só cria conta quem tem 18 anos completos (DT-33)", async () => {
    clock.set(new Date("2026-11-25T15:00:00Z")); // 25/11/2026 12h em Brasília
    const menor = form({ birthDate: "26/11/2008" }); // 17 anos e 364 dias
    try {
      await registerCitizen(menor, db);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fieldErrors.birthDate?.join(" ")).toMatch(/18 anos completos/);
    }
    expect(await db.select().from(users).where(eq(users.email, menor.email as string))).toHaveLength(0);
    await expect(registerCitizen(form({ birthDate: "05/06/2014" }), db)).rejects.toThrow(ValidationError);
    // Completa 18 anos hoje: pode criar a conta.
    const { userId } = await registerCitizen(form({ birthDate: "25/11/2008" }), db);
    expect(userId).toBeTruthy();
  });

  it("aplica a política de senha (RN23): diferente de CPF, nascimento e e-mail", async () => {
    const f = form();
    await expect(registerCitizen({ ...f, password: "15031988", passwordConfirm: "15031988" }, db)).rejects.toThrow(ValidationError);
    await expect(registerCitizen({ ...f, password: f.email, passwordConfirm: f.email }, db)).rejects.toThrow(ValidationError);
  });

  it("cria conta pendente, guarda só hash/HMAC e não revela CPF já cadastrado", async () => {
    const f = form();
    const { userId } = await registerCitizen(f, db);
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.status).toBe("pendente");
    expect(u.verificationLevel).toBe("nao_verificado");
    expect(u.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(JSON.stringify(u)).not.toContain(f.cpf.replace(/\D/g, ""));
    expect(u.cpfMasked).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(u.termsVersion).toBe("1.0");
    // CPF repetido com outro e-mail: mensagem genérica oferecendo recuperação.
    await expect(registerCitizen({ ...form(), cpf: f.cpf }, db)).rejects.toThrow(/recupere o acesso/);
  });

  it("aceita endereço fora do município (elegibilidade verificada por consulta)", async () => {
    const { userId } = await registerCitizen(form({ district: "fora", externalCity: "Outra Cidade/XX" }), db);
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.districtId).toBeNull();
    expect(u.externalCity).toBe("Outra Cidade/XX");
  });
});

describe("Confirmação de e-mail (RF003)", () => {
  it("ativa a conta com token de uso único válido por 24 h", async () => {
    const f = form();
    const { userId } = await registerCitizen(f, db);
    const mail = await lastEmail(f.email);
    const token = mail.body.match(/token=([\w-]+)/)![1];
    expect((await confirmEmail(token, db)).kind).toBe("ativacao");
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.status).toBe("ativa");
    await expect(confirmEmail(token, db)).rejects.toThrow(/inválido, expirado ou já utilizado/);
  });

  it("recusa token expirado", async () => {
    const f = form();
    await registerCitizen(f, db);
    const token = (await lastEmail(f.email)).body.match(/token=([\w-]+)/)![1];
    clock.set(new Date(Date.now() + 25 * 3600_000));
    await expect(confirmEmail(token, db)).rejects.toThrow();
  });
});

describe("Login e tentativas (RF005, RF010, RN24, RS007)", () => {
  it("mensagem genérica para credenciais incorretas e para conta inexistente", async () => {
    const c = await createCitizen(db);
    const a = await login({ identifier: c.email, password: "errada123" }, ctx, db);
    const b = await login({ identifier: "naoexiste@exemplo.test", password: "errada123" }, ctx, db);
    expect(a).toEqual(expect.objectContaining({ ok: false, message: "CPF/e-mail ou senha incorretos." }));
    expect(b).toEqual(expect.objectContaining({ ok: false, message: "CPF/e-mail ou senha incorretos." }));
  });

  it("aceita login por CPF ou e-mail e cria sessão no servidor", async () => {
    const c = await createCitizen(db);
    const r1 = await login({ identifier: formatCpf(c.cpf), password: PASSWORD }, ctx, db);
    const r2 = await login({ identifier: c.email.toUpperCase(), password: PASSWORD }, ctx, db);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok) expect((await validateSession(r1.token, db))?.userId).toBe(c.id);
  });

  it("bloqueia por 15 minutos após 5 falhas seguidas e desbloqueia ao fim do prazo", async () => {
    const c = await createCitizen(db);
    for (let i = 0; i < 5; i++) await login({ identifier: c.email, password: "errada123" }, { ...ctx, ipHash: `ip-${i}` }, db);
    const blocked = await login({ identifier: c.email, password: PASSWORD }, ctx, db);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toMatch(/temporariamente bloqueada/);
    const audits = await searchAudit({ action: "conta_bloqueada_temporariamente", objectId: c.id }, 5, db);
    expect(audits).toHaveLength(1);
    clock.set(new Date(Date.now() + 16 * 60_000));
    expect((await login({ identifier: c.email, password: PASSWORD }, ctx, db)).ok).toBe(true);
  });

  it("exige CAPTCHA depois de muitas falhas do mesmo IP", async () => {
    for (let i = 0; i < 10; i++) await login({ identifier: `x${i}@exemplo.test`, password: "errada123" }, { ...ctx, ipHash: "ip-ataque" }, db);
    const r = await login({ identifier: "y@exemplo.test", password: "errada123" }, { ...ctx, ipHash: "ip-ataque" }, db);
    expect(r).toEqual(expect.objectContaining({ ok: false, needCaptcha: true }));
  });

  it("conta pendente informa a situação e a ação possível", async () => {
    const c = await createCitizen(db, { status: "pendente" });
    const r = await login({ identifier: c.email, password: PASSWORD }, ctx, db);
    expect(r).toEqual(expect.objectContaining({ ok: false, pendingEmail: true }));
  });

  it("contas administrativas exigem segundo fator (TOTP)", async () => {
    const admin = await createAdmin(db, ["moderacao"]);
    const [u] = await db.select().from(users).where(eq(users.id, admin.id));
    const r = await login({ identifier: u.email, password: PASSWORD }, ctx, db);
    expect(r.ok && r.needsMfa).toBe(true);
    if (!r.ok) return;
    expect(await validateSession(r.token, db)).toEqual(expect.objectContaining({ mfaVerified: false }));
    await expect(verifySecondFactor(r.token, "000000", ctx.ipHash, db)).rejects.toThrow(/inválido/);
    await verifySecondFactor(r.token, totp(TOTP_SECRET), ctx.ipHash, db);
    expect(await validateSession(r.token, db)).toEqual(expect.objectContaining({ mfaVerified: true }));
  });

  it("sessão expira por inatividade (RN26)", async () => {
    const c = await createCitizen(db);
    const r = await login({ identifier: c.email, password: PASSWORD }, ctx, db);
    if (!r.ok) throw new Error("login");
    clock.set(new Date(Date.now() + 31 * 60_000));
    expect(await validateSession(r.token, db)).toBeNull();
  });
});

describe("Recuperação e alteração de senha (RF007, RF008, RN25)", () => {
  it("resposta genérica, link de uso único válido por 30 minutos e encerramento das sessões", async () => {
    const c = await createCitizen(db);
    const session = await login({ identifier: c.email, password: PASSWORD }, ctx, db);
    await requestPasswordReset(c.email, "ip-r", db);
    await requestPasswordReset("ninguem@exemplo.test", "ip-r", db); // não lança, não revela
    const token = (await lastEmail(c.email)).body.match(/token=([\w-]+)/)![1];
    await resetPassword(token, "novaSenha99", "novaSenha99", db);
    if (session.ok) expect(await validateSession(session.token, db)).toBeNull();
    await expect(resetPassword(token, "outraSenha99", "outraSenha99", db)).rejects.toThrow(/inválido, expirado ou já utilizado/);
    expect((await login({ identifier: c.email, password: "novaSenha99" }, ctx, db)).ok).toBe(true);
  });

  it("link expira após 30 minutos", async () => {
    const c = await createCitizen(db);
    await requestPasswordReset(c.email, "ip-r2", db);
    const token = (await lastEmail(c.email)).body.match(/token=([\w-]+)/)![1];
    clock.set(new Date(Date.now() + 31 * 60_000));
    await expect(resetPassword(token, "novaSenha99", "novaSenha99", db)).rejects.toThrow();
  });

  it("senha atual incorreta conta como falha (RF010)", async () => {
    const c = await createCitizen(db);
    await expect(changePassword(c.id, "s", { current: "errada", password: "novaSenha1", confirm: "novaSenha1" }, "ip", db)).rejects.toThrow(/incorreta/);
    const [u] = await db.select().from(users).where(eq(users.id, c.id));
    expect(u.failedLoginCount).toBe(1);
  });
});

describe("Controle de acesso (RF009) e desativação (RF015, RN33)", () => {
  it("nega operação sem permissão, não altera nada e audita a tentativa", async () => {
    const mod = await createAdmin(db, ["moderacao"]);
    await expect(assertPermission(mod, "usuarios.gerenciar", {}, db)).rejects.toBeInstanceOf(ForbiddenError);
    const c = await createCitizen(db);
    const citizenActor = await loadActor(c.id, db);
    await expect(assertPermission(citizenActor, "consultas.aprovar", {}, db)).rejects.toBeInstanceOf(ForbiddenError);
    const denied = await searchAudit({ action: "acesso_negado" }, 10, db);
    expect(denied.length).toBeGreaterThanOrEqual(2);
  });

  it("desativação anonimiza dados pessoais, encerra sessões e mantém o HMAC do CPF", async () => {
    const c = await createCitizen(db);
    const r = await login({ identifier: c.email, password: PASSWORD }, ctx, db);
    await deactivateAccount(c.id, PASSWORD, "DESATIVAR", "ip", db);
    const [u] = await db.select().from(users).where(eq(users.id, c.id));
    expect(u.status).toBe("desativada");
    expect(u.fullName).toBe("Titular anonimizado");
    expect(u.phone).toBeNull();
    expect(u.street).toBeNull();
    expect(u.cpfHmac).toBeTruthy();
    if (r.ok) expect(await validateSession(r.token, db)).toBeNull();
    const active = await db.select().from(sessions).where(eq(sessions.userId, c.id));
    expect(active.every((s) => s.revokedAt)).toBe(true);
    // Mesmo CPF não consegue novo cadastro (RN33).
    await expect(registerCitizen(form({ cpf: formatCpf(c.cpf) }), db)).rejects.toThrow(/recupere o acesso/);
  });
});
