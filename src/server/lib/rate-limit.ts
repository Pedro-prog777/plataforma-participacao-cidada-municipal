/**
 * Limitador de taxa em memória (janela deslizante). Usado em verificação de comprovante (RF041),
 * tentativas de voto (RF039), reenvio de e-mail (RF003, RF007) e formulários públicos.
 * Em implantação com várias instâncias, substituir por armazenamento compartilhado (ver DECISOES_TECNICAS).
 */
const buckets = new Map<string, number[]>();

export function hit(key: string, windowMs: number): number {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 50_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < 3_600_000)) buckets.delete(k);
  }
  return arr.length;
}

export function count(key: string, windowMs: number): number {
  const now = Date.now();
  return (buckets.get(key) ?? []).filter((t) => now - t < windowMs).length;
}

export function resetRateLimits() {
  buckets.clear();
}
