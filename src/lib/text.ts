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

/**
 * Aceita apenas URL https com nome de domínio público. Recusa IP literal, localhost e
 * sufixos internos — o servidor verifica periodicamente os links (RF023) e não pode ser
 * usado para alcançar endereços internos (SSRF).
 */
export function isPublicHttpsUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".")) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false; // IPv4/IPv6 literal
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(host)) return false;
  return true;
}

/** Destino de redirecionamento interno seguro (evita redirecionamento aberto). */
export function safeInternalPath(next: string | null | undefined, fallback: string): string {
  const n = String(next ?? "");
  const hasControl = Array.from(n).some((ch) => ch.charCodeAt(0) < 32);
  const ok = n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") && !hasControl;
  return ok ? n : fallback;
}

/**
 * Identificador no formato UUID. Parâmetros de URL (filtros e rotas `[id]`) são conferidos antes de
 * chegar ao banco: um valor fora do formato faz o PostgreSQL recusar a consulta (erro 500).
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Data AAAA-MM-DD de filtros de URL; devolve null se o texto não for uma data real (ex.: 2026-02-30). */
export function parseIsoDay(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? m[0] : null;
}
