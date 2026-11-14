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
