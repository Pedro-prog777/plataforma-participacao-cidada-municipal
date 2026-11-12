/**
 * Banco isolado por arquivo de teste.
 *  - Padrão: PGlite em memória (PostgreSQL real em WebAssembly), migrations aplicadas do zero.
 *  - TEST_DATABASE_URL definido (CI): PostgreSQL servidor; o esquema é recriado a cada arquivo.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { closeDb, setDb, type Db } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import * as schema from "@/server/db/schema";
import { seedReferenceData } from "@database/seeds/seed-reference";
import { invalidateSettingsCache } from "@/server/lib/settings";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { clock } from "@/server/lib/clock";

export async function createTestDb(): Promise<Db> {
  invalidateSettingsCache();
  resetRateLimits();
  clock.set(null);
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 10 });
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    const db = drizzlePg(pool, { schema, casing: "snake_case" });
    setDb(db, "pg", () => pool.end());
    await runMigrations(db, "pg");
    await seedReferenceData(db);
    return db;
  }
  const client = new PGlite();
  const db = drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as Db;
  setDb(db, "pglite", () => client.close());
  await runMigrations(db, "pglite");
  await seedReferenceData(db);
  return db;
}

export async function destroyTestDb() {
  clock.set(null);
  await closeDb();
}
