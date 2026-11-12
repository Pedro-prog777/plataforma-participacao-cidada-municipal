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
