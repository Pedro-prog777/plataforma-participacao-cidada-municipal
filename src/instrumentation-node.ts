import { ensureDatabase } from "./server/db/bootstrap";
import { env } from "./server/lib/env";
import { runSchedulerTick } from "./server/modules/scheduler/scheduler.service";

const g = globalThis as unknown as { __ppcmScheduler?: NodeJS.Timeout };

async function start() {
  await ensureDatabase();
  if (!env.schedulerEnabled || g.__ppcmScheduler) return;
  g.__ppcmScheduler = setInterval(() => void runSchedulerTick(), 60_000);
  void runSchedulerTick();
}

start().catch((e) => console.error("[ppcm] falha ao inicializar:", (e as Error).message));
