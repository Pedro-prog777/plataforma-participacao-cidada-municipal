/**
 * Repositórios (DT-35): a ponte entre as entidades de domínio e as tabelas, com Drizzle ORM no
 * PostgreSQL (PGlite nos testes; PostgreSQL 16 no CI).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen, createOpenConsultation } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { consultations, districts, themes } from "@/server/db/schema";
import { NotFoundError } from "@/server/lib/errors";
import { ConsultaRepository } from "@/server/repositories/consulta.repository";
import { PropostaCidadaRepository } from "@/server/repositories/proposta-cidada.repository";
import { Consulta } from "@/server/domain/entities/consulta";
import { submitCitizenProposal } from "@/server/modules/proposals/citizen-proposals.service";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);

const linha = async (id: string) => (await db.select().from(consultations).where(eq(consultations.id, id)))[0];

describe("ConsultaRepository", () => {
  it("reconstrói a entidade a partir da tabela consultations", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    const consulta = await new ConsultaRepository(db).obter(consultation.id);
    expect(consulta).toBeInstanceOf(Consulta);
    expect(consulta.situacao).toBe("aberta");
    expect(consulta.titulo).toBe(consultation.title);
    expect(consulta.encerramento?.getTime()).toBe(consultation.closesAt!.getTime());
  });

  it("grava pela entidade só as colunas alteradas", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    const repositorio = new ConsultaRepository(db);
    const consulta = await repositorio.obter(consultation.id, { paraAtualizar: true });
    consulta.suspender("Material com erro");
    await repositorio.salvar(consulta);
    const depois = await linha(consultation.id);
    expect(depois).toMatchObject({ status: "suspensa", statusBeforeSuspension: "aberta", statusReason: "Material com erro", title: consultation.title, version: consultation.version });
  });

  it("sem alterações, não grava nada (o gatilho de updated_at não dispara)", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    await db.update(consultations).set({ updatedAt: new Date("2020-01-01T00:00:00Z") }).where(eq(consultations.id, consultation.id));
    const repositorio = new ConsultaRepository(db);
    await repositorio.salvar(await repositorio.obter(consultation.id));
    expect((await linha(consultation.id)).updatedAt.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });

  it("consulta inexistente: NotFoundError com a mesma mensagem de antes", async () => {
    await expect(new ConsultaRepository(db).obter("00000000-0000-4000-8000-000000000000")).rejects.toThrow(NotFoundError);
    await expect(new ConsultaRepository(db).obter("00000000-0000-4000-8000-000000000000")).rejects.toThrow("Consulta não encontrada.");
  });

  it("transição inválida não chega ao banco", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    const repositorio = new ConsultaRepository(db);
    const consulta = await repositorio.obter(consultation.id);
    expect(() => consulta.publicar(new Date(), 72)).toThrow("Somente consultas aprovadas podem ser publicadas.");
    await repositorio.salvar(consulta);
    expect((await linha(consultation.id)).status).toBe("aberta");
  });
});

describe("PropostaCidadaRepository", () => {
  it("lê, aplica os estados da RN30 e grava em citizen_proposals", async () => {
    const autora = await createCitizen(db);
    const [tema] = await db.select().from(themes).limit(1);
    const [bairro] = await db.select().from(districts).limit(1);
    const criada = await submitCitizenProposal(autora.id, { title: "Bancos na praça", problem: "Não há onde sentar na praça.", solution: "Instalar bancos de concreto.", themeId: tema.id, districtId: bairro.id, authorizePublication: "sim" }, [], db);
    const repositorio = new PropostaCidadaRepository(db);
    const proposta = await repositorio.obter(criada.id, { paraAtualizar: true });
    expect(proposta.situacao).toBe("recebida");
    proposta.iniciarAnalise(new Date());
    await repositorio.salvar(proposta);
    expect((await repositorio.obter(criada.id)).situacao).toBe("em_analise");
  });
});
