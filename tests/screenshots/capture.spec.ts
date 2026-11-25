/** Captura das telas implementadas (evidência visual para README e Trello). Não é teste funcional. */
import { test, type Page } from "@playwright/test";
import { lastCode, loginAdmin, loginCitizen } from "../e2e/helpers";

const OUT = "screenshots";
async function shot(page: Page, name: string, path?: string) {
  if (path) await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const n = Number(name.slice(0, 2));
  const area = n < 20 ? "area-publica" : n < 40 ? "cidadao" : n < 70 ? "administrador" : "celular";
  await page.screenshot({ path: `${OUT}/${area}/${name}.png`, fullPage: true });
}
async function slug(page: Page, q: string) {
  await page.goto(`/consultas?q=${encodeURIComponent(q)}`);
  return (await page.locator("article h3 a").first().getAttribute("href"))!;
}
async function adminId(page: Page, q: string) {
  await page.goto(`/admin/consultas?q=${encodeURIComponent(q)}`);
  return (await page.locator("table a").first().getAttribute("href"))!;
}

test("área pública", async ({ page }) => {
  await shot(page, "01-inicio", "/");
  await shot(page, "02-indicadores", "/indicadores");
  await shot(page, "03-consultas", "/consultas");
  await shot(page, "04-pesquisa", "/consultas/pesquisa");
  const ciclo = await slug(page, "ciclofaixa");
  await shot(page, "05-detalhe-consulta", ciclo);
  await shot(page, "06-como-funciona", "/como-funciona");
  await shot(page, "07-consultas-encerradas", "/consultas/encerradas");
  const coleta = await slug(page, "coleta seletiva");
  await shot(page, "08-resultado", `${coleta}/resultado`);
  await shot(page, "09-historico", `${coleta}/historico`);
  await shot(page, "10-encaminhamentos", "/encaminhamentos");
  await shot(page, "11-transparencia", "/transparencia");
  await shot(page, "12-propostas", "/propostas");
  await page.goto("/propostas");
  await page.locator("li h2 a").first().click();
  await shot(page, "13-detalhe-proposta");
  await shot(page, "14-cadastro", "/cadastro");
  await shot(page, "15-login", "/entrar");
  await shot(page, "16-recuperar-senha", "/recuperar-senha");
  await shot(page, "17-resultados", "/resultados");
  await shot(page, "18-dados-abertos", "/dados-abertos");
});

test("área do cidadão", async ({ page }) => {
  await loginCitizen(page, "maria@exemplo.com");
  await shot(page, "20-meu-perfil", "/conta");
  await shot(page, "21-verificacao", "/conta/verificacao");
  await shot(page, "22-minhas-participacoes", "/conta/participacoes");
  await shot(page, "23-nova-proposta", "/conta/propostas/nova?titulo=ciclovia%20escola");
  await page.goto("/conta/propostas");
  await page.locator("table a").first().click();
  await shot(page, "24-acompanhar-proposta");
  await shot(page, "25-avisos", "/conta/avisos");
  await shot(page, "26-preferencias", "/conta/notificacoes");
  await shot(page, "27-privacidade", "/conta/privacidade");
  // Votação: a Carla ainda não participou de nenhuma consulta nos dados fictícios.
  await page.context().clearCookies();
  await loginCitizen(page, "carla@exemplo.com");
  const ciclo = await slug(page, "ciclofaixa");
  await page.goto(`${ciclo}/participar`);
  await shot(page, "28-votacao-escolher");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Revisar minha escolha" }).click();
  await page.getByLabel("Código de confirmação").waitFor();
  await shot(page, "29-votacao-revisar");
  await page.getByLabel("Código de confirmação").fill(await lastCode(page, "carla@exemplo.com"));
  await page.getByRole("button", { name: "Confirmar meu voto" }).click();
  await page.getByRole("heading", { name: "Participação registrada com sucesso!" }).waitFor();
  await shot(page, "30-voto-registrado");
  const code = (await page.locator("p.font-mono").textContent())!.trim();
  await page.goto("/comprovante");
  await page.getByLabel("Código do comprovante").fill(code);
  await page.getByRole("button", { name: "Verificar" }).click();
  await page.getByText(/Situação:/).waitFor();
  await shot(page, "31-verificar-comprovante");
});

test("administração", async ({ page }) => {
  await loginAdmin(page, "gestor");
  await shot(page, "40-painel-admin", "/admin");
  await shot(page, "41-monitoramento", "/admin/monitoramento");
  await shot(page, "42-usuarios", "/admin/usuarios");
  await shot(page, "43-papeis", "/admin/papeis");
  await shot(page, "44-auditoria", "/admin/auditoria?verificar=1");
  await shot(page, "45-incidentes", "/admin/incidentes");
  await shot(page, "46-relatorios", "/admin/relatorios");
  await shot(page, "47-parametros", "/admin/configuracoes");
  await shot(page, "48-consultas-admin", "/admin/consultas");
  const arbor = await adminId(page, "arborizacao");
  await shot(page, "49-consulta-visao-geral", arbor);
  await shot(page, "50-responsaveis", `${arbor}/responsaveis`);

  await page.context().clearCookies();
  await loginAdmin(page, "elaboradora");
  await shot(page, "51-criar-consulta", "/admin/consultas/nova");
  const arbor2 = await adminId(page, "arborizacao");
  await shot(page, "52-alternativas", `${arbor2}/alternativas`);
  await shot(page, "53-publico-alvo", `${arbor2}/publico-alvo`);
  await shot(page, "54-propostas-municipais", "/admin/propostas-municipais");

  await page.context().clearCookies();
  await loginAdmin(page, "aprovadora");
  const acad = await adminId(page, "academia");
  await shot(page, "55-aprovacao", `${acad}/aprovacao`);

  await page.context().clearCookies();
  await loginAdmin(page, "responsavel");
  const ubs = await adminId(page, "unidades basicas");
  await shot(page, "56-revisao", `${ubs}/revisao`);
  const ciclo = await adminId(page, "ciclofaixa");
  await shot(page, "57-conducao", `${ciclo}/conducao`);
  await shot(page, "58-divulgacao", `${ciclo}/divulgacao`);
  const feira = await adminId(page, "feira");
  await shot(page, "59-publicacao-resultado", `${feira}/resultado`);
  const escola = await adminId(page, "escolas");
  await shot(page, "60-encaminhamentos-admin", `${escola}/encaminhamentos`);

  await page.context().clearCookies();
  await loginAdmin(page, "analista");
  await shot(page, "61-fila-propostas", "/admin/propostas");
  await page.locator("table a").first().click();
  await shot(page, "62-analise-proposta");
  await shot(page, "63-moderacao", "/admin/moderacao");
  await shot(page, "64-verificacoes", "/admin/verificacoes");
});

test("celular (375 px)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
  const page = await ctx.newPage();
  await shot(page, "70-celular-inicio", "/");
  const ciclo = await slug(page, "ciclofaixa");
  await shot(page, "71-celular-consulta", ciclo);
  await ctx.close();
});
