/** Propostas municipais — objeto das consultas (RF022, RF024). */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "../../db/client";
import { municipalProposals, organs, themes, users } from "../../db/schema";
import { clock } from "../../lib/clock";
import { ConflictError, DomainError, NotFoundError, parseOrThrow } from "../../lib/errors";
import { sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertPermission, type Actor } from "../access/access.service";
import { saveVersion } from "../consultations/common";

const text = (max: number) => z.string().optional().transform((v) => sanitizePlainText(v ?? "").slice(0, max));

const proposalSchema = z.object({
  title: z.string().transform((v) => sanitizePlainText(v)).pipe(z.string().min(5, "Informe um título com ao menos 5 caracteres.").max(200, "Máximo de 200 caracteres.")),
  summary: text(600),
  description: text(10000),
  justification: text(5000),
  objectives: text(5000),
  themeId: z.string().optional().transform((v) => v || null),
  scope: text(300),
  organId: z.string().optional().transform((v) => v || null),
  estimatedCost: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\./g, "").replace(",", ".").trim() : ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Valor inválido. Ex.: 150000,00")
    .transform((v) => v || null),
  fundingSource: text(300).transform((v) => v || null),
  executionDeadline: text(120).transform((v) => v || null),
  version: z.coerce.number().int().optional(),
});

/** Campos obrigatórios exigidos na submissão (RF022 — validação completa no RF028). */
export function municipalProposalPendencies(p: typeof municipalProposals.$inferSelect) {
  const out: { field: string; message: string }[] = [];
  if (!p.summary) out.push({ field: "summary", message: "Resumo da proposta" });
  if (!p.description) out.push({ field: "description", message: "Descrição da proposta" });
  if (!p.justification) out.push({ field: "justification", message: "Justificativa da proposta" });
  if (!p.objectives) out.push({ field: "objectives", message: "Objetivos da proposta" });
  if (!p.themeId) out.push({ field: "themeId", message: "Tema da proposta" });
  if (!p.scope) out.push({ field: "scope", message: "Abrangência da proposta" });
  if (!p.organId) out.push({ field: "organId", message: "Órgão responsável pela proposta" });
  return out;
}

export async function createMunicipalProposal(actor: Actor, input: Record<string, unknown>, db: DbOrTx = getDb()) {
  await assertPermission(actor, "propostas_municipais.gerenciar", {}, db);
  const data = parseOrThrow(proposalSchema, input);
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [p] = await tx
      .insert(municipalProposals)
      .values({ ...data, version: 1, status: "rascunho", createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now })
      .returning();
    await saveVersion(tx, "municipal_proposal", p.id, 1, p, actor.id, "criação");
    await audit(tx, { actorId: actor.id, actorRole: "admin", action: "proposta_municipal_criada", objectType: "proposta_municipal", objectId: p.id });
    return p;
  });
}

export async function updateMunicipalProposal(actor: Actor, id: string, input: Record<string, unknown>, db: DbOrTx = getDb()) {
  await assertPermission(actor, "propostas_municipais.gerenciar", { objectType: "proposta_municipal", objectId: id }, db);
  const data = parseOrThrow(proposalSchema, input);
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(municipalProposals).where(eq(municipalProposals.id, id)).for("update");
    if (!cur) throw new NotFoundError();
    // RF024: edição apenas em Rascunho ou Rejeitada.
    if (!["rascunho", "rejeitada"].includes(cur.status)) throw new DomainError("A proposta está em análise ou já foi publicada em consulta; a edição está bloqueada.", "edicao_bloqueada");
    if (data.version !== undefined && data.version !== cur.version) {
      throw new ConflictError(`Edição simultânea: outra pessoa salvou a versão ${cur.version} enquanto você editava a versão ${data.version}. Revise as diferenças antes de salvar.`);
    }
    const { version: _v, ...fields } = data;
    const [p] = await tx
      .update(municipalProposals)
      .set({ ...fields, version: cur.version + 1, lastEditedBy: actor.id, updatedAt: clock.now() })
      .where(eq(municipalProposals.id, id))
      .returning();
    await saveVersion(tx, "municipal_proposal", id, p.version, p, actor.id, "edição");
    await audit(tx, { actorId: actor.id, actorRole: "admin", action: "proposta_municipal_editada", objectType: "proposta_municipal", objectId: id, details: { versao: p.version } });
    return p;
  });
}

export async function listMunicipalProposals(db: DbOrTx = getDb()) {
  return db
    .select({ p: municipalProposals, theme: themes.name, organ: organs.acronym, author: users.fullName })
    .from(municipalProposals)
    .leftJoin(themes, eq(themes.id, municipalProposals.themeId))
    .leftJoin(organs, eq(organs.id, municipalProposals.organId))
    .leftJoin(users, eq(users.id, municipalProposals.createdBy))
    .orderBy(desc(municipalProposals.updatedAt));
}

export async function getMunicipalProposal(id: string, db: DbOrTx = getDb()) {
  const [p] = await db.select().from(municipalProposals).where(eq(municipalProposals.id, id));
  return p ?? null;
}
