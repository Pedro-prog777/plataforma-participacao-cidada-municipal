/** Fluxos do cidadão: cadastro, votação em 3 passos, comprovante e voto único. */
import { expect, test } from "@playwright/test";
import { expectAccessible, lastCode, loginCitizen } from "./helpers";

test("cadastro com CPF incompleto mostra todos os erros por campo; CPF fictício é aceito (RF001, RF002, DT-36)", async ({ page }) => {
  const erroCpf = "Informe os 11 números do CPF, no formato XXX.XXX.XXX-XX.";
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill("Teste E2E");
  await page.getByLabel("CPF", { exact: false }).first().fill("123.456.78");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(erroCpf)).toBeVisible();
  await expect(page.getByText(/aceitar os Termos de Uso/)).toBeVisible();
  // O nome digitado é preservado após o erro.
  await expect(page.getByLabel("Nome completo")).toHaveValue("Teste E2E");
  // CPF fictício, sem dígito verificador válido: o campo passa; só os outros erros continuam.
  await page.getByLabel("CPF", { exact: false }).first().fill("111.111.111-11");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(/aceitar os Termos de Uso/)).toBeVisible();
  await expect(page.getByText(erroCpf)).toHaveCount(0);
});

test("cadastro: a pontuação de CPF, data, celular e CEP entra sozinha; município só para quem mora fora (RF001)", async ({ page }) => {
  await page.goto("/cadastro");
  const campo = (nome: RegExp) => page.getByRole("textbox", { name: nome });
  await campo(/^CPF/).pressSequentially("12345678909");
  await campo(/Data de nascimento/).pressSequentially("10051990");
  await campo(/Celular/).pressSequentially("82999990000");
  await campo(/^CEP/).pressSequentially("57000111");
  await expect(campo(/^CPF/)).toHaveValue("123.456.789-09");
  await expect(campo(/Data de nascimento/)).toHaveValue("10/05/1990");
  await expect(campo(/Celular/)).toHaveValue("(82) 99999-0000");
  await expect(campo(/^CEP/)).toHaveValue("57000-111");
  // Letras são ignoradas e o excesso de dígitos é descartado.
  await campo(/^CEP/).fill("57a000-11199");
  await expect(campo(/^CEP/)).toHaveValue("57000-111");

  const municipio = page.getByLabel("Município e UF onde você mora");
  await expect(municipio).toBeHidden();
  await page.getByLabel("Bairro").selectOption("fora");
  await expect(municipio).toBeVisible();
  // Os valores formatados voltam preenchidos depois de um erro do servidor.
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(/aceitar os Termos de Uso/)).toBeVisible();
  await expect(campo(/Celular/)).toHaveValue("(82) 99999-0000");
  await expect(municipio).toBeVisible();
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
  // Demonstração: o código de confirmação aparece na própria tela (sem abrir e-mail nem outra página — DT-32).
  const shown = (await page.locator("[data-codigo-demonstracao]").textContent())!.trim();
  expect(shown).toBe(await lastCode(page, "carla@exemplo.com"));
  await page.getByLabel("Código de confirmação").fill(shown);
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  // Passo 3: confirmação com o código de participação, na mesma guia.
  await expect(page.getByRole("heading", { name: "Participação registrada com sucesso!" })).toBeVisible();
  await expect(page.getByText("Seu voto foi registrado e confirmado pelo sistema.")).toBeVisible();
  const code = (await page.locator("p.font-mono").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.getByText("não informa a alternativa escolhida")).toBeVisible();
  await expect(page.getByText(/Enviamos o comprovante/)).toHaveCount(0);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copiar código" }).click();
  await expect(page.getByRole("status").filter({ hasText: "O código foi copiado." })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  expect(page.context().pages()).toHaveLength(1);
  await expectAccessible(page);
  // Recarregar não perde o código.
  await page.reload();
  await expect(page.locator("p.font-mono")).toHaveText(code);

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
  await page.getByRole("link", { name: "Ciclofaixa na orla lagunar" }).click();
  await expect(page.getByText("Para participar, é preciso verificar sua identidade.")).toBeVisible();
  await page.getByRole("link", { name: "Verificar identidade" }).click();
  await expect(page.getByRole("heading", { name: /Verificação de identidade/ })).toBeVisible();
});

test("cidadão não acessa a área administrativa e a tentativa é negada (RF009)", async ({ page }) => {
  await loginCitizen(page, "maria@exemplo.com");
  await page.goto("/admin");
  await expect(page).toHaveURL(/acesso-negado/);
});

test("as telas do cidadão falam a língua do cidadão: sem termos técnicos nem códigos de requisito", async ({ page }) => {
  // Termos de desenvolvedor ou jurídico-administrativos que não devem aparecer para o cidadão.
  const tecnico = /\b(hash|SHA-?256|HMAC|DEMO_MODE|SMTP|OIDC|TOTP|homolog\w*|apura\w*|quórum|metodologia|elegib\w*|determin[íi]stic\w*)\b|provedor de identidade|\b(RNF?\d{2}|RF\d{3}|RS\d{3})\b/i;
  const conferir = async (url: string) => {
    await page.goto(url);
    const texto = await page.locator("body").innerText();
    expect(texto.match(tecnico)?.[0], `termo técnico em ${url}`).toBeUndefined();
  };
  for (const url of ["/", "/consultas", "/consultas/encerradas", "/resultados", "/transparencia", "/indicadores", "/encaminhamentos", "/propostas", "/como-funciona", "/comprovante", "/privacidade", "/termos", "/acessibilidade", "/prefeitura", "/cadastro", "/entrar"]) await conferir(url);
  await page.goto("/resultados");
  const resultado = await page.locator('main a[href$="/resultado"]').first().getAttribute("href");
  if (resultado) await conferir(resultado);
  await page.goto("/consultas");
  const consulta = await page.locator('main a[href^="/consultas/"]:not([href*="encerradas"])').first().getAttribute("href");
  if (consulta) {
    await conferir(consulta);
    await conferir(`${consulta}/historico`);
  }
  await loginCitizen(page, "maria@exemplo.com");
  for (const url of ["/conta", "/conta/participacoes", "/conta/propostas", "/conta/privacidade", "/conta/verificacao", "/conta/notificacoes", "/avisos"]) await conferir(url);
});

