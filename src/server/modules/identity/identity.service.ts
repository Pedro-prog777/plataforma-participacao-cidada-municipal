/**
 * Verificação de identidade e domicílio (RF004; RN01, RN02, RN04, RN27, RN31; RS004).
 *  - Pelo provedor de identidade (gov.br, nível prata ou superior) — SIMULADO nesta versão acadêmica.
 *  - Ou por análise documental feita por administrador com a permissão "identidade.analisar".
 * Documentos têm acesso restrito (servidos apenas a quem analisa e ao titular).
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { attachments, districts, identityVerifications, users } from "../../db/schema";
import { cpfHmac, signPayload, verifyPayload } from "../../lib/crypto";
import { clock } from "../../lib/clock";
import { DomainError, ValidationError } from "../../lib/errors";
import { receiveFile, type StoredFile } from "../../lib/files";
import { LEVEL_ORDER, type IdentityAssertion, type IdentityLevel } from "../../lib/identity-provider";
import { env } from "../../lib/env";
import { onlyDigits, isValidCpf } from "@/lib/cpf";
import { sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertPermission, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";
import { openIncident } from "../integrity/incidents.service";
import { birthDateSchema } from "../auth/auth.service";

async function assertCanVerify(db: DbOrTx, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "cidadao" || u.status !== "ativa") throw new DomainError("Conta não disponível para verificação.");
  return u;
}

/** Inicia o fluxo no provedor: estado assinado e de curta duração (proteção contra CSRF/replay). */
export function startProviderFlow(userId: string) {
  return signPayload({ u: userId, e: Date.now() + 10 * 60_000, p: "verificacao" });
}

/** Retorno do provedor de identidade (simulado). Confere CPF, nível e domicílio. */
export async function completeProviderFlow(userId: string, state: string, assertion: IdentityAssertion & { residenceCity?: string | null }, db: DbOrTx = getDb()) {
  const st = verifyPayload<{ u: string; e: number; p: string }>(state);
  if (!st || st.u !== userId || st.e < Date.now() || st.p !== "verificacao") throw new DomainError("Sessão de verificação expirada ou inválida. Recomece.", "estado_invalido");
  const u = await assertCanVerify(db, userId);
  if (u.verificationLevel === "verificado" && u.domicileVerifiedAt) throw new DomainError("Sua identidade já está verificada.");
  const cpf = onlyDigits(assertion.cpf);
  return db.transaction(async (tx) => {
    if (!isValidCpf(cpf) || cpfHmac(cpf) !== u.cpfHmac) {
      await tx.insert(identityVerifications).values({ userId, method: "govbr", status: "recusada", govbrLevel: assertion.level, reason: "CPF divergente do cadastro", decidedAt: clock.now() });
      await tx.update(users).set({ verificationLevel: "recusado" }).where(eq(users.id, userId));
      // CPF divergente: recusa registrada na auditoria (RF004) e incidente de cadastro suspeito (RS004).
      await audit(tx, { actorId: userId, actorRole: "cidadao", action: "verificacao_recusada_cpf_divergente", result: "negado", objectType: "usuario", objectId: userId });
      await openIncident(tx, { severity: "media", type: "cadastro_suspeito", description: "Verificação de identidade com CPF divergente do cadastro.", evidence: { usuario: userId } });
      return { ok: false as const, reason: "O CPF informado pelo provedor não corresponde ao CPF do seu cadastro." };
    }
    if (LEVEL_ORDER[assertion.level as IdentityLevel] < LEVEL_ORDER.prata) {
      await tx.insert(identityVerifications).values({ userId, method: "govbr", status: "recusada", govbrLevel: assertion.level, reason: "Nível de conta inferior a prata", decidedAt: clock.now() });
      await audit(tx, { actorId: userId, actorRole: "cidadao", action: "verificacao_recusada_nivel", result: "negado", objectType: "usuario", objectId: userId, details: { nivel: assertion.level } });
      return { ok: false as const, reason: "Sua conta no provedor precisa ter nível prata ou ouro. Eleve o nível ou use a verificação por documentos." };
    }
    const now = clock.now();
    const domicileOk = !!u.districtId && !!assertion.residenceCity && sanitizePlainText(assertion.residenceCity).toLowerCase() === env.municipio.toLowerCase();
    await tx.insert(identityVerifications).values({ userId, method: "govbr", status: "aprovada", govbrLevel: assertion.level, includesAddressProof: domicileOk, decidedAt: now });
    await tx
      .update(users)
      .set({ verificationLevel: "verificado", verificationMethod: assertion.simulated ? "provedor_simulado" : "govbr", verifiedAt: now, domicileVerifiedAt: domicileOk ? now : u.domicileVerifiedAt })
      .where(eq(users.id, userId));
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "identidade_verificada", objectType: "usuario", objectId: userId, details: { metodo: assertion.simulated ? "provedor_simulado" : "govbr", nivel: assertion.level, domicilio: domicileOk } });
    await notifyUser(tx, userId, { type: "conta", title: "Identidade verificada", body: domicileOk ? "Sua identidade e seu domicílio foram verificados." : "Sua identidade foi verificada. Para consultas restritas a moradores, comprove o domicílio por documento.", link: "/conta/perfil" });
    return { ok: true as const, domicileVerified: domicileOk };
  });
}

/** Verificação documental: arquivos até 5 MB ficam "Em análise" (RF004). */
export async function submitDocuments(userId: string, input: { files: File[]; includesAddressProof: boolean; fullName?: string; birthDate?: string }, db: DbOrTx = getDb()) {
  const u = await assertCanVerify(db, userId);
  const files = input.files.filter((f) => f && f.size > 0);
  if (!files.length) throw new ValidationError({ files: ["Envie ao menos um documento de identificação."] });
  if (files.length > 4) throw new ValidationError({ files: ["Envie no máximo 4 arquivos."] });
  const [pending] = await db.select().from(identityVerifications).where(and(eq(identityVerifications.userId, userId), eq(identityVerifications.status, "em_analise")));
  if (pending) throw new DomainError("Já existe uma verificação em análise.");
  const requestedChanges: { fullName?: string; birthDate?: string } = {};
  if (input.fullName && sanitizePlainText(input.fullName) !== u.fullName) requestedChanges.fullName = sanitizePlainText(input.fullName).slice(0, 150);
  if (input.birthDate) {
    const r = birthDateSchema.safeParse(input.birthDate);
    if (!r.success) throw new ValidationError({ birthDate: [r.error.issues[0].message] });
    if (r.data !== u.birthDate) requestedChanges.birthDate = r.data;
  }
  const stored: StoredFile[] = [];
  for (const f of files) stored.push(await receiveFile(f, { maxBytes: 5 * 1024 * 1024, allowed: ["documento", "imagem"] }));
  await db.transaction(async (tx) => {
    const [v] = await tx
      .insert(identityVerifications)
      .values({ userId, method: "documental", status: "em_analise", includesAddressProof: input.includesAddressProof, requestedChanges: Object.keys(requestedChanges).length ? requestedChanges : null })
      .returning();
    for (const s of stored) {
      await tx.insert(attachments).values({ ownerType: "identity", ownerId: v.id, kind: "arquivo", mediaType: s.mediaType, title: s.filename, filename: s.filename, mime: s.mime, sizeBytes: s.sizeBytes, sha256: s.sha256, storagePath: s.storagePath, createdBy: userId });
    }
    if (u.verificationLevel !== "verificado") await tx.update(users).set({ verificationLevel: "em_analise" }).where(eq(users.id, userId));
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "verificacao_documental_enviada", objectType: "verificacao", objectId: v.id, details: { arquivos: stored.length } });
  });
}

export async function listPendingVerifications(db: DbOrTx = getDb()) {
  return db
    .select({ v: identityVerifications, name: users.fullName, cpfMasked: users.cpfMasked, district: districts.name, externalCity: users.externalCity })
    .from(identityVerifications)
    .innerJoin(users, eq(users.id, identityVerifications.userId))
    .leftJoin(districts, eq(districts.id, users.districtId))
    .where(eq(identityVerifications.status, "em_analise"))
    .orderBy(identityVerifications.createdAt);
}

export async function verificationDocuments(verificationId: string, db: DbOrTx = getDb()) {
  return db.select().from(attachments).where(and(eq(attachments.ownerType, "identity"), eq(attachments.ownerId, verificationId)));
}

export async function myVerifications(userId: string, db: DbOrTx = getDb()) {
  return db.select().from(identityVerifications).where(eq(identityVerifications.userId, userId)).orderBy(desc(identityVerifications.createdAt));
}

/** Decisão do administrador: aprovação ou recusa motivada (RF004). */
export async function decideVerification(actor: Actor, verificationId: string, input: { approve: boolean; reason: string; confirmAddress: boolean }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "identidade.analisar", { objectType: "verificacao", objectId: verificationId }, db);
  const reason = sanitizePlainText(input.reason ?? "");
  if (!input.approve && !reason) throw new ValidationError({ reason: ["A recusa deve ser motivada."] });
  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(identityVerifications).where(eq(identityVerifications.id, verificationId)).for("update");
    if (!v || v.status !== "em_analise") throw new DomainError("Pedido não está em análise.");
    if (v.userId === actor.id) throw new DomainError("Não é permitido analisar o próprio pedido.");
    const now = clock.now();
    await tx.update(identityVerifications).set({ status: input.approve ? "aprovada" : "recusada", reason: reason || null, reviewerId: actor.id, decidedAt: now }).where(eq(identityVerifications.id, verificationId));
    if (input.approve) {
      const [u] = await tx.select().from(users).where(eq(users.id, v.userId));
      const changes = v.requestedChanges ?? {};
      await tx
        .update(users)
        .set({
          verificationLevel: "verificado",
          verificationMethod: "documental",
          verifiedAt: now,
          domicileVerifiedAt: v.includesAddressProof && input.confirmAddress && u.districtId ? now : u.domicileVerifiedAt,
          fullName: changes.fullName ?? u.fullName,
          birthDate: changes.birthDate ?? u.birthDate,
          updatedAt: now,
        })
        .where(eq(users.id, v.userId));
    } else {
      const [u] = await tx.select({ level: users.verificationLevel }).from(users).where(eq(users.id, v.userId));
      if (u.level !== "verificado") await tx.update(users).set({ verificationLevel: "recusado" }).where(eq(users.id, v.userId));
    }
    await audit(tx, { actorId: actor.id, actorRole: "atendimento", action: input.approve ? "verificacao_documental_aprovada" : "verificacao_documental_recusada", objectType: "verificacao", objectId: verificationId, justification: reason || null });
    await notifyUser(tx, v.userId, {
      type: "conta",
      title: input.approve ? "Verificação aprovada" : "Verificação recusada",
      body: input.approve ? "Sua verificação documental foi aprovada." : `Sua verificação documental foi recusada. Motivo: ${reason}. Você pode enviar novos documentos.`,
      link: "/conta/verificacao",
    });
  });
}

export async function pendingVerificationCount(db: DbOrTx = getDb()) {
  const rows = await db.select({ id: identityVerifications.id }).from(identityVerifications).where(inArray(identityVerifications.status, ["em_analise"]));
  return rows.length;
}
