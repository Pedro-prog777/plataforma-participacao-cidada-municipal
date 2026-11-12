// Aplica as migrations no banco configurado (DATABASE_URL ou PGlite em PGLITE_DIR).
import { closeDb, getDbKind } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";
import { seedReferenceData } from "../src/server/db/seed-reference";
import { getDb } from "../src/server/db/client";

async function main() {
  await runMigrations();
  await seedReferenceData(getDb());
  console.log(`[ppcm] migrations aplicadas (${getDbKind()}).`);
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
