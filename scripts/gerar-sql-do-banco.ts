/**
 * Gera os scripts SQL de entrega a partir das fontes oficiais do banco (DT-35):
 *  - database/schema.sql          — estrutura completa: as migrations de database/migrations, na
 *                                   ordem do controle de versões (meta/_journal.json);
 *  - database/seed-referencia.sql — dados iniciais: o resultado de `seedReferenceData` (regiões,
 *                                   bairros, temas, órgãos e papéis administrativos), com chaves
 *                                   naturais (nomes) em vez de UUIDs, idempotente.
 *
 * As migrations continuam sendo a forma oficial de criar e atualizar o banco (`npm run db:migrate`);
 * estes arquivos são uma alternativa prática para reconstruir o banco com `psql`. O teste
 * `tests/integration/schema-sql.test.ts` falha se eles ficarem desatualizados.
 *
 * Uso: npm run db:sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import { runMigrations } from "../src/server/db/migrate";
import type { Db } from "../src/server/db/client";
import { seedReferenceData } from "../database/seeds/seed-reference";

const RAIZ = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(RAIZ, "database/migrations");
export const ARQUIVO_SCHEMA = path.join(RAIZ, "database/schema.sql");
export const ARQUIVO_SEED = path.join(RAIZ, "database/seed-referencia.sql");

type Journal = { entries: { idx: number; tag: string }[] };

/** Estrutura do banco: as migrations em ordem, sem os marcadores internos do Drizzle. */
export function montarSchemaSql(): string {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")) as Journal;
  const partes = [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((e) => {
      const corpo = readFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), "utf8").replace(/\r\n/g, "\n").replace(/--> statement-breakpoint/g, "").trim();
      return `-- ============================================================================\n-- ${e.tag}.sql\n-- ============================================================================\n${corpo}\n`;
    });
  return [
    "-- PPCM — Plataforma de Participação Cidadã Municipal — ESTRUTURA DO BANCO (PostgreSQL 16)",
    "-- Gerado por `npm run db:sql` a partir de database/migrations (não edite à mão).",
    "-- Inclui: tipos ENUM, 44 tabelas com chaves primárias, estrangeiras, UNIQUE e CHECK, índices,",
    "-- funções e gatilhos (registros somente de acréscimo, updated_at), a view vw_consultas_publicas",
    "-- e as contas ppcm_app, ppcm_relatorios e ppcm_auditoria com GRANT/REVOKE.",
    "--",
    "-- Uso (banco vazio): psql -d ppcm --single-transaction -f database/schema.sql",
    "--                    psql -d ppcm -f database/seed-referencia.sql",
    "-- A criação de contas exige usuário com permissão CREATEROLE (o dono padrão do PostgreSQL tem).",
    "-- As contas nascem sem senha; defina-a na implantação: ALTER ROLE ppcm_relatorios PASSWORD '...';",
    "-- A aplicação usa as migrations (npm run db:migrate), que produzem exatamente esta estrutura.",
    "",
    ...partes,
  ].join("\n");
}

const texto = (v: string) => `'${v.replace(/'/g, "''")}'`;
const lista = (vs: string[]) => (vs.length ? `ARRAY[${vs.map(texto).join(", ")}]::text[]` : "'{}'::text[]");

/** Dados iniciais: lidos de um banco recém-criado e alimentado por `seedReferenceData`. */
export async function montarSeedReferenciaSql(): Promise<string> {
  const cliente = new PGlite();
  const db = drizzle(cliente, { schema, casing: "snake_case" }) as unknown as Db;
  try {
    await runMigrations(db, "pglite");
    await seedReferenceData(db);
    const linhas = async <T,>(consulta: ReturnType<typeof sql>) => (await db.execute(consulta)).rows as T[];
    const regioes = await linhas<{ name: string }>(sql`select name from regions order by name`);
    const bairros = await linhas<{ name: string; region: string }>(sql`select d.name, r.name as region from districts d join regions r on r.id = d.region_id order by r.name, d.name`);
    const temas = await linhas<{ name: string }>(sql`select name from themes order by name`);
    const orgaos = await linhas<{ name: string; acronym: string }>(sql`select name, acronym from organs order by name`);
    const papeis = await linhas<{ key: string; name: string; description: string; permissions: string[]; system: boolean }>(sql`select key, name, description, permissions, system from roles order by key`);
    return [
      "-- PPCM — DADOS INICIAIS (dados de referência necessários para o sistema funcionar)",
      "-- Gerado por `npm run db:sql` a partir de database/seeds/seed-reference.ts (não edite à mão).",
      "-- Regiões e bairros reais de Maceió/AL; temas, órgãos e papéis administrativos do sistema.",
      "-- Idempotente: pode ser executado mais de uma vez (ON CONFLICT DO NOTHING).",
      "-- Os dados de DEMONSTRAÇÃO (pessoas e consultas fictícias) não entram aqui: dependem das chaves",
      "-- de criptografia do ambiente e são gerados por `npm run db:seed` com DEMO_MODE=true.",
      "",
      `-- Regiões administrativas (${regioes.length})`,
      ...regioes.map((r) => `INSERT INTO regions (name) VALUES (${texto(r.name)}) ON CONFLICT (name) DO NOTHING;`),
      "",
      `-- Bairros (${bairros.length})`,
      ...bairros.map((b) => `INSERT INTO districts (name, region_id) SELECT ${texto(b.name)}, id FROM regions WHERE name = ${texto(b.region)} ON CONFLICT (name) DO NOTHING;`),
      "",
      `-- Temas (${temas.length})`,
      ...temas.map((t) => `INSERT INTO themes (name) VALUES (${texto(t.name)}) ON CONFLICT (name) DO NOTHING;`),
      "",
      `-- Órgãos municipais fictícios (${orgaos.length})`,
      ...orgaos.map((o) => `INSERT INTO organs (name, acronym) VALUES (${texto(o.name)}, ${texto(o.acronym)}) ON CONFLICT (name) DO NOTHING;`),
      "",
      `-- Papéis administrativos do sistema (${papeis.length})`,
      ...papeis.map((p) => `INSERT INTO roles (key, name, description, permissions, system) VALUES (${texto(p.key)}, ${texto(p.name)}, ${texto(p.description)}, ${lista(p.permissions)}, ${p.system}) ON CONFLICT (key) DO NOTHING;`),
      "",
    ].join("\n");
  } finally {
    await cliente.close();
  }
}

async function main() {
  writeFileSync(ARQUIVO_SCHEMA, montarSchemaSql());
  writeFileSync(ARQUIVO_SEED, await montarSeedReferenciaSql());
  console.log("Gerados:", path.relative(RAIZ, ARQUIVO_SCHEMA), "e", path.relative(RAIZ, ARQUIVO_SEED));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
