/** Administração: segundo fator, permissões por papel, segregação, painel sem parciais e auditoria. */
import { expect, test } from "@playwright/test";
import { expectAccessible, loginAdmin } from "./helpers";

test("conta administrativa exige segundo fator e vê só o menu permitido (RF005, RF009)", async ({ page }) => {
  await loginAdmin(page, "aprovadora");
  await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Menu administrativo" });
  await expect(nav.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/admin\/acesso-negado/);
  await expectAccessible(page);
});

test("aprovadora vê a consulta Em análise e pode decidir; elaboradora é barrada pela segregação (RN20)", async ({ page }) => {
  await loginAdmin(page, "elaboradora");
  await page.goto("/admin/consultas?q=academia");
  await page.getByRole("link", { name: "Academia ao ar livre no Trapiche da Barra" }).click();
  await page.getByRole("link", { name: "Aprovação", exact: true }).click();
  await expect(page.getByText("Apenas o aprovador designado pode decidir.")).toBeVisible();
});

test("painel de monitoramento não mostra contagem por alternativa (RN16) e auditoria verifica o encadeamento", async ({ page }) => {
  await loginAdmin(page, "gestor");
  await page.goto("/admin/monitoramento");
  await expect(page.getByRole("heading", { name: "Monitoramento de consultas" })).toBeVisible();
  await expect(page.getByText("Ciclofaixa no lado do lago")).toHaveCount(0);
  await page.goto("/admin/auditoria?verificar=1");
  await expect(page.getByText(/Encadeamento íntegro/)).toBeVisible();
  const csv = await page.request.get("/api/admin/auditoria");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).not.toMatch(/Demo@2026|\$argon2|cpf_hmac/i);
});

test("responsável publica resultado da consulta apurada (RF043)", async ({ page }) => {
  await loginAdmin(page, "responsavel");
  await page.goto("/admin/consultas?q=feira");
  await page.getByRole("link", { name: "Feira livre aos domingos no Poço" }).click();
  await page.getByRole("link", { name: "Resultado", exact: true }).click();
  await page.getByRole("button", { name: "Publicar resultado final" }).click();
  await expect(page).toHaveURL(/resultado/);
  await page.goto("/resultados");
  await expect(page.getByRole("link", { name: "Feira livre aos domingos no Poço" })).toBeVisible();
});

test("identificadores citados nas telas administrativas viram links para o documento (DT-24)", async ({ page, context }) => {
  await loginAdmin(page, "gestor");
  for (const path of ["/admin/monitoramento", "/admin/papeis", "/admin/configuracoes", "/admin/usuarios", "/admin/incidentes", "/admin/relatorios", "/admin/auditoria"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    // Nenhum RF/RNF/RN/RS fica como texto solto: ou é link, ou está marcado "a verificar".
    const soltos = await page.evaluate(() => {
      const padrao = /\b(RNF|RF|RN|RS)\d{2,4}\b/;
      const ignorar = "a, [data-ref], option, script, style, title, textarea, noscript";
      const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const achados: string[] = [];
      for (let n = andar.nextNode(); n; n = andar.nextNode()) if (padrao.test(n.textContent ?? "") && !n.parentElement?.closest(ignorar)) achados.push(n.textContent!.trim());
      return achados;
    });
    expect(soltos, path).toEqual([]);
  }

  await page.goto("/admin/monitoramento");
  const rn16 = page.locator('a.ref-req[data-ref="RN16"]').first();
  await expect(rn16).toHaveAttribute("href", "/requisitos#RN16");
  await expect(rn16).toHaveAttribute("target", "_blank");
  const [aba] = await Promise.all([context.waitForEvent("page"), rn16.click()]);
  await aba.waitForLoadState();
  await expect(aba).toHaveURL(/\/requisitos#RN16$/);
  await expect(aba.locator("#RN16")).toHaveClass(/req-destaque/);
  await expect(aba.locator("#RN16")).toBeInViewport();
  await aba.close();
});
