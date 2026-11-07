/**
 * Leitura centralizada das variáveis de ambiente. Segredos nunca têm valor fixo no código
 * para produção: em DEMO_MODE (desenvolvimento/demonstração acadêmica) é usada uma chave
 * derivada, claramente marcada como insegura, para que o projeto rode sem configuração.
 */
import crypto from "node:crypto";

const isProdBuild = process.env.NODE_ENV === "production";

export function demoMode(): boolean {
  const v = process.env.DEMO_MODE;
  if (v === undefined || v === "") return !isProdBuild;
  return v === "true" || v === "1";
}

const warned = new Set<string>();
function secret(name: string): Buffer {
  const v = process.env[name]?.trim();
  if (v) return Buffer.from(v, "utf8");
  if (!demoMode()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}. Veja .env.example.`);
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[ppcm] ${name} não definida — usando chave de DEMONSTRAÇÃO (insegura). Não use em produção.`);
  }
  return crypto.createHash("sha256").update(`ppcm-demo-only:${name}`).digest();
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get municipio() {
    return process.env.MUNICIPIO_NOME || "Município de Porto Alecrim";
  },
  get uf() {
    return process.env.MUNICIPIO_UF || "XX";
  },
  get cpfHmacKey() {
    return secret("CPF_HMAC_KEY");
  },
  get dataEncryptionKey() {
    return crypto.createHash("sha256").update(secret("DATA_ENCRYPTION_KEY")).digest();
  },
  get signingKey() {
    return secret("APP_SIGNING_KEY");
  },
  get storageDir() {
    return process.env.STORAGE_DIR || "./storage";
  },
  get schedulerEnabled() {
    return (process.env.SCHEDULER_ENABLED ?? "true") === "true";
  },
  get secureCookies() {
    return isProdBuild && !(process.env.APP_URL || "").startsWith("http://");
  },
};
