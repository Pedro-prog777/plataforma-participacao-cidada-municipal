/** Utilitários de CPF (RF001, RF002). Seguro para uso no cliente e no servidor. */

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
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

/** Gera um CPF válido aleatório — usado apenas em dados fictícios e testes. */
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
