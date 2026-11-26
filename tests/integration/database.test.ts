import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import type { Db } from "@/server/db/client";
import { auditLog, consultations, participations } from "@/server/db/schema";
import { createAdmin, createCitizen, createOpenConsultation } from "../helpers/fixtures";
import { audit, verifyAuditChain } from "@/server/modules/audit/audit.service";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);

describe("Banco de dados e trilha de auditoria (RF057, RF058, RS013)", () => {
  it("aplica as migrations e os dados de referência", async () => {
    const r = await db.execute(sql`select count(*)::int as n from districts`);
    expect((r.rows[0] as { n: number }).n).toBeGreaterThan(5);
  });

  it("encadeia os registros por hash e detecta adulteração", async () => {
    await audit(db, { action: "teste_1", objectType: "x", objectId: "1" });
    await audit(db, { action: "teste_2", objectType: "x", objectId: "2", details: { campo: "a", senha: "nao-deve-ser-gravada" } });
    const ok = await verifyAuditChain(db);
    expect(ok.ok).toBe(true);
    expect(ok.total).toBe(2);
    const rows = await db.select().from(auditLog);
    expect(JSON.stringify(rows)).not.toContain("nao-deve-ser-gravada");
  });

  it("recusa UPDATE, DELETE e TRUNCATE na trilha (somente acréscimo)", async () => {
    await expect(db.execute(sql`update audit_log set action = 'x'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from audit_log`)).rejects.toThrow();
    await expect(db.execute(sql`truncate audit_log`)).rejects.toThrow();
  });

  it("detecta o primeiro registro inconsistente quando o gatilho é contornado", async () => {
    // Simula um ataque com privilégio de superusuário que desliga o gatilho.
    await db.execute(sql`alter table audit_log disable trigger audit_log_somente_acrescimo`);
    await db.execute(sql`update audit_log set action = 'adulterado' where action = 'teste_2'`);
    await db.execute(sql`alter table audit_log enable trigger audit_log_somente_acrescimo`);
    const r = await verifyAuditChain(db);
    expect(r.ok).toBe(false);
    expect(r.firstInvalidId).toBe(2);
  });
});

/*
 * Estrutura de banco avaliada (DT-34): view, CHECK de regra de negócio, gatilho que executa uma
 * ação e contas com permissões separadas. As verificações de papel usam SET LOCAL ROLE dentro de
 * uma transação, para que a troca de conta não vaze para outras consultas do mesmo pool.
 */
async function comoPapel(papel: string, consulta: ReturnType<typeof sql>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local role ${papel}`));
    return tx.execute(consulta);
  });
}

/** Mensagem do PostgreSQL ao negar a operação (o Drizzle a guarda em `cause`). */
async function negado(papel: string, consulta: ReturnType<typeof sql>) {
  try {
    await comoPapel(papel, consulta);
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return `${err.message} ${err.cause?.message ?? ""}`;
  }
  return "permitido";
}

describe("View, integridade definida pelo usuário, gatilho de ação e permissões (DT-34)", () => {
  let consultaPublica: string;
  let rascunho: string;

  beforeAll(async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    consultaPublica = consultation.id;
    const outra = await createOpenConsultation(db, { createdBy: elab.id });
    rascunho = outra.consultation.id;
    await db.update(consultations).set({ status: "rascunho" }).where(eq(consultations.id, rascunho));
    const cidadao = await createCitizen(db);
    await db.insert(participations).values({ consultationId: consultaPublica, citizenId: cidadao.id, participatedOn: "2026-11-20", receiptHash: "h-view", receiptEnc: "x" });
  });

  it("vw_consultas_publicas lista só consultas públicas, com o total de participações e sem dados pessoais", async () => {
    const r = await db.execute(sql`select * from vw_consultas_publicas`);
    const linhas = r.rows as Record<string, unknown>[];
    const publica = linhas.find((l) => l.id === consultaPublica);
    expect(publica).toMatchObject({ situacao: "aberta", participacoes: 1 });
    expect(linhas.some((l) => l.id === rascunho)).toBe(false);
    // Nenhuma coluna pessoal nem de voto (RN07, RN16, RN27).
    expect(Object.keys(publica!).sort()).toEqual(["abertura", "encerramento", "id", "orgao", "participacoes", "regiao", "situacao", "slug", "tema", "titulo"]);
  });

  it("CHECK consultations_periodo_valido recusa encerramento antes da abertura (RN14)", async () => {
    await expect(db.execute(sql`update consultations set closes_at = opens_at - interval '1 day' where id = ${consultaPublica}`)).rejects.toThrow();
    // Rascunho sem datas continua permitido.
    await db.execute(sql`update consultations set opens_at = null, closes_at = null where id = ${rascunho}`);
  });

  it("gatilho preenche updated_at quando a alteração não o informa e respeita o valor informado", async () => {
    await db.execute(sql`update consultations set updated_at = '2020-01-01T00:00:00Z' where id = ${consultaPublica}`);
    const lido = async () => new Date(((await db.execute(sql`select updated_at from consultations where id = ${consultaPublica}`)).rows[0] as { updated_at: string }).updated_at);
    expect((await lido()).toISOString()).toBe("2020-01-01T00:00:00.000Z");
    await db.execute(sql`update consultations set summary = 'Resumo alterado direto no banco' where id = ${consultaPublica}`);
    expect((await lido()).getFullYear()).toBeGreaterThan(2020);
  });

  it("ppcm_relatorios lê a view e as tabelas de referência, mas não dados pessoais nem votos", async () => {
    expect((await comoPapel("ppcm_relatorios", sql`select count(*) from vw_consultas_publicas`)).rows).toHaveLength(1);
    expect((await comoPapel("ppcm_relatorios", sql`select count(*) from themes`)).rows).toHaveLength(1);
    for (const tabela of ["users", "votes", "participations", "audit_log"]) {
      expect(await negado("ppcm_relatorios", sql.raw(`select 1 from ${tabela} limit 1`)), tabela).toMatch(/permission denied/);
    }
  });

  it("ppcm_auditoria lê a trilha de auditoria, mas não as contas nem os votos", async () => {
    expect((await comoPapel("ppcm_auditoria", sql`select count(*) from audit_log`)).rows).toHaveLength(1);
    for (const tabela of ["users", "votes"]) {
      expect(await negado("ppcm_auditoria", sql.raw(`select 1 from ${tabela} limit 1`)), tabela).toMatch(/permission denied/);
    }
    expect(await negado("ppcm_auditoria", sql`delete from incidents`)).toMatch(/permission denied/);
  });

  it("ppcm_app lê e grava, mas não altera nem apaga registros imutáveis; só troca a chave de embaralhamento", async () => {
    expect((await comoPapel("ppcm_app", sql`select count(*) from users`)).rows).toHaveLength(1);
    await comoPapel("ppcm_app", sql`update consultations set summary = 'Alterado pela aplicação' where id = ${consultaPublica}`);
    expect(await negado("ppcm_app", sql`delete from votes`)).toMatch(/permission denied/);
    expect(await negado("ppcm_app", sql`update audit_log set action = 'x'`)).toMatch(/permission denied/);
    expect(await negado("ppcm_app", sql`delete from participations`)).toMatch(/permission denied/);
    expect(await negado("ppcm_app", sql`update votes set alternative_id = null`)).toMatch(/permission denied/);
    await comoPapel("ppcm_app", sql`update votes set shuffle_key = gen_random_uuid() where consultation_id = ${consultaPublica}`);
  });
});
