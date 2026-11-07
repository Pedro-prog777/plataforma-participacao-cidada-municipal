"use server";
/** Ações da área do cidadão: perfil, LGPD, verificação, avisos, votação, propostas, comentários e denúncias. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../db/client";
import { getSession, requireCitizen } from "../auth/current";
import { clientIp, ipHash } from "../lib/request";
import { verifyPayload } from "../lib/crypto";
import { createCaptcha, verifyCaptcha } from "../lib/captcha";
import { hit } from "../lib/rate-limit";
import { changePassword } from "../modules/auth/auth.service";
import { revokeAllSessions } from "../modules/auth/session.service";
import { deactivateAccount, requestDataCopy, updateProfile } from "../modules/profile/profile.service";
import { markAllRead, savePreferences, OPTIONAL_TYPES } from "../modules/notifications/notifications.service";
import { completeProviderFlow, startProviderFlow, submitDocuments } from "../modules/identity/identity.service";
import { getIdentityProvider, type IdentityLevel } from "../lib/identity-provider";
import { castVote, requestVoteCode, verifyReceipt } from "../modules/voting/voting.service";
import { resubmitAfterAdjustment, submitCitizenProposal, supportProposal } from "../modules/proposals/citizen-proposals.service";
import { postComment, reportContent, requestModerationReview, markHelpful } from "../modules/moderation/moderation.service";
import { askQuestion } from "../modules/events/events.service";
import { participations } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { attempt, files, obj, str, withValues, type FormState } from "./helpers";
import { MINUTE } from "../lib/clock";

/* ------------------------------ Perfil ------------------------------ */
export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const r = await attempt(() => updateProfile(a.id, obj(fd), ipHash(String(a.id))));
  if (!r.ok) return withValues(r.state, fd);
  redirect(`/conta?ok=${r.value.emailPending ? "perfil_email" : r.value.addressChanged ? "perfil_endereco" : "perfil"}`);
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/entrar");
  const r = await attempt(() => changePassword(s.userId, s.sessionId, { current: str(fd, "current"), password: str(fd, "password"), confirm: str(fd, "confirm") }, ipHash(s.userId)));
  if (!r.ok) return r.state;
  redirect(`${s.kind === "admin" ? "/admin" : "/conta"}?ok=senha_alterada`);
}

export async function revokeOtherSessionsAction() {
  const s = await getSession();
  if (!s) redirect("/entrar");
  await revokeAllSessions(getDb(), s.userId, s.sessionId);
  redirect("/conta/privacidade?ok=sessoes_encerradas");
}

export async function savePreferencesAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const types = Object.fromEntries(OPTIONAL_TYPES.map((t) => [t, { email: fd.get(`${t}.email`) === "on", inApp: fd.get(`${t}.inApp`) === "on" }]));
  await savePreferences(a.id, { types, themeIds: fd.getAll("themeIds").map(String), districtIds: fd.getAll("districtIds").map(String) });
  redirect("/conta/notificacoes?ok=preferencias");
}

export async function markReadAction() {
  const a = await requireCitizen();
  await markAllRead(a.id);
  revalidatePath("/conta/avisos");
}

export async function requestDataAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const format = str(fd, "format") === "pdf" ? "pdf" : "json";
  const r = await attempt(() => requestDataCopy(a.id, str(fd, "password"), format, ipHash(a.id)));
  if (!r.ok) return r.state;
  redirect("/conta/privacidade?ok=dados");
}

export async function deactivateAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const r = await attempt(() => deactivateAccount(a.id, str(fd, "password"), str(fd, "confirmText"), ipHash(a.id)));
  if (!r.ok) return r.state;
  redirect("/?ok=conta_desativada");
}

/* ------------------------- Verificação (RF004) ------------------------- */
export async function startIdentityProviderAction() {
  const a = await requireCitizen("/conta/verificacao");
  const state = startProviderFlow(a.id);
  redirect(getIdentityProvider().authorizationUrl(state, "/conta/verificacao"));
}

/** Retorno do provedor SIMULADO (demonstração). Com o gov.br real, seria o callback OIDC. */
export async function simulatedProviderReturnAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen("/conta/verificacao");
  const provider = getIdentityProvider();
  if (!provider.simulated) return { ok: false, message: "Provedor simulado indisponível." };
  const r = await attempt(() =>
    completeProviderFlow(a.id, str(fd, "state"), { cpf: str(fd, "cpf"), name: "Titular", level: (str(fd, "level") || "bronze") as IdentityLevel, providerName: provider.name, simulated: true, residenceCity: str(fd, "residenceCity") || null }),
  );
  if (!r.ok) return withValues(r.state, fd);
  if (!r.value.ok) return withValues({ ok: false, message: r.value.reason }, fd);
  redirect("/conta?ok=verificado");
}

export async function submitDocumentsAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen("/conta/verificacao");
  const r = await attempt(() => submitDocuments(a.id, { files: files(fd, "files"), includesAddressProof: fd.get("includesAddressProof") === "on", fullName: str(fd, "fullName") || undefined, birthDate: str(fd, "birthDate") || undefined }));
  if (!r.ok) return withValues(r.state, fd);
  redirect("/conta/verificacao?ok=documentos");
}

/* --------------------------- Votação (RF037) --------------------------- */
/** Passo 2: revisão da escolha + envio do código (RF011). A escolha NÃO é gravada no servidor. */
export async function prepareVoteAction(consultationId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const choice = str(fd, "choice");
  if (!choice) return { ok: false, message: "Escolha uma alternativa para continuar.", fieldErrors: { choice: ["Escolha uma alternativa."] } };
  const channel = str(fd, "channel") === "celular" ? "celular" : "email";
  const r = await attempt(() => requestVoteCode(a.id, consultationId, channel));
  if (!r.ok) return { ...r.state, values: { choice } };
  return { ok: true, data: { step: "confirmar", choice, destination: r.value.maskedDestination, channel }, values: { choice } };
}

/** Passo 3: confirmação com o código e gravação atômica. */
export async function castVoteAction(consultationId: string, prev: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const choice = str(fd, "choice");
  const r = await attempt(() => castVote(a.id, { consultationId, alternativeId: choice === "abstencao" ? null : choice, abstention: choice === "abstencao", code: str(fd, "code") }));
  if (!r.ok) {
    // Código bloqueado, participação anterior ou consulta fora do período: recomeça do passo 1.
    const restart = /interrompida|já participou|não está aberta|suspensa/i.test(r.state.message ?? "");
    return { ...r.state, data: { ...prev.data, step: restart ? "escolher" : "confirmar" }, values: { choice } };
  }
  const [p] = await getDb().select({ id: participations.id }).from(participations).where(and(eq(participations.citizenId, a.id), eq(participations.consultationId, consultationId)));
  redirect(`/conta/participacoes/${p.id}?novo=1`);
}

/* ------------------------ Comprovante (RF041) ------------------------ */
export async function verifyReceiptAction(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const n = hit(`comprovante:${ip}`, MINUTE);
  if (n > 10 && !verifyCaptcha(str(fd, "captchaToken"), str(fd, "captchaAnswer"))) {
    return withValues({ ok: false, message: "Muitas consultas a partir desta rede. Responda à verificação.", data: { captcha: createCaptcha() } }, fd);
  }
  const code = str(fd, "code");
  const result = await verifyReceipt(code);
  if (!result) return withValues({ ok: false, message: "Código não encontrado. Confira os 12 caracteres do comprovante." }, fd);
  return withValues({ ok: true, data: { result } }, fd);
}

/* --------------------------- Propostas (RF020) --------------------------- */
export async function submitProposalAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen("/conta/propostas/nova");
  const r = await attempt(() => submitCitizenProposal(a.id, obj(fd), files(fd, "files")));
  if (!r.ok) return withValues(r.state, fd);
  redirect(`/conta/propostas/${r.value.id}?ok=proposta`);
}

export async function resubmitProposalAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen();
  const r = await attempt(() => resubmitAfterAdjustment(a.id, id, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  redirect(`/conta/propostas/${id}?ok=proposta_ajustada`);
}

export async function supportAction(proposalId: string, protocol: string, _: FormState): Promise<FormState> {
  const a = await requireCitizen(`/propostas/${protocol}`);
  const r = await attempt(() => supportProposal(a.id, proposalId));
  if (!r.ok) return r.state;
  redirect(`/propostas/${protocol}?ok=apoio`);
}

/* -------------------- Comentários e denúncias (RF064, RF065) -------------------- */
export async function commentAction(targetType: "consultation" | "citizen_proposal", targetId: string, back: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen(back);
  const r = await attempt(() => postComment(a.id, { targetType, targetId, body: str(fd, "body"), kind: str(fd, "kind") === "pergunta" ? "pergunta" : "comentario" }));
  if (!r.ok) return withValues(r.state, fd);
  redirect(`${back}?ok=comentario#comentarios`);
}

export async function helpfulAction(commentId: string, back: string) {
  const a = await requireCitizen(back);
  await markHelpful(a.id, commentId);
  revalidatePath(back);
}

export async function reportAction(targetType: "comment" | "citizen_proposal", targetId: string, back: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect(`/entrar?proximo=${encodeURIComponent(back)}`);
  const r = await attempt(() => reportContent(s.userId, { targetType, targetId, reason: str(fd, "reason"), details: str(fd, "details") }));
  if (!r.ok) return r.state;
  return { ok: true, message: r.value.repeated ? "Você já havia denunciado este conteúdo; a denúncia anterior continua válida." : `Denúncia registrada. Protocolo: ${r.value.protocol}.` };
}

export async function requestReviewAction(decisionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen("/conta/avisos");
  const r = await attempt(() => requestModerationReview(a.id, decisionId, str(fd, "reason")));
  if (!r.ok) return r.state;
  redirect("/conta/avisos?ok=revisao_solicitada");
}

export async function eventQuestionAction(eventId: string, channel: "antecipada" | "ao_vivo", _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireCitizen(`/eventos/${eventId}`);
  const r = await attempt(() => askQuestion({ eventId, body: str(fd, "body"), authorId: a.id, channel }));
  if (!r.ok) return withValues(r.state, fd);
  return { ok: true, message: `Pergunta registrada. Protocolo: ${r.value}.` };
}

/* --------------------------- Descadastro (RF052) --------------------------- */
export async function unsubscribeFromToken(token: string) {
  const data = verifyPayload<{ u: string; t: string }>(token);
  if (!data) return false;
  const { unsubscribe } = await import("../modules/notifications/notifications.service");
  return unsubscribe(data.u, data.t);
}
