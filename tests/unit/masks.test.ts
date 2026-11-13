/** Máscaras de digitação do cadastro (RF001): pontuação automática sem alterar os dígitos. */
import { describe, expect, it } from "vitest";
import { caretAfterDigits, maskValue } from "@/lib/masks";
import { generateCpf, isValidCpf } from "@/lib/cpf";

const typed = (kind: Parameters<typeof maskValue>[0], digits: string) => [...digits].reduce<string[]>((acc, ch) => [...acc, maskValue(kind, (acc.at(-1) ?? "") + ch)], []);

describe("maskValue", () => {
  it("CPF: pontos e traço entram conforme a pessoa digita", () => {
    expect(typed("cpf", "12345678909")).toEqual(["1", "12", "123", "123.4", "123.45", "123.456", "123.456.7", "123.456.78", "123.456.789", "123.456.789-0", "123.456.789-09"]);
    expect(maskValue("cpf", "123456789091234")).toBe("123.456.789-09");
    expect(maskValue("cpf", "123.456.789-09")).toBe("123.456.789-09");
  });

  it("CPF formatado continua válido para o servidor", () => {
    const cpf = generateCpf();
    expect(isValidCpf(maskValue("cpf", cpf.replace(/\D/g, "")))).toBe(true);
  });

  it("data: barras automáticas no formato DD/MM/AAAA", () => {
    expect(typed("data", "10051990")).toEqual(["1", "10", "10/0", "10/05", "10/05/1", "10/05/19", "10/05/199", "10/05/1990"]);
    expect(maskValue("data", "10/05/1990")).toBe("10/05/1990");
  });

  it("celular: parênteses e traço, com 10 ou 11 dígitos", () => {
    expect(typed("celular", "82999990000")).toEqual(["(8", "(82", "(82) 9", "(82) 99", "(82) 999", "(82) 9999", "(82) 9999-9", "(82) 9999-90", "(82) 9999-900", "(82) 9999-9000", "(82) 99999-0000"]);
    expect(maskValue("celular", "8233334444")).toBe("(82) 3333-4444");
  });

  it("CEP: traço automático", () => {
    expect(maskValue("cep", "57000")).toBe("57000");
    expect(maskValue("cep", "570001")).toBe("57000-1");
    expect(maskValue("cep", "57000111")).toBe("57000-111");
  });

  it("ignora letras, aceita texto colado e permite apagar tudo", () => {
    expect(maskValue("cpf", "abc")).toBe("");
    expect(maskValue("celular", "(")).toBe("");
    expect(maskValue("celular", "+55 (82) 99999-0000")).toBe("(82) 99999-0000");
    // DDD 55 não é código do país: um dígito a mais é só descartado.
    expect(maskValue("celular", "(55) 99999-0000")).toBe("(55) 99999-0000");
    expect(maskValue("celular", "(55) 99999-00001")).toBe("(55) 99999-0000");
    expect(maskValue("cep", "57a000-11199")).toBe("57000-111");
    expect(maskValue("data", "1990-05-10")).toBe("19/90/0510");
    // Apagar o separador não trava a digitação: sem dígito depois, o separador some.
    expect(maskValue("cpf", "123.")).toBe("123");
    expect(maskValue("data", "10/")).toBe("10");
  });

  it("dígitos em excesso são descartados (a máscara limita o tamanho, sem maxLength no campo)", () => {
    expect(maskValue("cpf", "1".repeat(20))).toHaveLength(14);
    expect(maskValue("data", "1".repeat(20))).toHaveLength(10);
    expect(maskValue("celular", "1".repeat(20))).toHaveLength(15);
    expect(maskValue("cep", "1".repeat(20))).toHaveLength(9);
  });
});

describe("caretAfterDigits", () => {
  it("mantém o cursor depois do dígito que a pessoa acabou de digitar", () => {
    expect(caretAfterDigits("123.4", 4)).toBe(5);
    expect(caretAfterDigits("123.456.789-09", 3)).toBe(3);
    expect(caretAfterDigits("(82) 9", 3)).toBe(6);
    expect(caretAfterDigits("(82) 99999-0000", 0)).toBe(1);
    expect(caretAfterDigits("10/05", 9)).toBe(5);
    expect(caretAfterDigits("", 0)).toBe(0);
  });
});
