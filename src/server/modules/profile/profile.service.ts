/** Perfil do cidadão e direitos do titular — LGPD (RF012, RF013, RF015; RN27, RN33). */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "../../db/client";
import { citizenProposals, dataExports, districts, notificationPreferences, regions, users } from "../../db/schema";
import { clock, HOUR } from "../../lib/clock";
import { DomainError, ValidationError, type FieldErrors } from "../../lib/errors";
import { verifyPassword } from "../../lib/password";
import { buildPdf } from "../../lib/export-formats";
import { env } from "../../lib/env";
import { sanitizePlainText } from "@/lib/text";
import { fmtDate, fmtDateTime, ACCOUNT_STATUS, VERIFICATION_LEVEL, CITIZEN_PROPOSAL_STATUS } from "@/lib/labels";
import { audit } from "../audit/audit.service";
import { addressSchema, emailSchema, sendEmailConfirmation } from "../auth/auth.service";
import { revokeAllSessions } from "../auth/session.service";
import { myParticipations } from "../voting/voting.service";
import { evaluateEligibility, loadEligibilityUser } from "../voting/eligibility";
import { recordAuthFailure } from "../auth/auth.service";

export async function getProfile(userId: string, db: DbOrTx = getDb()) {
  const [u] = await db
    .select({ u: users, district: districts.name, region: regions.name })
    .from(users)
    .leftJoin(districts, eq(districts.id, users.districtId))
    .leftJoin(regions, eq(regions.id, districts.regionId))
    .where(eq(users.id, userId));
  if (!u) return null;
  const { passwordHash: _p, cpfHmac: _h, mfaSecretEnc: _m, ...safe } = u.u;
  return { ...safe, district: u.district, region: u.region };
}

/** Resumo de elegibilidade (RF012): motivo e ação necessária quando houver impedimento. */
export async function eligibilitySummary(userId: string, db: DbOrTx = getDb()) {
  const u = await loadEligibilityUser(userId, db);
  if (!u) return [];
  const generic = evaluateEligibility(u, { status: "aberta", opensAt: new Date(0), closesAt: new Date(8.64e15), audienceOpen: true, criteria: [] }, false);
  const domicile = evaluateEligibility(u, { status: "aberta", opensAt: new Date(0), closesAt: new Date(8.64e15), audienceOpen: false, criteria: [{ type: "domicilio", params: {} }] }, false);
  return [
    { label: "Consultas abertas ao público em geral", ...(generic.eligible ? { ok: true as const } : { ok: false as const, reason: generic.reason, action: generic.action }) },
    { label: "Consultas restritas a moradores do município", ...(domicile.eligible ? { ok: true as const } : { ok: false as const, reason: domicile.reason, action: domicile.action }) },
  ];
}

const profileSchema = z
  .object({
    socialName: z.string().optional().transform((v) => sanitizePlainText(v ?? "").slice(0, 150) || null),
    email: emailSchema,
    phone: z.string().optional(),
    currentPassword: z.string().min(1, "Confirme com sua senha."),
  })
  .and(addressSchema);

/** RF013 — CPF imutável; nome civil e nascimento só por verificação documental. */
export async function updateProfile(userId: string, input: Record<string, unknown>, ipH: string, db: DbOrTx = getDb()) {
  const r = profileSchema.safeParse(input);
  if (!r.success) {
    const fe: FieldErrors = {};
    r.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
    throw new ValidationError(fe);
  }
  const data = r.data;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new DomainError("Conta não encontrada.");
  if (!(await verifyPassword(u.passwordHash, data.currentPassword))) {
    await recordAuthFailure(db, userId, ipH, "senha_confirmacao_perfil");
    throw new ValidationError({ currentPassword: ["Senha incorreta."] });
  }
  const phoneDigits = String(data.phone ?? "").replace(/\D/g, "");
  if (phoneDigits && phoneDigits.length !== 10 && phoneDigits.length !== 11) throw new ValidationError({ phone: ["Celular inválido."] });
  const phone = phoneDigits ? `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, phoneDigits.length - 4)}-${phoneDigits.slice(-4)}` : null;
  let districtId: string | null = null;
  if (data.district !== "fora") {
    const [d] = await db.select().from(districts).where(eq(districts.id, data.district));
    if (!d) throw new ValidationError({ district: ["Bairro inválido."] });
    districtId = d.id;
  } else if (!data.externalCity) throw new ValidationError({ externalCity: ["Informe o município."] });

  const changed: string[] = [];
  const addressChanged = u.cep !== data.cep || u.street !== data.street || u.number !== data.number || u.districtId !== districtId || (u.complement ?? null) !== data.complement;
  if ((u.socialName ?? null) !== data.socialName) changed.push("nome_social");
  if ((u.phone ?? null) !== phone) changed.push("celular");
  if (addressChanged) changed.push("endereco");
  const emailChanged = data.email !== u.email;
  if (emailChanged) {
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
    if (dup && dup.id !== userId) throw new ValidationError({ email: ["Não foi possível usar este e-mail."] });
    changed.push("email_pendente");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        socialName: data.socialName,
        phone,
        cep: data.cep,
        street: data.street,
        number: data.number,
        complement: data.complement,
        districtId,
        externalCity: districtId ? null : data.externalCity,
        // Novo endereço exige nova comprovação; votos registrados não são afetados.
        domicileVerifiedAt: addressChanged ? null : u.domicileVerifiedAt,
        pendingEmail: emailChanged ? data.email : u.pendingEmail,
        updatedAt: clock.now(),
      })
      .where(eq(users.id, userId));
    // Novo e-mail vale após confirmação; o anterior é avisado na confirmação.
    if (emailChanged) await sendEmailConfirmation(tx, userId, data.email, "trocar_email");
    // Audita os CAMPOS alterados, nunca os valores (RF013, RF057).
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "perfil_atualizado", objectType: "usuario", objectId: userId, details: { campos: changed } });
  });
  return { emailPending: emailChanged, addressChanged };
}

/* ------------------------------------------------------------------ */
/* RF015 — Cópia dos dados e desativação                               */
/* ------------------------------------------------------------------ */
export async function requestDataCopy(userId: string, password: string, format: "json" | "pdf", ipH: string, db: DbOrTx = getDb()) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !(await verifyPassword(u.passwordHash, password))) {
    if (u) await recordAuthFailure(db, userId, ipH, "senha_confirmacao_dados");
    throw new ValidationError({ password: ["Senha incorreta."] });
  }
  const profile = await getProfile(userId, db);
  const parts = await myParticipations(userId, db);
  const props = await db.select({ protocol: citizenProposals.protocol, title: citizenProposals.title, status: citizenProposals.status, createdAt: citizenProposals.createdAt }).from(citizenProposals).where(eq(citizenProposals.authorId, userId)).orderBy(desc(citizenProposals.createdAt));
  const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  const payload = {
    geradoEm: clock.now().toISOString(),
    controlador: `Prefeitura — ${env.municipio}`,
    observacao: "Cópia dos dados pessoais. O voto é secreto: a alternativa escolhida não é vinculada à sua conta e por isso não consta deste arquivo.",
    conta: {
      nomeCompleto: profile?.fullName,
      nomeSocial: profile?.socialName,
      cpf: profile?.cpfMasked,
      dataNascimento: profile?.birthDate,
      email: profile?.email,
      celular: profile?.phone,
      endereco: { cep: profile?.cep, logradouro: profile?.street, numero: profile?.number, complemento: profile?.complement, bairro: profile?.district, municipioExterno: profile?.externalCity },
      situacao: profile ? ACCOUNT_STATUS[profile.status].label : null,
      verificacao: profile ? VERIFICATION_LEVEL[profile.verificationLevel].label : null,
      termosAceitos: { versao: profile?.termsVersion, em: profile?.termsAcceptedAt },
      cadastradoEm: profile?.createdAt,
    },
    participacoes: parts.map((p) => ({ consulta: p.title, data: p.date, comprovante: p.receipt })),
    propostas: props,
    preferenciasDeAviso: prefs ?? null,
  };
  let content: string;
  if (format === "json") content = JSON.stringify(payload, null, 2);
  else {
    const pdf = await buildPdf(
      [
        { type: "title", text: "Cópia dos meus dados pessoais" },
        { type: "text", text: payload.observacao },
        { type: "subtitle", text: "Conta" },
        { type: "table", head: ["Campo", "Valor"], rows: [["Nome", String(payload.conta.nomeCompleto ?? "")], ["Nome social", String(payload.conta.nomeSocial ?? "—")], ["CPF", String(payload.conta.cpf ?? "")], ["Nascimento", fmtDate(payload.conta.dataNascimento ?? null)], ["E-mail", String(payload.conta.email ?? "")], ["Celular", String(payload.conta.celular ?? "—")], ["Endereço", `${payload.conta.endereco.logradouro ?? ""}, ${payload.conta.endereco.numero ?? ""} — ${payload.conta.endereco.bairro ?? payload.conta.endereco.municipioExterno ?? ""} — CEP ${payload.conta.endereco.cep ?? ""}`], ["Situação", String(payload.conta.situacao)], ["Verificação", String(payload.conta.verificacao)]] },
        { type: "subtitle", text: "Participações (sem a alternativa escolhida)" },
        { type: "table", head: ["Consulta", "Data", "Comprovante"], rows: parts.map((p) => [p.title, fmtDate(p.date), p.receipt]) },
        { type: "subtitle", text: "Propostas enviadas" },
        { type: "table", head: ["Protocolo", "Título", "Estado", "Envio"], rows: props.map((p) => [p.protocol, p.title, CITIZEN_PROPOSAL_STATUS[p.status].label, fmtDateTime(p.createdAt)]) },
      ],
      `Gerado em ${fmtDateTime(clock.now())}`,
    );
    content = Buffer.from(pdf).toString("base64");
  }
  const [exp] = await db.insert(dataExports).values({ userId, format, content, expiresAt: new Date(clock.now().getTime() + 48 * HOUR) }).returning({ id: dataExports.id });
  await audit(db, { actorId: userId, actorRole: "cidadao", action: "copia_dados_gerada", objectType: "usuario", objectId: userId, details: { formato: format } });
  return exp.id;
}

export async function getDataExport(userId: string, id: string, db: DbOrTx = getDb()) {
  const [e] = await db.select().from(dataExports).where(eq(dataExports.id, id));
  if (!e || e.userId !== userId || e.expiresAt < clock.now()) return null;
  return e;
}

export async function listDataExports(userId: string, db: DbOrTx = getDb()) {
  const rows = await db.select({ id: dataExports.id, format: dataExports.format, createdAt: dataExports.createdAt, expiresAt: dataExports.expiresAt }).from(dataExports).where(eq(dataExports.userId, userId)).orderBy(desc(dataExports.createdAt));
  return rows.filter((r) => r.expiresAt > clock.now());
}

/**
 * Desativação com anonimização (RF015): encerra sessões e anonimiza nome, e-mail, celular e endereço.
 * Mantém o HMAC do CPF para impedir novo voto (RN33) e não altera votos nem resultados.
 */
export async function deactivateAccount(userId: string, password: string, confirmText: string, ipH: string, db: DbOrTx = getDb()) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "cidadao") throw new DomainError("Conta não encontrada.");
  if (!(await verifyPassword(u.passwordHash, password))) {
    await recordAuthFailure(db, userId, ipH, "senha_confirmacao_desativacao");
    throw new ValidationError({ password: ["Senha incorreta."] });
  }
  if ((confirmText ?? "").trim().toUpperCase() !== "DESATIVAR") throw new ValidationError({ confirmText: ['Digite "DESATIVAR" para confirmar.'] });
  await db.transaction(async (tx) => {
    const now = clock.now();
    await tx
      .update(users)
      .set({
        fullName: "Titular anonimizado",
        socialName: null,
        email: `anonimizado+${u.id}@invalido.local`,
        pendingEmail: null,
        phone: null,
        cep: null,
        street: null,
        number: null,
        complement: null,
        externalCity: null,
        birthDate: null,
        status: "desativada",
        deactivatedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    await revokeAllSessions(tx, userId);
    await tx.delete(dataExports).where(eq(dataExports.userId, userId));
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "conta_desativada_titular", objectType: "usuario", objectId: userId });
  });
}
