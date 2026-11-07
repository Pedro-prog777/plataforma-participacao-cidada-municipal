"use server";
/** Ações administrativas. Cada uma exige sessão administrativa com 2º fator; os serviços verificam permissão e papel. */
import { redirect } from "next/navigation";
import { requireAdmin } from "../auth/current";
import { createMunicipalProposal, updateMunicipalProposal } from "../modules/proposals/municipal-proposals.service";
import {
  alterPublished,
  ALTERNATIVE_TEMPLATES,
  cancelConsultation,
  closeSuspendedForTally,
  createConsultation,
  decideApproval,
  decideExceptionalDeadline,
  publishConsultation,
  resumeConsultation,
  reviewConsultation,
  setAlternatives,
  setAssignments,
  setAudience,
  submitForReview,
  suspendConsultation,
  unscheduleConsultation,
  updateConsultation,
  type CriterionInput,
  type PublishedChange,
} from "../modules/consultations/lifecycle.service";
import { addAttachment } from "../modules/attachments/attachments.service";
import { registerDissemination } from "../modules/dissemination/dissemination.service";
import { publishFinalResult, publishRectification, recount, tallyConsultation, verifyIntegrity } from "../modules/results/results.service";
import { registerOutcome, updateOutcomeStatus } from "../modules/outcomes/outcomes.service";
import { analyzeProposal, type AnalysisAction } from "../modules/proposals/citizen-proposals.service";
import { decideModeration, officialAnswer } from "../modules/moderation/moderation.service";
import { decideVerification } from "../modules/identity/identity.service";
import { deleteRole, inviteAdmin, saveRole, setAccountStatus, setUserRoles, updateSettings } from "../modules/admin/users.service";
import { registerIncident, updateIncident } from "../modules/integrity/incidents.service";
import { askQuestion, createEvent, updateEventMaterials } from "../modules/events/events.service";
import { runSchedulerTick } from "../modules/scheduler/scheduler.service";
import { assertPermission } from "../modules/access/access.service";
import type { ConsultationRole } from "@/lib/permissions";
import { CONSULTATION_ROLE_KEYS } from "@/lib/permissions";
import { attempt, files, obj, str, withValues, type FormState } from "./helpers";

const back = (path: string, ok: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${ok}`);

/* --------------------------- Propostas municipais (RF022) --------------------------- */
export async function saveMunicipalProposalAction(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => (id ? updateMunicipalProposal(a, id, obj(fd)) : createMunicipalProposal(a, obj(fd))));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/propostas-municipais/${r.value.id}`, id ? "salvo" : "criado");
  return {};
}

/* --------------------------- Consultas (RF024–RF035) --------------------------- */
export async function createConsultationAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => createConsultation(a, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${r.value.id}/alternativas`, "criado");
  return {};
}

export async function updateConsultationAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => updateConsultation(a, id, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "salvo");
  return {};
}

export async function alternativesAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const template = str(fd, "template");
  const items =
    template && ALTERNATIVE_TEMPLATES[template]
      ? ALTERNATIVE_TEMPLATES[template]
      : fd
          .getAll("label")
          .map((l, i) => ({ label: String(l), explanation: String(fd.getAll("explanation")[i] ?? "") }))
          .filter((x) => x.label.trim());
  const r = await attempt(() => setAlternatives(a, id, { items, allowAbstention: fd.get("allowAbstention") === "on" }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/alternativas`, "salvo");
  return {};
}

export async function audienceAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const open = str(fd, "mode") === "aberta";
  const criteria: CriterionInput[] = [];
  if (!open) {
    if (fd.get("domicilio.on") === "on") criteria.push({ type: "domicilio", justification: str(fd, "domicilio.justification"), publicText: str(fd, "domicilio.publicText") });
    if (fd.get("territorio.on") === "on")
      criteria.push({ type: "territorio", districtIds: fd.getAll("territorio.districtIds").map(String), regionIds: fd.getAll("territorio.regionIds").map(String), justification: str(fd, "territorio.justification"), publicText: str(fd, "territorio.publicText") });
    if (fd.get("faixa_etaria.on") === "on")
      criteria.push({
        type: "faixa_etaria",
        minAge: str(fd, "faixa_etaria.minAge") ? Number(str(fd, "faixa_etaria.minAge")) : null,
        maxAge: str(fd, "faixa_etaria.maxAge") ? Number(str(fd, "faixa_etaria.maxAge")) : null,
        justification: str(fd, "faixa_etaria.justification"),
        publicText: str(fd, "faixa_etaria.publicText"),
      });
    if (fd.get("outro.on") === "on") criteria.push({ type: "outro", description: str(fd, "outro.publicText"), justification: str(fd, "outro.justification"), publicText: str(fd, "outro.publicText") });
  }
  const r = await attempt(() => setAudience(a, id, { open, criteria, youthModality: str(fd, "youthModality") || null, youthSafeguards: str(fd, "youthSafeguards") || null }));
  if (!r.ok) {
    // Ajusta os nomes dos erros por índice para os campos do formulário.
    const fe: Record<string, string[]> = { ...(r.state.fieldErrors ?? {}) };
    criteria.forEach((c, i) => {
      for (const k of ["justification", "publicText", "type"]) if (fe[`criteria.${i}.${k}`]) fe[`${c.type}.${k === "type" ? "justification" : k}`] = fe[`criteria.${i}.${k}`];
    });
    return withValues({ ...r.state, fieldErrors: fe }, fd);
  }
  back(`/admin/consultas/${id}/publico-alvo`, "salvo");
  return {};
}

export async function assignmentsAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("responsaveis.designar", id);
  const input: Partial<Record<ConsultationRole, string[]>> = {};
  for (const role of CONSULTATION_ROLE_KEYS) input[role] = fd.getAll(role).map(String).filter(Boolean);
  const r = await attempt(() => setAssignments(a, id, input, str(fd, "justification") || null));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/responsaveis`, "salvo");
  return {};
}

export async function submitReviewAction(id: string, _: FormState): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => submitForReview(a, id));
  if (!r.ok) return r.state;
  back(`/admin/consultas/${id}`, "enviado_revisao");
  return {};
}

export async function reviewAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const items = Object.fromEntries(fd.getAll("items").map((k) => [String(k), true]));
  const r = await attempt(() => reviewConsultation(a, id, { items, observations: str(fd, "observations") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "revisada");
  return {};
}

export async function deadlineAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => decideExceptionalDeadline(a, id, { authorize: str(fd, "decision") === "autorizar", justification: str(fd, "justification") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/aprovacao`, "decisao");
  return {};
}

export async function approvalAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => decideApproval(a, id, { approve: str(fd, "decision") === "aprovar", justification: str(fd, "justification") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "decisao");
  return {};
}

export async function publishAction(id: string, _: FormState): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => publishConsultation(a, id));
  if (!r.ok) return r.state;
  back(`/admin/consultas/${id}`, "publicada");
  return {};
}

export async function unscheduleAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => unscheduleConsultation(a, id, str(fd, "justification")));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "salvo");
  return {};
}

export async function alterPublishedAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const kind = str(fd, "kind");
  const change: PublishedChange =
    kind === "prorrogacao"
      ? { kind, closesAt: str(fd, "closesAt"), justification: str(fd, "justification") }
      : kind === "ajuste_abertura"
        ? { kind, opensAt: str(fd, "opensAt"), justification: str(fd, "justification") }
        : { kind: "correcao", field: str(fd, "field") as "summary", value: str(fd, "value"), changesMeaning: fd.get("changesMeaning") === "on", justification: str(fd, "justification") };
  const r = await attempt(() => alterPublished(a, id, change));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/conducao`, "alterada");
  return {};
}

export async function suspendAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => suspendConsultation(a, id, str(fd, "justification")));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/conducao`, "suspensa");
  return {};
}

export async function resumeAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => resumeConsultation(a, id, { justification: str(fd, "justification"), newClosesAt: str(fd, "newClosesAt") || undefined }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/conducao`, "retomada");
  return {};
}

export async function closeSuspendedAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(async () => {
    await closeSuspendedForTally(a, id, str(fd, "justification"));
    const integrity = await verifyIntegrity(id, "encerramento");
    if (integrity.passed) await tallyConsultation(id);
  });
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "salvo");
  return {};
}

export async function cancelAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => cancelConsultation(a, id, { justification: str(fd, "justification"), confirmTitle: str(fd, "confirmTitle") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}`, "cancelada");
  return {};
}

export async function attachmentAction(ownerType: "consultation" | "municipal_proposal", ownerId: string, backTo: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const file = files(fd, "file")[0] ?? null;
  const r = await attempt(() => addAttachment(a, { ownerType, ownerId, title: str(fd, "title"), altText: str(fd, "altText"), transcript: str(fd, "transcript"), captionsUrl: str(fd, "captionsUrl"), url: str(fd, "url"), file, justification: str(fd, "justification") }));
  if (!r.ok) return withValues(r.state, fd);
  back(backTo, "criado");
  return {};
}

export async function disseminationAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => registerDissemination(a, id, { channel: str(fd, "channel"), usedOn: str(fd, "usedOn"), notes: str(fd, "notes"), customText: str(fd, "customText") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/divulgacao`, "divulgacao");
  return {};
}

/* --------------------------- Resultados (RF042, RF043) --------------------------- */
export async function recountAction(id: string, _: FormState): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => recount(a, id));
  if (!r.ok) return r.state;
  const cmp = r.value.ok ? r.value.comparison : null;
  return { ok: true, message: !r.value.ok ? "A verificação de integridade falhou; recontagem bloqueada e incidente aberto." : cmp?.equal ? "Recontagem concluída: resultado idêntico à apuração anterior (mesmo hash)." : "Recontagem concluída com resultado DIFERENTE da anterior. Um incidente foi aberto." };
}

export async function publishResultAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => publishFinalResult(a, id, str(fd, "note")));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/resultado`, "resultado");
  return {};
}

export async function rectifyAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => publishRectification(a, id, { justification: str(fd, "justification"), note: str(fd, "note") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/resultado`, "retificacao");
  return {};
}

export async function outcomeAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => registerOutcome(a, id, { decision: str(fd, "decision"), actions: str(fd, "actions"), organId: str(fd, "organId"), status: str(fd, "status"), justification: str(fd, "justification"), expectedDate: str(fd, "expectedDate") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${id}/encaminhamentos`, "encaminhamento");
  return {};
}

export async function outcomeStatusAction(consultationId: string, outcomeId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => updateOutcomeStatus(a, outcomeId, { status: str(fd, "status"), justification: str(fd, "justification"), expectedDate: str(fd, "expectedDate") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/consultas/${consultationId}/encaminhamentos`, "encaminhamento");
  return {};
}

/* --------------------------- Propostas cidadãs (RF021) --------------------------- */
export async function analyzeAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const action = str(fd, "action");
  const act: AnalysisAction =
    action === "solicitar_ajuste"
      ? { action, guidance: str(fd, "guidance") }
      : action === "responder"
        ? { action, responseType: str(fd, "responseType") as "convertida", responseText: str(fd, "responseText") }
        : action === "encerrar"
          ? { action, justification: str(fd, "justification") }
          : { action: action as "iniciar_analise" | "publicar" };
  const r = await attempt(() => analyzeProposal(a, id, act));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/propostas/${id}`, "decisao");
  return {};
}

/* --------------------------- Moderação (RF066) --------------------------- */
export async function moderateAction(targetType: "comment" | "citizen_proposal", targetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => decideModeration(a, { targetType, targetId, decision: str(fd, "decision") as "manter", justification: str(fd, "justification"), redactedText: str(fd, "redactedText") }));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/moderacao", "moderacao");
  return {};
}

export async function officialAnswerAction(commentId: string, backTo: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => officialAnswer(a, commentId, str(fd, "body")));
  if (!r.ok) return withValues(r.state, fd);
  back(backTo, "salvo");
  return {};
}

/* --------------------------- Identidade (RF004) --------------------------- */
export async function verificationDecisionAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin();
  const r = await attempt(() => decideVerification(a, id, { approve: str(fd, "decision") === "aprovar", reason: str(fd, "reason"), confirmAddress: fd.get("confirmAddress") === "on" }));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/verificacoes", "decisao");
  return {};
}

/* --------------------------- Usuários e papéis (RF046, RF047) --------------------------- */
export async function inviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("usuarios.gerenciar");
  const r = await attempt(() => inviteAdmin(a, { name: str(fd, "name"), registration: str(fd, "registration"), email: str(fd, "email"), organId: str(fd, "organId"), roleIds: fd.getAll("roleIds").map(String) }));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/usuarios", "convite");
  return {};
}

export async function accountStatusAction(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("usuarios.gerenciar");
  const r = await attempt(() => setAccountStatus(a, userId, str(fd, "action") as "bloquear", str(fd, "justification")));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/usuarios/${userId}`, "salvo");
  return {};
}

export async function userRolesAction(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("papeis.gerenciar");
  const r = await attempt(() => setUserRoles(a, userId, fd.getAll("roleIds").map(String)));
  if (!r.ok) return r.state;
  back(`/admin/usuarios/${userId}`, "salvo");
  return {};
}

export async function saveRoleAction(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("papeis.gerenciar");
  const r = await attempt(() => saveRole(a, { id: id ?? undefined, name: str(fd, "name"), description: str(fd, "description"), permissions: fd.getAll("permissions").map(String) }));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/papeis", "salvo");
  return {};
}

export async function deleteRoleAction(id: string, _: FormState): Promise<FormState> {
  const a = await requireAdmin("papeis.gerenciar");
  const r = await attempt(() => deleteRole(a, id));
  if (!r.ok) return r.state;
  back("/admin/papeis", "salvo");
  return {};
}

export async function settingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("configuracoes.gerenciar");
  const r = await attempt(() => updateSettings(a, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/configuracoes", "salvo");
  return {};
}

/* --------------------------- Incidentes (RF060) --------------------------- */
export async function incidentUpdateAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("incidentes.tratar");
  const r = await attempt(() => updateIncident(a, id, { status: str(fd, "status") as "encerrado", conclusion: str(fd, "conclusion") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/incidentes/${id}`, "incidente");
  return {};
}

export async function incidentCreateAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("incidentes.tratar");
  const r = await attempt(() => registerIncident(a, { severity: (str(fd, "severity") || "media") as "media", type: str(fd, "type") || "manual", consultationId: str(fd, "consultationId") || null, description: str(fd, "description") }));
  if (!r.ok) return withValues(r.state, fd);
  back(`/admin/incidentes/${r.value.id}`, "criado");
  return {};
}

/* --------------------------- Eventos (RF068) --------------------------- */
export async function createEventAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("eventos.gerenciar");
  const r = await attempt(() => createEvent(a, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/eventos", "criado");
  return {};
}

export async function updateEventAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("eventos.gerenciar");
  const r = await attempt(() => updateEventMaterials(a, id, obj(fd)));
  if (!r.ok) return withValues(r.state, fd);
  back("/admin/eventos", "salvo");
  return {};
}

export async function phoneQuestionAction(eventId: string, _: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("atendimento.registrar");
  const r = await attempt(() => askQuestion({ eventId, body: str(fd, "body"), registeredBy: a, channel: "telefone" }));
  if (!r.ok) return withValues(r.state, fd);
  return { ok: true, message: `Pergunta por telefone registrada. Protocolo: ${r.value}.` };
}

/* --------------------------- Rotina (RF019) --------------------------- */
export async function runTickAction(_: FormState): Promise<FormState> {
  const a = await requireAdmin("consultas.acompanhar");
  await assertPermission(a, "consultas.acompanhar");
  const s = await runSchedulerTick();
  return { ok: true, message: `Rotina executada: ${JSON.stringify(s)}` };
}
