/**
 * Prepara o banco na primeira requisição: aplica migrations (idempotente) e, no modo
 * demonstração, carrega dados fictícios se o banco estiver vazio.
 */
import { count } from "drizzle-orm";
import { getDb } from "./client";
import { runMigrations } from "./migrate";
import { seedReferenceData } from "@database/seeds/seed-reference";
import { users } from "./schema";
import { demoMode } from "../lib/env";

const g = globalThis as unknown as { __ppcmBoot?: Promise<void> };

export function ensureDatabase(): Promise<void> {
  g.__ppcmBoot ??= (async () => {
    const db = getDb();
    await runMigrations(db);
    await seedReferenceData(db);
    const [{ n }] = await db.select({ n: count() }).from(users);
    if (n === 0 && demoMode()) {
      const { seedDemoData } = await import("@database/seeds/seed-demo");
      await seedDemoData(db);
    }
  })().catch((e) => {
    g.__ppcmBoot = undefined;
    throw e;
  });
  return g.__ppcmBoot;
}
