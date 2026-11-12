import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { totp } from "../../src/server/lib/totp";

export const PASSWORD = "Demo@2026";
export const TOTP = {
  gestor: "GESTORDEMOPPCMAAGESTORDEMOPPCMAA",
  elaboradora: "ELABORADORADEMOAELABORADORADEMOA",
  aprovadora: "APROVADORADEMOPPAPROVADORADEMOPP",
  responsavel: "RESPONSAVELDEMOPRESPONSAVELDEMOP",
  analista: "ANALISTADEMOPPCMAANALISTADEMOPPC",
} as const;

export async function loginCitizen(page: Page, email: string, next = "/conta") {
  await page.goto(`/entrar?proximo=${encodeURIComponent(next)}`);
  await page.getByLabel("CPF ou e-mail").fill(email);
  await page.getByLabel("Senha", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

export async function loginAdmin(page: Page, who: keyof typeof TOTP) {
  await page.goto("/entrar");
  await page.getByLabel("CPF ou e-mail").fill(`${who}@prefeitura.exemplo`);
  await page.getByLabel("Senha", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/entrar/segundo-fator");
  await page.getByLabel("Código do autenticador").fill(totp(TOTP[who]));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.waitForURL("**/admin");
}

/** Lê o último código de 6 dígitos enviado a um destinatário na caixa simulada. */
export async function lastCode(page: Page, email: string) {
  const res = await page.request.get(`/demo/caixa-de-email?para=${encodeURIComponent(email)}`);
  const html = await res.text();
  const m = html.match(/participação é (\d{6})/);
  if (!m) throw new Error("código não encontrado");
  return m[1];
}

/** Verificação automática de acessibilidade (WCAG 2.2 A/AA) com axe-core. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(r.sw).toBeLessThanOrEqual(r.w);
}
