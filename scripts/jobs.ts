// Executa uma vez a rotina automática (RF019). Útil com SCHEDULER_ENABLED=false e um agendador externo (cron).
import { closeDb } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";
import { runSchedulerTick } from "../src/server/modules/scheduler/scheduler.service";

async function main() {
  await runMigrations();
  console.log("[ppcm] rotina:", await runSchedulerTick());
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
