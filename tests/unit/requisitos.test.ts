/** Referências cruzadas automáticas entre requisitos (DT-24) e integridade do documento transcrito. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { citadoEm, contarPorTipo } from "@/lib/requisitos/catalogo";
import { lerMarkdown, textoPuro, type Bloco, type BlocoLista } from "@/lib/requisitos/markdown";
import { formatoOficial, hrefRequisito, referenciasDoTexto, separarReferencias } from "@/lib/requisitos/referencias";
import { documentoRequisitos, enderecoDoLink } from "@/server/lib/documento-requisitos";

const RAIZ = path.resolve(__dirname, "../..");
const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");
const MARKDOWN = ler("docs/requisitos/REQUISITOS_COMPLETOS.md");

describe("catálogo montado a partir do documento", () => {
  const { catalogo, resumo } = documentoRequisitos();

  it("reconhece todos os requisitos do documento, sem cadastro manual", () => {
    expect(contarPorTipo(catalogo)).toEqual({ RF: 68, RNF: 15, RN: 42, RS: 13 });
    expect(Object.keys(resumo)).toHaveLength(68 + 15 + 42 + 13);
  });

  it("RF001 cita RN02 e a referência aponta para a regra correta (CPF único)", () => {
    const noRF001 = catalogo.citacoes.filter((c) => c.contexto.ancora === "RF001").map((c) => c.id);
    expect(noRF001).toContain("RN02");
    expect(resumo.RN02).toBe("CPF único");
    expect(citadoEm(catalogo, "RN02").map((c) => c.ancora)).toEqual(expect.arrayContaining(["RF001", "RF002", "RF004", "RF013", "RF039"]));
    expect(hrefRequisito("RN02")).toBe("/requisitos#RN02");
  });

  it("RF004 — Verificar identidade e domicílio do cidadão — é encontrado e citado por outros requisitos", () => {
    expect(resumo.RF004).toBe("Verificar identidade e domicílio do cidadão");
    const citantes = citadoEm(catalogo, "RF004").map((c) => c.ancora);
    expect(citantes).toEqual(expect.arrayContaining(["RF001", "RF003", "RF012", "RS004", "7-2-dependencias-de-todos-os-requisitos"]));
  });

  it("usa o nome escrito no documento para cada tipo", () => {
    expect(resumo.RF037).toBe("Registrar voto");
    expect(resumo.RNF01).toBe("Acesso para todos");
    expect(resumo.RN16).toBe("Sigilo das parciais");
    expect(resumo.RS001).toBe("Requisito de segurança");
  });

  it("todas as referências do documento existem (nenhuma a verificar)", () => {
    expect(catalogo.aVerificar.map((c) => `${c.id} em ${c.contexto.rotulo}`)).toEqual([]);
    expect(catalogo.citacoes.length).toBeGreaterThan(500);
  });

  it("a definição não conta como citação de si mesma", () => {
    expect(citadoEm(catalogo, "RF001").map((c) => c.ancora)).not.toContain("RF001");
  });
});

describe("reconhecimento das referências no texto", () => {
  const { resumo } = documentoRequisitos();

  it("separa texto e referências, marcando as inexistentes", () => {
    const trechos = separarReferencias("CPF único (RN02); ver RF004, RF999 e RN43.", resumo);
    const refs = trechos.filter((t) => t.tipo === "ref");
    expect(refs).toEqual([
      { tipo: "ref", id: "RN02", existe: true, titulo: "CPF único" },
      { tipo: "ref", id: "RF004", existe: true, titulo: "Verificar identidade e domicílio do cidadão" },
      { tipo: "ref", id: "RF999", existe: false },
      { tipo: "ref", id: "RN43", existe: false },
    ]);
    expect(trechos.map((t) => (t.tipo === "texto" ? t.texto : t.id)).join("")).toBe("CPF único (RN02); ver RF004, RF999 e RN43.");
  });

  it("formatos parecidos com os oficiais são sinalizados, não ignorados nem corrigidos", () => {
    expect(referenciasDoTexto("RF01, RN001 e RNF001")).toEqual(["RF01", "RN001", "RNF001"]);
    expect(separarReferencias("RF01", resumo)).toEqual([{ tipo: "ref", id: "RF01", existe: false }]);
    expect(formatoOficial("RF001") && formatoOficial("RNF01") && formatoOficial("RN01") && formatoOficial("RS001")).toBe(true);
    expect(formatoOficial("RF01")).toBe(false);
  });

  it("não confunde identificadores dentro de outras palavras e reconhece intervalos e barras", () => {
    expect(referenciasDoTexto("XRF001 RF001a _RN02")).toEqual([]);
    expect(referenciasDoTexto("regras RN05–RN08 e (RN12/RN32)")).toEqual(["RN05", "RN08", "RN12", "RN32"]);
  });

  it("sem catálogo, nada vira link", () => {
    expect(separarReferencias("RN02", null)).toEqual([{ tipo: "ref", id: "RN02", existe: false }]);
  });
});

describe("leitura do Markdown preserva o documento", () => {
  /** Palavras na ordem do documento, para provar que nada foi perdido ou reescrito na leitura. */
  function palavrasDosBlocos(blocos: Bloco[]): string[] {
    const partes: string[] = [];
    const lista = (l: BlocoLista) =>
      l.itens.forEach((it) => {
        if (it.numero !== undefined) partes.push(String(it.numero));
        partes.push(textoPuro(it.c));
        if (it.sub) lista(it.sub);
      });
    for (const b of blocos) {
      if (b.t === "titulo" || b.t === "paragrafo") partes.push(textoPuro(b.c));
      else if (b.t === "citacao") b.linhas.forEach((l) => partes.push(textoPuro(l)));
      else if (b.t === "lista") lista(b);
      else if (b.t === "tabela") [b.cabecalho, ...b.linhas].forEach((linha) => linha.forEach((c) => partes.push(textoPuro(c))));
    }
    return partes.join(" ").match(/[\p{L}\p{N}]+/gu) ?? [];
  }

  it("todas as palavras do arquivo aparecem, na mesma ordem", () => {
    const semDestinoDeLinks = MARKDOWN.replace(/\]\([^)\s]+\)/g, "]");
    expect(palavrasDosBlocos(lerMarkdown(MARKDOWN))).toEqual(semDestinoDeLinks.match(/[\p{L}\p{N}]+/gu));
  });

  it("listas aninhadas, tabelas alinhadas, negrito e o marcador (*)", () => {
    const blocos = lerMarkdown("- **Campos:**\n  - **CPF** – texto (*). Único.\n- B\n\n| A | B |\n|---|---:|\n| RF001 | 3 |\n\n1. x\n2. *y*");
    expect(blocos.map((b) => b.t)).toEqual(["lista", "tabela", "lista"]);
    const [lista, tabela, numerada] = blocos as [BlocoLista, Extract<Bloco, { t: "tabela" }>, BlocoLista];
    expect(lista.itens[0].c[0]).toEqual({ t: "forte", c: [{ t: "texto", v: "Campos:" }] });
    expect(textoPuro(lista.itens[0].sub!.itens[0].c)).toBe("CPF – texto (*). Único.");
    expect(tabela.alinhamentos).toEqual([null, "direita"]);
    expect(numerada.ordenada && numerada.itens.map((i) => i.numero)).toEqual([1, 2]);
    expect(numerada.itens[1].c[0].t).toBe("enfase");
  });

  it("links relativos do documento apontam para o repositório", () => {
    expect(enderecoDoLink("PENDENCIAS_CLIENTE.md")).toMatch(/^https:\/\/github\.com\/.+\/blob\/main\/docs\/requisitos\/PENDENCIAS_CLIENTE\.md$/);
    expect(enderecoDoLink("https://exemplo.org")).toBe("https://exemplo.org");
  });
});

describe("integridade da transcrição", () => {
  it("AGENTS.md e REQUISITOS_COMPLETOS.md trazem o mesmo conteúdo", () => {
    const corpo = (s: string) => s.slice(s.indexOf("## 1. Introdução")).trim();
    expect(corpo(ler("AGENTS.md"))).toBe(corpo(MARKDOWN));
  });

  it("sem citações jurídicas (leis, artigos, bases legais) — DT-24", () => {
    const juridico = /\bLei n|\bLGPD\b|\bLAI\b|\bLBI\b|Constituição|\bart\. ?\d|Decreto|[Bb]ase legal|previstos? em lei|pela lei|Resolução nº|Enunciado|\bANPD\b/;
    const linhas = MARKDOWN.split("\n").filter((l) => juridico.test(l));
    expect(linhas).toEqual([]);
  });

  it("numeração preservada: RF001–RF068, RNF01–RNF15, RS001–RS013 e RN01–RN42", () => {
    const { resumo } = documentoRequisitos();
    const faixa = (p: string, n: number, d: number) => Array.from({ length: n }, (_, i) => `${p}${String(i + 1).padStart(d, "0")}`);
    for (const id of [...faixa("RF", 68, 3), ...faixa("RNF", 15, 2), ...faixa("RS", 13, 3), ...faixa("RN", 42, 2)]) expect(resumo).toHaveProperty(id);
  });
});

describe("identificadores citados no código da interface e dos serviços", () => {
  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const p = path.join(dir, nome);
      return statSync(p).isDirectory() ? arquivos(p) : /\.(tsx?|mts)$/.test(nome) ? [p] : [];
    });
  }

  it("todo RF/RNF/RN/RS citado em src/ existe no documento", () => {
    const { resumo } = documentoRequisitos();
    // Exemplos intencionais de identificador inexistente (legenda da página e comentários do reconhecedor).
    const exemplos = [path.join("src", "lib", "requisitos"), path.join("src", "app", "(site)", "requisitos")];
    const inexistentes: string[] = [];
    for (const arq of arquivos(path.join(RAIZ, "src"))) {
      const rel = path.relative(RAIZ, arq);
      if (exemplos.some((e) => rel.startsWith(e))) continue;
      for (const id of referenciasDoTexto(readFileSync(arq, "utf8"))) if (!(id in resumo)) inexistentes.push(`${id} em ${rel}`);
    }
    expect(inexistentes).toEqual([]);
  });
});
