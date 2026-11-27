/** Utilitários de CPF (RF001, RF002). Seguro para uso no cliente e no servidor. */

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/**
 * CPF aceito pelo sistema (RF001 e RF002 do Documento v6, DT-36): 11 números no formato
 * XXX.XXX.XXX-XX, com ou sem a pontuação. Aceita CPF fictício — os dígitos verificadores não são
 * calculados. A conta única por pessoa (RN02) continua garantida pelo HMAC do CPF no banco.
 */
export function isCpfFormat(value: string): boolean {
  return /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test((value ?? "").trim());
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** CPF mascarado para exibição ao titular (RF012, RN27): ***.456.789-** */
export function maskCpf(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/**
 * Gera um CPF aleatório com dígitos verificadores corretos (aparência de CPF real) — usado apenas em
 * dados fictícios e testes. O sistema também aceita CPF sem verificador válido (DT-36).
 */
export function generateCpf(seed?: () => number): string {
  const rnd = seed ?? Math.random;
  const base = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  const dv = (digits: number[]) => {
    const len = digits.length;
    const sum = digits.reduce((acc, n, i) => acc + n * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}
