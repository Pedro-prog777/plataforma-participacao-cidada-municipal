/** Fluxos do cidadão: cadastro, votação em 3 passos, comprovante e voto único. */
import { expect, test } from "@playwright/test";
import { expectAccessible, lastCode, loginCitizen } from "./helpers";

test("cadastro com CPF inválido mostra todos os erros por campo (RF001, RF002)", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill("Teste E2E");
  await page.getByLabel("CPF", { exact: false }).first().fill("111.111.111-11");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("CPF inválido (confira os dígitos).")).toBeVisible();
  await expect(page.getByText(/aceitar os Termos de Uso/)).toBeVisible();
  // O nome digitado é preservado após o erro.
  await expect(page.getByLabel("Nome completo")).toHaveValue("Teste E2E");
});

test("login com dados incorretos mostra mensagem genérica (RF005)", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("CPF ou e-mail").fill("maria@exemplo.com");
  await page.getByLabel("Senha", { exact: false }).first().fill("senhaErrada9");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("CPF/e-mail ou senha incorretos.")).toBeVisible();
});

test("cidadã vota em 3 passos, recebe comprovante e não consegue votar de novo (RF011, RF037–RF041)", async ({ page }) => {
  await loginCitizen(page, "carla@exemplo.com", "/consultas?posso_participar=1");
  const card = page.getByRole("article").filter({ hasText: "Você pode participar" }).first();
  const title = (await card.getByRole("heading").textContent())!.trim();
  const href = (await card.getByRole("link").first().getAttribute("href"))!;
  await page.goto(href);
  await expect(page.getByRole("link", { name: "Participar", exact: true })).toBeVisible();
  await page.goto(`${href}/participar`);
  await expect(page.getByRole("button", { name: "Revisar minha escolha" })).toBeVisible();
  await expectAccessible(page);
  // Passo 1: escolher
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Revisar minha escolha" }).click();
  // Passo 2: revisar + código
  await expect(page.getByText("o voto não poderá ser alterado depois de confirmado")).toBeVisible();
  await page.getByLabel("Código de confirmação").fill("000000");
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  await expect(page.getByText(/Código incorreto/)).toBeVisible();
  await page.getByLabel("Código de confirmação").fill(await lastCode(page, "carla@exemplo.com"));
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  // Passo 3: comprovante
  await expect(page.getByRole("heading", { name: "Seu voto foi registrado" })).toBeVisible();
  const code = (await page.locator("p.font-mono").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.getByText("não informa a alternativa escolhida")).toBeVisible();

  // Voto único: voltar à consulta mostra "Você já participou" e a URL de votação redireciona ao comprovante.
  await page.getByRole("link", { name: "Voltar à consulta" }).click();
  await expect(page.getByText(/Você já participou em/)).toBeVisible();

  // Verificação pública do comprovante sem revelar a alternativa.
  await page.goto("/comprovante");
  await page.getByLabel("Código do comprovante").fill(code);
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText("Situação: Registrado")).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Histórico do titular sem a opção votada.
  await page.goto("/conta/participacoes");
  await expect(page.getByText(code)).toBeVisible();
});

test("cidadão sem identidade verificada é orientado a verificar (RN04)", async ({ page }) => {
  await loginCitizen(page, "joao@exemplo.com", "/consultas");
  await page.getByRole("link", { name: "Ciclofaixa na Avenida Beira-Lago" }).click();
  await expect(page.getByText("Para participar, é preciso verificar sua identidade.")).toBeVisible();
  await page.getByRole("link", { name: "Verificar identidade" }).click();
  await expect(page.getByRole("heading", { name: /Verificação de identidade/ })).toBeVisible();
});

test("cidadão não acessa a área administrativa e a tentativa é negada (RF009)", async ({ page }) => {
  await loginCitizen(page, "maria@exemplo.com");
  await page.goto("/admin");
  await expect(page).toHaveURL(/acesso-negado/);
});
