/** Fábricas de dados fictícios para os testes. */
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { alternatives, consultationAssignments, consultations, districts, municipalProposals, organs, roles, themes, userRoles, users } from "@/server/db/schema";
import { cpfHmac, encrypt } from "@/server/lib/crypto";
import { hashPassword } from "@/server/lib/password";
import { generateCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { loadActor, type Actor } from "@/server/modules/access/access.service";
import { DAY } from "@/server/lib/clock";
import type { ConsultationRole } from "@/lib/permissions";

let seq = 0;
let pwHash: string | null = null;
export const PASSWORD = "senhaSegura1";

async function hashOnce() {
  pwHash ??= await hashPassword(PASSWORD);
  return pwHash;
}

/** CPF fictício: o último dígito verificador está propositalmente errado (aceito desde a DT-36). */
export function fictitiousCpf(): string {
  const valido = generateCpf();
  return valido.slice(0, 10) + String((Number(valido[10]) + 1) % 10);
}

export async function createCitizen(db: Db, opts: { verified?: boolean; domicile?: boolean; status?: "ativa" | "pendente"; birthDate?: string; districtName?: string; cpf?: string } = {}) {
  seq++;
  const cpf = opts.cpf ? onlyDigits(opts.cpf) : generateCpf();
  const [d] = await db.select().from(districts).where(eq(districts.name, opts.districtName ?? "Centro"));
  const now = new Date();
  const [u] = await db
    .insert(users)
    .values({
      kind: "cidadao",
      fullName: `Cidadã Teste ${seq}`,
      email: `cidadao${seq}-${Math.random().toString(36).slice(2, 6)}@exemplo.test`,
      cpfHmac: cpfHmac(cpf),
      cpfMasked: maskCpf(cpf),
      birthDate: opts.birthDate ?? "1990-05-10",
      cep: "57000-000",
      street: "Rua Fictícia",
      number: "10",
      districtId: d.id,
      domicileVerifiedAt: opts.domicile === false ? null : now,
      passwordHash: await hashOnce(),
      status: opts.status ?? "ativa",
      verificationLevel: opts.verified === false ? "nao_verificado" : "verificado",
      emailVerifiedAt: now,
    })
    .returning();
  return { ...u, cpf };
}

export const TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

export async function createAdmin(db: Db, roleKeys: string[], name?: string): Promise<Actor> {
  seq++;
  const [organ] = await db.select().from(organs).limit(1);
  const [u] = await db
    .insert(users)
    .values({
      kind: "admin",
      fullName: name ?? `Servidor Teste ${seq}`,
      email: `servidor${seq}-${Math.random().toString(36).slice(2, 6)}@prefeitura.test`,
      registration: `MAT-${seq}-${Math.random().toString(36).slice(2, 6)}`,
      organId: organ.id,
      passwordHash: await hashOnce(),
      status: "ativa",
      verificationLevel: "verificado",
      mfaSecretEnc: encrypt(TOTP_SECRET),
      mfaEnabledAt: new Date(),
    })
    .returning();
  for (const key of roleKeys) {
    const [r] = await db.select().from(roles).where(eq(roles.key, key));
    await db.insert(userRoles).values({ userId: u.id, roleId: r.id });
  }
  return (await loadActor(u.id, db))!;
}

export async function createMunicipalProposal(db: Db, authorId: string) {
  const [theme] = await db.select().from(themes).limit(1);
  const [organ] = await db.select().from(organs).limit(1);
  const [p] = await db
    .insert(municipalProposals)
    .values({ title: "Proposta municipal de teste", summary: "Resumo", description: "Descrição", justification: "Justificativa", objectives: "Objetivos", themeId: theme.id, organId: organ.id, scope: "Municipal", createdBy: authorId })
    .returning();
  return p;
}

/** Consulta Aberta pronta para votação (inserida diretamente). */
export async function createOpenConsultation(db: Db, opts: { alternatives?: number; allowAbstention?: boolean; audienceOpen?: boolean; createdBy: string; closesInMs?: number }) {
  const p = await createMunicipalProposal(db, opts.createdBy);
  const now = Date.now();
  const [c] = await db
    .insert(consultations)
    .values({
      slug: `consulta-teste-${++seq}-${Math.random().toString(36).slice(2, 6)}`,
      municipalProposalId: p.id,
      title: `Consulta de teste ${seq}`,
      summary: "Resumo da consulta",
      themeId: p.themeId,
      organId: p.organId,
      problem: "Problema",
      objective: "Objetivo",
      justification: "Justificativa",
      question: "Você concorda com a proposta?",
      guidance: "Escolha uma alternativa.",
      nextSteps: "A Prefeitura analisará o resultado.",
      opensAt: new Date(now - DAY),
      closesAt: new Date(now + (opts.closesInMs ?? 19 * DAY)),
      status: "aberta",
      audienceOpen: opts.audienceOpen ?? true,
      allowAbstention: opts.allowAbstention ?? false,
      estimatedEligible: 100,
      createdBy: opts.createdBy,
    })
    .returning();
  const labels = ["Sim", "Não", "Talvez", "Outra"].slice(0, opts.alternatives ?? 2);
  const alts = await db
    .insert(alternatives)
    .values(labels.map((label, i) => ({ consultationId: c.id, label, explanation: `Explicação ${label}`, position: i + 1 })))
    .returning();
  return { consultation: c, alternatives: alts, proposal: p };
}

export async function assign(db: Db, consultationId: string, userId: string, role: ConsultationRole) {
  await db.insert(consultationAssignments).values({ consultationId, userId, role });
}
