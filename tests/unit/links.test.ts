/**
 * Links internos (navegação): todo caminho fixo citado no código em `href`, `link` (avisos) ou
 * `redirect` precisa existir no App Router. Achou o aviso "Identidade verificada" e a ação
 * "Ver meu perfil" apontando para /conta/perfil, página inexistente (404).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../..");
function arquivos(dir: string, filtro: (nome: string) => boolean, out: string[] = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, filtro, out);
    else if (filtro(nome)) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

const rotas = arquivos(path.join(RAIZ, "src/app"), (n) => n === "page.tsx" || n === "route.ts").map((r) => {
  const url = r.slice(r.indexOf("/src/app") + "/src/app".length).replace(/\/(page\.tsx|route\.ts)$/, "").replace(/\/\([^)]+\)/g, "") || "/";
  return new RegExp(`^${url.replace(/\[[^\]]+\]/g, "[^/]+")}/?$`);
});

describe("links internos", () => {
  it("todo caminho fixo usado em href, link ou redirect corresponde a uma rota existente", () => {
    const quebrados: string[] = [];
    for (const f of arquivos(path.join(RAIZ, "src"), (n) => /\.tsx?$/.test(n))) {
      const texto = readFileSync(f, "utf8");
      for (const m of texto.matchAll(/(?:href|link|redirect\(|href:)\s*[=:(]?\s*["`]((?:\/[A-Za-z0-9\-_.]*)+)(?=[?#"`$])/g)) {
        const url = m[1];
        if (url === "/" || url.startsWith("/_next")) continue;
        if (!rotas.some((r) => r.test(url))) quebrados.push(`${path.relative(RAIZ, f)} -> ${url}`);
      }
    }
    expect(rotas.length).toBeGreaterThan(80);
    expect(quebrados).toEqual([]);
  });
});
