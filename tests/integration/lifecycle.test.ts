/** Ciclo de vida da consulta e segregação de funções — RF022–RF035, RF043, RF061, RF063; RN11–RN15, RN20, RN32, RN36. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { consultationEvents, consultations, entityVersions, organs, results, themes } from "@/server/db/schema";
import { createMunicipalProposal } from "@/server/modules/proposals/municipal-proposals.service";
import {
  alterPublished,
  cancelConsultation,
  consultationPendencies,
  createConsultation,
  decideApproval,
  decideExceptionalDeadline,
  publishConsultation,
  resumeConsultation,
  reviewConsultation,
  REVIEW_ITEMS,
  setAlternatives,
  setAssignments,
  setAudience,
  submitForReview,
  suspendConsultation,
  updateConsultation,
} from "@/server/modules/consultations/lifecycle.service";
import { runSchedulerTick } from "@/server/modules/scheduler/scheduler.service";
import { publishFinalResult, publishRectification } from "@/server/modules/results/results.service";
import { registerOutcome, updateOutcomeStatus } from "@/server/modules/outcomes/outcomes.service";
import { listPublicConsultations } from "@/server/modules/consultations/queries.service";
import { clock, DAY, HOUR } from "@/server/lib/clock";
import { toLocalInput } from "@/lib/labels";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { ForbiddenError } from "@/server/lib/errors";
import type { Actor } from "@/server/modules/access/access.service";

let db: Db;
let team: Record<string, Actor>;
let themeId: string;
let organId: string;
beforeAll(async () => {
  db = await createTestDb();
  team = {
    elaborador: await createAdmin(db, ["elaborador"], "Elaine Elaboradora"),
    revisor: await createAdmin(db, ["revisor"], "Rui Revisor"),
    aprovador: await createAdmin(db, ["aprovador"], "Ana Aprovadora"),
    autorizador: await createAdmin(db, ["autorizador_prazo"], "Augusto Autorizador"),
    responsavel: await createAdmin(db, ["responsavel", "publicacao_resultados", "encaminhamentos"], "Rita Responsável"),
    gestor: await createAdmin(db, ["gestor_acessos"], "Gil Gestor"),
    elabAprov: await createAdmin(db, ["elaborador", "aprovador"], "Duda Dupla"),
  };
  [{ id: themeId }] = await db.select({ id: themes.id }).from(themes).limit(1);
  [{ id: organId }] = await db.select({ id: organs.id }).from(organs).limit(1);
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

function fields(overrides: Record<string, unknown> = {}) {
  const opens = new Date(Date.now() + 3 * DAY);
  return {
    title: "Ciclovia na Avenida Central",
    summary: "Implantação de ciclovia protegida.",
    themeId,
    organId,
    problem: "Falta de infraestrutura cicloviária.",
    objective: "Ouvir a população sobre a ciclovia.",
    justification: "Demanda recorrente na ouvidoria.",
    question: "Você concorda com a implantação da ciclovia na Avenida Central?",
    guidance: "Leia os documentos e escolha uma alternativa.",
    opensAt: toLocalInput(opens),
    closesAt: toLocalInput(new Date(opens.getTime() + 20 * DAY)),
    nextSteps: "A Secretaria analisará o resultado e publicará os encaminhamentos.",
    quorumType: "nenhum",
    ...overrides,
  };
}

async function draft(overrides: Record<string, unknown> = {}) {
  const p = await createMunicipalProposal(team.elaborador, { title: "Ciclovia na Avenida Central", summary: "Resumo", description: "Desc", justification: "Just", objectives: "Obj", themeId, organId, scope: "Municipal" }, db);
  const c = await createConsultation(team.elaborador, { municipalProposalId: p.id, ...fields(overrides) }, db);
  await setAlternatives(team.elaborador, c.id, { items: [{ label: "Sim", explanation: "Concordo" }, { label: "Não", explanation: "Não concordo" }], allowAbstention: true }, db);
  await setAudience(team.elaborador, c.id, { open: true, criteria: [] }, db);
  return c;
}

const allOk = Object.fromEntries(Object.keys(REVIEW_ITEMS).map((k) => [k, true]));

describe("Cadastro e validação (RF025, RF026, RF027, RN13, RN14)", () => {
  it("bloqueia período menor que 20 dias sem prazo excepcional", async () => {
    const p = await createMunicipalProposal(team.elaborador, { title: "Proposta curta", themeId, organId }, db);
    const opens = new Date(Date.now() + 3 * DAY);
    await expect(createConsultation(team.elaborador, { municipalProposalId: p.id, ...fields({ closesAt: toLocalInput(new Date(opens.getTime() + 15 * DAY)) }) }, db)).rejects.toThrow();
  });

  it("bloqueia alternativas repetidas ou fora de 2 a 10", async () => {
    const c = await draft();
    await expect(setAlternatives(team.elaborador, c.id, { items: [{ label: "Sim", explanation: "" }], allowAbstention: false }, db)).rejects.toThrow(/Quantidade inválida/);
    await expect(setAlternatives(team.elaborador, c.id, { items: [{ label: "Sim", explanation: "" }, { label: "sim", explanation: "" }], allowAbstention: false }, db)).rejects.toThrow(/repetidos/);
  });

  it("limitação de público-alvo sem justificativa é bloqueada", async () => {
    const c = await draft();
    await expect(setAudience(team.elaborador, c.id, { open: false, criteria: [{ type: "domicilio", justification: "", publicText: "Moradores" }] }, db)).rejects.toThrow();
  });

  it("a busca continua encontrando a consulta pelo texto da proposta depois de editada (RF017)", async () => {
    const p = await createMunicipalProposal(team.elaborador, { title: "Bicicletário comunitário", summary: "Paraciclos na orla", themeId, organId }, db);
    const c = await createConsultation(team.elaborador, { municipalProposalId: p.id, ...fields() }, db);
    const texto = async () => (await db.select({ s: consultations.searchText }).from(consultations).where(eq(consultations.id, c.id)))[0].s;
    expect(await texto()).toContain("bicicletario comunitario");
    await updateConsultation(team.elaborador, c.id, { ...fields({ summary: "Resumo revisado." }), version: String(c.version) }, db);
    // Antes da correção a edição recalculava o índice só com título e resumo da consulta.
    expect(await texto()).toContain("bicicletario comunitario");
    expect(await texto()).toContain("paraciclos na orla");
    expect(await texto()).toContain("resumo revisado");
  });

  it("edição simultânea não sobrescreve (RF024)", async () => {
    const c = await draft();
    const [cur] = await db.select().from(consultations).where(eq(consultations.id, c.id));
    await updateConsultation(team.elaborador, c.id, { ...fields(), version: String(cur.version) }, db);
    await expect(updateConsultation(team.elaborador, c.id, { ...fields({ summary: "Outro" }), version: String(cur.version) }, db)).rejects.toThrow(/simultânea/);
    const versions = await db.select().from(entityVersions).where(eq(entityVersions.entityId, c.id));
    expect(versions.length).toBeGreaterThan(2);
  });
});

describe("Segregação de funções (RF028, RF029, RF061, RN20, RN36, RS006)", () => {
  it("lista pendências quando faltam responsáveis obrigatórios", async () => {
    const c = await draft();
    const pend = await consultationPendencies(c.id, db);
    expect(pend.map((p) => p.field)).toEqual(expect.arrayContaining(["papel_revisor", "papel_aprovador", "papel_responsavel"]));
    await expect(submitForReview(team.elaborador, c.id, db)).rejects.toThrow(/pendências/);
  });

  it("não permite designar a mesma conta como elaboradora e aprovadora", async () => {
    const c = await draft();
    await expect(setAssignments(team.gestor, c.id, { elaborador: [team.elabAprov.id], aprovador: [team.elabAprov.id] }, null, db)).rejects.toThrow(/Combinação vedada/);
  });

  it("ninguém aprova a consulta que elaborou (mesmo designado por erro) e a tentativa é auditada", async () => {
    const p = await createMunicipalProposal(team.elabAprov, { title: "Proposta da conta dupla", summary: "R", description: "D", justification: "J", objectives: "O", themeId, organId, scope: "M" }, db);
    const c = await createConsultation(team.elabAprov, { municipalProposalId: p.id, ...fields() }, db);
    await setAlternatives(team.elabAprov, c.id, { items: [{ label: "Sim", explanation: "" }, { label: "Não", explanation: "" }], allowAbstention: false }, db);
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], responsavel: [team.responsavel.id], aprovador: [team.aprovador.id] }, null, db);
    await submitForReview(team.elabAprov, c.id, db);
    await reviewConsultation(team.revisor, c.id, { items: allOk, observations: "" }, db);
    // Força a designação vedada diretamente no banco para provar a 2ª camada de defesa.
    const { consultationAssignments } = await import("@/server/db/schema");
    await db.insert(consultationAssignments).values({ consultationId: c.id, userId: team.elabAprov.id, role: "aprovador" });
    await expect(decideApproval(team.elabAprov, c.id, { approve: true, justification: "" }, db)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("revisor diferente do elaborador; problema apontado volta a Rascunho", async () => {
    const c = await draft();
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], aprovador: [team.aprovador.id], responsavel: [team.responsavel.id] }, null, db);
    await submitForReview(team.elaborador, c.id, db);
    await expect(reviewConsultation(team.elaborador, c.id, { items: allOk, observations: "" }, db)).rejects.toThrow();
    await reviewConsultation(team.revisor, c.id, { items: { ...allOk, pergunta_clara: false }, observations: "A pergunta induz a resposta." }, db);
    const [cur] = await db.select().from(consultations).where(eq(consultations.id, c.id));
    expect(cur.status).toBe("rascunho");
    expect(cur.reviewObservations).toContain("induz");
  });
});

describe("Prazo excepcional (RF029)", () => {
  it("redução negada volta a Rascunho com 20 dias sugeridos", async () => {
    const opens = new Date(Date.now() + 3 * DAY);
    const c = await draft({ exceptionalDeadline: "on", emergencyJustification: "Enchente atingiu a região.", closesAt: toLocalInput(new Date(opens.getTime() + 10 * DAY)) });
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], aprovador: [team.aprovador.id], responsavel: [team.responsavel.id], autorizador_prazo: [team.autorizador.id] }, null, db);
    await submitForReview(team.elaborador, c.id, db);
    await reviewConsultation(team.revisor, c.id, { items: allOk, observations: "" }, db);
    await expect(decideApproval(team.aprovador, c.id, { approve: true, justification: "" }, db)).rejects.toThrow(/não foi autorizado/);
    await decideExceptionalDeadline(team.autorizador, c.id, { authorize: false, justification: "Não caracteriza emergência." }, db);
    const [cur] = await db.select().from(consultations).where(eq(consultations.id, c.id));
    expect(cur.status).toBe("rascunho");
    expect(Math.round((cur.closesAt!.getTime() - cur.opensAt!.getTime()) / DAY)).toBe(20);
  });
});

describe("Ciclo completo: publicação → abertura → alteração → suspensão → encerramento → resultado → encaminhamentos", () => {
  it("percorre o ciclo e registra o histórico público", async () => {
    const c = await draft();
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], aprovador: [team.aprovador.id], responsavel: [team.responsavel.id], publicacao_resultados: [team.responsavel.id], encaminhamentos: [team.responsavel.id] }, null, db);
    await submitForReview(team.elaborador, c.id, db);
    await reviewConsultation(team.revisor, c.id, { items: allOk, observations: "" }, db);
    await decideApproval(team.aprovador, c.id, { approve: true, justification: "Conforme." }, db);
    // Não aparece no portal antes de publicada.
    expect((await listPublicConsultations({}, null, db)).items.some((i) => i.id === c.id)).toBe(false);
    await publishConsultation(team.responsavel, c.id, db);
    expect((await listPublicConsultations({ q: "CICLOVIA avenida" }, null, db)).items.some((i) => i.id === c.id)).toBe(true);

    const [cur] = await db.select().from(consultations).where(eq(consultations.id, c.id));
    clock.set(new Date(cur.opensAt!.getTime() + HOUR));
    await runSchedulerTick(db);
    expect((await db.select().from(consultations).where(eq(consultations.id, c.id)))[0].status).toBe("aberta");

    // Alteração proibida após publicação: pergunta/alternativas.
    await expect(setAlternatives(team.elaborador, c.id, { items: [{ label: "A", explanation: "" }, { label: "B", explanation: "" }], allowAbstention: false }, db)).rejects.toThrow();
    await alterPublished(team.responsavel, c.id, { kind: "correcao", field: "summary", value: "Implantação de ciclovia protegida (texto corrigido).", changesMeaning: false, justification: "Erro de digitação." }, db);
    await suspendConsultation(team.responsavel, c.id, "Decisão judicial liminar.", db);
    await resumeConsultation(team.responsavel, c.id, { justification: "Liminar revogada." }, db);

    const voter = await createCitizen(db);
    void voter;
    clock.set(new Date(cur.closesAt!.getTime() + HOUR));
    await runSchedulerTick(db);
    expect((await db.select().from(consultations).where(eq(consultations.id, c.id)))[0].status).toBe("apurada");

    await expect(publishFinalResult(team.responsavel, c.id, "curta", db)).rejects.toThrow(/nota oficial/);
    await publishFinalResult(team.responsavel, c.id, "Votação consultiva: orienta a administração. Próximos passos: estudo técnico em 60 dias.", db);
    await expect(cancelConsultation(team.responsavel, c.id, { justification: "x", confirmTitle: cur.title }, db)).rejects.toThrow(/retificação/);
    await publishRectification(team.responsavel, c.id, { justification: "Erro de digitação na nota oficial.", note: "Nota corrigida: votação consultiva; estudo técnico em 60 dias." }, db);
    const rs = await db.select().from(results).where(eq(results.consultationId, c.id));
    expect(rs.map((r) => r.kind)).toEqual(["preliminar", "final", "retificacao"]);

    await expect(registerOutcome(team.responsavel, c.id, { decision: "Ciclovia", actions: "Projeto", organId, status: "nao_realizada" }, db)).rejects.toThrow(/justificativa/);
    const o = await registerOutcome(team.responsavel, c.id, { decision: "Elaborar projeto da ciclovia", actions: "Contratar projeto executivo", organId, status: "prevista", expectedDate: "2027-03-01" }, db);
    await updateOutcomeStatus(team.responsavel, o.id, { status: "em_andamento" }, db);

    const events = await db.select().from(consultationEvents).where(eq(consultationEvents.consultationId, c.id));
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["publicacao", "abertura", "alteracao", "suspensao", "retomada", "encerramento", "apuracao", "resultado", "retificacao", "encaminhamento"]));
  });

  it("cancelamento exige digitar o título e é irreversível", async () => {
    const c = await draft();
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], aprovador: [team.aprovador.id], responsavel: [team.responsavel.id] }, null, db);
    await submitForReview(team.elaborador, c.id, db);
    await reviewConsultation(team.revisor, c.id, { items: allOk, observations: "" }, db);
    await decideApproval(team.aprovador, c.id, { approve: true, justification: "" }, db);
    await publishConsultation(team.responsavel, c.id, db);
    await expect(cancelConsultation(team.responsavel, c.id, { justification: "Mudança de prioridade.", confirmTitle: "outro título" }, db)).rejects.toThrow(/exatamente/);
    await cancelConsultation(team.responsavel, c.id, { justification: "Mudança de prioridade.", confirmTitle: c.title }, db);
    await expect(resumeConsultation(team.responsavel, c.id, { justification: "voltar" }, db)).rejects.toThrow();
    expect((await db.select().from(consultations).where(eq(consultations.id, c.id)))[0].status).toBe("cancelada");
  });

  it("aprovação bloqueada por antecedência insuficiente (RN15)", async () => {
    const opens = new Date(Date.now() + 3 * DAY);
    const c = await draft();
    await setAssignments(team.gestor, c.id, { revisor: [team.revisor.id], aprovador: [team.aprovador.id], responsavel: [team.responsavel.id] }, null, db);
    await submitForReview(team.elaborador, c.id, db);
    await reviewConsultation(team.revisor, c.id, { items: allOk, observations: "" }, db);
    clock.set(new Date(opens.getTime() - 2 * HOUR));
    await expect(decideApproval(team.aprovador, c.id, { approve: true, justification: "" }, db)).rejects.toThrow(/Antecedência/);
  });
});
