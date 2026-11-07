/** Utilitários para Server Actions: converte erros de domínio em estado de formulário. */
import { DomainError, type FieldErrors } from "../lib/errors";

export type FormState = { ok?: boolean; message?: string; fieldErrors?: FieldErrors; data?: Record<string, unknown>; values?: Record<string, string> };

/** Devolve os valores enviados (exceto senhas e códigos) para que o formulário não seja apagado após erro. */
export function withValues(state: FormState, fd: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION") || /senha|password|current|confirm$|code|codigo|totp/i.test(k)) continue;
    values[k] = k in values ? `${values[k]},${v}` : v;
  }
  return { ...state, values };
}

export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; state: FormState }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    if (e instanceof DomainError) {
      const extra = (e as DomainError & { pendencies?: unknown }).pendencies;
      return { ok: false, state: { ok: false, message: e.message, fieldErrors: e.fieldErrors, data: extra ? { pendencies: extra } : undefined } };
    }
    // Erros inesperados: nunca expõem detalhes internos ao usuário.
    console.error("[ppcm] erro inesperado em ação:", (e as Error)?.message);
    return { ok: false, state: { ok: false, message: "Não foi possível concluir a operação. Tente novamente." } };
  }
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function obj(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

export function files(fd: FormData, key: string): File[] {
  return fd.getAll(key).filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
}
