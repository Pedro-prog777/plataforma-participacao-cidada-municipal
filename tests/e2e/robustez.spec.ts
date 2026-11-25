/**
 * Robustez da navegação (revisão de qualidade de 24/11/2026): parâmetros de URL manipulados,
 * links quebrados, largura de 320 px nas áreas autenticadas e mensagens do assistente de votação.
 * Cada teste reproduz um defeito encontrado na revisão (ver docs/testes/RELATORIO_DE_TESTES.md).
 */
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, loginAdmin, loginCitizen } from "./helpers";

test.describe("parâmetros de URL manipulados não geram erro 500 (RF016, RF017, RF009)", () => {
  for (const url of ["/consultas?tema=abc", "/consultas?regiao=1%27%20OR%20%271%27%3D%271", "/consultas?de=xyz", "/consultas?ate=2026-13-45", "/consultas?pagina=-5", "/consultas?pagina=abc", "/consultas/encerradas?ano=abc", "/consultas?q=%5C"]) {
    test(`portal: ${decodeURIComponent(url)}`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("identificador fora do formato responde 404 (e não 500) para cidadão e API", async ({ page }) => {
    await loginCitizen(page, "maria@exemplo.com");
    for (const url of ["/conta/propostas/abc", "/conta/participacoes/abc"]) expect((await page.goto(url))?.status(), url).toBe(404);
    expect((await page.request.get("/api/conta/dados/abc")).status()).toBe(404);
  });

  test("identificador fora do formato responde 404 na administração; filtro de situação inválido é ignorado", async ({ page }) => {
    await loginAdmin(page, "gestor");
    for (const url of ["/admin/consultas/abc", "/admin/consultas/abc/resultado", "/admin/usuarios/abc", "/admin/incidentes/abc"]) expect((await page.goto(url))?.status(), url).toBe(404);
    expect((await page.goto("/admin/consultas?situacao=xyz"))?.status()).toBe(200);
  });
});

async function semRolagem(page: Page, urls: string[]) {
  for (const url of urls) {
    await page.goto(url);
    await expectNoHorizontalScroll(page);
  }
}

test.describe("celular de 320 px nas áreas autenticadas (RNF03)", () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test("área do cidadão: o menu da conta rola sozinho, sem alargar a página (antes: 930 px)", async ({ page }) => {
    await loginCitizen(page, "maria@exemplo.com");
    await semRolagem(page, ["/conta", "/conta/participacoes", "/conta/propostas", "/conta/avisos", "/conta/notificacoes", "/conta/privacidade", "/conta/verificacao"]);
  });

  test("administração: tabelas e gráficos rolam dentro do próprio quadro", async ({ page }) => {
    await loginAdmin(page, "gestor");
    await semRolagem(page, ["/admin", "/admin/consultas", "/admin/usuarios", "/admin/incidentes", "/admin/relatorios", "/admin/auditoria"]);
    // Divulgação: o texto curto traz o link permanente, uma "palavra" longa que precisa quebrar.
    await page.goto("/admin/consultas?situacao=aberta");
    const consulta = await page.locator('main a[href^="/admin/consultas/"]').first().getAttribute("href");
    if (consulta) await semRolagem(page, [`${consulta}/divulgacao`]);
  });

  test("cartões de consulta com rótulos longos quebram linha", async ({ page }) => {
    await page.goto("/consultas");
    // Força o rótulo mais longo de situação em um cartão, independentemente do momento do teste.
    await page.evaluate(() => {
      const badge = document.querySelector("article span.rounded-full");
      if (badge) badge.textContent = "Votos contados — resultado em conferência";
    });
    await expectNoHorizontalScroll(page);
  });
});

test.describe("acessibilidade das telas autenticadas (RNF01)", () => {
  test("tabelas com rolagem são alcançáveis pelo teclado e a lista vazia é válida", async ({ page }) => {
    await loginAdmin(page, "gestor");
    for (const url of ["/admin/relatorios", "/admin/auditoria"]) {
      await page.goto(url);
      await expectAccessible(page);
    }
  });

  test("minhas participações sem propostas não gera lista inválida", async ({ page }) => {
    await loginCitizen(page, "joao@exemplo.com");
    await page.goto("/conta/participacoes");
    await expectAccessible(page);
  });
});

test("votação: depois de errar o código, voltar para mudar a escolha não mostra o erro antigo, e o código anterior continua valendo (DT-32)", async ({ page }) => {
  await loginCitizen(page, "maria@exemplo.com", "/consultas?posso_participar=1");
  const card = page.getByRole("article").filter({ hasText: "Você pode participar" }).first();
  test.skip((await card.count()) === 0, "a cidadã de demonstração já participou de todas as consultas abertas");
  const href = (await card.getByRole("link").first().getAttribute("href"))!;
  await page.goto(`${href}/participar`);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Revisar minha escolha" }).click();
  const first = (await page.locator("[data-codigo-demonstracao]").textContent())!.trim();
  await page.getByLabel("Código de confirmação").fill("000000");
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  await expect(page.getByText(/Código incorreto/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar e mudar a escolha" }).click();
  await expect(page.getByRole("button", { name: "Revisar minha escolha" })).toBeVisible();
  await expect(page.getByText(/Código incorreto/)).toHaveCount(0);
  // Gerar outro código não invalida o anterior: a votação termina com ele, na mesma guia.
  await page.getByRole("radio").last().check();
  await page.getByRole("button", { name: "Revisar minha escolha" }).click();
  await expect(page.locator("[data-codigo-demonstracao]")).not.toHaveText(first);
  await page.getByLabel("Código de confirmação").fill(first);
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  await expect(page.getByRole("heading", { name: "Participação registrada com sucesso!" })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test("portal público sem links internos quebrados", async ({ page, request }) => {
  const visitados = new Set<string>();
  const fila = ["/"];
  const quebrados: string[] = [];
  while (fila.length && visitados.size < 60) {
    const url = fila.shift()!;
    if (visitados.has(url)) continue;
    visitados.add(url);
    const res = await page.goto(url);
    if ((res?.status() ?? 0) >= 400) {
      quebrados.push(`${url} (${res?.status()})`);
      continue;
    }
    // A caixa de e-mail simulada lista mensagens de todas as contas: seus links são privados.
    if (url.startsWith("/demo/")) continue;
    for (const h of await page.$$eval("main a[href^='/'], header a[href^='/'], footer a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!))) {
      const limpo = h.replace(/#.*$/, "");
      if (!limpo || limpo.startsWith("//") || visitados.has(limpo)) continue;
      if (limpo.startsWith("/api/")) {
        const r = await request.get(limpo);
        if (r.status() >= 400) quebrados.push(`${limpo} (${r.status()}) em ${url}`);
        visitados.add(limpo);
      } else fila.push(limpo);
    }
  }
  expect(quebrados).toEqual([]);
});
