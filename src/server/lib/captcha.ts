/**
 * CAPTCHA simples, sem serviço externo (RF010, RF041): desafio aritmético assinado com HMAC,
 * válido por 10 minutos. Para produção recomenda-se um serviço acessível (ver DECISOES_TECNICAS DT-12).
 */
import crypto from "node:crypto";
import { signPayload, verifyPayload } from "./crypto";

const NUMBERS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

export type Captcha = { question: string; token: string };

export function createCaptcha(): Captcha {
  const a = crypto.randomInt(1, 10);
  const b = crypto.randomInt(1, 10);
  const token = signPayload({ s: a + b, e: Date.now() + 10 * 60_000, n: crypto.randomBytes(6).toString("hex") });
  return { question: `Quanto é ${NUMBERS[a]} mais ${NUMBERS[b]}? (responda com números)`, token };
}

export function verifyCaptcha(token: string | null | undefined, answer: string | null | undefined): boolean {
  if (!token || !answer) return false;
  const data = verifyPayload<{ s: number; e: number }>(token);
  if (!data || data.e < Date.now()) return false;
  return Number(String(answer).trim()) === data.s;
}
