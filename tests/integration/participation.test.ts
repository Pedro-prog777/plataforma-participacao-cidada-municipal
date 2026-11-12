/** Propostas cidadãs, moderação, anexos, exportação e acesso a dados de terceiros — RF014, RF015, RF020–RF023, RF045, RF052, RF064–RF067; RS005, RS011, RS012. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen, createOpenConsultation, PASSWORD } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { citizenProposals, comments, consultations, districts, notifications, themes, users } from "@/server/db/schema";
import { analyzeProposal, getProposalForAuthor, getPublishedProposal, submitCitizenProposal, supportProposal } from "@/server/modules/proposals/citizen-proposals.service";
import { decideModeration, postComment, reportContent, requestModerationReview } from "@/server/modules/moderation/moderation.service";
import { addAttachment } from "@/server/modules/attachments/attachments.service";
import { getDataExport, requestDataCopy } from "@/server/modules/profile/profile.service";
import { exportDataset } from "@/server/modules/results/open-data.service";
import { notifyUser, savePreferences, unsubscribe } from "@/server/modules/notifications/notifications.service";
import { writeSetting } from "@/server/lib/settings";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { clock } from "@/server/lib/clock";
import { DomainError, ForbiddenError } from "@/server/lib/errors";

let db: Db;
let themeId: string;
let districtId: string;
beforeAll(async () => {
  db = await createTestDb();
  [{ id: themeId }] = await db.select({ id: themes.id }).from(themes).limit(1);
  [{ id: districtId }] = await db.select({ id: districts.id }).from(districts).limit(1);
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

const proposal = (over: Record<string, unknown> = {}) => ({
  title: "Faixa elevada em frente à escola",
  problem: "Carros passam em alta velocidade na saída dos alunos.",
  solution: "Construir faixa elevada e sinalização de área escolar.",
  themeId,
  districtId,
  authorizePublication: "sim",
  ...over,
});
const file = (content: string | Buffer, name: string, type = "application/pdf") => new File([new Uint8Array(typeof content === "string" ? Buffer.from(content) : content)], name, { type });

describe("Propostas cidadãs (RF020, RF021, RN30)", () => {
  it("exige identidade verificada e respeita o limite de 3 em análise", async () => {
    const unverified = await createCitizen(db, { verified: false });
    await expect(submitCitizenProposal(unverified.id, proposal(), [], db)).rejects.toThrow(/verificar sua identidade/);
    const c = await createCitizen(db);
    for (let i = 0; i < 3; i++) await submitCitizenProposal(c.id, proposal({ title: `Proposta número ${i + 1}` }), [], db);
    await expect(submitCitizenProposal(c.id, proposal({ title: "Quarta proposta" }), [], db)).rejects.toThrow(/limite é 3/);
  });

  it("título acima de 120 caracteres é recusado", async () => {
    const c = await createCitizen(db);
    await expect(submitCitizenProposal(c.id, proposal({ title: "x".repeat(121) }), [], db)).rejects.toThrow();
  });

  it("percorre os estados, converte em proposta municipal e publica sem dados do autor", async () => {
    const c = await createCitizen(db);
    const analyst = await createAdmin(db, ["analise_propostas"]);
    const p = await submitCitizenProposal(c.id, proposal(), [], db);
    expect(p.protocol).toMatch(/^PROP-\d{4}-[A-Z0-9]{6}$/);
    await analyzeProposal(analyst, p.id, { action: "iniciar_analise" }, db);
    await analyzeProposal(analyst, p.id, { action: "solicitar_ajuste", guidance: "Informe a rua exata." }, db);
    await expect(analyzeProposal(analyst, p.id, { action: "publicar" }, db)).rejects.toThrow();
    const { resubmitAfterAdjustment } = await import("@/server/modules/proposals/citizen-proposals.service");
    await resubmitAfterAdjustment(c.id, p.id, proposal({ problem: "Na Rua das Flores, carros passam em alta velocidade." }), db);
    await expect(analyzeProposal(analyst, p.id, { action: "responder", responseType: "convertida", responseText: "" }, db)).rejects.toThrow(/justificada/);
    await analyzeProposal(analyst, p.id, { action: "responder", responseType: "convertida", responseText: "Acolhida para estudo técnico." }, db);
    const [row] = await db.select().from(citizenProposals).where(eq(citizenProposals.id, p.id));
    expect(row.municipalProposalId).toBeTruthy();
    await analyzeProposal(analyst, p.id, { action: "publicar" }, db);
    const pub = await getPublishedProposal(p.protocol, db);
    expect(pub).toBeTruthy();
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain(c.email);
    expect(serialized).not.toContain(c.fullName);
    expect(serialized).not.toContain(c.id);
    const notes = await db.select().from(notifications).where(eq(notifications.userId, c.id));
    expect(notes.filter((n) => n.type === "respostas_propostas").length).toBeGreaterThanOrEqual(4);
  });

  it("sem autorização do autor a proposta não é publicada", async () => {
    const c = await createCitizen(db);
    const analyst = await createAdmin(db, ["analise_propostas"]);
    const p = await submitCitizenProposal(c.id, proposal({ authorizePublication: "nao" }), [], db);
    await analyzeProposal(analyst, p.id, { action: "responder", responseType: "nao_acolhida", responseText: "Fora da competência municipal." }, db);
    await expect(analyzeProposal(analyst, p.id, { action: "publicar" }, db)).rejects.toThrow(/não autorizou/);
  });

  it("outro cidadão não acessa a proposta (RF009)", async () => {
    const a = await createCitizen(db);
    const b = await createCitizen(db);
    const p = await submitCitizenProposal(a.id, proposal(), [], db);
    expect(await getProposalForAuthor(b.id, p.id, db)).toBeNull();
    expect(await getProposalForAuthor(a.id, p.id, db)).not.toBeNull();
  });
});

describe("Anexos (RF023, RS012)", () => {
  it("recusa arquivo com extensão falsa, vírus de teste e excesso de tamanho; aceita PDF real com hash", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { createMunicipalProposal } = await import("@/server/modules/proposals/municipal-proposals.service");
    const mp = await createMunicipalProposal(elab, { title: "Proposta com anexos" }, db);
    const add = (f: File, extra: Record<string, string> = {}) => addAttachment(elab, { ownerType: "municipal_proposal", ownerId: mp.id, title: "Estudo", file: f, ...extra }, db);
    await expect(add(file("MZ\x90\x00 programa", "estudo.pdf"))).rejects.toThrow(/Formato/);
    await expect(add(file("%PDF-1.4 X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", "estudo.pdf"))).rejects.toThrow(/antivírus/);
    await expect(add(file(Buffer.alloc(21 * 1024 * 1024, 0x25), "grande.pdf"))).rejects.toThrow(/limite/);
    await expect(add(file(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), "mapa.png", "image/png"))).rejects.toThrow(/texto alternativo/);
    const ok = await add(file("%PDF-1.4 estudo técnico", "estudo.pdf"));
    expect(ok.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ok.mime).toBe("application/pdf");
  });
});

describe("Comentários, denúncias e moderação (RF064–RF066, RS011)", () => {
  it("comentários ficam desabilitados até a validação do cliente", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: admin.id });
    const c = await createCitizen(db);
    await expect(postComment(c.id, { targetType: "consultation", targetId: consultation.id, body: "Oi", kind: "comentario" }, db)).rejects.toThrow(/não estão habilitados/);
  });

  it("denúncias ocultam no limite; moderador autor/denunciante bloqueado; revisão por outro moderador", async () => {
    await writeSetting(db, "recursos.comentarios", true, null);
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: admin.id });
    await db.update(consultations).set({ commentsEnabled: true }).where(eq(consultations.id, consultation.id));
    const author = await createCitizen(db);
    const com = await postComment(author.id, { targetType: "consultation", targetId: consultation.id, body: "Comentário com dados 529.982.247-25", kind: "comentario" }, db);
    expect(com.flagged).toBe(true);
    expect(com.displayName).not.toContain("@");
    const reporters = await Promise.all([createCitizen(db), createCitizen(db), createCitizen(db)]);
    const r1 = await reportContent(reporters[0].id, { targetType: "comment", targetId: com.id, reason: "dados_pessoais" }, db);
    expect(r1.protocol).toMatch(/^DEN-/);
    expect((await reportContent(reporters[0].id, { targetType: "comment", targetId: com.id, reason: "ofensa" }, db)).repeated).toBe(true);
    await reportContent(reporters[1].id, { targetType: "comment", targetId: com.id, reason: "dados_pessoais" }, db);
    await reportContent(reporters[2].id, { targetType: "comment", targetId: com.id, reason: "dados_pessoais" }, db);
    expect((await db.select().from(comments).where(eq(comments.id, com.id)))[0].status).toBe("oculto");

    const mod1 = await createAdmin(db, ["moderacao"]);
    const mod2 = await createAdmin(db, ["moderacao"]);
    await decideModeration(mod1, { targetType: "comment", targetId: com.id, decision: "ocultar_trecho", redactedText: "Comentário com dados [removido]", justification: "Exposição de CPF." }, db);
    const [after] = await db.select().from(comments).where(eq(comments.id, com.id));
    expect(after.body).toBe("Comentário com dados [removido]");
    expect(after.status).toBe("publicado");
    const { myModerationDecisions } = await import("@/server/modules/moderation/moderation.service");
    const [dec] = await myModerationDecisions(author.id, db);
    await requestModerationReview(author.id, dec.id, "Não era meu CPF.", db);
    await expect(decideModeration(mod1, { targetType: "comment", targetId: com.id, decision: "manter", justification: "x" }, db)).rejects.toThrow(/outro moderador/);
    await decideModeration(mod2, { targetType: "comment", targetId: com.id, decision: "remover", justification: "Mantida a proteção de dados." }, db);
    await expect(decideModeration(mod2, { targetType: "comment", targetId: com.id, decision: "manter", justification: "x" }, db)).rejects.toThrow(/definitivo/);
    // O autor recebe a decisão sem saber quem denunciou.
    const notes = await db.select().from(notifications).where(eq(notifications.userId, author.id));
    expect(JSON.stringify(notes)).not.toContain(reporters[0].email);
    await writeSetting(db, "recursos.comentarios", false, null);
  });

  it("moderador que denunciou não decide", async () => {
    const analyst = await createAdmin(db, ["analise_propostas", "moderacao"]);
    const c = await createCitizen(db);
    const p = await submitCitizenProposal(c.id, proposal(), [], db);
    await analyzeProposal(analyst, p.id, { action: "responder", responseType: "encaminhada", responseText: "Encaminhada." }, db);
    await analyzeProposal(analyst, p.id, { action: "publicar" }, db);
    await reportContent(analyst.id, { targetType: "citizen_proposal", targetId: p.id, reason: "propaganda" }, db);
    await expect(decideModeration(analyst, { targetType: "citizen_proposal", targetId: p.id, decision: "remover", justification: "x" }, db)).rejects.toThrow(/autor ou denunciante/);
  });
});

describe("Apoios (RF067 — condicionado)", () => {
  it("só funciona habilitado, um apoio por pessoa e prioriza ao atingir a meta no prazo", async () => {
    const analyst = await createAdmin(db, ["analise_propostas"]);
    const author = await createCitizen(db);
    const p = await submitCitizenProposal(author.id, proposal(), [], db);
    await analyzeProposal(analyst, p.id, { action: "responder", responseType: "encaminhada", responseText: "Encaminhada." }, db);
    await analyzeProposal(analyst, p.id, { action: "publicar" }, db);
    const s1 = await createCitizen(db);
    await expect(supportProposal(s1.id, p.id, db)).rejects.toThrow(/não está habilitado/);
    await writeSetting(db, "recursos.apoios", true, null);
    await writeSetting(db, "apoios.meta", 2, null);
    await writeSetting(db, "apoios.prazo_dias", 30, null);
    await supportProposal(s1.id, p.id, db);
    await expect(supportProposal(s1.id, p.id, db)).rejects.toThrow(/já apoiou/);
    await expect(supportProposal(author.id, p.id, db)).rejects.toThrow(/própria/);
    await supportProposal((await createCitizen(db)).id, p.id, db);
    expect((await db.select().from(citizenProposals).where(eq(citizenProposals.id, p.id)))[0].priority).toBe(true);
    await writeSetting(db, "recursos.apoios", false, null);
  });
});

describe("LGPD e notificações (RF015, RF052, RN27)", () => {
  it("cópia dos dados só para o titular, por 48 h, sem a alternativa votada", async () => {
    const c = await createCitizen(db);
    const other = await createCitizen(db);
    await expect(requestDataCopy(c.id, "senhaErrada1", "json", "ip", db)).rejects.toThrow(/incorreta/);
    const id = await requestDataCopy(c.id, PASSWORD, "json", "ip", db);
    const exp = await getDataExport(c.id, id, db);
    expect(JSON.parse(exp!.content).conta.cpf).toMatch(/\*\*\*/);
    expect(await getDataExport(other.id, id, db)).toBeNull();
    clock.set(new Date(Date.now() + 49 * 3600_000));
    expect(await getDataExport(c.id, id, db)).toBeNull();
  });

  it("respeita preferências; avisos obrigatórios não podem ser desligados; descadastro sem login", async () => {
    const c = await createCitizen(db);
    const all = (t: boolean) => Object.fromEntries(["nova_consulta", "abertura", "alteracoes", "lembrete", "resultado", "encaminhamentos", "respostas_propostas"].map((k) => [k, { email: t, inApp: t }]));
    await savePreferences(c.id, { types: all(false), themeIds: [], districtIds: [] }, db);
    await notifyUser(db, c.id, { type: "nova_consulta", title: "Opcional", body: "x" });
    await notifyUser(db, c.id, { type: "conta", title: "Obrigatório", body: "x" });
    const ns = await db.select().from(notifications).where(eq(notifications.userId, c.id));
    expect(ns.map((n) => n.title)).toEqual(["Obrigatório"]);
    expect(await unsubscribe(c.id, "conta", db)).toBe(false);
    expect(await unsubscribe(c.id, "lembrete", db)).toBe(true);
  });
});

describe("Exportação aberta (RF045, RS005)", () => {
  it("sem dados no período informa vazio; nunca contém dados pessoais", async () => {
    const out = await exportDataset("resultados", "json", { from: "2001-01-01", to: "2001-01-02" }, db);
    expect(out.empty).toBe(true);
    const all = await exportDataset("encaminhamentos", "csv", {}, db);
    const emails = (await db.select({ e: users.email }).from(users)).map((u) => u.e);
    for (const e of emails) expect(String(all.body)).not.toContain(e);
  });
});

describe("Controle de acesso por papel (RF009, RN20, RN21)", () => {
  it("analista não modera sem permissão; cidadão não analisa", async () => {
    const analyst = await createAdmin(db, ["analise_propostas"]);
    await expect(decideModeration(analyst, { targetType: "comment", targetId: "00000000-0000-0000-0000-000000000000", decision: "manter", justification: "x" }, db)).rejects.toBeInstanceOf(ForbiddenError);
    const c = await createCitizen(db);
    const { loadActor } = await import("@/server/modules/access/access.service");
    const actor = (await loadActor(c.id, db))!;
    const p = await submitCitizenProposal(c.id, proposal(), [], db);
    await expect(analyzeProposal(actor, p.id, { action: "iniciar_analise" }, db)).rejects.toBeInstanceOf(DomainError);
  });
});
