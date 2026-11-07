import crypto from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, key: Buffer = env.signingKey): string {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

/** HMAC do CPF (somente dígitos) com chave fora do banco — resistente a enumeração (RN02, RN33). */
export function cpfHmac(cpfDigits: string): string {
  return crypto.createHmac("sha256", env.cpfHmacKey).update(`cpf:${cpfDigits}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para códigos digitados por pessoas. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function humanCode(length: number): string {
  const out: string[] = [];
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 248) out.push(ALPHABET[byte % ALPHABET.length]); // 248 = 31*8, evita viés
  }
  return out.join("");
}

/** Código do comprovante: 12 caracteres aleatórios (RF038). */
export function receiptCode(): string {
  return humanCode(12);
}

export function normalizeReceiptCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatReceiptCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function numericCode(digits = 6): string {
  return String(crypto.randomInt(0, 10 ** digits)).padStart(digits, "0");
}

export function protocol(prefix: string): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${humanCode(6)}`;
}

/** Cifra AES-256-GCM (segredos TOTP). Formato: iv.tag.ciphertext em base64url. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", env.dataEncryptionKey, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ct] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", env.dataEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** JSON canônico (chaves ordenadas) para hashes reprodutíveis. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/** Assina um payload pequeno (tokens sem estado: CAPTCHA, descadastro de avisos). */
export function signPayload(data: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyPayload<T = Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(hmac(body), sig)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
