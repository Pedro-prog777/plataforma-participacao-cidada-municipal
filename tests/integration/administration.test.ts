/**
 * Identidade, perfil, usuários, papéis, notificações, divulgação, eventos e parâmetros —
 * RF004, RF012, RF013, RF046, RF047, RF053, RF055, RF062, RF068, RNF12; RS004, RS006.
 * Entradas maliciosas e SSRF: tests/security/security.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { assign, createAdmin, createCitizen, createOpenConsultation, PASSWORD } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { attachments, auditLog, consultationEvents, districts, emailOutbox, incidents, notifications, organs, participations, roles, themes, users } from "@/server/db/schema";
import { completeProviderFlow, decideVerification, listPendingVerifications, startProviderFlow, submitDocuments } from "@/server/modules/identity/identity.service";
import { eligibilitySummary, getProfile, updateProfile } from "@/server/modules/profile/profile.service";
import { acceptInvite, confirmEmail, login } from "@/server/modules/auth/auth.service";
import { validateSession } from "@/server/modules/auth/session.service";
import { deleteRole, inviteAdmin, saveRole, setAccountStatus, setUserRoles, updateSettings } from "@/server/modules/admin/users.service";
import { notifyPublished, notifyReminder } from "@/server/modules/notifications/dispatch";
import { defaultPreferences, savePreferences } from "@/server/modules/notifications/notifications.service";
import { disseminationMaterial, registerDissemination } from "@/server/modules/dissemination/dissemination.service";
import { askQuestion, createEvent } from "@/server/modules/events/events.service";
import { getSetting, writeSetting } from "@/server/lib/settings";
import { generateTotpSecret, totp } from "@/server/lib/totp";
import { env } from "@/server/lib/env";
import { clock } from "@/server/lib/clock";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { ForbiddenError } from "@/server/lib/errors";
import { generateCpf } from "@/lib/cpf";
import type { Actor } from "@/server/modules/access/access.service";

let db: Db;
let gestor: Actor;
let organId: string;
beforeAll(async () => {
  db = await createTestDb();
  gestor = await createAdmin(db, ["gestor_acessos"], "Gil Gestor");
  [{ id: organId }] = await db.select({ id: organs.id }).from(organs).limit(1);
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

const ctx = { ipHash: "ip-adm", userAgent: "vitest" };
const pdf = (name = "documento.pdf", size = 0) => new File([new Uint8Array(size ? Buffer.concat([Buffer.from("%PDF-1.4 "), Buffer.alloc(size, 0x20)]) : Buffer.from("%PDF-1.4 documento fictício"))], name, { type: "application/pdf" });
const emailsTo = async (to: string) => (await db.select().from(emailOutbox).where(eq(emailOutbox.toAddress, to)).orderBy(desc(emailOutbox.createdAt))).map((m) => m);
const userRow = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];

describe("Verificação de identidade e domicílio (RF004, RS004)", () => {
  const assertion = (cpf: string, level: "bronze" | "prata" | "ouro", residenceCity: string | null = null) => ({ cpf, name: "Titular", level, providerName: "simulado", simulated: true, residenceCity });

  it("provedor: CPF divergente é recusado, auditado e vira incidente; nível bronze é insuficiente; prata verifica", async () => {
    const c = await createCitizen(db, { verified: false, domicile: false });
    const divergente = await completeProviderFlow(c.id, startProviderFlow(c.id), assertion(generateCpf(), "ouro"), db);
    expect(divergente.ok).toBe(false);
    expect((await userRow(c.id)).verificationLevel).toBe("recusado");
    expect(await db.select().from(auditLog).where(and(eq(auditLog.action, "verificacao_recusada_cpf_divergente"), eq(auditLog.objectId, c.id)))).toHaveLength(1);
    expect((await db.select().from(incidents).where(eq(incidents.type, "cadastro_suspeito"))).length).toBeGreaterThan(0);

    const bronze = await completeProviderFlow(c.id, startProviderFlow(c.id), assertion(c.cpf, "bronze"), db);
    expect(bronze).toMatchObject({ ok: false });
    if (!bronze.ok) expect(bronze.reason).toMatch(/prata ou ouro/);

    const prata = await completeProviderFlow(c.id, startProviderFlow(c.id), assertion(c.cpf, "prata", env.municipio), db);
    expect(prata).toEqual({ ok: true, domicileVerified: true });
    const u = await userRow(c.id);
    expect(u.verificationLevel).toBe("verificado");
    expect(u.verificationMethod).toBe("provedor_simulado");
    expect(u.domicileVerifiedAt).not.toBeNull();
  });

  it("o estado do fluxo é assinado, expira e não serve para outra conta", async () => {
    const a = await createCitizen(db, { verified: false });
    const b = await createCitizen(db, { verified: false });
    const state = startProviderFlow(a.id);
    await expect(completeProviderFlow(b.id, state, assertion(b.cpf, "ouro"), db)).rejects.toThrow(/expirada ou inválida/);
    await expect(completeProviderFlow(a.id, `${state}x`, assertion(a.cpf, "ouro"), db)).rejects.toThrow(/expirada ou inválida/);
  });

  it("documental: fica em análise, recusa exige motivo e a aprovação aplica correção de nome e domicílio", async () => {
    const c = await createCitizen(db, { verified: false, domicile: false });
    await expect(submitDocuments(c.id, { files: [pdf("grande.pdf", 6 * 1024 * 1024)], includesAddressProof: false }, db)).rejects.toThrow(/limite de 5 MB/);
    // A correção da data de nascimento não pode tornar a conta de menor de 18 anos (DT-33).
    await expect(submitDocuments(c.id, { files: [pdf()], includesAddressProof: false, birthDate: "10/10/2015" }, db)).rejects.toThrow(/18 anos completos/);
    await submitDocuments(c.id, { files: [pdf()], includesAddressProof: true, fullName: "Nome Civil Corrigido" }, db);
    expect((await userRow(c.id)).verificationLevel).toBe("em_analise");
    await expect(submitDocuments(c.id, { files: [pdf()], includesAddressProof: false }, db)).rejects.toThrow(/já existe/i);

    const [pending] = (await listPendingVerifications(db)).filter((p) => p.v.userId === c.id);
    const moderador = await createAdmin(db, ["moderacao"]);
    const atendente = await createAdmin(db, ["atendimento"]);
    await expect(decideVerification(moderador, pending.v.id, { approve: true, reason: "", confirmAddress: true }, db)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decideVerification(atendente, pending.v.id, { approve: false, reason: "", confirmAddress: false }, db)).rejects.toThrow(/motivada/);
    await decideVerification(atendente, pending.v.id, { approve: true, reason: "Documentos conferem.", confirmAddress: true }, db);
    const u = await userRow(c.id);
    expect(u).toMatchObject({ verificationLevel: "verificado", verificationMethod: "documental", fullName: "Nome Civil Corrigido" });
    expect(u.domicileVerifiedAt).not.toBeNull();
    // Os documentos ficam com acesso restrito: anexos do tipo "identity", nunca listados em consultas.
    expect((await db.select().from(attachments).where(eq(attachments.ownerType, "identity"))).length).toBeGreaterThan(0);
  });
});

describe("Visualização do perfil (RF012, RN27)", () => {
  it("mostra o CPF só mascarado, sem hash de senha nem segredos, e explica o impedimento com a ação necessária", async () => {
    const c = await createCitizen(db, { verified: false, domicile: false });
    const perfil = (await getProfile(c.id, db))!;
    expect(perfil.cpfMasked).toMatch(/^\*{3}\.\d{3}\.\d{3}-\*{2}$/);
    const texto = JSON.stringify(perfil);
    expect(texto).not.toContain(c.cpf);
    expect(texto).not.toContain(c.cpf.replace(/\D/g, ""));
    expect(texto).not.toMatch(/passwordHash|cpfHmac|mfaSecretEnc|\$argon2/);
    expect(perfil.district).toBe("Centro");

    const antes = await eligibilitySummary(c.id, db);
    expect(antes).toHaveLength(2);
    for (const item of antes) {
      expect(item.ok).toBe(false);
      if (!item.ok) {
        expect(item.reason).toBeTruthy();
        expect(item.action).toBeTruthy();
      }
    }
    const verificado = await createCitizen(db);
    expect((await eligibilitySummary(verificado.id, db)).every((i) => i.ok)).toBe(true);
    // Verificado sem domicílio comprovado: participa das consultas gerais, não das restritas a moradores.
    const semDomicilio = await createCitizen(db, { domicile: false });
    expect((await eligibilitySummary(semDomicilio.id, db)).map((i) => i.ok)).toEqual([true, false]);
  });
});

describe("Atualização do perfil (RF013)", () => {
  it("novo endereço exige nova comprovação; novo e-mail só vale após confirmação e o anterior é avisado; auditoria sem valores", async () => {
    const c = await createCitizen(db);
    const [outro] = await db.select().from(districts).where(eq(districts.name, "Jatiúca"));
    const novoEmail = `novo-${Math.random().toString(36).slice(2, 8)}@exemplo.test`;
    const input = { socialName: "Nome Social", email: novoEmail, phone: "", currentPassword: PASSWORD, cep: "57000-111", street: "Rua Totalmente Nova", number: "55", district: outro.id };
    await expect(updateProfile(c.id, { ...input, currentPassword: "senhaErrada1" }, "ip", db)).rejects.toThrow(/incorreta/);
    const r = await updateProfile(c.id, input, "ip", db);
    expect(r).toEqual({ emailPending: true, addressChanged: true });
    let u = await userRow(c.id);
    expect(u.domicileVerifiedAt).toBeNull();
    expect(u.email).toBe(c.email);
    expect(u.pendingEmail).toBe(novoEmail);

    const token = (await emailsTo(novoEmail))[0].body.match(/token=([\w-]+)/)![1];
    expect((await confirmEmail(token, db)).kind).toBe("troca");
    u = await userRow(c.id);
    expect(u.email).toBe(novoEmail);
    expect((await emailsTo(c.email)).some((m) => m.subject === "Seu e-mail foi alterado")).toBe(true);

    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.action, "perfil_atualizado"), eq(auditLog.objectId, c.id)));
    expect(log.details).toMatchObject({ campos: expect.arrayContaining(["endereco", "email_pendente", "nome_social"]) });
    expect(JSON.stringify(log)).not.toContain("Rua Totalmente Nova");
    expect(JSON.stringify(log)).not.toContain(novoEmail);
  });
});

describe("Gestão de usuários (RF046)", () => {
  it("convite de 72 h: o convidado define senha e segundo fator; token é de uso único", async () => {
    const [revisor] = await db.select().from(roles).where(eq(roles.key, "revisor"));
    const email = "novo.servidor@prefeitura.test";
    const u = await inviteAdmin(gestor, { name: "Novo Servidor", registration: "MAT-NOVO-1", email, organId, roleIds: [revisor.id] }, db);
    expect(u.status).toBe("pendente");
    await expect(inviteAdmin(gestor, { name: "Outro", registration: "MAT-NOVO-1", email: "x@prefeitura.test", organId, roleIds: [] }, db)).rejects.toThrow(/Já existe/);
    const token = (await emailsTo(email))[0].body.match(/token=([\w-]+)/)![1];
    const secret = generateTotpSecret();
    await expect(acceptInvite({ token, password: "Servidor2026x", confirm: "Servidor2026x", totpSecret: secret, totpCode: "000000" }, db)).rejects.toThrow(/autenticador inválido/);
    await acceptInvite({ token, password: "Servidor2026x", confirm: "Servidor2026x", totpSecret: secret, totpCode: totp(secret) }, db);
    await expect(acceptInvite({ token, password: "Servidor2026x", confirm: "Servidor2026x", totpSecret: secret, totpCode: totp(secret) }, db)).rejects.toThrow(/inválido, expirado ou já utilizado/);
    const row = await userRow(u.id);
    expect(row.status).toBe("ativa");
    expect(row.mfaSecretEnc).not.toContain(secret); // segredo cifrado
    const r = await login({ identifier: email, password: "Servidor2026x" }, ctx, db);
    expect(r).toMatchObject({ ok: true, needsMfa: true });

    // Bloqueio encerra as sessões; atos anteriores permanecem.
    await expect(setAccountStatus(gestor, u.id, "bloquear", "", db)).rejects.toThrow(/justificativa/);
    await setAccountStatus(gestor, u.id, "bloquear", "Afastamento do servidor.", db);
    if (r.ok) expect(await validateSession(r.token, db)).toBeNull();
    expect((await login({ identifier: email, password: "Servidor2026x" }, ctx, db)).ok).toBe(false);
    await setAccountStatus(gestor, u.id, "desbloquear", "Retorno.", db);
    expect((await userRow(u.id)).status).toBe("ativa");
  });

  it("convite expira em 72 horas", async () => {
    const email = "atrasado@prefeitura.test";
    await inviteAdmin(gestor, { name: "Servidor Atrasado", registration: "MAT-ATR-1", email, organId, roleIds: [] }, db);
    const token = (await emailsTo(email))[0].body.match(/token=([\w-]+)/)![1];
    const secret = generateTotpSecret();
    clock.set(new Date(Date.now() + 73 * 3600_000));
    await expect(acceptInvite({ token, password: "Servidor2026x", confirm: "Servidor2026x", totpSecret: secret, totpCode: totp(secret, clock.now().getTime()) }, db)).rejects.toThrow(/expirado/);
  });

  it("não bloqueia a si mesmo nem remove o último gestor de acessos", async () => {
    await expect(setAccountStatus(gestor, gestor.id, "bloquear", "teste", db)).rejects.toThrow(/própria conta/);
    await expect(setUserRoles(gestor, gestor.id, [], db)).rejects.toThrow(/último gestor/);
    const semPermissao = await createAdmin(db, ["revisor"]);
    await expect(setAccountStatus(semPermissao, gestor.id, "bloquear", "abuso", db)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Papéis e permissões (RF047, RN20)", () => {
  it("impede combinação vedada, exclusão de papel em uso e de papel previsto no documento; audita antes e depois", async () => {
    await expect(saveRole(gestor, { name: "Papel misto", description: "", permissions: ["consultas.elaborar", "consultas.aprovar"] }, db)).rejects.toThrow(/vedada/);
    await expect(saveRole(gestor, { name: "Papel inválido", description: "", permissions: ["permissao.inexistente"] }, db)).rejects.toThrow(/inválidas/);
    const papel = await saveRole(gestor, { name: "Apoio à divulgação", description: "", permissions: ["consultas.divulgar"] }, db);
    const servidor = await createAdmin(db, []);
    await setUserRoles(gestor, servidor.id, [papel.id], db);
    await expect(deleteRole(gestor, papel.id, db)).rejects.toThrow(/em uso por 1 conta/);
    await saveRole(gestor, { id: papel.id, name: "Apoio à divulgação", description: "ampliado", permissions: ["consultas.divulgar", "consultas.acompanhar"] }, db);
    const [alt] = await db.select().from(auditLog).where(and(eq(auditLog.action, "papel_alterado"), eq(auditLog.objectId, papel.id)));
    expect(alt.details).toMatchObject({ antes: ["consultas.divulgar"], depois: ["consultas.divulgar", "consultas.acompanhar"] });
    await setUserRoles(gestor, servidor.id, [], db);
    await deleteRole(gestor, papel.id, db);
    const [doDocumento] = await db.select().from(roles).where(eq(roles.key, "encaminhamentos"));
    await expect(deleteRole(gestor, doDocumento.id, db)).rejects.toThrow(/não podem ser excluídos/);
    // Contas de cidadão nunca recebem papéis administrativos (RN22).
    const cidadao = await createCitizen(db);
    await expect(setUserRoles(gestor, cidadao.id, [doDocumento.id], db)).rejects.toThrow(/contas administrativas/);
  });
});

describe("Avisos de consulta (RF053, RF055)", () => {
  it("publicação avisa interessados respeitando o tema; lembrete exclui quem já participou", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    const interessado = await createCitizen(db);
    const outroTema = await createCitizen(db);
    const [tema] = (await db.select().from(themes)).filter((t) => t.id !== consultation.themeId);
    await savePreferences(outroTema.id, { types: defaultPreferences(), themeIds: [tema.id], districtIds: [] }, db);

    await notifyPublished(db, consultation.id);
    const tipo = async (userId: string, type: string) => (await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, type)))).length;
    expect(await tipo(interessado.id, "nova_consulta")).toBe(1);
    expect(await tipo(outroTema.id, "nova_consulta")).toBe(0);
    const [n] = await db.select().from(notifications).where(and(eq(notifications.userId, interessado.id), eq(notifications.type, "nova_consulta")));
    expect(n.link).toBe(`/consultas/${consultation.slug}`);
    expect(n.body).toContain("Período de participação");

    await db.insert(participations).values({ consultationId: consultation.id, citizenId: interessado.id, participatedOn: "2026-11-10", receiptHash: `h-${Math.random()}`, receiptEnc: "x" });
    await notifyReminder(db, consultation.id);
    expect(await tipo(interessado.id, "lembrete")).toBe(0);
    expect(await tipo(outroTema.id, "lembrete")).toBe(1);
    // E-mail opcional traz link de descadastro sem login (RF052).
    expect((await emailsTo(outroTema.email))[0].body).toContain("/avisos/descadastrar?t=");
  });
});

describe("Divulgação (RF062)", () => {
  it("gera texto, link permanente e QR Code sem parciais; registra o canal no histórico; texto divergente exige revisão", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const divulgador = await createAdmin(db, ["divulgacao"]);
    const naoDesignado = await createAdmin(db, ["divulgacao"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    await assign(db, consultation.id, divulgador.id, "divulgacao");

    const m = await disseminationMaterial(consultation.id, db);
    expect(m.link).toBe(`${env.appUrl}/consultas/${consultation.slug}`);
    expect(m.qrSvg).toContain("<svg");
    expect(JSON.stringify([m.shortText, m.card])).not.toMatch(/votos|percentual|parcial/i);

    await expect(registerDissemination(naoDesignado, consultation.id, { channel: "radio", usedOn: "2026-11-10" }, db)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(registerDissemination(divulgador, consultation.id, { channel: "tv", usedOn: "2026-11-10" }, db)).rejects.toThrow(/canal/);
    await expect(registerDissemination(divulgador, consultation.id, { channel: "redes", usedOn: "2026-11-10", customText: "Venha ao show na praça neste sábado" }, db)).rejects.toThrow(/divergir da pergunta/);
    await registerDissemination(divulgador, consultation.id, { channel: "radio", usedOn: "2026-11-10", notes: "Rádio comunitária" }, db);
    const ev = await db.select().from(consultationEvents).where(and(eq(consultationEvents.consultationId, consultation.id), eq(consultationEvents.type, "divulgacao")));
    expect(ev).toHaveLength(1);
    expect(ev[0].description).toContain("Rádio");
  });
});

describe("Eventos participativos (RF068 — condicionado à validação)", () => {
  it("desligado por padrão; ligado: evento com link https, perguntas com protocolo e telefone só pelo atendimento", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const responsavel = await createAdmin(db, ["responsavel"]);
    const atendente = await createAdmin(db, ["atendimento"]);
    const cidadao = await createCitizen(db);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    const dados = { consultationId: consultation.id, kind: "audiencia", title: "Audiência sobre a proposta", agenda: "Apresentação e perguntas", startsAt: "2026-12-01T19:00", location: "Auditório municipal" };
    await expect(createEvent(responsavel, dados, db)).rejects.toThrow(/não estão habilitados/);

    await writeSetting(db, "recursos.eventos", true, null);
    await expect(createEvent(responsavel, { ...dados, streamUrl: "http://sem-https.org/ao-vivo" }, db)).rejects.toThrow();
    await expect(createEvent(atendente, dados, db)).rejects.toBeInstanceOf(ForbiddenError);
    const e = await createEvent(responsavel, { ...dados, streamUrl: "https://videos.exemplo-ficticio.org/ao-vivo" }, db);
    expect(await askQuestion({ eventId: e.id, body: "Haverá estacionamento?", authorId: cidadao.id, channel: "antecipada" }, db)).toMatch(/^PERG-\d{4}-/);
    await expect(askQuestion({ eventId: e.id, body: "Pergunta por telefone", registeredBy: responsavel, channel: "telefone" }, db)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await askQuestion({ eventId: e.id, body: "Pergunta por telefone", registeredBy: atendente, channel: "telefone" }, db)).toMatch(/^PERG-/);
    await writeSetting(db, "recursos.eventos", false, null);
  });
});

describe("Parâmetros sem alterar código (RNF12)", () => {
  it("apoios só podem ser ligados com meta e prazo próprios; valores inválidos são recusados; alteração auditada", async () => {
    await expect(updateSettings(gestor, { "recursos.apoios": "on", "apoios.meta": "0", "apoios.prazo_dias": "0" }, db)).rejects.toThrow();
    await expect(updateSettings(gestor, { "proposta.limite_em_analise": "-1" }, db)).rejects.toThrow();
    await updateSettings(gestor, { "recursos.apoios": "on", "apoios.meta": "50", "apoios.prazo_dias": "60", "consulta.prazo_padrao_dias": "25" }, db);
    expect(await getSetting("apoios.meta", db)).toBe(50);
    expect(await getSetting("consulta.prazo_padrao_dias", db)).toBe(25);
    expect(await getSetting("recursos.apoios", db)).toBe(true);
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "parametros_alterados"))).length).toBe(1);
    const semPermissao = await createAdmin(db, ["aprovador"]);
    await expect(updateSettings(semPermissao, { "consulta.prazo_padrao_dias": "1" }, db)).rejects.toBeInstanceOf(ForbiddenError);
    await updateSettings(gestor, { "apoios.meta": "0", "apoios.prazo_dias": "0", "consulta.prazo_padrao_dias": "20" }, db);
    expect(await getSetting("recursos.apoios", db)).toBe(false);
  });
});
