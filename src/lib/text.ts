/** Utilitários de texto compartilhados (cliente e servidor). */

/** Minúsculas e sem acentos — busca sem diferenciar maiúsculas e acentos (RF017). */
export function normalizeSearch(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Remove conteúdo executável/marcação de texto livre (RF022, RF064).
 * Todo texto é exibido com escape pelo React; esta limpeza é defesa adicional
 * para exportações (CSV/PDF/e-mail) e para evitar armazenar HTML.
 */
export function sanitizePlainText(value: string): string {
  return (value || "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}
