/**
 * Ciclo de vida da consulta pública (RF024–RF035, RF061; RN11–RN15, RN20, RN32, RN34–RN37).
 *
 *  rascunho ──submeter──▶ em_revisao ──revisão ok──▶ em_analise ──aprovar──▶ aprovada ──publicar──▶ agendada
 *     ▲  ▲                    │ problema                  │ rejeitar                                   │ abertura automática
 *     │  └────────────────────┘                           ▼                                            ▼
 *     └───────── editar ◀──────────────────────────── rejeitada                 suspensa ◀──▶ aberta ──encerramento──▶ encerrada ─▶ apurada ─▶ finalizada
 *  cancelada: a partir de aprovada/agendada/aberta/suspensa/encerrada (irreversível, RN32).
 */
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "../../db/client";
import {
  alternatives,
  attachments,
  audienceCriteria,
  consultationAssignments,
  consultations,
  districts,
  municipalProposals,
  reviewChecklists,
  users,
} from "../../db/schema";
import { clock, DAY, HOUR } from "../../lib/clock";
import { ConflictError, DomainError, ForbiddenError, parseOrThrow, ValidationError, type FieldErrors } from "../../lib/errors";
import { getSetting } from "../../lib/settings";
import { CONFLICTS_WITH_APPROVER, CONSULTATION_ROLES, CONSULTATION_ROLE_KEYS, type ConsultationRole, type Permission } from "@/lib/permissions";
import { daysBetween, fmtDateTime, parseLocalDateTime, YOUTH_MODALITIES_PERMITIDAS } from "@/lib/labels";
import { normalizeSearch, sanitizePlainText, slugify } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertConsultationRole, assertPermission, consultationRolesOf, loadActor, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";
import { notifyChange, notifyPublished } from "../notifications/dispatch";
import { matchesAudience, type EligibilityUser } from "../voting/eligibility";
import { consultationSnapshot, getConsultationOrThrow, recordPublicEvent, saveVersion, type ConsultationRow } from "./common";
import { municipalProposalPendencies } from "../proposals/municipal-proposals.service";

const EDITABLE: ConsultationRow["status"][] = ["rascunho", "rejeitada"];

/**
 * Texto de busca (RF017: título, resumo e proposta). Calculado em um só lugar: antes, a edição e a
 * alteração publicada recalculavam só com título e resumo, e a consulta sumia da busca pela proposta.
 */
async function searchTextFor(db: DbOrTx, c: { title: string; summary: string | null }, municipalProposalId: string) {
  const [p] = await db.select({ title: municipalProposals.title, summary: municipalProposals.summary }).from(municipalProposals).where(eq(municipalProposals.id, municipalProposalId));
  return normalizeSearch(`${c.title} ${c.summary ?? ""} ${p?.title ?? ""} ${p?.summary ?? ""}`);
}
const t = (max: number) => z.string().optional().transform((v) => sanitizePlainText(v ?? "").slice(0, max));

/* ------------------------------------------------------------------ */
/* RF025 — Cadastrar consulta                                          */
/* ------------------------------------------------------------------ */
const consultationFields = z.object({
  title: z.string().transform((v) => sanitizePlainText(v)).pipe(z.string().min(5, "Informe o título (mínimo 5 caracteres).").max(200)),
  summary: t(600),
  themeId: z.string().optional().transform((v) => v || null),
  regionId: z.string().optional().transform((v) => v || null),
  organId: z.string().optional().transform((v) => v || null),
  problem: t(5000),
  objective: t(5000),
  justification: t(5000),
  participationForm: z.enum(["votacao"]).default("votacao"),
  question: z.string().optional().transform((v) => sanitizePlainText(v ?? "")).pipe(z.string().max(300, "A pergunta deve ter no máximo 300 caracteres.")),
  guidance: t(5000),
  opensAt: z.string().optional().transform((v) => parseLocalDateTime(v)),
  closesAt: z.string().optional().transform((v) => parseLocalDateTime(v)),
  exceptionalDeadline: z.string().optional().transform((v) => v === "on" || v === "true"),
  emergencyJustification: t(3000).transform((v) => v || null),
  quorumType: z.enum(["nenhum", "absoluto", "percentual"]).default("nenhum"),
  quorumValue: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(",", ".").trim() : null))
    .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), "Quórum inválido."),
  nextSteps: t(5000),
  ownRite: z.string().optional().transform((v) => v === "on" || v === "true"),
  ownRiteConfirmed: z.string().optional().transform((v) => v === "on" || v === "true"),
  version: z.coerce.number().int().optional(),
});

function validateDates(data: { opensAt: Date | null; closesAt: Date | null; exceptionalDeadline: boolean; emergencyJustification: string | null }, prazoPadrao: number, prazoExcepcional: number, errors: FieldErrors) {
  if (data.opensAt && data.closesAt) {
    if (data.closesAt <= data.opensAt) errors.closesAt = ["O encerramento deve ser posterior à abertura."];
    else {
      const days = daysBetween(data.opensAt, data.closesAt);
      const min = data.exceptionalDeadline ? prazoExcepcional : prazoPadrao;
      if (days < min - 1e-9) {
        errors.closesAt = [
          data.exceptionalDeadline
            ? `Mesmo com prazo excepcional, o período mínimo é de ${prazoExcepcional} dias (RN14).`
            : `O período padrão é de ${prazoPadrao} dias (RN14). Para reduzir para ${prazoExcepcional} dias, marque "prazo excepcional" e justifique a emergência.`,
        ];
      }
    }
    if (data.opensAt < clock.now()) errors.opensAt = ["A abertura deve ser uma data futura."];
  }
  if (data.exceptionalDeadline && !data.emergencyJustification) errors.emergencyJustification = ["Justifique a emergência para pedir o prazo excepcional."];
}

export async function createConsultation(actor: Actor, input: Record<string, unknown>, db: DbOrTx = getDb()) {
  await assertPermission(actor, "consultas.elaborar", {}, db);
  const proposalId = String(input.municipalProposalId ?? "");
  const data = parseOrThrow(consultationFields, input);
  const [prazoPadrao, prazoExcepcional, publicoPadrao] = await Promise.all([
    getSetting("consulta.prazo_padrao_dias", db),
    getSetting("consulta.prazo_excepcional_dias", db),
    getSetting("consulta.publico_padrao", db),
  ]);
  const errors: FieldErrors = {};
  validateDates(data, prazoPadrao, prazoExcepcional, errors);
  if (data.ownRite && !data.ownRiteConfirmed) errors.ownRiteConfirmed = ["Confirme que a norma aplicável ao rito próprio foi verificada."];
  if (Object.keys(errors).length) throw new ValidationError(errors);

  return db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(municipalProposals).where(eq(municipalProposals.id, proposalId)).for("update");
    if (!proposal) throw new ValidationError({ municipalProposalId: ["Selecione a proposta municipal."] });
    // Pré-condição: proposta em Rascunho sem consulta ativa.
    const active = await tx
      .select({ id: consultations.id })
      .from(consultations)
      .where(and(eq(consultations.municipalProposalId, proposalId), inArray(consultations.status, ["rascunho", "em_revisao", "em_analise", "rejeitada", "aprovada", "agendada", "aberta", "suspensa"])));
    if (active.length) throw new DomainError("Esta proposta já possui uma consulta em andamento.", "consulta_ativa");
    if (proposal.status !== "rascunho") throw new DomainError("A proposta precisa estar em Rascunho.", "proposta_status");

    const now = clock.now();
    // O sistema sugere encerramento 20 dias após a abertura.
    const closesAt = data.closesAt ?? (data.opensAt ? new Date(data.opensAt.getTime() + prazoPadrao * DAY) : null);
    const slugBase = slugify(data.title) || "consulta";
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;
    const { version: _v, ...fields } = data;
    const [c] = await tx
      .insert(consultations)
      .values({
        ...fields,
        closesAt,
        organId: fields.organId ?? proposal.organId,
        themeId: fields.themeId ?? proposal.themeId,
        slug,
        municipalProposalId: proposalId,
        status: "rascunho",
        deadlineAuthorization: data.exceptionalDeadline ? "pendente" : "nao_aplicavel",
        audienceOpen: publicoPadrao === "aberta",
        searchText: await searchTextFor(tx, data, proposalId),
        createdBy: actor.id,
        lastEditedBy: actor.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    // Até a resposta do cliente (*), o público padrão herdado é o domicílio no município (RF027).
    if (publicoPadrao === "domicilio") {
      await tx.insert(audienceCriteria).values({
        consultationId: c.id,
        type: "domicilio",
        params: {},
        justification: "Padrão herdado da versão anterior do documento (público-alvo padrão pendente de validação com o cliente).",
        publicText: "Pessoas que moram no município, com domicílio comprovado.",
      });
    }
    // Quem cria a consulta é designado como elaborador.
    await tx.insert(consultationAssignments).values({ consultationId: c.id, userId: actor.id, role: "elaborador", assignedBy: actor.id });
    await saveVersion(tx, "consulta", c.id, 1, consultationSnapshot(c), actor.id, "criação");
    await audit(tx, { actorId: actor.id, actorRole: "elaborador", action: "consulta_criada", objectType: "consulta", objectId: c.id });
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* RF024 — Editar consulta em elaboração                               */
/* ------------------------------------------------------------------ */
async function assertEditable(actor: Actor, c: ConsultationRow, db: DbOrTx) {
  if (!EDITABLE.includes(c.status)) {
    throw new DomainError(
      c.status === "em_analise" || c.status === "em_revisao" ? "A consulta está em revisão/análise e não pode ser editada." : "Consulta publicada: use \"Alterar consulta publicada\" (RF032).",
      "edicao_bloqueada",
    );
  }
  await assertConsultationRole(actor, c.id, "elaborador", db);
}

export async function updateConsultation(actor: Actor, id: string, input: Record<string, unknown>, db: DbOrTx = getDb()) {
  const data = parseOrThrow(consultationFields, input);
  const [prazoPadrao, prazoExcepcional] = await Promise.all([getSetting("consulta.prazo_padrao_dias", db), getSetting("consulta.prazo_excepcional_dias", db)]);
  const errors: FieldErrors = {};
  validateDates(data, prazoPadrao, prazoExcepcional, errors);
  if (data.ownRite && !data.ownRiteConfirmed) errors.ownRiteConfirmed = ["Confirme que a norma aplicável ao rito próprio foi verificada."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return db.transaction(async (tx) => {
    const cur = await getConsultationOrThrow(tx, id, { forUpdate: true });
    await assertEditable(actor, cur, tx);
    if (data.version !== undefined && data.version !== cur.version) {
      throw new ConflictError(`Edição simultânea: a consulta foi salva por outra pessoa (versão ${cur.version}). Recarregue para ver as diferenças; nada foi sobrescrito.`);
    }
    const { version: _v, ...fields } = data;
    const deadlineAuthorization = fields.exceptionalDeadline ? (cur.exceptionalDeadline && cur.deadlineAuthorization !== "nao_aplicavel" ? cur.deadlineAuthorization : "pendente") : "nao_aplicavel";
    const [c] = await tx
      .update(consultations)
      .set({
        ...fields,
        deadlineAuthorization: deadlineAuthorization === "negada" && fields.exceptionalDeadline ? "pendente" : deadlineAuthorization,
        searchText: await searchTextFor(tx, fields, cur.municipalProposalId),
        version: cur.version + 1,
        lastEditedBy: actor.id,
        updatedAt: clock.now(),
      })
      .where(eq(consultations.id, id))
      .returning();
    await saveVersion(tx, "consulta", id, c.version, consultationSnapshot(c), actor.id, "edição");
    await audit(tx, { actorId: actor.id, actorRole: "elaborador", action: "consulta_editada", objectType: "consulta", objectId: id, details: { versao: c.version } });
    return c;
  });
}

async function bumpVersion(tx: DbOrTx, c: ConsultationRow, actor: Actor, reason: string) {
  const [n] = await tx.update(consultations).set({ version: c.version + 1, lastEditedBy: actor.id, updatedAt: clock.now() }).where(eq(consultations.id, c.id)).returning();
  const alts = await tx.select().from(alternatives).where(eq(alternatives.consultationId, c.id)).orderBy(asc(alternatives.position));
  const crit = await tx.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, c.id));
  await saveVersion(tx, "consulta", c.id, n.version, { ...consultationSnapshot(n), alternatives: alts, audience: crit }, actor.id, reason);
}

/* ------------------------------------------------------------------ */
/* RF026 — Alternativas de resposta                                    */
/* ------------------------------------------------------------------ */
export const ALTERNATIVE_TEMPLATES: Record<string, { label: string; explanation: string }[]> = {
  sim_nao: [
    { label: "Sim", explanation: "Concordo com a proposta apresentada." },
    { label: "Não", explanation: "Não concordo com a proposta apresentada." },
  ],
  concordo_discordo: [
    { label: "Concordo", explanation: "Sou a favor da proposta." },
    { label: "Discordo", explanation: "Sou contra a proposta." },
  ],
};

export async function setAlternatives(actor: Actor, id: string, input: { items: { label: string; explanation: string }[]; allowAbstention: boolean }, db: DbOrTx = getDb()) {
  const items = input.items.map((i) => ({ label: sanitizePlainText(i.label).slice(0, 120), explanation: sanitizePlainText(i.explanation).slice(0, 1000) })).filter((i) => i.label);
  const errors: FieldErrors = {};
  if (items.length < 2 || items.length > 10) errors.items = ["Defina de 2 a 10 alternativas (RN13)."];
  const seen = new Set<string>();
  items.forEach((i, idx) => {
    const k = normalizeSearch(i.label);
    if (seen.has(k)) (errors[`items.${idx}.label`] ??= []).push("Rótulo repetido.");
    seen.add(k);
  });
  if (Object.keys(errors).length) throw new ValidationError(errors, "Quantidade inválida ou rótulos repetidos.");
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    await assertEditable(actor, c, tx);
    await tx.delete(alternatives).where(eq(alternatives.consultationId, id));
    await tx.insert(alternatives).values(items.map((i, idx) => ({ consultationId: id, label: i.label, explanation: i.explanation, position: idx + 1 })));
    await tx.update(consultations).set({ allowAbstention: input.allowAbstention }).where(eq(consultations.id, id));
    await bumpVersion(tx, { ...c, allowAbstention: input.allowAbstention }, actor, "alternativas");
    await audit(tx, { actorId: actor.id, actorRole: "elaborador", action: "consulta_alternativas_definidas", objectType: "consulta", objectId: id, details: { quantidade: items.length } });
  });
}

/* ------------------------------------------------------------------ */
/* RF027 — Público-alvo                                                */
/* ------------------------------------------------------------------ */
export type CriterionInput = { type: "domicilio" | "territorio" | "faixa_etaria" | "outro"; districtIds?: string[]; regionIds?: string[]; minAge?: number | null; maxAge?: number | null; description?: string; justification: string; publicText: string };

export async function setAudience(
  actor: Actor,
  id: string,
  input: { open: boolean; criteria: CriterionInput[]; youthModality?: string | null; youthSafeguards?: string | null },
  db: DbOrTx = getDb(),
) {
  const errors: FieldErrors = {};
  const criteria = input.open ? [] : input.criteria;
  if (!input.open && !criteria.length) errors.criteria = ['Escolha "aberta ao público em geral" ou adicione ao menos uma limitação justificada.'];
  criteria.forEach((c, i) => {
    if (!sanitizePlainText(c.justification)) (errors[`criteria.${i}.justification`] ??= []).push("Limitação sem justificativa não é permitida.");
    if (!sanitizePlainText(c.publicText)) (errors[`criteria.${i}.publicText`] ??= []).push("Descreva a limitação em linguagem simples para o público.");
    if (c.type === "territorio" && !c.districtIds?.length && !c.regionIds?.length) (errors[`criteria.${i}.type`] ??= []).push("Selecione bairros ou regiões.");
    if (c.type === "faixa_etaria" && c.minAge == null && c.maxAge == null) (errors[`criteria.${i}.type`] ??= []).push("Informe idade mínima e/ou máxima.");
  });
  const youth = criteria.some((c) => c.type === "faixa_etaria" && c.maxAge != null && c.maxAge < 18) || criteria.some((c) => c.type === "faixa_etaria" && c.minAge != null && c.minAge < 18);
  if (youth) {
    if (!input.youthModality) errors.youthModality = ["Consulta voltada a crianças e adolescentes: escolha a modalidade (RN40)."];
    else if (input.youthModality === "voto") errors.youthModality = ["Só vota quem tem 18 anos completos (RF036): para crianças e adolescentes, escolha informativa, educativa ou envio de propostas."];
    else if (!(YOUTH_MODALITIES_PERMITIDAS as readonly string[]).includes(input.youthModality)) errors.youthModality = ["Modalidade inválida."];
    if (!sanitizePlainText(input.youthSafeguards ?? "")) errors.youthSafeguards = ["Descreva as salvaguardas (coleta mínima, linguagem adequada, consentimento quando aplicável)."];
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);

  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    await assertEditable(actor, c, tx);
    await tx.delete(audienceCriteria).where(eq(audienceCriteria.consultationId, id));
    for (const cr of criteria) {
      await tx.insert(audienceCriteria).values({
        consultationId: id,
        type: cr.type,
        params: {
          districtIds: cr.districtIds?.length ? cr.districtIds : undefined,
          regionIds: cr.regionIds?.length ? cr.regionIds : undefined,
          minAge: cr.minAge ?? undefined,
          maxAge: cr.maxAge ?? undefined,
          description: cr.description ? sanitizePlainText(cr.description) : undefined,
        },
        justification: sanitizePlainText(cr.justification),
        publicText: sanitizePlainText(cr.publicText),
      });
    }
    const estimated = await estimateEligible(tx, input.open, criteria);
    await tx
      .update(consultations)
      .set({ audienceOpen: input.open, youthModality: youth ? input.youthModality : null, youthSafeguards: youth ? sanitizePlainText(input.youthSafeguards ?? "") : null, estimatedEligible: estimated })
      .where(eq(consultations.id, id));
    await bumpVersion(tx, c, actor, "público-alvo");
    await audit(tx, { actorId: actor.id, actorRole: "elaborador", action: "consulta_publico_definido", objectType: "consulta", objectId: id, details: { aberta: input.open, criterios: criteria.length } });
    return { estimatedEligible: estimated };
  });
}

/** Estima elegíveis entre as contas de cidadão ativas (RF027, passo 3). */
export async function estimateEligible(db: DbOrTx, open: boolean, criteria: { type: string; districtIds?: string[]; regionIds?: string[]; minAge?: number | null; maxAge?: number | null }[]) {
  const rows = await db
    .select({ id: users.id, kind: users.kind, status: users.status, lockedUntil: users.lockedUntil, verificationLevel: users.verificationLevel, districtId: users.districtId, regionId: districts.regionId, domicileVerifiedAt: users.domicileVerifiedAt, birthDate: users.birthDate })
    .from(users)
    .leftJoin(districts, eq(districts.id, users.districtId))
    .where(and(eq(users.kind, "cidadao"), eq(users.status, "ativa")));
  const ec = { audienceOpen: open, criteria: criteria.map((c) => ({ type: c.type, params: { districtIds: c.districtIds, regionIds: c.regionIds, minAge: c.minAge ?? undefined, maxAge: c.maxAge ?? undefined } })) };
  return rows.filter((u) => matchesAudience(u as EligibilityUser, ec)).length;
}

/* ------------------------------------------------------------------ */
/* RF061 — Responsáveis e papéis da consulta                           */
/* ------------------------------------------------------------------ */
export async function setAssignments(actor: Actor, id: string, input: Partial<Record<ConsultationRole, string[]>>, justification: string | null, db: DbOrTx = getDb()) {
  await assertPermission(actor, "responsaveis.designar", { objectType: "consulta", objectId: id }, db);
  const errors: FieldErrors = {};
  const approvers = new Set(input.aprovador ?? []);
  for (const role of CONFLICTS_WITH_APPROVER) {
    for (const u of input[role] ?? []) if (approvers.has(u)) (errors[role] ??= []).push(`A mesma conta não pode acumular "${CONSULTATION_ROLES[role].label}" e "Aprovação" (RN20).`);
  }
  // Revisor diferente do elaborador (RF028, RN36).
  for (const u of input.revisor ?? []) if ((input.elaborador ?? []).includes(u)) (errors.revisor ??= []).push("O revisor deve ser diferente do elaborador.");
  const allIds = Array.from(new Set(Object.values(input).flat().filter(Boolean) as string[]));
  const accounts = allIds.length
    ? await db.select({ id: users.id, kind: users.kind, status: users.status }).from(users).where(inArray(users.id, allIds))
    : [];
  for (const role of CONSULTATION_ROLE_KEYS) {
    for (const uid of input[role] ?? []) {
      const acc = accounts.find((a) => a.id === uid);
      if (!acc || acc.kind !== "admin" || acc.status !== "ativa") {
        (errors[role] ??= []).push("Conta administrativa inválida ou inativa.");
        continue;
      }
      const a = await loadActor(uid, db);
      if (!a?.permissions.has(CONSULTATION_ROLES[role].permission as Permission)) (errors[role] ??= []).push(`${a?.name ?? "Conta"} não possui a permissão exigida para "${CONSULTATION_ROLES[role].label}".`);
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors, "Combinação vedada ou designação inválida.");

  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    const published = !["rascunho", "rejeitada", "em_revisao", "em_analise", "aprovada"].includes(c.status);
    if (c.status !== "rascunho" && c.status !== "rejeitada" && !sanitizePlainText(justification ?? "")) {
      throw new ValidationError({ justification: ["Substituição durante a consulta exige justificativa (registrada no histórico)."] });
    }
    const current = await tx.select().from(consultationAssignments).where(and(eq(consultationAssignments.consultationId, id), eq(consultationAssignments.active, true)));
    const now = clock.now();
    const changes: string[] = [];
    for (const role of CONSULTATION_ROLE_KEYS) {
      if (!(role in input)) continue;
      const wanted = new Set(input[role] ?? []);
      for (const a of current.filter((x) => x.role === role)) {
        if (!wanted.has(a.userId)) {
          await tx.update(consultationAssignments).set({ active: false, endedAt: now, justification }).where(eq(consultationAssignments.id, a.id));
          changes.push(`-${role}`);
        }
      }
      for (const uid of wanted) {
        if (!current.some((x) => x.role === role && x.userId === uid)) {
          await tx.insert(consultationAssignments).values({ consultationId: id, userId: uid, role, assignedBy: actor.id, justification });
          changes.push(`+${role}`);
          await notifyUser(tx, uid, { type: "conta", title: "Você foi designado(a) em uma consulta", body: `Papel: ${CONSULTATION_ROLES[role].label} — consulta "${c.title}".`, link: `/admin/consultas/${id}` });
        }
      }
    }
    if (published && changes.length) await recordPublicEvent(tx, id, "substituicao_responsavel", "Substituição de responsáveis da consulta", justification);
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "responsaveis_designados", objectType: "consulta", objectId: id, justification, details: { mudancas: changes } });
  });
}

export async function getAssignments(id: string, db: DbOrTx = getDb()) {
  return db
    .select({ id: consultationAssignments.id, role: consultationAssignments.role, userId: users.id, name: users.fullName, email: users.email })
    .from(consultationAssignments)
    .innerJoin(users, eq(users.id, consultationAssignments.userId))
    .where(and(eq(consultationAssignments.consultationId, id), eq(consultationAssignments.active, true)));
}

/* ------------------------------------------------------------------ */
/* RF028 — Validação completa, revisão e submissão                     */
/* ------------------------------------------------------------------ */
export type Pendency = { field: string; message: string; href: string };

export async function consultationPendencies(id: string, db: DbOrTx = getDb()): Promise<Pendency[]> {
  const c = await getConsultationOrThrow(db, id);
  const [prazoPadrao, prazoExcepcional] = await Promise.all([getSetting("consulta.prazo_padrao_dias", db), getSetting("consulta.prazo_excepcional_dias", db)]);
  const base = `/admin/consultas/${id}`;
  const out: Pendency[] = [];
  const req = (cond: boolean, field: string, message: string, href = `${base}/editar#${field}`) => !cond && out.push({ field, message, href });
  req(!!c.title, "title", "Título");
  req(!!c.summary, "summary", "Resumo");
  req(!!c.themeId, "themeId", "Tema");
  req(!!c.organId, "organId", "Unidade responsável");
  req(!!c.problem, "problem", "Problema");
  req(!!c.objective, "objective", "Objetivo");
  req(!!c.justification, "justification", "Justificativa");
  req(!!c.question && c.question.length <= 300, "question", "Pergunta clara e neutra (até 300 caracteres)");
  req(!!c.guidance, "guidance", "Orientações de participação");
  req(!!c.nextSteps, "nextSteps", "O que acontece após o encerramento");
  req(!!c.opensAt && !!c.closesAt, "opensAt", "Datas de abertura e encerramento");
  if (c.opensAt && c.closesAt) {
    const days = daysBetween(c.opensAt, c.closesAt);
    const min = c.exceptionalDeadline ? prazoExcepcional : prazoPadrao;
    req(days >= min - 1e-9, "closesAt", `Período mínimo de ${min} dias (RN14)`);
    req(c.opensAt > clock.now(), "opensAt", "Abertura no futuro");
  }
  if (c.exceptionalDeadline) req(!!c.emergencyJustification, "emergencyJustification", "Justificativa da emergência (prazo excepcional)");
  if (c.ownRite) req(c.ownRiteConfirmed, "ownRiteConfirmed", "Confirmação de que a norma do rito próprio foi verificada");
  if (c.quorumType !== "nenhum") req(!!c.quorumValue, "quorumValue", "Valor do quórum de referência");
  const [{ n: nAlt }] = await db.select({ n: count() }).from(alternatives).where(eq(alternatives.consultationId, id));
  req(nAlt >= 2 && nAlt <= 10, "alternativas", "De 2 a 10 alternativas (RN13)", `${base}/alternativas`);
  const [{ n: nCrit }] = await db.select({ n: count() }).from(audienceCriteria).where(eq(audienceCriteria.consultationId, id));
  req(c.audienceOpen || nCrit > 0, "publico", "Público-alvo definido e justificado", `${base}/publico-alvo`);
  const missingAlt = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.ownerType, "consultation"), eq(attachments.ownerId, id), isNull(attachments.altText)));
  req(missingAlt.length === 0, "anexos", "Todos os materiais com alternativa textual (RN37)", `${base}/anexos`);
  const assigned = await getAssignments(id, db);
  for (const role of CONSULTATION_ROLE_KEYS) {
    const needed = CONSULTATION_ROLES[role].required || (role === "autorizador_prazo" && c.exceptionalDeadline);
    if (needed) req(assigned.some((a) => a.role === role), `papel_${role}`, `Responsável designado: ${CONSULTATION_ROLES[role].label}`, `${base}/responsaveis`);
  }
  const approverIds = new Set(assigned.filter((a) => a.role === "aprovador").map((a) => a.userId));
  const conflict = assigned.some((a) => CONFLICTS_WITH_APPROVER.includes(a.role as ConsultationRole) && approverIds.has(a.userId));
  req(!conflict, "papel_conflito", "Combinação vedada: quem elabora ou revisa não pode aprovar", `${base}/responsaveis`);
  const [proposal] = await db.select().from(municipalProposals).where(eq(municipalProposals.id, c.municipalProposalId));
  if (proposal) municipalProposalPendencies(proposal).forEach((p) => out.push({ field: `proposta_${p.field}`, message: p.message, href: `/admin/propostas-municipais/${proposal.id}` }));
  return out;
}

export async function submitForReview(actor: Actor, id: string, db: DbOrTx = getDb()) {
  const c = await getConsultationOrThrow(db, id);
  await assertEditable(actor, c, db);
  const pend = await consultationPendencies(id, db);
  if (pend.length) {
    const e = new ValidationError({}, "Há pendências antes do envio para revisão.");
    (e as ValidationError & { pendencies?: Pendency[] }).pendencies = pend;
    throw e;
  }
  await db.transaction(async (tx) => {
    await tx.update(consultations).set({ status: "em_revisao", reviewObservations: null, updatedAt: clock.now() }).where(eq(consultations.id, id));
    await tx.update(municipalProposals).set({ status: "em_analise" }).where(eq(municipalProposals.id, c.municipalProposalId));
    for (const r of (await getAssignments(id, tx)).filter((a) => a.role === "revisor")) {
      await notifyUser(tx, r.userId, { type: "conta", title: "Consulta aguardando sua revisão", body: `"${c.title}" foi enviada para revisão.`, link: `/admin/consultas/${id}/revisao` });
    }
    await audit(tx, { actorId: actor.id, actorRole: "elaborador", action: "consulta_enviada_revisao", objectType: "consulta", objectId: id, details: { versao: c.version } });
  });
}

export const REVIEW_ITEMS = {
  conteudo_minimo: "Conteúdo mínimo completo (RN37)",
  pergunta_clara: "Pergunta clara e neutra",
  alternativas_equilibradas: "Alternativas equilibradas e mutuamente exclusivas",
  contexto_suficiente: "Contexto suficiente para decidir",
  publico_justificado: "Público-alvo justificado",
  periodo_conforme: "Período conforme a RN14",
  materiais_acessiveis: "Materiais com alternativa textual",
  linguagem_simples: "Linguagem simples",
} as const;

export async function reviewConsultation(actor: Actor, id: string, input: { items: Record<string, boolean>; observations: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "revisor", db);
  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "em_revisao") throw new DomainError("A consulta não está aguardando revisão.");
    // Revisor diferente do elaborador e do último editor (RN36).
    const roles = await consultationRolesOf(actor.id, id, tx);
    if (roles.includes("elaborador") || c.createdBy === actor.id || c.lastEditedBy === actor.id) throw new ForbiddenError("O revisor deve ser diferente de quem elaborou ou editou a consulta.");
    const items = Object.fromEntries(Object.keys(REVIEW_ITEMS).map((k) => [k, !!input.items[k]]));
    const allOk = Object.values(items).every(Boolean);
    const observations = sanitizePlainText(input.observations ?? "");
    if (!allOk && !observations) throw new ValidationError({ observations: ["Descreva o problema apontado para orientar o elaborador."] });
    await tx.insert(reviewChecklists).values({ consultationId: id, reviewerId: actor.id, version: c.version, items, outcome: allOk ? "aprovada" : "problema", observations: observations || null });
    if (allOk) {
      const alts = await tx.select().from(alternatives).where(eq(alternatives.consultationId, id));
      const crit = await tx.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, id));
      await saveVersion(tx, "consulta", id, c.version, { ...consultationSnapshot(c), alternatives: alts, audience: crit }, actor.id, "versão congelada para aprovação");
      await tx.update(consultations).set({ status: "em_analise", frozenVersion: c.version, updatedAt: clock.now() }).where(eq(consultations.id, id));
      const assigned = await getAssignments(id, tx);
      for (const a of assigned.filter((x) => x.role === "aprovador" || (c.exceptionalDeadline && x.role === "autorizador_prazo"))) {
        await notifyUser(tx, a.userId, { type: "conta", title: "Consulta aguardando decisão", body: `"${c.title}" foi revisada e aguarda ${a.role === "aprovador" ? "aprovação" : "decisão sobre prazo excepcional"}.`, link: `/admin/consultas/${id}/aprovacao` });
      }
    } else {
      await tx.update(consultations).set({ status: "rascunho", reviewObservations: observations, updatedAt: clock.now() }).where(eq(consultations.id, id));
      await tx.update(municipalProposals).set({ status: "rascunho" }).where(eq(municipalProposals.id, c.municipalProposalId));
      for (const e of (await getAssignments(id, tx)).filter((x) => x.role === "elaborador")) {
        await notifyUser(tx, e.userId, { type: "conta", title: "Revisão apontou problemas", body: `"${c.title}" voltou para Rascunho: ${observations}`, link: `/admin/consultas/${id}` });
      }
    }
    await audit(tx, { actorId: actor.id, actorRole: "revisor", action: allOk ? "consulta_revisada_aprovada" : "consulta_revisada_problema", objectType: "consulta", objectId: id, details: { versao: c.version } });
  });
}

/* ------------------------------------------------------------------ */
/* RF029 — Aprovação e autorização de prazo excepcional                */
/* ------------------------------------------------------------------ */
export async function decideExceptionalDeadline(actor: Actor, id: string, input: { authorize: boolean; justification: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "autorizador_prazo", db);
  const justification = sanitizePlainText(input.justification ?? "");
  if (!justification) throw new ValidationError({ justification: ["A decisão sobre o prazo excepcional exige justificativa (RN11)."] });
  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "em_analise" || !c.exceptionalDeadline || c.deadlineAuthorization !== "pendente") throw new DomainError("Não há pedido de prazo excepcional pendente.");
    if (c.createdBy === actor.id || c.lastEditedBy === actor.id) throw new ForbiddenError("Quem elaborou a consulta não decide sobre o próprio pedido de prazo.");
    if (input.authorize) {
      await tx.update(consultations).set({ deadlineAuthorization: "autorizada", deadlineDecisionJustification: justification, deadlineAuthorizedBy: actor.id }).where(eq(consultations.id, id));
    } else {
      // Redução negada: volta a Rascunho com 20 dias sugeridos.
      const prazo = await getSetting("consulta.prazo_padrao_dias", tx);
      const closesAt = c.opensAt ? new Date(c.opensAt.getTime() + prazo * DAY) : c.closesAt;
      await tx
        .update(consultations)
        .set({ deadlineAuthorization: "negada", deadlineDecisionJustification: justification, deadlineAuthorizedBy: actor.id, status: "rascunho", exceptionalDeadline: false, closesAt, reviewObservations: `Prazo excepcional negado: ${justification}. Encerramento sugerido para ${prazo} dias após a abertura.` })
        .where(eq(consultations.id, id));
      await tx.update(municipalProposals).set({ status: "rascunho" }).where(eq(municipalProposals.id, c.municipalProposalId));
    }
    await audit(tx, { actorId: actor.id, actorRole: "autorizador_prazo", action: input.authorize ? "prazo_excepcional_autorizado" : "prazo_excepcional_negado", objectType: "consulta", objectId: id, justification });
  });
}

async function assertAntecedence(c: ConsultationRow, db: DbOrTx) {
  const hours = await getSetting("consulta.antecedencia_minima_horas", db);
  if (!c.opensAt || c.opensAt.getTime() - clock.now().getTime() < hours * HOUR) {
    throw new DomainError(`Antecedência insuficiente: a abertura precisa ocorrer pelo menos ${hours} horas após a ${c.status === "em_analise" ? "aprovação" : "publicação"} (RN15). Ajuste as datas.`, "antecedencia");
  }
}

export async function decideApproval(actor: Actor, id: string, input: { approve: boolean; justification: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "aprovador", db);
  const justification = sanitizePlainText(input.justification ?? "");
  if (!input.approve && !justification) throw new ValidationError({ justification: ["A rejeição exige justificativa (RN11)."] });
  // Segregação de funções (RN20, RN36): aprovador ≠ elaborador, último editor e revisor.
  // Verificada antes da transação para que a tentativa negada fique registrada na auditoria (RF009).
  const pre = await getConsultationOrThrow(db, id);
  const reviewers = (await db.select({ id: reviewChecklists.reviewerId }).from(reviewChecklists).where(eq(reviewChecklists.consultationId, id))).map((r) => r.id);
  const myRoles = await consultationRolesOf(actor.id, id, db);
  if (pre.createdBy === actor.id || pre.lastEditedBy === actor.id || reviewers.includes(actor.id) || myRoles.includes("elaborador") || myRoles.includes("revisor")) {
    await audit(db, { actorId: actor.id, action: "acesso_negado", result: "negado", objectType: "consulta", objectId: id, details: { motivo: "segregacao_de_funcoes" } });
    throw new ForbiddenError("Segregação de funções: ninguém aprova a consulta que elaborou, editou ou revisou (RN20).");
  }
  return db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "em_analise") throw new DomainError("A consulta não está Em análise.");
    if (c.lastEditedBy === actor.id || c.createdBy === actor.id) throw new ForbiddenError("Segregação de funções (RN20).");
    if (input.approve) {
      if (c.exceptionalDeadline && c.deadlineAuthorization !== "autorizada") throw new DomainError("O pedido de prazo excepcional ainda não foi autorizado.", "prazo_pendente");
      await assertAntecedence(c, tx);
      await tx.update(consultations).set({ status: "aprovada", approvedBy: actor.id, approvedAt: clock.now() }).where(eq(consultations.id, id));
      for (const r of (await getAssignments(id, tx)).filter((x) => x.role === "responsavel")) {
        await notifyUser(tx, r.userId, { type: "conta", title: "Consulta aprovada — pronta para publicação", body: `"${c.title}" foi aprovada (versão ${c.frozenVersion}).`, link: `/admin/consultas/${id}` });
      }
    } else {
      await tx.update(consultations).set({ status: "rejeitada", reviewObservations: `Rejeitada pelo aprovador: ${justification}` }).where(eq(consultations.id, id));
      await tx.update(municipalProposals).set({ status: "rascunho" }).where(eq(municipalProposals.id, c.municipalProposalId));
    }
    await audit(tx, { actorId: actor.id, actorRole: "aprovador", action: input.approve ? "consulta_aprovada" : "consulta_rejeitada", objectType: "consulta", objectId: id, justification: justification || null, details: { versao: c.frozenVersion } });
  });
}

/* ------------------------------------------------------------------ */
/* RF030 — Publicar / desfazer agendamento                             */
/* ------------------------------------------------------------------ */
export async function publishConsultation(actor: Actor, id: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "aprovada") throw new DomainError("Somente consultas aprovadas podem ser publicadas.");
    await assertAntecedence(c, tx);
    await tx.update(consultations).set({ status: "agendada", publishedAt: clock.now() }).where(eq(consultations.id, id));
    await tx.update(municipalProposals).set({ status: "em_consulta" }).where(eq(municipalProposals.id, c.municipalProposalId));
    await recordPublicEvent(tx, id, "publicacao", `Consulta publicada. Abertura em ${fmtDateTime(c.opensAt)} e encerramento em ${fmtDateTime(c.closesAt)}.`, c.exceptionalDeadline ? `Prazo excepcional autorizado: ${c.deadlineDecisionJustification}` : null);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "consulta_publicada", objectType: "consulta", objectId: id });
    await notifyPublished(tx, id);
  });
}

export async function unscheduleConsultation(actor: Actor, id: string, justification: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  const j = sanitizePlainText(justification ?? "");
  if (!j) throw new ValidationError({ justification: ["Justifique o cancelamento do agendamento."] });
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "agendada" || (c.opensAt && c.opensAt <= clock.now())) throw new DomainError("Só é possível desfazer o agendamento antes da data de abertura.");
    await tx.update(consultations).set({ status: "em_analise", publishedAt: null, approvedAt: null, approvedBy: null }).where(eq(consultations.id, id));
    await recordPublicEvent(tx, id, "agendamento_desfeito", "Agendamento desfeito; a consulta voltou para análise.", j);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "agendamento_desfeito", objectType: "consulta", objectId: id, justification: j });
  });
}

/* ------------------------------------------------------------------ */
/* RF032 — Alterar consulta publicada                                  */
/* ------------------------------------------------------------------ */
const TEXT_FIELDS = ["summary", "problem", "objective", "justification", "guidance", "nextSteps"] as const;
export type PublishedChange =
  | { kind: "correcao"; field: (typeof TEXT_FIELDS)[number]; value: string; changesMeaning: boolean; justification: string }
  | { kind: "prorrogacao"; closesAt: string; justification: string }
  | { kind: "ajuste_abertura"; opensAt: string; justification: string };

export async function alterPublished(actor: Actor, id: string, change: PublishedChange, db: DbOrTx = getDb()) {
  const justification = sanitizePlainText(change.justification ?? "");
  if (!justification) throw new ValidationError({ justification: ["Toda alteração de consulta publicada exige justificativa (RN11)."] });
  const roleNeeded: ConsultationRole = change.kind === "correcao" && change.changesMeaning ? "aprovador" : "responsavel";
  await assertConsultationRole(actor, id, roleNeeded, db);
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (!["agendada", "aberta", "suspensa"].includes(c.status)) throw new DomainError("Alteração proibida nesta situação (RN12/RN32). Para mudanças de fundo, cancele e crie nova consulta.", "alteracao_proibida");
    let before: unknown;
    let after: unknown;
    const set: Partial<ConsultationRow> = {};
    if (change.kind === "correcao") {
      if (!TEXT_FIELDS.includes(change.field)) throw new DomainError("Pergunta, alternativas, público-alvo e regra de apuração não podem ser alterados após a publicação (RN12). Cancele e crie nova consulta.", "alteracao_proibida");
      const value = sanitizePlainText(change.value).slice(0, 5000);
      if (!value) throw new ValidationError({ value: ["Informe o novo texto."] });
      before = c[change.field];
      after = value;
      set[change.field] = value;
    } else if (change.kind === "prorrogacao") {
      const d = parseLocalDateTime(change.closesAt);
      if (!d || !c.closesAt || d <= c.closesAt) throw new ValidationError({ closesAt: ["A prorrogação deve definir um encerramento posterior ao atual."] });
      if (clock.now() >= c.closesAt) throw new DomainError("A prorrogação só é permitida antes do encerramento (RN32).", "alteracao_proibida");
      before = c.closesAt;
      after = d;
      set.closesAt = d;
    } else {
      if (c.status !== "agendada") throw new DomainError("A abertura só pode ser ajustada enquanto a consulta está Agendada.", "alteracao_proibida");
      const d = parseLocalDateTime(change.opensAt);
      const [prazoPadrao, prazoExcepcional, antecedencia] = await Promise.all([getSetting("consulta.prazo_padrao_dias", tx), getSetting("consulta.prazo_excepcional_dias", tx), getSetting("consulta.antecedencia_minima_horas", tx)]);
      if (!d || d.getTime() - clock.now().getTime() < antecedencia * HOUR) throw new ValidationError({ opensAt: [`A nova abertura deve respeitar a antecedência mínima de ${antecedencia} horas.`] });
      const min = c.exceptionalDeadline ? prazoExcepcional : prazoPadrao;
      if (!c.closesAt || daysBetween(d, c.closesAt) < min - 1e-9) throw new ValidationError({ opensAt: [`A duração mínima de ${min} dias deve ser mantida (RN14).`] });
      before = c.opensAt;
      after = d;
      set.opensAt = d;
    }
    const [n] = await tx
      .update(consultations)
      .set({ ...set, version: c.version + 1, lastEditedBy: actor.id, updatedAt: clock.now(), searchText: await searchTextFor(tx, { title: c.title, summary: set.summary ?? c.summary }, c.municipalProposalId) })
      .where(eq(consultations.id, id))
      .returning();
    await saveVersion(tx, "consulta", id, n.version, consultationSnapshot(n), actor.id, `alteração publicada: ${change.kind}`);
    const label = change.kind === "correcao" ? `Correção textual (${change.field})` : change.kind === "prorrogacao" ? "Prorrogação do encerramento" : "Ajuste da data de abertura";
    const fmt = (v: unknown) => (v instanceof Date ? fmtDateTime(v) : String(v ?? ""));
    await recordPublicEvent(tx, id, "alteracao", label, justification, { antes: fmt(before), depois: fmt(after) });
    await audit(tx, { actorId: actor.id, actorRole: roleNeeded, action: "consulta_publicada_alterada", objectType: "consulta", objectId: id, justification, details: { tipo: change.kind } });
    await notifyChange(tx, id, `Consulta alterada: ${c.title}`, `${label}.\nAntes: ${fmt(before)}\nDepois: ${fmt(after)}\nJustificativa: ${justification}\nEfeito sobre os votos: os votos já registrados permanecem válidos e não podem ser alterados.`);
  });
}

/* ------------------------------------------------------------------ */
/* RF033 — Suspender e retomar                                         */
/* ------------------------------------------------------------------ */
export async function suspendConsultation(actor: Actor, id: string, justification: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  const j = sanitizePlainText(justification ?? "");
  if (!j) throw new ValidationError({ justification: ["A suspensão exige justificativa pública (RN11)."] });
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (!["agendada", "aberta"].includes(c.status)) throw new DomainError("Só é possível suspender consultas Agendadas ou Abertas.");
    await tx.update(consultations).set({ status: "suspensa", statusBeforeSuspension: c.status, statusReason: j }).where(eq(consultations.id, id));
    await recordPublicEvent(tx, id, "suspensao", "Consulta suspensa. Nenhum voto é aceito durante a suspensão; os votos registrados são preservados.", j);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "consulta_suspensa", objectType: "consulta", objectId: id, justification: j });
    await notifyChange(tx, id, `Consulta suspensa: ${c.title}`, `Justificativa: ${j}\nEfeito sobre os votos: os votos já registrados estão preservados; novos votos não são aceitos enquanto durar a suspensão.`);
  });
}

export async function resumeConsultation(actor: Actor, id: string, input: { justification: string; newClosesAt?: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  const j = sanitizePlainText(input.justification ?? "");
  if (!j) throw new ValidationError({ justification: ["A retomada exige justificativa (RN11)."] });
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "suspensa") throw new DomainError("A consulta não está suspensa.");
    const newClose = input.newClosesAt ? parseLocalDateTime(input.newClosesAt) : null;
    if (newClose && c.closesAt && newClose <= c.closesAt) throw new ValidationError({ newClosesAt: ["A prorrogação deve ser posterior ao encerramento atual."] });
    const closesAt = newClose ?? c.closesAt;
    if (closesAt && closesAt <= clock.now()) {
      throw new DomainError("O prazo terminou durante a suspensão. Decida, com justificativa, entre apurar ou cancelar a consulta.", "encerrada_durante_suspensao");
    }
    const target = c.statusBeforeSuspension === "agendada" && c.opensAt && c.opensAt > clock.now() ? "agendada" : "aberta";
    await tx.update(consultations).set({ status: target, statusBeforeSuspension: null, statusReason: null, closesAt, openedAt: target === "aberta" ? (c.openedAt ?? clock.now()) : c.openedAt }).where(eq(consultations.id, id));
    await recordPublicEvent(tx, id, "retomada", newClose ? `Consulta retomada com prorrogação até ${fmtDateTime(newClose)}.` : "Consulta retomada.", j);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "consulta_retomada", objectType: "consulta", objectId: id, justification: j });
    await notifyChange(tx, id, `Consulta retomada: ${c.title}`, `Justificativa: ${j}${newClose ? `\nNovo encerramento: ${fmtDateTime(newClose)}` : ""}`);
  });
}

/** Encerramento durante a suspensão: decide-se entre apurar e cancelar (RF033). */
export async function closeSuspendedForTally(actor: Actor, id: string, justification: string, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  const j = sanitizePlainText(justification ?? "");
  if (!j) throw new ValidationError({ justification: ["Justifique a decisão de apurar."] });
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (c.status !== "suspensa" || !c.closesAt || c.closesAt > clock.now()) throw new DomainError("Disponível apenas para consulta suspensa cujo prazo já terminou.");
    await tx.update(consultations).set({ status: "encerrada", closedAt: clock.now(), statusBeforeSuspension: null }).where(eq(consultations.id, id));
    await recordPublicEvent(tx, id, "encerramento", "Consulta encerrada após suspensão; decidiu-se contar os votos registrados.", j);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "consulta_encerrada_apos_suspensao", objectType: "consulta", objectId: id, justification: j });
  });
}

/* ------------------------------------------------------------------ */
/* RF034 — Cancelar (irreversível)                                     */
/* ------------------------------------------------------------------ */
export async function cancelConsultation(actor: Actor, id: string, input: { justification: string; confirmTitle: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, id, "responsavel", db);
  const j = sanitizePlainText(input.justification ?? "");
  if (!j) throw new ValidationError({ justification: ["O cancelamento exige justificativa (RN11)."] });
  await db.transaction(async (tx) => {
    const c = await getConsultationOrThrow(tx, id, { forUpdate: true });
    if (["apurada", "finalizada"].includes(c.status)) throw new DomainError("Consulta já apurada não pode ser cancelada; cabe retificação do resultado (RF043).", "ja_apurada");
    if (!["aprovada", "agendada", "aberta", "suspensa", "encerrada"].includes(c.status)) throw new DomainError("Esta consulta não pode ser cancelada nesta situação.");
    if ((input.confirmTitle ?? "").trim() !== c.title.trim()) throw new ValidationError({ confirmTitle: ["Digite o título exatamente como aparece para confirmar."] });
    await tx.update(consultations).set({ status: "cancelada", statusReason: j, closedAt: c.closedAt ?? clock.now() }).where(eq(consultations.id, id));
    await tx.update(municipalProposals).set({ status: "rascunho" }).where(eq(municipalProposals.id, c.municipalProposalId));
    await recordPublicEvent(tx, id, "cancelamento", "Consulta cancelada de forma definitiva. Os votos registrados foram guardados sem contagem e não entram em nenhum resultado.", j);
    await audit(tx, { actorId: actor.id, actorRole: "responsavel", action: "consulta_cancelada", objectType: "consulta", objectId: id, justification: j });
    await notifyChange(tx, id, `Consulta cancelada: ${c.title}`, `Justificativa: ${j}\nEfeito sobre os votos: os votos registrados foram guardados sem contagem e não entram em nenhum resultado.`);
  });
}
