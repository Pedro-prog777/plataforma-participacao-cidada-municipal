import { ensureDatabase } from "./server/db/bootstrap";
import { closeDb } from "./server/db/client";
import { env } from "./server/lib/env";
import { runSchedulerTick } from "./server/modules/scheduler/scheduler.service";

const g = globalThis as unknown as { __ppcmScheduler?: NodeJS.Timeout; __ppcmSignals?: boolean };

async function start() {
  await ensureDatabase();
  if (!g.__ppcmSignals) {
    g.__ppcmSignals = true;
    // Fecha o banco de forma limpa (importante para o PGlite, que grava em disco).
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.once(sig, () => {
        if (g.__ppcmScheduler) clearInterval(g.__ppcmScheduler);
        closeDb()
          .catch(() => undefined)
          .finally(() => process.exit(0));
      });
    }
  }
  if (!env.schedulerEnabled || g.__ppcmScheduler) return;
  g.__ppcmScheduler = setInterval(() => void runSchedulerTick(), 60_000);
  void runSchedulerTick();
}

start().catch((e) => console.error("[ppcm] falha ao inicializar:", (e as Error).message));
