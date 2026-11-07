// Verificação rápida do seed em banco em memória (usado no desenvolvimento).
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import { setDb, type Db } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";
import { seedReferenceData } from "../src/server/db/seed-reference";
import { seedDemoData } from "../src/server/db/seed-demo";

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Db;
  setDb(db, "pglite");
  await runMigrations(db, "pglite");
  await seedReferenceData(db);
  const t = Date.now();
  await seedDemoData(db);
  const r = await db.execute(sql`select status, count(*)::int n from consultations group by status order by status`);
  console.log("seed ok em", Date.now() - t, "ms", r.rows);
  const v = await db.execute(sql`select (select count(*) from votes)::int votos, (select count(*) from participations)::int part, (select count(*) from audit_log)::int auditoria, (select count(*) from results)::int resultados`);
  console.log(v.rows);
}
main().catch((e) => { console.error(e); process.exit(1); });
