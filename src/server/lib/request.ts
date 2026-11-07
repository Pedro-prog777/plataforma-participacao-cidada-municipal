import { headers } from "next/headers";
import { hmac } from "./crypto";

/** IP do cliente (primeiro de X-Forwarded-For quando atrás de proxy confiável). */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
  } catch {
    return "local";
  }
}

/** O IP nunca é gravado em claro (RNF06): só um HMAC usado para contagem de tentativas. */
export function ipHash(ip: string): string {
  return hmac(`ip:${ip}`).slice(0, 32);
}

export async function userAgent(): Promise<string> {
  try {
    return ((await headers()).get("user-agent") || "").slice(0, 200);
  } catch {
    return "";
  }
}
