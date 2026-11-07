/**
 * Relógio do servidor. Toda regra de período (RN08, RF040, RS009) usa o horário do servidor,
 * nunca o do aparelho do usuário. Os testes podem fixar o horário.
 */
let fixed: Date | null = null;

export const clock = {
  now(): Date {
    return fixed ? new Date(fixed) : new Date();
  },
  set(date: Date | null) {
    fixed = date ? new Date(date) : null;
  },
  advance(ms: number) {
    fixed = new Date((fixed ?? new Date()).getTime() + ms);
  },
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Data (AAAA-MM-DD) no fuso de Brasília. */
export function brDate(d: Date = clock.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Idade completa em uma data de referência. */
export function ageOn(birthDate: string, ref: Date = clock.now()): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ry, rm, rd] = brDate(ref).split("-").map(Number);
  let age = ry - y;
  if (rm < m || (rm === m && rd < d)) age--;
  return age;
}
