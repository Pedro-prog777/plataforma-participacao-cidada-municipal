/** Testes unitários das regras puras (RNF12: RN05–RN08, RN14, RN18 e correlatas). */
import { describe, expect, it } from "vitest";
import { formatCpf, generateCpf, isCpfFormat, maskCpf } from "@/lib/cpf";
import { isUuid, normalizeSearch, parseIsoDay, sanitizePlainText, slugify } from "@/lib/text";
import { passwordPolicyErrors } from "@/server/lib/password";
import { base32Decode, base32Encode, totp, verifyTotp } from "@/server/lib/totp";
import { largestRemainderPercentages, tally } from "@/server/modules/results/tally";
import { evaluateEligibility, matchesAudience, temIdadeMinima, type EligibilityConsultation, type EligibilityUser } from "@/server/modules/voting/eligibility";
import { toCsv } from "@/server/lib/export-formats";
import { detectFileType, scanForViruses } from "@/server/lib/files";
import { canonicalJson, decrypt, encrypt, formatReceiptCode, normalizeReceiptCode, receiptCode, signPayload, verifyPayload } from "@/server/lib/crypto";
import { createCaptcha, verifyCaptcha } from "@/server/lib/captcha";
import { parseLocalDateTime, toLocalInput } from "@/lib/labels";
import { shouldFlag } from "@/server/modules/moderation/moderation.service";

describe("CPF (RF001, RF002)", () => {
  it("aceita CPF fictício no formato XXX.XXX.XXX-XX, sem calcular os dígitos verificadores (DT-36)", () => {
    expect(isCpfFormat("529.982.247-25")).toBe(true);
    expect(isCpfFormat("529.982.247-24")).toBe(true); // verificador errado: fictício, aceito
    expect(isCpfFormat("111.111.111-11")).toBe(true);
    expect(isCpfFormat("52998224724")).toBe(true); // sem pontuação
    expect(isCpfFormat(" 529.982.247-24 ")).toBe(true);
    expect(isCpfFormat("123")).toBe(false);
    expect(isCpfFormat("529.982.247-2")).toBe(false);
    expect(isCpfFormat("529.982.247-255")).toBe(false);
    expect(isCpfFormat("529.982.247-2a")).toBe(false);
    expect(isCpfFormat("529/982/247-25")).toBe(false);
    expect(isCpfFormat("")).toBe(false);
  });
  it("gera CPFs no formato aceito, formata e mascara sem expor os extremos", () => {
    for (let i = 0; i < 50; i++) expect(isCpfFormat(generateCpf())).toBe(true);
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });
});

describe("Política de senha (RN23)", () => {
  it("exige 8 caracteres, letras e números", () => {
    expect(passwordPolicyErrors("abc12", {})).not.toHaveLength(0);
    expect(passwordPolicyErrors("abcdefgh", {})).not.toHaveLength(0);
    expect(passwordPolicyErrors("12345678", {})).not.toHaveLength(0);
    expect(passwordPolicyErrors("abcd1234", {})).toHaveLength(0);
  });
  it("recusa senha igual a CPF, nascimento ou e-mail", () => {
    expect(passwordPolicyErrors("52998224725", { cpf: "529.982.247-25" }).join()).toMatch(/CPF/);
    expect(passwordPolicyErrors("15031988", { birthDate: "1988-03-15" }).join()).toMatch(/nascimento/);
    expect(passwordPolicyErrors("ana1@x.com", { email: "ana1@x.com" }).join()).toMatch(/e-mail/);
  });
});

describe("TOTP (RFC 6238)", () => {
  it("confere o vetor de teste da RFC (SHA-1, T=59 s → 287082 nos 6 últimos dígitos)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totp(secret, 59_000)).toBe("287082");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
  it("aceita janela de ±30 s e recusa códigos errados", () => {
    const secret = base32Encode(Buffer.from("segredo-de-teste-123"));
    const t = Date.now();
    expect(verifyTotp(secret, totp(secret, t - 30_000), t)).toBe(true);
    expect(verifyTotp(secret, "000000", t)).toBe(totp(secret, t) === "000000");
    expect(verifyTotp(secret, totp(secret, t - 120_000), t)).toBe(false);
  });
});

describe("Apuração (RF042, RN18, RN19)", () => {
  const alts = [
    { id: "a", label: "A", position: 1 },
    { id: "b", label: "B", position: 2 },
    { id: "c", label: "C", position: 3 },
  ];
  const v = (id: string | null) => ({ alternativeId: id, abstention: id === null });
  const base = { countingRule: "maioria_simples", alternatives: alts, estimatedEligible: 100, quorumType: "nenhum", quorumValue: null, computedAt: "x" };

  it("percentuais pelo maior resto somam exatamente 100,00", () => {
    const p = largestRemainderPercentages([1, 1, 1]);
    expect(p.reduce((s, x) => s + Number(x), 0)).toBeCloseTo(100, 10);
    expect(p).toEqual(["33.34", "33.33", "33.33"]);
    expect(largestRemainderPercentages([0, 0])).toEqual(["0.00", "0.00"]);
  });

  it("abstenção não é voto válido e não entra no percentual", () => {
    const r = tally({ ...base, votes: [v("a"), v("a"), v("b"), v(null)], participations: 4 });
    expect(r.validVotes).toBe(3);
    expect(r.abstentions).toBe(1);
    expect(r.alternatives.map((a) => a.percentage)).toEqual(["66.67", "33.33", "0.00"]);
    expect(r.winnerId).toBe("a");
    expect(r.condition).toBe("vencedora");
  });

  it("empate sem regra de desempate não tem vencedora", () => {
    expect(tally({ ...base, votes: [v("a"), v("b")], participations: 2 })).toMatchObject({ winnerId: null, condition: "empate" });
  });

  it("nenhum voto válido e quórum não atingido", () => {
    expect(tally({ ...base, votes: [v(null)], participations: 1 }).condition).toBe("sem_votos");
    const q = tally({ ...base, quorumType: "absoluto", quorumValue: "10", votes: [v("a")], participations: 1 });
    expect(q).toMatchObject({ condition: "abaixo_quorum", winnerId: null });
    expect(q.quorum).toMatchObject({ required: 10, met: false });
    const qp = tally({ ...base, quorumType: "percentual", quorumValue: "1", votes: [v("a"), v("b"), v("a")], participations: 3 });
    expect(qp.quorum).toMatchObject({ required: 1, met: true });
  });

  it("é determinística (mesma entrada, mesmo resultado)", () => {
    const votes = [v("c"), v("a"), v("c"), v("b"), v("c")];
    expect(JSON.stringify(tally({ ...base, votes, participations: 5 }))).toBe(JSON.stringify(tally({ ...base, votes: [...votes], participations: 5 })));
  });
});

describe("Elegibilidade na ordem do documento (RF036)", () => {
  const now = new Date("2026-11-07T15:00:00Z");
  const user: EligibilityUser = { id: "u", kind: "cidadao", status: "ativa", lockedUntil: null, verificationLevel: "verificado", districtId: "d1", regionId: "r1", domicileVerifiedAt: now, birthDate: "2000-01-01" };
  const cons: EligibilityConsultation = { status: "aberta", opensAt: new Date("2026-11-01T00:00:00Z"), closesAt: new Date("2026-11-21T00:00:00Z"), audienceOpen: true, criteria: [] };
  const ev = (u: Partial<EligibilityUser>, c: Partial<EligibilityConsultation> = {}, participated = false) => evaluateEligibility({ ...user, ...u }, { ...cons, ...c }, participated, now);

  it("elegível no caso base", () => expect(ev({})).toEqual({ eligible: true }));
  it("conta inativa ou bloqueada vem primeiro", () => {
    expect(ev({ status: "bloqueada", verificationLevel: "nao_verificado" })).toMatchObject({ code: "conta_inativa" });
    expect(ev({ lockedUntil: new Date(now.getTime() + 60_000) })).toMatchObject({ code: "conta_inativa" });
  });
  it("identidade não verificada antes do público-alvo", () => {
    expect(ev({ verificationLevel: "nao_verificado" }, { audienceOpen: false, criteria: [{ type: "domicilio", params: {} }] })).toMatchObject({ code: "identidade_nao_verificada" });
  });
  it("conta administrativa não vota (RN22)", () => expect(ev({ kind: "admin" })).toMatchObject({ code: "conta_administrativa" }));
  it("domicílio, território e faixa etária", () => {
    expect(ev({ domicileVerifiedAt: null }, { audienceOpen: false, criteria: [{ type: "domicilio", params: {} }] })).toMatchObject({ code: "domicilio_nao_comprovado" });
    expect(ev({}, { audienceOpen: false, criteria: [{ type: "territorio", params: { regionIds: ["r2"] } }] })).toMatchObject({ code: "fora_do_publico" });
    expect(ev({}, { audienceOpen: false, criteria: [{ type: "territorio", params: { districtIds: ["d1"] } }] })).toEqual({ eligible: true });
    expect(ev({ birthDate: "2000-01-01" }, { audienceOpen: false, criteria: [{ type: "faixa_etaria", params: { minAge: 30 } }] })).toMatchObject({ code: "fora_do_publico" });
    expect(ev({ birthDate: "1950-01-01" }, { audienceOpen: false, criteria: [{ type: "faixa_etaria", params: { maxAge: 60 } }] })).toMatchObject({ code: "fora_do_publico" });
  });

  describe("só vota quem tem 18 anos completos (RF036, DT-30)", () => {
    // now = 07/11/2026 12h em Brasília.
    it("menor de 18 anos não vota, nem em consulta aberta ao público em geral", () => {
      expect(ev({ birthDate: "2014-05-05" })).toMatchObject({ eligible: false, code: "menor_de_18" });
    });
    it("completa 18 anos hoje: vota; faltando um dia (17 anos e 364 dias): não vota", () => {
      expect(ev({ birthDate: "2008-11-07" })).toEqual({ eligible: true });
      expect(ev({ birthDate: "2008-11-08" })).toMatchObject({ code: "menor_de_18" });
      expect(ev({ birthDate: "1960-02-10" })).toEqual({ eligible: true });
    });
    it("sem data de nascimento não é possível conferir a idade", () => {
      expect(ev({ birthDate: null })).toMatchObject({ code: "menor_de_18", action: { href: "/conta" } });
    });
    it("nascido em 29/02: em ano não bissexto completa a idade em 01/03", () => {
      expect(temIdadeMinima("2008-02-29", new Date("2026-02-28T15:00:00Z"))).toBe(false);
      expect(temIdadeMinima("2008-02-29", new Date("2026-03-01T15:00:00Z"))).toBe(true);
    });
    it("a data é a de Brasília (horário do servidor), não a de Greenwich", () => {
      // 07/11 02h30 em Greenwich ainda é 06/11 23h30 em Brasília.
      expect(temIdadeMinima("2008-11-07", new Date("2026-11-07T02:30:00Z"))).toBe(false);
      expect(temIdadeMinima("2008-11-07", new Date("2026-11-07T03:00:00Z"))).toBe(true);
    });
    it("critério etário da consulta só restringe mais: idade mínima 16 não libera quem tem 17", () => {
      expect(ev({ birthDate: "2009-06-01" }, { audienceOpen: false, criteria: [{ type: "faixa_etaria", params: { minAge: 16 } }] })).toMatchObject({ code: "menor_de_18" });
    });
    it("a idade é conferida depois de conta, identidade e perfil, antes do público-alvo", () => {
      expect(ev({ birthDate: "2014-05-05", verificationLevel: "nao_verificado" })).toMatchObject({ code: "identidade_nao_verificada" });
      expect(ev({ birthDate: "2014-05-05", kind: "admin" })).toMatchObject({ code: "conta_administrativa" });
      expect(ev({ birthDate: "2014-05-05" }, { audienceOpen: false, criteria: [{ type: "territorio", params: { regionIds: ["r2"] } }] })).toMatchObject({ code: "menor_de_18" });
    });
    it("menores não entram na estimativa de quem pode votar nem nos avisos de abertura", () => {
      expect(matchesAudience({ ...user, birthDate: "2014-05-05" }, { audienceOpen: true, criteria: [] }, now)).toBe(false);
      expect(matchesAudience(user, { audienceOpen: true, criteria: [] }, now)).toBe(true);
    });
  });
  it("período pelo horário do servidor e situação (RN08, RN09)", () => {
    expect(ev({}, { closesAt: new Date(now.getTime() - 1) })).toMatchObject({ code: "fora_do_periodo" });
    expect(ev({}, { opensAt: new Date(now.getTime() + 1) })).toMatchObject({ code: "fora_do_periodo" });
    expect(ev({}, { status: "suspensa" })).toMatchObject({ code: "fora_do_periodo" });
  });
  it("participação anterior por último (RN05)", () => expect(ev({}, {}, true)).toMatchObject({ code: "ja_participou" }));
});

describe("Segurança de dados e arquivos", () => {
  it("CSV neutraliza injeção de fórmulas e usa ';'", () => {
    const csv = toCsv([{ a: "=HYPERLINK(\"x\")", b: "texto; com separador" }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"texto; com separador"');
  });
  it("detecta o tipo real pelo conteúdo, não pela extensão (RS012)", () => {
    expect(detectFileType(Buffer.from("%PDF-1.7\n..."), "doc.pdf")?.mime).toBe("application/pdf");
    expect(detectFileType(Buffer.from("MZ\x90\x00 executável"), "relatorio.pdf")).toBeNull();
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "x.png")?.mediaType).toBe("imagem");
    expect(detectFileType(Buffer.from("a;b\n1;2\n"), "dados.csv")?.mime).toBe("text/csv");
  });
  it("antivírus embutido detecta a assinatura de teste EICAR", async () => {
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    expect(await scanForViruses(Buffer.from(`%PDF-1.4 ${eicar}`))).toMatch(/EICAR/);
    expect(await scanForViruses(Buffer.from("%PDF-1.4 conteúdo limpo"))).toBeNull();
  });
  it("remove marcação e scripts de texto livre", () => {
    expect(sanitizePlainText('<script>alert(1)</script>Olá <b>mundo</b> <a href="javascript:x">l</a>')).toBe("Olá mundo l");
  });
  it("busca ignora maiúsculas e acentos; slug é estável", () => {
    expect(normalizeSearch("  SAÚDE   Pública ")).toBe("saude publica");
    expect(slugify("Praça do Centro: revitalização!")).toBe("praca-do-centro-revitalizacao");
  });
  it("comprovante: 12 caracteres sem ambíguos; formatação reversível", () => {
    const c = receiptCode();
    expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
    expect(normalizeReceiptCode(formatReceiptCode(c).toLowerCase())).toBe(c);
  });
  it("cifra AES-GCM detecta adulteração; assinatura HMAC detecta alteração", () => {
    const enc = encrypt("segredo");
    expect(decrypt(enc)).toBe("segredo");
    const parts = enc.split(".");
    parts[2] = Buffer.from("outro").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
    const t = signPayload({ u: "1" });
    expect(verifyPayload(t)).toEqual({ u: "1" });
    expect(verifyPayload(t.replace(/.$/, (ch) => (ch === "a" ? "b" : "a")))).toBeNull();
  });
  it("JSON canônico independe da ordem das chaves", () => expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 })));
  it("CAPTCHA aritmético assinado", () => {
    const c = createCaptcha();
    const nums = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
    const m = c.question.match(/Quanto é (\S+) mais (\S+)\?/)!;
    expect(verifyCaptcha(c.token, String(nums.indexOf(m[1]) + nums.indexOf(m[2])))).toBe(true);
    expect(verifyCaptcha(c.token, "999")).toBe(false);
  });
  it("sinaliza termos ofensivos e dados pessoais para revisão humana (RF064)", () => {
    expect(shouldFlag("Meu CPF é 529.982.247-25")).toBe(true);
    expect(shouldFlag("Que proposta idiota")).toBe(true);
    expect(shouldFlag("Concordo com a ciclofaixa")).toBe(false);
  });
});

describe("Datas no horário de Brasília", () => {
  it("datetime-local ↔ Date preserva o horário de Brasília", () => {
    const d = parseLocalDateTime("2026-11-20T09:30")!;
    expect(d.toISOString()).toBe("2026-11-20T12:30:00.000Z");
    expect(toLocalInput(d)).toBe("2026-11-20T09:30");
  });
});

describe("Parâmetros de URL (filtros e rotas com identificador)", () => {
  it("isUuid aceita só o formato UUID", () => {
    expect(isUuid("2ab4db0d-786e-4061-a244-f5e06bdf25ab")).toBe(true);
    for (const v of ["abc", "", "2ab4db0d-786e-4061-a244-f5e06bdf25a", "2ab4db0d786e4061a244f5e06bdf25ab", "' OR 1=1 --", null, 42]) expect(isUuid(v), String(v)).toBe(false);
  });
  it("parseIsoDay recusa datas inexistentes", () => {
    expect(parseIsoDay("2026-11-24")).toBe("2026-11-24");
    expect(parseIsoDay("2028-02-29")).toBe("2028-02-29");
    for (const v of ["2026-02-30", "2026-13-01", "xyz", "24/11/2026", "", undefined]) expect(parseIsoDay(v), String(v)).toBeNull();
  });
});
