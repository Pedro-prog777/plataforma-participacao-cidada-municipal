/** Portal público: navegação, busca, transparência, acessibilidade (RNF01) e celular (RNF03). */
import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

test("página inicial apresenta consultas abertas e indicadores", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua opinião");
  await expect(page.getByRole("heading", { name: "Consultas em votação" })).toBeVisible();
  await expect(page.getByText("Participações registradas")).toBeVisible();
});

test("busca sem acentos e filtros removíveis (RF017)", async ({ page }) => {
  await page.goto("/consultas?q=PRACA");
  await expect(page.getByRole("link", { name: "Revitalização da Praça do Centro" })).toBeVisible();
  await page.getByRole("link", { name: /Remover filtro/ }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await page.goto("/consultas?q=inexistentexyz");
  await expect(page.getByText("Nenhuma consulta encontrada")).toBeVisible();
});

test("rascunhos e consultas em análise nunca aparecem no portal (RF016)", async ({ page }) => {
  await page.goto("/consultas");
  await expect(page.getByText("Arborização das vias do Benedito Bentes")).toHaveCount(0);
  await expect(page.getByText("Academia ao ar livre no Trapiche da Barra")).toHaveCount(0);
});

test("consulta aberta mostra só participações, sem parciais (RN16)", async ({ page }) => {
  await page.goto("/consultas?q=ciclofaixa");
  await page.getByRole("link", { name: "Ciclofaixa na orla lagunar" }).click();
  await expect(page.getByText("Resultados por alternativa só após o encerramento.")).toBeVisible();
  await expect(page.getByText("mais votada")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Entre para participar" })).toBeVisible();
});

test("resultado publicado com gráfico, tabela, metodologia e aviso", async ({ page }) => {
  await page.goto("/resultados");
  await page.getByRole("link", { name: "Coleta seletiva porta a porta" }).click();
  await expect(page.getByText("Resultado de participação voluntária")).toBeVisible();
  await expect(page.getByRole("table", { name: "Votos por alternativa" })).toBeVisible();
  await expect(page.getByText(/Hash do resultado/)).toBeVisible();
});

test("consulta cancelada não exibe números por alternativa", async ({ page }) => {
  await page.goto("/consultas/encerradas");
  await page.getByRole("link", { name: /Mercado Público/ }).click();
  await expect(page.getByText("Os votos registrados foram lacrados e não foram apurados.", { exact: true })).toBeVisible();
});

test("dados abertos em CSV e JSON sem dados pessoais (RF045)", async ({ request }) => {
  const csv = await request.get("/api/dados-abertos/resultados?formato=csv");
  expect(csv.status()).toBe(200);
  const body = await csv.text();
  expect(body).toContain("hash_resultado");
  expect(body).not.toMatch(/@exemplo\.com/);
  const json = await request.get("/api/dados-abertos/encaminhamentos?formato=json");
  expect((await json.json()).dicionario.length).toBeGreaterThan(3);
});

test("cabeçalhos de segurança e CSP com nonce (RNF05)", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("áreas protegidas redirecionam visitantes ao login (RF009)", async ({ page }) => {
  await page.goto("/conta/participacoes");
  await expect(page).toHaveURL(/\/entrar\?proximo=/);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/entrar/);
  const r = await page.request.get("/api/admin/auditoria");
  expect(r.status()).toBe(403);
});

for (const path of ["/", "/consultas", "/como-funciona", "/transparencia", "/comprovante", "/cadastro", "/entrar", "/requisitos"]) {
  test(`acessibilidade WCAG 2.2 AA (axe) em ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectAccessible(page);
  });
}

test("alto contraste: ligado na página de Acessibilidade, vale nas páginas seguintes e mantém o contraste (RNF01, eMAG)", async ({ page }) => {
  await page.goto("/acessibilidade");
  const botao = page.getByRole("button", { name: /^Alto contraste/ });
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-contraste", "alto");
  await expectAccessible(page);
  // A preferência é lembrada ao navegar.
  await page.goto("/resultados");
  await expect(page.locator("html")).toHaveAttribute("data-contraste", "alto");
  await expectAccessible(page);
  await page.goto("/acessibilidade");
  await page.getByRole("button", { name: /^Alto contraste/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-contraste", "alto");
});

test("o topo identifica o município e avisa que não é o site oficial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Prefeitura de Maceió").first()).toBeAttached();
  await expect(page.getByText("Não é o site oficial da Prefeitura", { exact: false })).toBeVisible();
  await expect(page.locator("footer")).toContainText("Não é um serviço oficial da Prefeitura de Maceió");
  // A faixa do topo traz serviços para o cidadão; contraste e acessibilidade ficam na página própria (DT-22).
  const servicos = page.getByRole("navigation", { name: "Serviços" });
  await expect(servicos.getByRole("link", { name: "Verificar comprovante" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Alto contraste/ })).toHaveCount(0);
  await expect(page.locator("footer").getByRole("link", { name: "Acessibilidade" })).toBeVisible();
  // Os atalhos de teclado continuam existindo e aparecem ao receber foco.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ir para o conteúdo" })).toBeFocused();
});

test("a troca de página pelo menu funciona e não deixa o indicador de carregamento preso", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Consultas", exact: true }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Carregando a página" })).toHaveCount(0);
});

test("páginas de consulta e resultado acessíveis (axe)", async ({ page }) => {
  await page.goto("/resultados");
  await page.getByRole("link", { name: "Coleta seletiva porta a porta" }).click();
  await expectAccessible(page);
  await page.goto("/consultas?q=ciclofaixa");
  await page.getByRole("link", { name: "Ciclofaixa na orla lagunar" }).click();
  await expectAccessible(page);
});

test.describe("celular a partir de 320 px (RNF03)", () => {
  test.use({ viewport: { width: 320, height: 720 } });
  for (const path of ["/", "/consultas", "/transparencia", "/cadastro", "/resultados", "/propostas", "/requisitos"]) {
    test(`sem rolagem horizontal em ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe("referências cruzadas no documento de requisitos (DT-24)", () => {
  test("RN02 citada no RF001 leva à regra, rola até ela e a destaca por alguns segundos", async ({ page }) => {
    await page.goto("/requisitos");
    const link = page.locator('#RF001 a.ref-req[data-ref="RN02"]').first();
    await expect(link).toHaveAttribute("title", "RN02 — CPF único");
    await link.click();
    await expect(page).toHaveURL(/#RN02$/);
    const destino = page.locator("#RN02");
    await expect(destino).toHaveClass(/req-destaque/);
    await expect(destino).toBeInViewport();
    await expect(destino).toBeFocused();
    await expect(destino).toContainText("CPF único");
    await expect(destino).not.toHaveClass(/req-destaque/, { timeout: 10_000 });
    // Voltar refaz o caminho até o requisito anterior, que é destacado de novo.
    await destino.getByRole("link", { name: /RF004/ }).click();
    await expect(page.locator("#RF004")).toHaveClass(/req-destaque/);
    await page.goBack();
    await expect(page).toHaveURL(/#RN02$/);
    await expect(destino).toHaveClass(/req-destaque/);
  });

  test("endereço com âncora abre o RF004 destacado", async ({ page }) => {
    await page.goto("/requisitos#RF004");
    const rf004 = page.locator("#RF004");
    await expect(rf004.getByRole("heading", { level: 3 })).toHaveText("RF004 – Verificar identidade e domicílio do cidadão");
    await expect(rf004).toHaveClass(/req-destaque/);
    await expect(rf004).toBeInViewport();
  });

  test("identificador inexistente não vira link e fica sinalizado", async ({ page }) => {
    await page.goto("/requisitos");
    await expect(page.locator('a[data-ref="RF999"]')).toHaveCount(0);
    const marcado = page.locator('[data-ref="RF999"][data-ref-situacao="verificar"]');
    await expect(marcado).toHaveCount(1);
    await expect(marcado).toContainText("?");
    // Todo link de referência tem destino na página; o documento não tem referências a verificar.
    const semDestino = await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>("a.ref-req")].map((a) => a.hash.slice(1)).filter((id) => !document.getElementById(id)));
    expect(semDestino).toEqual([]);
    await expect(page.locator('[data-ref-situacao="verificar"]')).toHaveCount(1);
  });
});
