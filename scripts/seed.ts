// Carrega os dados FICTÍCIOS de demonstração em um banco vazio.
import { count } from "drizzle-orm";
import { closeDb, getDb } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";
import { seedReferenceData } from "../database/seeds/seed-reference";
import { seedDemoData } from "../database/seeds/seed-demo";
import { users } from "../src/server/db/schema";

async function main() {
  const db = getDb();
  await runMigrations();
  await seedReferenceData(db);
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) {
    console.log("[ppcm] o banco já possui usuários; use `npm run db:reset` para recomeçar.");
  } else {
    await seedDemoData(db);
    console.log("[ppcm] dados de demonstração carregados.");
  }
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
