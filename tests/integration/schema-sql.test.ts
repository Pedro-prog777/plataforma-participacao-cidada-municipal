/**
 * Scripts SQL de entrega (DT-35): database/schema.sql reconstrói exatamente a estrutura criada pelas
 * migrations, e database/seed-referencia.sql carrega os mesmos dados iniciais de `seedReferenceData`.
 * Também falha se os arquivos estiverem desatualizados (rode `npm run db:sql`).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import type { Db } from "@/server/db/client";
import { seedReferenceData } from "@database/seeds/seed-reference";
import { ARQUIVO_SCHEMA, ARQUIVO_SEED, montarSchemaSql, montarSeedReferenciaSql } from "../../scripts/gerar-sql-do-banco";

/** Estrutura do esquema public: tabelas, colunas, restrições, índices, gatilhos, funções e views. */
const CATALOGO = `
  select 'tabela' as k, table_name as v from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
  union all select 'view', table_name || ': ' || regexp_replace(view_definition, '\\s+', ' ', 'g') from information_schema.views where table_schema = 'public'
  union all select 'coluna', table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') from information_schema.columns where table_schema = 'public'
  union all select 'restricao', conrelid::regclass::text || '.' || conname || ' ' || pg_get_constraintdef(oid) from pg_constraint where connamespace = 'public'::regnamespace
  union all select 'indice', indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
  union all select 'gatilho', tgrelid::regclass::text || '.' || tgname || ' ' || pg_get_triggerdef(oid) from pg_trigger where not tgisinternal
  union all select 'funcao', proname || ' ' || md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace
  union all select 'enum', t.typname || '=' || e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace
  order by 1, 2`;

const REFERENCIA = `
  select 'regions' as t, count(*)::int as n from regions union all select 'districts', count(*)::int from districts
  union all select 'themes', count(*)::int from themes union all select 'organs', count(*)::int from organs
  union all select 'roles', count(*)::int from roles order by 1`;

let pelasMigrations: PGlite;
let peloScript: PGlite;

beforeAll(async () => {
  pelasMigrations = new PGlite();
  const db = drizzle(pelasMigrations, { schema, casing: "snake_case" }) as unknown as Db;
  await runMigrations(db, "pglite");
  await seedReferenceData(db);
  peloScript = new PGlite();
  await peloScript.exec(readFileSync(ARQUIVO_SCHEMA, "utf8"));
  await peloScript.exec(readFileSync(ARQUIVO_SEED, "utf8"));
});

afterAll(async () => {
  await pelasMigrations?.close();
  await peloScript?.close();
});

describe("database/schema.sql e database/seed-referencia.sql", () => {
  it("estão atualizados em relação às migrations e ao seed de referência", async () => {
    expect(readFileSync(ARQUIVO_SCHEMA, "utf8")).toBe(montarSchemaSql());
    expect(readFileSync(ARQUIVO_SEED, "utf8")).toBe(await montarSeedReferenciaSql());
  });

  it("schema.sql reconstrói a mesma estrutura das migrations (tabelas, restrições, índices, gatilhos, funções e view)", async () => {
    const esperado = (await pelasMigrations.query<{ k: string; v: string }>(CATALOGO)).rows;
    const obtido = (await peloScript.query<{ k: string; v: string }>(CATALOGO)).rows;
    expect(obtido.filter((r) => r.k === "tabela")).toHaveLength(44);
    expect(obtido.some((r) => r.k === "view" && r.v.startsWith("vw_consultas_publicas"))).toBe(true);
    expect(obtido).toEqual(esperado);
  });

  it("cria as contas e as permissões (relatórios vê só a view)", async () => {
    const contas = (await peloScript.query<{ rolname: string }>("select rolname from pg_roles where rolname like 'ppcm_%' order by 1")).rows.map((r) => r.rolname);
    expect(contas).toEqual(["ppcm_app", "ppcm_auditoria", "ppcm_relatorios"]);
    const pode = async (conta: string, objeto: string) =>
      (await peloScript.query<{ ok: boolean }>(`select has_table_privilege('${conta}', '${objeto}', 'SELECT') as ok`)).rows[0].ok;
    expect(await pode("ppcm_relatorios", "vw_consultas_publicas")).toBe(true);
    expect(await pode("ppcm_relatorios", "users")).toBe(false);
  });

  it("seed-referencia.sql carrega os mesmos dados iniciais e pode ser executado de novo", async () => {
    const esperado = (await pelasMigrations.query(REFERENCIA)).rows;
    expect((await peloScript.query(REFERENCIA)).rows).toEqual(esperado);
    await peloScript.exec(readFileSync(ARQUIVO_SEED, "utf8"));
    expect((await peloScript.query(REFERENCIA)).rows).toEqual(esperado);
  });
});
