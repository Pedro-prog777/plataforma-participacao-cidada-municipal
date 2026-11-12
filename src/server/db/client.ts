/**
 * Conexão com o PostgreSQL.
 *  - DATABASE_URL definido  → PostgreSQL real via node-postgres (produção, docker compose, CI).
 *  - DATABASE_URL vazio     → PGlite (PostgreSQL 17 compilado para WebAssembly) em PGLITE_DIR,
 *                             para desenvolvimento e demonstração sem instalar servidor.
 * Ver docs/arquitetura/DECISOES_TECNICAS.md (DT-03).
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export type DbKind = "pg" | "pglite";

type Holder = { db?: Db; kind?: DbKind; close?: () => Promise<void> };
const g = globalThis as unknown as { __ppcmDb?: Holder };
const holder: Holder = (g.__ppcmDb ??= {});

export function getDb(): Db {
  if (!holder.db) {
    const url = process.env.DATABASE_URL?.trim();
    if (url) {
      const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX || 10) });
      holder.db = drizzlePg(pool, { schema, casing: "snake_case" });
      holder.kind = "pg";
      holder.close = () => pool.end();
    } else {
      const dir = path.resolve(process.env.PGLITE_DIR || "./.data/pglite");
      fs.mkdirSync(dir, { recursive: true });
      const client = new PGlite(dir);
      holder.db = drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as Db;
      holder.kind = "pglite";
      holder.close = () => client.close();
    }
  }
  return holder.db;
}

export function getDbKind(): DbKind {
  getDb();
  return holder.kind!;
}

/** Usado pelos testes para injetar um banco isolado (PGlite em memória ou PostgreSQL de CI). */
export function setDb(db: Db, kind: DbKind, close?: () => Promise<void>) {
  holder.db = db;
  holder.kind = kind;
  holder.close = close;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.kind = undefined;
  holder.close = undefined;
}

export { schema };
