/**
 * Documentos e materiais audiovisuais (RF023; RN11, RN12, RN37; RS012).
 * Imagens exigem texto alternativo; áudio/vídeo exigem transcrição ou resumo (e legenda havendo fala).
 * Limites: 20 MB por arquivo e 10 anexos. Mídias nunca são condição para votar.
 */
import { and, count, eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { attachments, consultationAssignments, consultations, municipalProposals } from "../../db/schema";
import { clock } from "../../lib/clock";
import { DomainError, NotFoundError, ValidationError, type FieldErrors } from "../../lib/errors";
import { receiveFile } from "../../lib/files";
import { isPublicHttpsUrl, sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertConsultationRole, assertPermission, type Actor } from "../access/access.service";
import { recordPublicEvent } from "../consultations/common";
import { notifyChange } from "../notifications/dispatch";
import { notifyUser } from "../notifications/notifications.service";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;

export type AttachmentInput = { ownerType: "consultation" | "municipal_proposal"; ownerId: string; title: string; altText?: string; transcript?: string; captionsUrl?: string; url?: string; file?: File | null; justification?: string };

export async function addAttachment(actor: Actor, input: AttachmentInput, db: DbOrTx = getDb()) {
  const title = sanitizePlainText(input.title ?? "");
  const altText = sanitizePlainText(input.altText ?? "");
  const transcript = sanitizePlainText(input.transcript ?? "");
  const url = (input.url ?? "").trim();
  const errors: FieldErrors = {};
  if (!title) errors.title = ["Informe um título para o material."];
  const hasFile = !!input.file && input.file.size > 0;
  if (!hasFile && !url) errors.file = ["Envie um arquivo ou informe um link."];
  if (url && !isPublicHttpsUrl(url)) errors.url = ["Informe um link público seguro (https:// com nome de domínio)."];
  if (Object.keys(errors).length) throw new ValidationError(errors);

  // Situação editável: rascunho/rejeitada (elaborador) ou publicada com acréscimo justificado (responsável — RF032).
  let afterPublication = false;
  if (input.ownerType === "consultation") {
    const [c] = await db.select().from(consultations).where(eq(consultations.id, input.ownerId));
    if (!c) throw new NotFoundError();
    if (["rascunho", "rejeitada"].includes(c.status)) await assertConsultationRole(actor, c.id, "elaborador", db);
    else if (["agendada", "aberta", "suspensa"].includes(c.status)) {
      await assertConsultationRole(actor, c.id, "responsavel", db);
      afterPublication = true;
      if (!sanitizePlainText(input.justification ?? "")) throw new ValidationError({ justification: ["Consulta publicada: o acréscimo de anexo exige justificativa (RF032)."] });
    } else throw new DomainError("A consulta não está em situação que permita anexar materiais (RN12).", "nao_editavel");
  } else {
    await assertPermission(actor, "propostas_municipais.gerenciar", { objectType: "proposta_municipal", objectId: input.ownerId }, db);
    const [p] = await db.select().from(municipalProposals).where(eq(municipalProposals.id, input.ownerId));
    if (!p) throw new NotFoundError();
    if (!["rascunho", "rejeitada"].includes(p.status)) throw new DomainError("A proposta não está em situação editável.");
  }
  const [{ n }] = await db.select({ n: count() }).from(attachments).where(and(eq(attachments.ownerType, input.ownerType), eq(attachments.ownerId, input.ownerId)));
  if (n >= MAX_FILES) throw new DomainError(`Limite de ${MAX_FILES} anexos atingido.`);

  let stored: Awaited<ReturnType<typeof receiveFile>> | null = null;
  let mediaType: string = "link";
  if (hasFile) {
    stored = await receiveFile(input.file!, { maxBytes: MAX_BYTES, allowed: ["documento", "imagem", "audio", "video"] }).catch(async (e) => {
      await audit(db, { actorId: actor.id, actorRole: "admin", action: "anexo_recusado", result: "negado", objectType: input.ownerType, objectId: input.ownerId, details: { motivo: (e as DomainError).code } });
      throw e;
    });
    mediaType = stored.mediaType;
  }
  // Alternativa textual obrigatória (RN37).
  if (mediaType === "imagem" && !altText) throw new ValidationError({ altText: ["Imagens exigem texto alternativo."] });
  if ((mediaType === "audio" || mediaType === "video") && !transcript) throw new ValidationError({ transcript: ["Áudio e vídeo exigem transcrição ou resumo."] });
  if (mediaType === "link" && !transcript && !altText) throw new ValidationError({ transcript: ["Links de vídeo/transmissão exigem resumo ou transcrição (alternativa textual)."] });

  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(attachments)
      .values({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        kind: stored ? "arquivo" : "link",
        mediaType,
        title,
        filename: stored?.filename,
        mime: stored?.mime,
        sizeBytes: stored?.sizeBytes,
        sha256: stored?.sha256,
        storagePath: stored?.storagePath,
        url: stored ? null : url,
        altText: altText || (mediaType === "documento" ? title : null) || transcript || null,
        transcript: transcript || null,
        captionsUrl: input.captionsUrl?.trim() || null,
        addedAfterPublication: afterPublication,
        justification: afterPublication ? sanitizePlainText(input.justification ?? "") : null,
        createdBy: actor.id,
        createdAt: clock.now(),
      })
      .returning();
    if (afterPublication) {
      await recordPublicEvent(tx, input.ownerId, "alteracao", `Inclusão de anexo: ${title}`, sanitizePlainText(input.justification ?? ""));
      await notifyChange(tx, input.ownerId, "Novo material na consulta", `Foi incluído o material "${title}". Justificativa: ${sanitizePlainText(input.justification ?? "")}`);
    }
    await audit(tx, { actorId: actor.id, actorRole: "admin", action: "anexo_incluido", objectType: input.ownerType, objectId: input.ownerId, details: { anexo: a.id, sha256: a.sha256, tipo: mediaType } });
    return a;
  });
}

export async function listAttachments(ownerType: string, ownerId: string, db: DbOrTx = getDb()) {
  return db.select().from(attachments).where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId)));
}

export async function getAttachment(id: string, db: DbOrTx = getDb()) {
  const [a] = await db.select().from(attachments).where(eq(attachments.id, id));
  return a ?? null;
}

/**
 * Verificação periódica de links externos (RF023): link indisponível alerta o responsável e a
 * página pública passa a destacar a alternativa textual. Só HEAD, sem seguir redirecionamentos,
 * e apenas para URLs públicas (anti-SSRF).
 */
export async function checkExternalLinks(db: DbOrTx = getDb(), fetcher: typeof fetch = fetch) {
  const links = await db.select().from(attachments).where(eq(attachments.kind, "link"));
  let changed = 0;
  for (const l of links) {
    let status = "ok";
    if (!l.url || !isPublicHttpsUrl(l.url)) status = "indisponivel";
    else {
      try {
        const r = await fetcher(l.url, { method: "HEAD", signal: AbortSignal.timeout(5000), redirect: "manual" });
        if (r.status >= 400) status = `http_${r.status}`;
      } catch {
        status = "indisponivel";
      }
    }
    if (status === l.linkStatus) continue;
    changed++;
    await db.update(attachments).set({ linkStatus: status }).where(eq(attachments.id, l.id));
    if (status !== "ok" && l.ownerType === "consultation") {
      const responsaveis = await db
        .select({ userId: consultationAssignments.userId })
        .from(consultationAssignments)
        .where(and(eq(consultationAssignments.consultationId, l.ownerId), eq(consultationAssignments.role, "responsavel"), eq(consultationAssignments.active, true)));
      for (const r of responsaveis) {
        await notifyUser(db, r.userId, { type: "conta", title: "Link de material indisponível", body: `O link "${l.title}" não respondeu. A página pública está exibindo a alternativa em texto.`, link: `/admin/consultas/${l.ownerId}/anexos` });
      }
    }
  }
  return changed;
}
