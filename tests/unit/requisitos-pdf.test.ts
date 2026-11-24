/**
 * Documento de Requisitos em PDF (DT-24): sem citações jurídicas, com links internos entre
 * requisitos (RF, RNF, RS) e com as mesmas páginas do original (o apêndice das RN foi retirado). O PDF é gerado por `npm run requisitos:pdf`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";
import { lerPaginas, textoCorrido, type Pagina } from "../../scripts/pdf-requisitos/leitor";

const RAIZ = path.resolve(__dirname, "../..");
const PDF = path.join(RAIZ, "docs/requisitos/Documento_de_Requisitos_v6.pdf");
const ORIGINAL = path.join(RAIZ, "docs/requisitos/original/Documento_de_Requisitos_v6_original.pdf");

type Link = { pagina: number; texto: string; destino: number };

let doc: PDFDocument;
let paginas: Pagina[];
let textos: string[];
let links: Link[];

beforeAll(async () => {
  doc = await PDFDocument.load(readFileSync(PDF));
  paginas = await lerPaginas(doc);
  textos = paginas.map((p) => textoCorrido(p).s);
  const indice = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
  links = doc.getPages().flatMap((page, i) => {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) return [];
    return annots.asArray().flatMap((ref) => {
      const a = doc.context.lookup(ref, PDFDict);
      if (a.get(PDFName.of("Subtype"))?.toString() !== "/Link") return [];
      const dest = a.lookup(PDFName.of("Dest"));
      const alvo = dest instanceof PDFArray ? (dest.get(0) as PDFRef) : null;
      const c = a.lookup(PDFName.of("Contents"));
      const texto = c instanceof PDFHexString || c instanceof PDFString ? c.decodeText() : "";
      return alvo ? [{ pagina: i + 1, texto, destino: indice.get(alvo.toString()) ?? -1 }] : [];
    });
  });
});

describe("PDF do Documento de Requisitos", () => {
  it("não tem citações jurídicas", () => {
    const juridico = /\bLei n|\bLGPD\b|\bLAI\b|\bLBI\b|Constituição|\bart\. ?\d|Decreto|[Bb]ase legal|previstos? em lei|pela lei|rito legal|Resolução nº|Enunciado|\bANPD\b/;
    expect(textos.flatMap((t, i) => (juridico.test(t) ? [`página ${i + 1}`] : []))).toEqual([]);
  });

  it("mantém o conteúdo técnico onde a citação foi retirada", () => {
    const tudo = textos.join(" ");
    expect(tudo).toContain("RF015 – Exercer direitos do titular de dados");
    expect(tudo).toContain("propostas e direitos do titular de dados;");
    expect(tudo).toContain("que seguem ritos próprios (RN34)");
    expect(tudo).toContain("Consentimento de um dos pais quando o tratamento depender de consentimento.");
    expect(tudo).toContain("Análise jurídica antes da operação (*).");
    expect(tudo).toContain("5. BRASIL. Ministério do Planejamento, Orçamento e Gestão.");
  });

  it("mantém as páginas do original, sem o apêndice das regras de negócio (retirado em 24/11/2026)", async () => {
    const original = await PDFDocument.load(readFileSync(ORIGINAL));
    expect(doc.getPageCount()).toBe(original.getPageCount());
    expect(textos[1]).toContain(`Página 2 de ${original.getPageCount()}`);
    expect(textos.join(" ")).not.toMatch(/Índice das regras de negócio/);
  });

  it("RN citada no RF001 fica como texto normal, sem link (o documento não descreve as regras)", () => {
    const paginaRF001 = textos.findIndex((t) => t.includes("RF001 – Cadastrar")) + 1;
    expect(textos[paginaRF001 - 1]).toContain("CPF único (RN02)");
    expect(links.filter((l) => /^RNd/.test(l.texto))).toEqual([]);
  });

  it("RF004 citado em outros requisitos leva ao RF004 – Verificar identidade e domicílio do cidadão", () => {
    const paraRF004 = links.filter((l) => l.texto.startsWith("RF004"));
    expect(paraRF004.length).toBeGreaterThan(3);
    for (const l of paraRF004) expect(textos[l.destino - 1]).toMatch(/RF004 –/);
  });

  it("todos os links apontam para páginas existentes e cobrem RF, RNF e RS", () => {
    expect(links.length).toBeGreaterThan(400);
    expect(links.filter((l) => l.destino < 1 || l.destino > doc.getPageCount())).toEqual([]);
    for (const tipo of ["RF", "RNF", "RS"]) expect(links.some((l) => new RegExp(`^${tipo}\\d`).test(l.texto))).toBe(true);
  });
});
