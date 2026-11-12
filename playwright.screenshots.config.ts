/** Gera as capturas reais das telas para o README e o Trello: `npm run screenshots` (salva em screenshots/). */
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "tests/screenshots",
  reporter: [["list"]],
  timeout: 240_000,
  projects: [{ name: "capturas", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
