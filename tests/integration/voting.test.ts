/**
 * Votação, voto único, sigilo e apuração — RF011, RF036–RF042, RF059; RN05–RN09; RS001–RS003, RS009; RNF07, RNF14.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen, createOpenConsultation, assign } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { auditLog, consultations, emailOutbox, incidents, notifications, oneTimeCodes, participations, results, votes } from "@/server/db/schema";
import { castVote, myParticipations, requestVoteCode, verifyReceipt } from "@/server/modules/voting/voting.service";
import { closeDueConsultations, runSchedulerTick, shuffleVotes } from "@/server/modules/scheduler/scheduler.service";
import { publishFinalResult, verifyIntegrity } from "@/server/modules/results/results.service";
import { monitoringPanel, generateReport } from "@/server/modules/admin/monitoring.service";
import { exportDataset } from "@/server/modules/results/open-data.service";
import { searchAudit } from "@/server/modules/audit/audit.service";
import { clock, DAY } from "@/server/lib/clock";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { sha256 } from "@/server/lib/crypto";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

/** Lê o código de 6 dígitos da caixa de saída (e-mail simulado) — fluxo RF011. */
async function codeFor(userId: string, consultationId: string) {
  // O código só existe em claro no e-mail; aqui o teste o recupera da fila de saída.
  await requestVoteCode(userId, consultationId, "email", db);
  const [m] = await db.select().from(emailOutbox).orderBy(sql`created_at desc`).limit(1);
  return m.body.match(/é (\d{6})/)![1];
}

async function vote(userId: string, consultationId: string, alternativeId: string | null, abstention = false) {
  const code = await codeFor(userId, consultationId);
  return castVote(userId, { consultationId, alternativeId, abstention, code }, db);
}

describe("Registro de voto (RF037, RF038)", () => {
  it("registra participação e voto atomicamente e emite comprovante de 12 caracteres", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const r = await vote(citizen.id, consultation.id, alternatives[0].id);
    expect(r.receipt.replace(/-/g, "")).toHaveLength(12);
    const [p] = await db.select().from(participations).where(eq(participations.citizenId, citizen.id));
    expect(p.receiptHash).toBe(sha256(r.receipt.replace(/-/g, "")));
    const vs = await db.select().from(votes).where(eq(votes.consultationId, consultation.id));
    expect(vs).toHaveLength(1);
    // Comprovante na central de avisos, sem a alternativa (RF038).
    const ns = await db.select().from(notifications).where(eq(notifications.userId, citizen.id));
    expect(ns.some((n) => n.type === "comprovante")).toBe(true);
    expect(JSON.stringify(ns)).not.toContain(alternatives[0].label === "Sim" ? '"Sim"' : alternatives[0].label);
  });

  it("exige o código de confirmação (RF011) e interrompe após 3 erros", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    await requestVoteCode(citizen.id, consultation.id, "email", db);
    for (let i = 0; i < 2; i++) await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code: "000000" }, db)).rejects.toThrow(/incorreto/);
    await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code: "000000" }, db)).rejects.toThrow(/interrompida/);
    const vs = await db.select().from(votes).where(eq(votes.consultationId, consultation.id));
    expect(vs).toHaveLength(0);
  });

  it("código expira em 5 minutos", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const code = await codeFor(citizen.id, consultation.id);
    clock.set(new Date(Date.now() + 6 * 60_000));
    await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code }, db)).rejects.toThrow(/expirado/);
  });
});

describe("Voto único (RF039, RN05, RS001, RNF07)", () => {
  it("recusa o segundo voto do mesmo cidadão e audita a tentativa", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    await vote(citizen.id, consultation.id, alternatives[0].id);
    await expect(requestVoteCode(citizen.id, consultation.id, "email", db)).rejects.toThrow(/já participou/);
    const audits = await searchAudit({ action: "voto_recusado", objectId: consultation.id }, 50, db);
    expect(audits.length).toBeGreaterThan(0);
    expect((await db.select().from(votes).where(eq(votes.consultationId, consultation.id))).length).toBe(1);
  });

  it("requisições simultâneas do mesmo cidadão resultam em um único voto", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const code = await codeFor(citizen.id, consultation.id);
    // Gera códigos válidos idênticos para 5 envios paralelos (simula duplo clique / várias abas).
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[i % 2].id, abstention: false, code }, db)),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect((await db.select().from(participations).where(eq(participations.consultationId, consultation.id))).length).toBe(1);
    expect((await db.select().from(votes).where(eq(votes.consultationId, consultation.id))).length).toBe(1);
  });

  it("a restrição de unicidade do banco impede duplicidade mesmo contornando a regra de negócio", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const row = { consultationId: consultation.id, citizenId: citizen.id, participatedOn: "2026-01-01", receiptEnc: "x" };
    await db.insert(participations).values({ ...row, receiptHash: "a" });
    await expect(db.insert(participations).values({ ...row, receiptHash: "b" })).rejects.toThrow();
  });
});

describe("Período, situação e elegibilidade (RF036, RF040, RN08, RN09, RS009)", () => {
  it("recusa voto em consulta encerrada pelo horário do servidor, mesmo antes da rotina", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id, closesInMs: 60_000 });
    const citizen = await createCitizen(db);
    const code = await codeFor(citizen.id, consultation.id);
    clock.set(new Date(Date.now() + 2 * 60_000)); // passou do encerramento, status ainda "aberta"
    await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code }, db)).rejects.toThrow(/não está aberta/);
  });

  it("recusa voto em consulta suspensa", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const code = await codeFor(citizen.id, consultation.id);
    await db.update(consultations).set({ status: "suspensa" }).where(eq(consultations.id, consultation.id));
    await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code }, db)).rejects.toThrow(/suspensa/);
  });

  it("contas administrativas não votam (RN22) e identidade não verificada é barrada (RN04)", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: admin.id });
    await expect(requestVoteCode(admin.id, consultation.id, "email", db)).rejects.toThrow(/administrativas/);
    const unverified = await createCitizen(db, { verified: false });
    await expect(requestVoteCode(unverified.id, consultation.id, "email", db)).rejects.toThrow(/verificar sua identidade/);
  });

  it("recusa alternativa de outra consulta e abre incidente", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const a = await createOpenConsultation(db, { createdBy: admin.id });
    const b = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const code = await codeFor(citizen.id, a.consultation.id);
    await expect(castVote(citizen.id, { consultationId: a.consultation.id, alternativeId: b.alternatives[0].id, abstention: false, code }, db)).rejects.toThrow(/inexistente/);
    const inc = await db.select().from(incidents).where(eq(incidents.type, "alternativa_inexistente"));
    expect(inc.length).toBeGreaterThan(0);
  });
});

describe("Atomicidade e voto sem perda (RF037, RNF14)", () => {
  it("falha na gravação do voto desfaz a participação e permite nova tentativa", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    // Injeção de falha: o banco passa a recusar inserções em votes.
    await db.execute(sql`alter table votes add constraint teste_falha check (false) not valid`);
    const code = await codeFor(citizen.id, consultation.id);
    await expect(castVote(citizen.id, { consultationId: consultation.id, alternativeId: alternatives[0].id, abstention: false, code }, db)).rejects.toThrow(/Nada foi gravado/);
    expect((await db.select().from(participations).where(eq(participations.citizenId, citizen.id))).length).toBe(0);
    await db.execute(sql`alter table votes drop constraint teste_falha`);
    const r = await vote(citizen.id, consultation.id, alternatives[0].id);
    expect(r.receipt).toBeTruthy();
  });
});

describe("Sigilo do voto (RN07, RS002, RNF07)", () => {
  it("a tabela de votos não tem cidadão, comprovante, horário nem chave para participações", async () => {
    const cols = (await db.execute(sql`select column_name from information_schema.columns where table_name = 'votes'`)).rows.map((r) => (r as { column_name: string }).column_name);
    expect(cols.sort()).toEqual(["abstention", "alternative_id", "consultation_id", "id", "shuffle_key"]);
    const fks = (
      await db.execute(sql`select ccu.table_name as ref from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name where tc.table_name = 'votes' and tc.constraint_type = 'FOREIGN KEY'`)
    ).rows.map((r) => (r as { ref: string }).ref);
    expect(fks).not.toContain("users");
    expect(fks).not.toContain("participations");
    const pCols = (await db.execute(sql`select column_name, data_type from information_schema.columns where table_name = 'participations'`)).rows as { column_name: string; data_type: string }[];
    expect(pCols.map((c) => c.column_name)).not.toContain("alternative_id");
    // Participação guarda apenas a DATA, sem hora.
    expect(pCols.find((c) => c.column_name === "participated_on")?.data_type).toBe("date");
    expect(pCols.some((c) => c.data_type.startsWith("timestamp"))).toBe(false);
  });

  it("um administrador não consegue identificar a escolha de um cidadão por painel, relatório, auditoria, avisos ou exportação", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const gestor = await createAdmin(db, ["gestor_acessos", "acompanhamento", "publicacao_resultados"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: elab.id, alternatives: 3 });
    const target = await createCitizen(db);
    const others = await Promise.all([createCitizen(db), createCitizen(db), createCitizen(db)]);
    // O alvo escolhe uma alternativa com rótulo único "Talvez".
    await vote(target.id, consultation.id, alternatives[2].id);
    for (const o of others) await vote(o.id, consultation.id, alternatives[0].id);

    // 1) Painel durante a votação: só participações, nenhuma contagem por alternativa (RN16).
    const panel = await monitoringPanel(gestor, db);
    const mine = panel.find((p) => p.id === consultation.id)!;
    expect(mine.participations).toBe(4);
    expect(JSON.stringify(panel)).not.toMatch(/Talvez|alternative/i);
    // 2) Relatório agregado não contém alternativas.
    expect(JSON.stringify(await generateReport(gestor, {}, {}, db))).not.toContain("Talvez");
    // 3) Auditoria e avisos não contêm a alternativa nem o id dela.
    const auditRows = await db.select().from(auditLog);
    expect(JSON.stringify(auditRows)).not.toContain(alternatives[2].id);
    const allNotifications = await db.select().from(notifications);
    const allEmails = await db.select().from(emailOutbox);
    expect(JSON.stringify([allNotifications, allEmails])).not.toContain("Talvez");
    expect(JSON.stringify([allNotifications, allEmails])).not.toContain(alternatives[2].id);
    // 4) Código de confirmação não guarda a alternativa.
    expect(JSON.stringify(await db.select().from(oneTimeCodes))).not.toContain(alternatives[2].id);
    // 5) O histórico do próprio titular não mostra a opção votada (RF014).
    const hist = await myParticipations(target.id, db);
    expect(JSON.stringify(hist)).not.toContain("Talvez");
    expect(JSON.stringify(hist)).not.toContain(alternatives[2].id);
    // 6) Mesmo com acesso ao banco: a participação do alvo não tem nenhum campo em comum com votos.
    const [p] = await db.select().from(participations).where(eq(participations.citizenId, target.id));
    const vs = await db.select().from(votes).where(eq(votes.consultationId, consultation.id));
    for (const v of vs) {
      expect(Object.values(v)).not.toContain(p.id);
      expect(Object.values(v)).not.toContain(p.receiptHash);
    }
    // 7) Após encerrar e apurar, a exportação traz apenas agregados.
    await db.update(consultations).set({ closesAt: new Date(Date.now() - 1000) }).where(eq(consultations.id, consultation.id));
    await closeDueConsultations(db);
    await assign(db, consultation.id, gestor.id, "publicacao_resultados");
    await publishFinalResult(gestor, consultation.id, "Resultado consultivo: orienta a administração. Próximos passos: análise técnica.", db);
    const csv = (await exportDataset("resultados", "csv", { consultationId: consultation.id }, db)).body as string;
    expect(csv).toContain("Talvez");
    expect(csv).not.toContain(target.email);
    expect(csv).not.toContain(target.fullName);
    expect(csv).not.toContain(target.id);
  });

  it("votos não podem ser alterados nem excluídos por nenhuma ferramenta (RN39, RS003)", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    await vote(citizen.id, consultation.id, alternatives[0].id);
    await expect(db.update(votes).set({ alternativeId: alternatives[1].id }).where(eq(votes.consultationId, consultation.id))).rejects.toThrow();
    await expect(db.delete(votes).where(eq(votes.consultationId, consultation.id))).rejects.toThrow();
    await expect(db.delete(participations).where(eq(participations.consultationId, consultation.id))).rejects.toThrow();
  });
});

describe("Comprovante público (RF041)", () => {
  it("confirma participação sem revelar alternativa nem eleitor", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const r = await vote(citizen.id, consultation.id, alternatives[1].id);
    const v = await verifyReceipt(r.receipt.toLowerCase(), db);
    expect(v).toMatchObject({ consultationTitle: consultation.title, situation: "Registrado" });
    expect(JSON.stringify(v)).not.toMatch(/Não|citizen|cidad/);
    expect(await verifyReceipt("AAAA-BBBB-CCCC", db)).toBeNull();
  });
});

describe("Encerramento, integridade e apuração (RF035, RF042, RF059, RN18, RN19)", () => {
  it("encerra no horário, verifica integridade e apura com hash reprodutível", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id, allowAbstention: true, closesInMs: 10 * 60_000 });
    const cs = await Promise.all(Array.from({ length: 6 }, () => createCitizen(db)));
    await vote(cs[0].id, consultation.id, alternatives[0].id);
    await vote(cs[1].id, consultation.id, alternatives[0].id);
    await vote(cs[2].id, consultation.id, alternatives[0].id);
    await vote(cs[3].id, consultation.id, alternatives[1].id);
    await vote(cs[4].id, consultation.id, null, true);
    clock.set(new Date(Date.now() + 11 * 60_000));
    await runSchedulerTick(db);
    const [c] = await db.select().from(consultations).where(eq(consultations.id, consultation.id));
    expect(c.status).toBe("apurada");
    const [prelim] = await db.select().from(results).where(and(eq(results.consultationId, consultation.id), eq(results.kind, "preliminar")));
    expect(prelim.data.validVotes).toBe(4);
    expect(prelim.data.abstentions).toBe(1);
    expect(prelim.data.alternatives.map((a) => a.percentage)).toEqual(["75.00", "25.00"]);
    expect(prelim.data.winnerId).toBe(alternatives[0].id);
    const again = await verifyIntegrity(consultation.id, "sob_demanda", db);
    expect(again.passed).toBe(true);
    expect(again.hash).toBe(prelim.hash);
    // Após encerrada, nenhum voto é aceito (cidadão que não votou).
    await expect(requestVoteCode(cs[5].id, consultation.id, "email", db)).rejects.toThrow();
  });

  it("totais divergentes bloqueiam a apuração e abrem incidente (RF035, RF060)", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id, closesInMs: 60_000 });
    const c1 = await createCitizen(db);
    await vote(c1.id, consultation.id, alternatives[0].id);
    // Adulteração: voto inserido sem participação correspondente.
    await db.insert(votes).values({ consultationId: consultation.id, alternativeId: alternatives[1].id, abstention: false });
    clock.set(new Date(Date.now() + 2 * 60_000));
    await closeDueConsultations(db);
    const [c] = await db.select().from(consultations).where(eq(consultations.id, consultation.id));
    expect(c.status).toBe("encerrada");
    const inc = await db.select().from(incidents).where(and(eq(incidents.consultationId, consultation.id), eq(incidents.type, "falha_integridade")));
    expect(inc).toHaveLength(1);
    expect(inc[0].severity).toBe("alta");
  });

  it("consulta cancelada: comprovante indica que os votos não foram apurados", async () => {
    const admin = await createAdmin(db, ["elaborador"]);
    const { consultation, alternatives } = await createOpenConsultation(db, { createdBy: admin.id });
    const citizen = await createCitizen(db);
    const r = await vote(citizen.id, consultation.id, alternatives[0].id);
    await db.update(consultations).set({ status: "cancelada" }).where(eq(consultations.id, consultation.id));
    expect((await verifyReceipt(r.receipt, db))?.situation).toBe("Consulta cancelada");
  });

  it("reordena fisicamente a tabela de votos por chave aleatória (CLUSTER — mitigação RS002)", async () => {
    const before = await db.execute(sql`select count(*)::int as n from votes`);
    expect(await shuffleVotes(db, true)).toBe(true);
    const after = await db.execute(sql`select count(*)::int as n from votes`);
    expect((after.rows[0] as { n: number }).n).toBe((before.rows[0] as { n: number }).n);
    void DAY;
  });
});
