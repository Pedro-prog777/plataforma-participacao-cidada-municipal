// Recria o banco LOCAL do PGlite do zero, com dados de demonstração.
// Por segurança, não apaga bancos PostgreSQL remotos (DATABASE_URL).
import fs from "node:fs";
import path from "node:path";

async function main() {
  if (process.env.DATABASE_URL) {
    console.error("[ppcm] DATABASE_URL definido: o reset só apaga o banco local PGlite. Recrie o banco PostgreSQL manualmente.");
    process.exit(1);
  }
  const dir = path.resolve(process.env.PGLITE_DIR || "./.data/pglite");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[ppcm] banco local removido: ${dir}`);
  await import("./seed");
}
main();
