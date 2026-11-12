// Sobe um servidor de produção limpo para os testes E2E: banco PGlite novo + build separado.
import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const port = process.argv[2] || "3100";
const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-e2e",
  PGLITE_DIR: process.env.DATABASE_URL ? "" : "./.data/e2e",
  STORAGE_DIR: "./.data/e2e-storage",
  DEMO_MODE: "true",
  SCHEDULER_ENABLED: "true",
  APP_URL: `http://localhost:${port}`,
  NEXT_TELEMETRY_DISABLED: "1",
};
rmSync(".data/e2e", { recursive: true, force: true });
rmSync(".data/e2e-storage", { recursive: true, force: true });
if (!process.env.E2E_SKIP_BUILD) {
  const b = spawnSync("npx", ["next", "build"], { stdio: "inherit", env, shell: true });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const s = spawn("npx", ["next", "start", "-p", port], { stdio: "inherit", env, shell: true });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => s.kill(sig));
s.on("exit", (code) => process.exit(code ?? 0));
