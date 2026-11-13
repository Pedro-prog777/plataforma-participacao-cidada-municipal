/**
 * Máscaras de digitação: o usuário digita só os números e a pontuação entra sozinha
 * (RF001: CPF XXX.XXX.XXX-XX, data DD/MM/AAAA, celular (XX) XXXXX-XXXX, CEP XXXXX-XXX).
 * Só formatam o texto; a validação continua sendo feita no servidor (RF002).
 */
export type MaskKind = "cpf" | "data" | "celular" | "cep";

const MAX_DIGITS: Record<MaskKind, number> = { cpf: 11, data: 8, celular: 11, cep: 8 };

/** Junta as partes não vazias com os separadores dados (o separador só aparece quando há dígito depois dele). */
function join(parts: string[], separators: string[]): string {
  let out = parts[0] ?? "";
  for (let i = 1; i < parts.length; i++) if (parts[i]) out += separators[i - 1] + parts[i];
  return out;
}

export function maskValue(kind: MaskKind, value: string): string {
  let all = (value ?? "").replace(/\D/g, "");
  // Celular colado com o código do país explícito (+55 82 99999-0000): descarta o 55.
  // Sem o "+", 55 é tratado como DDD (existe o DDD 55), para não corromper o número de quem digita.
  if (kind === "celular" && /^\s*\+\s*55/.test(value ?? "")) all = all.slice(2);
  const d = all.slice(0, MAX_DIGITS[kind]);
  if (!d) return "";
  switch (kind) {
    case "cpf":
      return join([d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9)], [".", ".", "-"]);
    case "data":
      return join([d.slice(0, 2), d.slice(2, 4), d.slice(4)], ["/", "/"]);
    case "cep":
      return join([d.slice(0, 5), d.slice(5)], ["-"]);
    case "celular": {
      // 11 dígitos: (XX) XXXXX-XXXX; até 10: (XX) XXXX-XXXX.
      const cut = d.length > 10 ? 7 : 6;
      return `(${join([d.slice(0, 2), d.slice(2, cut), d.slice(cut)], [") ", "-"])}`;
    }
  }
}

/** Posição do cursor logo depois do n-ésimo dígito do texto formatado. */
export function caretAfterDigits(formatted: string, n: number): number {
  if (n <= 0) return formatted.search(/\d/) === -1 ? formatted.length : formatted.search(/\d/);
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
}
