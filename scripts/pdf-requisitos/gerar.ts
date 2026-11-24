/**
 * Gera docs/requisitos/Documento_de_Requisitos_v6.pdf a partir do original preservado em
 * docs/requisitos/original/, mantendo o layout (DT-24):
 *  1. remove do próprio PDF as citações jurídicas (o texto sai do arquivo, não é só coberto);
 *  2. acrescenta um apêndice com o índice das regras de negócio citadas (o documento cita as RN
 *     pelo nome, mas não as descreve) — gerado das próprias citações;
 *  3. transforma cada RF, RNF, RN e RS citado em link interno para o ponto em que é descrito,
 *     com sublinhado e fundo azul-claro; identificador sem descrição fica marcado, sem link.
 *
 * Uso: npm run requisitos:pdf   (falha se algum trecho esperado não for encontrado)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFNull, PDFNumber, PDFPage, PDFRef, StandardFonts, rgb } from "pdf-lib";
import { citadoEm, montarCatalogo } from "../../src/lib/requisitos/catalogo";
import { lerMarkdown } from "../../src/lib/requisitos/markdown";
import { PADRAO_REFERENCIA, tipoDoId } from "../../src/lib/requisitos/referencias";
import { interpretar, lerPaginas, textoCorrido, type Exibicao, type Glifo, type Pagina } from "./leitor";

const RAIZ = path.resolve(__dirname, "../..");
const ORIGINAL = path.join(RAIZ, "docs/requisitos/original/Documento_de_Requisitos_v6_original.pdf");
const SAIDA = path.join(RAIZ, "docs/requisitos/Documento_de_Requisitos_v6.pdf");
const TRANSCRICAO = path.join(RAIZ, "docs/requisitos/REQUISITOS_COMPLETOS.md");

/* ------------------------------------------------------------------ */
/* 1. Citações jurídicas: só a menção sai; o conteúdo técnico fica       */
/* ------------------------------------------------------------------ */

/** `por` em lista: um trecho para cada linha que o texto original ocupava (mantém a quebra de linha da célula). */
type Edicao = { nome: string; re: RegExp; n: number; por?: string | string[]; manterLargura?: boolean; subir?: boolean };

const EDICOES: Edicao[] = [
  { nome: "2.1 — ritos próprios", re: / previstos em lei(?= \(RN34\))/g, n: 1 },
  { nome: "2.1 — escopo (direitos do titular)", re: /previstos na LGPD(?=;)/g, n: 1, por: "do titular de dados", manterLargura: true },
  { nome: "RF015 — título", re: /(?<=titular de dados) \(LGPD\)/g, n: 1 },
  { nome: "RF045 — LAI", re: /, em atenção à LAI(?=\.)/g, n: 1 },
  { nome: "RF068 — rito legal", re: /(?<=rito )legal (?=da audiência)/g, n: 1 },
  { nome: "RNF06 — categoria", re: /(?<=requisito legal) \(LGPD\)/g, n: 1 },
  { nome: "RNF01 — base legal", re: / Base legal: LBI, art\. 63\./g, n: 1 },
  { nome: "RNF02 — base legal", re: / Base legal: Lei nº 13\.460\/2017\./g, n: 1 },
  { nome: "RNF06 — base legal", re: / Base legal: LGPD\./g, n: 1 },
  { nome: "RNF13 — base legal", re: / Base legal: LAI, art\. 8º, § 3º\./g, n: 1 },
  { nome: "RS010 — perigo", re: /(?<=cuidados exigidos) pela lei(?=\.)/g, n: 1 },
  // O trecho original ocupa três linhas da célula; a substituição (com o ponto final) cabe na primeira.
  { nome: "RS010 — consentimento", re: /o consentimento for a base legal \(LGPD, art\. 14\)\./g, n: 1, por: ["o tratamento depender de", "consentimento."] },
  { nome: "RS010 — análise jurídica", re: /(?<=Análise jurídica) da Lei nº 15\.211\/2025(?= antes)/g, n: 1 },
  { nome: "Referências 5 a 15 (normas jurídicas)", re: /5\. BRASIL\. \[Constituição \(1988\)\][\s\S]*?Brasília, DF: ConCidades, 2005\./g, n: 1, subir: true },
  { nome: "Referência 17 (ANPD)", re: /17\. AUTORIDADE NACIONAL DE PROTEÇÃO DE DADOS\.[\s\S]*?Brasília, DF: ANPD, 2023\./g, n: 1, subir: true },
  { nome: "Referência 16 → 5", re: /16\.(?= BRASIL\. Ministério do Planejamento)/g, n: 1, por: "5." },
  { nome: "Referência 18 → 6", re: /18\.(?= INTERNATIONAL ORGANIZATION)/g, n: 1, por: "6." },
  { nome: "Referência 19 → 7", re: /19\.(?= PRESSMAN)/g, n: 1, por: "7." },
  { nome: "Referência 20 → 8", re: /20\.(?= SOMMERVILLE)/g, n: 1, por: "8." },
  { nome: "Referência 21 → 9", re: /21\.(?= WORLD WIDE WEB)/g, n: 1, por: "9." },
];

/** Depois da edição, nada disto pode sobrar no PDF. */
const JURIDICO = /\bLei n|\bLGPD\b|\bLAI\b|\bLBI\b|Constituição|\bart\. ?\d|Decreto|[Bb]ase legal|previstos? em lei|pela lei|rito legal|Resolução nº|Enunciado|\bANPD\b/;

type Marcas = { removidos: Map<number, Set<number>>; insercoes: Map<number, Map<number, number[]>>; manter: Set<number>; subirBt: Map<number, number> };
const novasMarcas = (): Marcas => ({ removidos: new Map(), insercoes: new Map(), manter: new Set(), subirBt: new Map() });

function primeiroGlifo(ex: Exibicao): Glifo | undefined {
  for (const it of ex.itens) if (it.k === "g") return it.g;
}

function aplicarEdicao(p: Pagina, m: Marcas, ed: Edicao): number {
  const { s, mapa } = textoCorrido(p);
  let n = 0;
  for (const achado of s.matchAll(ed.re)) {
    n++;
    const ini = achado.index ?? 0;
    const pos = mapa.slice(ini, ini + achado[0].length).filter((x): x is { e: number; it: number } => x !== null);
    for (const { e, it } of pos) {
      if (!m.removidos.has(e)) m.removidos.set(e, new Set());
      m.removidos.get(e)!.add(it);
    }
    if (ed.por !== undefined) {
      // Primeira posição de cada linha ocupada pelo trecho (na ordem do texto).
      const inicios: { e: number; it: number }[] = [];
      let yAnterior: number | null = null;
      for (const x of pos) {
        const g = (p.exibicoes[x.e].itens[x.it] as { g: Glifo }).g;
        if (g.u.trim() === "" && yAnterior !== null) continue;
        if (yAnterior === null || Math.abs(g.y - yAnterior) > 2) { inicios.push(x); yAnterior = g.y; }
      }
      const trechos = Array.isArray(ed.por) ? ed.por : [ed.por];
      trechos.forEach((texto, li) => {
        const alvo = inicios[li];
        if (!alvo) throw new Error(`"${ed.nome}": há mais trechos de substituição que linhas no original`);
        const fonte = p.fontes.get(p.exibicoes[alvo.e].fonte)!;
        const codigos = [...texto].map((ch) => {
          const c = fonte.codigo.get(ch);
          if (c === undefined) throw new Error(`"${ed.nome}": o caractere "${ch}" não existe na fonte ${fonte.nome}`);
          return c;
        });
        if (!m.insercoes.has(alvo.e)) m.insercoes.set(alvo.e, new Map());
        m.insercoes.get(alvo.e)!.set(alvo.it, codigos);
        if (ed.manterLargura) m.manter.add(alvo.e);
      });
    }
    if (ed.subir) {
      // Sobe o que vem depois do trecho removido (até o rodapé) para não deixar o espaço vazio.
      const exs = new Set(pos.map((x) => x.e));
      const topo = primeiroGlifo(p.exibicoes[pos[0].e])!.y;
      const ultimaEx = Math.max(...exs);
      const seguinte = p.exibicoes.slice(ultimaEx + 1).filter((ex) => textoDe(ex).trim()).map(primeiroGlifo).find((g) => g && g.y > 85);
      if (seguinte) {
        const delta = topo - seguinte.y;
        for (const ex of p.exibicoes.slice(ultimaEx + 1)) {
          const g = primeiroGlifo(ex);
          if (g && g.y > 85 && g.y <= seguinte.y + 0.5) m.subirBt.set(ex.bt, delta);
        }
      }
    }
  }
  return n;
}

const hex = (cods: number[]) => `<${cods.map((c) => c.toString(16).padStart(2, "0").toUpperCase()).join("")}>`;
const numero = (v: number) => (Math.round(v * 1000) / 1000).toString();

function larguraGlifo(p: Pagina, ex: Exibicao, cod: number) {
  const f = p.fontes.get(ex.fonte)!;
  return ((f.larguras[cod - f.primeiro] ?? 0) / 1000) * ex.tam;
}

/** Reescreve o operador de texto sem os caracteres removidos e com as inserções. */
function reconstruir(p: Pagina, ex: Exibicao, idx: number, m: Marcas): string {
  const rem = m.removidos.get(idx) ?? new Set<number>();
  const ins = m.insercoes.get(idx) ?? new Map<number, number[]>();
  type Item = { k: "g"; cod: number; espaco: boolean } | { k: "n"; v: number };
  const saida: Item[] = [];
  let pendente: number | null = null;
  let ultimoMantido = false;
  let larguraAntes = 0, larguraDepois = 0;
  const emitir = (cod: number, espaco: boolean) => {
    if (pendente !== null) saida.push({ k: "n", v: pendente });
    pendente = null;
    saida.push({ k: "g", cod, espaco });
    larguraDepois += larguraGlifo(p, ex, cod);
    ultimoMantido = true;
  };
  ex.itens.forEach((it, i) => {
    for (const c of ins.get(i) ?? []) emitir(c, p.fontes.get(ex.fonte)!.unicode.get(c) === " ");
    if (it.k === "n") {
      larguraAntes -= (it.v / 1000) * ex.tam;
      if (ultimoMantido) pendente = (pendente ?? 0) + it.v;
      return;
    }
    larguraAntes += larguraGlifo(p, ex, it.g.cod);
    if (rem.has(i)) { pendente = null; ultimoMantido = false; return; }
    emitir(it.g.cod, it.g.u === " ");
  });
  // Linha justificada: a diferença de largura da substituição é compensada nos espaços.
  if (m.manter.has(idx)) {
    for (const x of saida) if (x.k === "n") larguraDepois -= (x.v / 1000) * ex.tam;
    const ajustaveis = saida.filter((x, i) => x.k === "n" && ((saida[i - 1]?.k === "g" && (saida[i - 1] as { espaco: boolean }).espaco) || (saida[i + 1]?.k === "g" && (saida[i + 1] as { espaco: boolean }).espaco)));
    const delta = larguraDepois - larguraAntes;
    if (ajustaveis.length && Math.abs(delta) > 0.01) for (const x of ajustaveis) (x as { v: number }).v += (delta * 1000) / ex.tam / ajustaveis.length;
  }
  const partes: string[] = [];
  let buf: number[] = [];
  for (const x of saida) {
    if (x.k === "g") buf.push(x.cod);
    else { if (buf.length) partes.push(hex(buf)); buf = []; partes.push(numero(x.v)); }
  }
  if (buf.length) partes.push(hex(buf));
  return `[${partes.join(" ")}] TJ`;
}

function aplicarMarcas(p: Pagina, m: Marcas): string {
  const trocas: [number, number, string][] = [];
  const editadas = new Set([...m.removidos.keys(), ...m.insercoes.keys()]);
  for (const idx of editadas) {
    const ex = p.exibicoes[idx];
    const op = p.tokens[ex.op];
    if (op.t !== "op" || (op.v !== "TJ" && op.v !== "Tj")) throw new Error(`operador de texto não suportado na edição: ${op.t === "op" ? op.v : op.t}`);
    trocas.push([p.tokens[ex.ini].i, op.f, reconstruir(p, ex, idx, m)]);
  }
  for (const [bt, delta] of m.subirBt) {
    const td = p.tdDoBloco.get(bt);
    if (td === undefined) continue;
    const y = p.tokens[td - 1];
    if (y.t !== "num") continue;
    trocas.push([y.i, y.f, numero(y.v + delta)]);
  }
  trocas.sort((a, b) => b[0] - a[0]);
  let s = p.texto;
  for (const [i, f, t] of trocas) s = s.slice(0, i) + t + s.slice(f);
  return s;
}

/* ------------------------------------------------------------------ */
/* 2. Apêndice: índice das regras de negócio                            */
/* ------------------------------------------------------------------ */

type Alvo = { pagina: number; topo: number };
type Link = { pagina: number; x0: number; y0: number; x1: number; y1: number; id: string };

const MARGEM_E = 71, MARGEM_D = 524.5, TOPO = 770, BASE = 100;

function quebrar(fonte: PDFFont, tam: number, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tam) > largura && atual) { linhas.push(atual); atual = palavra; }
    else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

async function montarApendice(doc: PDFDocument, primeiraPagina: number, totalFinal: number | null) {
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const catalogo = montarCatalogo(lerMarkdown(readFileSync(TRANSCRICAO, "utf8")));
  const regras = [...catalogo.definicoes.values()].filter((d) => d.tipo === "RN").sort((a, b) => a.id.localeCompare(b.id));
  const alvos = new Map<string, Alvo>();
  const links: Link[] = [];
  const paginas: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const cor = rgb(0, 0, 0);
  const novaPagina = () => {
    page = doc.addPage([595.304, 841.89]);
    paginas.push(page);
    y = TOPO;
  };
  const garantir = (altura: number) => { if (y - altura < BASE) novaPagina(); };
  novaPagina();
  // Título no mesmo estilo das seções do documento: faixa cinza com borda.
  page.drawRectangle({ x: 66.35, y: y - 20.1, width: 462.5, height: 20.1, color: rgb(0.949, 0.949, 0.949), borderColor: cor, borderWidth: 0.45 });
  page.drawText("Apêndice – Índice das regras de negócio citadas", { x: MARGEM_E, y: y - 15, size: 14, font: negrito, color: cor });
  y -= 40;
  const intro =
    "O documento cita as regras de negócio (RN) pelo nome dentro dos requisitos — por exemplo, “CPF único (RN02)” no RF001 —, mas não traz uma seção que descreva cada regra. Este apêndice foi gerado automaticamente a partir dessas citações: para cada regra, mostra o nome usado no documento e os requisitos em que ela é citada, onde está o comportamento esperado. Nenhuma regra foi criada ou descrita aqui. Os identificadores são links.";
  for (const l of quebrar(normal, 10.5, intro, MARGEM_D - MARGEM_E)) { page.drawText(l, { x: MARGEM_E, y, size: 10.5, font: normal, color: cor }); y -= 14; }
  y -= 10;
  for (const r of regras) {
    const locais = citadoEm(catalogo, r.id);
    const rotulo = "Citada em: ";
    const itens = locais.map((c, i) => ({ texto: c.rotulo + (i < locais.length - 1 ? "," : "."), id: c.requisito ? c.ancora : null }));
    // Altura: título + linhas da lista
    const largDisp = MARGEM_D - MARGEM_E - 14;
    const linhasLista: { texto: string; id: string | null }[][] = [[]];
    let larg = normal.widthOfTextAtSize(rotulo, 10);
    for (const it of itens) {
      const w = normal.widthOfTextAtSize(it.texto + " ", 10);
      if (larg + w > largDisp) { linhasLista.push([]); larg = 0; }
      linhasLista[linhasLista.length - 1].push(it);
      larg += w;
    }
    garantir(16 + linhasLista.length * 13 + 8);
    alvos.set(r.id, { pagina: primeiraPagina + paginas.length - 1, topo: y + 8 });
    page.drawText(`${r.id} – ${r.titulo}`, { x: MARGEM_E, y: y - 11, size: 11, font: negrito, color: cor });
    y -= 26;
    linhasLista.forEach((linha, li) => {
      let x = MARGEM_E + 14;
      if (li === 0) { page.drawText(rotulo, { x, y, size: 10, font: normal, color: rgb(0.27, 0.31, 0.42) }); x += normal.widthOfTextAtSize(rotulo, 10); }
      for (const it of linha) {
        if (it.id) {
          // Mesma aparência dos links nas páginas originais: fundo azul-claro (antes do texto) e sublinhado.
          const x1 = x + normal.widthOfTextAtSize(it.id, 10);
          page.drawRectangle({ x: x - 0.6, y: y - 2.4, width: x1 - x + 1.2, height: 10.4, color: rgb(0.886, 0.925, 0.973) });
          page.drawLine({ start: { x, y: y - 1.3 }, end: { x: x1, y: y - 1.3 }, thickness: 0.6, color: rgb(0.114, 0.333, 0.588) });
          links.push({ pagina: primeiraPagina + paginas.length - 1, x0: x - 0.6, y0: y - 2.4, x1: x1 + 0.6, y1: y + 8, id: it.id });
        }
        page.drawText(it.texto, { x, y, size: 10, font: normal, color: cor });
        x += normal.widthOfTextAtSize(it.texto + " ", 10);
      }
      y -= 13;
    });
    y -= 9;
  }
  const total = totalFinal ?? primeiraPagina + paginas.length - 1;
  paginas.forEach((pg, i) => {
    pg.drawText("Documento de Requisitos", { x: 71, y: 71.9, size: 8, font: normal, color: cor });
    const rod = `Página ${primeiraPagina + i} de ${total}`;
    pg.drawText(rod, { x: 524.5 - normal.widthOfTextAtSize(rod, 8), y: 71.9, size: 8, font: normal, color: cor });
  });
  return { alvos, links, paginas: paginas.length };
}

/* ------------------------------------------------------------------ */
/* 3. Links                                                             */
/* ------------------------------------------------------------------ */

/** Acrescenta o apêndice ao fim dos marcadores (índice lateral) do PDF, depois de "9. Referências". */
function marcarApendice(doc: PDFDocument, pagina: number) {
  const outlines = doc.catalog.lookup(PDFName.of("Outlines"));
  if (!(outlines instanceof PDFDict)) return;
  const ultimoRef = outlines.get(PDFName.of("Last")) as PDFRef;
  const item = doc.context.obj({
    Title: PDFHexString.fromText("Apêndice – Índice das regras de negócio citadas"),
    Parent: doc.catalog.get(PDFName.of("Outlines")) as PDFRef,
    Prev: ultimoRef,
    Dest: [doc.getPage(pagina - 1).ref, PDFName.of("XYZ"), PDFNull, PDFNumber.of(800), PDFNull],
  });
  const ref = doc.context.register(item);
  doc.context.lookup(ultimoRef, PDFDict).set(PDFName.of("Next"), ref);
  outlines.set(PDFName.of("Last"), ref);
  const count = outlines.get(PDFName.of("Count"));
  if (count instanceof PDFNumber) outlines.set(PDFName.of("Count"), PDFNumber.of(count.asNumber() + (count.asNumber() >= 0 ? 1 : -1)));
}

function textoDe(ex: Exibicao) {
  return ex.itens.map((i) => (i.k === "g" ? i.g.u : "")).join("");
}

/** Onde cada RF/RNF/RS é descrito: título na coluna "Requisito" (RF) ou célula "[ID]" das tabelas (RNF, RS). */
function localizarDefinicoes(pags: Pagina[]): Map<string, Alvo & { bt: number; pag: number }> {
  const defs = new Map<string, Alvo & { bt: number; pag: number }>();
  pags.forEach((p, pi) => {
    for (const ex of p.exibicoes) {
      const t = textoDe(ex).trim();
      const g = primeiroGlifo(ex);
      if (!g) continue;
      // RF: "RF001 – Nome" (às vezes o nome vem no bloco seguinte); RNF/RS: identificador sozinho na célula "ID".
      const rf = /^(RF\d{3}) –(\s|$)/.exec(t);
      const tab = /^\[?(RNF\d{2}|RS\d{3})\]?$/.exec(t);
      const id = g.x0 < 110 ? (rf ? rf[1] : tab ? tab[1] : null) : null;
      if (id && !defs.has(id)) defs.set(id, { pagina: pi + 1, topo: g.y + g.tam + 6, bt: ex.bt, pag: pi });
    }
  });
  return defs;
}

function localizarReferencias(p: Pagina): { id: string; x0: number; x1: number; y: number; tam: number; bt: number }[] {
  const { s, mapa } = textoCorrido(p);
  const out = [];
  for (const m of s.matchAll(PADRAO_REFERENCIA)) {
    const ini = m.index ?? 0;
    const pos = mapa.slice(ini, ini + m[0].length).filter((x): x is { e: number; it: number } => x !== null);
    const gs = pos.map(({ e, it }) => (p.exibicoes[e].itens[it] as { g: Glifo }).g);
    out.push({ id: m[0], x0: Math.min(...gs.map((g) => g.x0)), x1: Math.max(...gs.map((g) => g.x1)), y: gs[0].y, tam: gs[0].tam, bt: p.exibicoes[pos[0].e].bt });
  }
  return out;
}

function anotar(doc: PDFDocument, page: PDFPage, link: { x0: number; y0: number; x1: number; y1: number }, destino: PDFRef, topo: number, dica: string) {
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [link.x0, link.y0, link.x1, link.y1],
    Border: [0, 0, 0],
    F: 4,
    Contents: PDFHexString.fromText(dica),
    Dest: [destino, PDFName.of("XYZ"), PDFNull, PDFNumber.of(Math.round(topo)), PDFNull],
  });
  page.node.addAnnot(doc.context.register(annot));
}

/* ------------------------------------------------------------------ */

async function main() {
  if (!existsSync(ORIGINAL)) {
    mkdirSync(path.dirname(ORIGINAL), { recursive: true });
    copyFileSync(SAIDA, ORIGINAL);
    console.log("Original preservado em", path.relative(RAIZ, ORIGINAL));
  }
  const doc = await PDFDocument.load(readFileSync(ORIGINAL), { updateMetadata: false });
  const nOriginais = doc.getPageCount();
  const pags = await lerPaginas(doc);

  // Apêndice primeiro (para saber o total de páginas do rodapé).
  const teste = await PDFDocument.load(readFileSync(ORIGINAL));
  const { paginas: nApendice } = await montarApendice(teste, nOriginais + 1, null);
  const total = nOriginais + nApendice;

  // 1. Edições de texto.
  const marcas = pags.map(novasMarcas);
  const relatorio: string[] = [];
  // A capa não tem rodapé: "Página N de 39" aparece da página 2 em diante.
  const edicoes = [...EDICOES, { nome: "Rodapé — total de páginas", re: /(?<=Página \d{1,2} de )39(?!\d)/g, n: nOriginais - 1, por: String(total) }];
  for (const ed of edicoes) {
    const n = pags.reduce((soma, p, i) => soma + aplicarEdicao(p, marcas[i], ed), 0);
    if (n !== ed.n) throw new Error(`Edição "${ed.nome}": esperado ${ed.n}, encontrado ${n}.`);
    relatorio.push(`  ✓ ${ed.nome} (${n})`);
  }
  const editadas = pags.map((p, i) => {
    const m = marcas[i];
    if (!m.removidos.size && !m.insercoes.size && !m.subirBt.size) return p;
    return interpretar(aplicarMarcas(p, m), p.fontes);
  });

  // 2. Apêndice no documento final.
  const apendice = await montarApendice(doc, nOriginais + 1, total);
  marcarApendice(doc, nOriginais + 1);

  // 3. Destinos e links.
  const defs = localizarDefinicoes(editadas);
  const paginasDoc = doc.getPages();
  const refPagina = (n: number) => paginasDoc[n - 1]?.ref ?? doc.getPage(n - 1).ref;
  const alvos = new Map<string, Alvo>([...defs].map(([id, d]) => [id, { pagina: d.pagina, topo: d.topo }]));
  for (const [id, a] of apendice.alvos) alvos.set(id, a);
  const catalogo = montarCatalogo(lerMarkdown(readFileSync(TRANSCRICAO, "utf8")));
  const titulo = (id: string) => catalogo.definicoes.get(id)?.titulo;
  let nLinks = 0;
  const aVerificar: string[] = [];
  editadas.forEach((p, pi) => {
    const page = paginasDoc[pi];
    let fundo = "", traco = "";
    for (const r of localizarReferencias(p)) {
      const def = defs.get(r.id);
      if (def && def.pag === pi && def.bt === r.bt) continue; // a própria definição
      const ret = { x0: r.x0 - 0.6, y0: r.y - r.tam * 0.24, x1: r.x1 + 0.6, y1: r.y + r.tam * 0.8 };
      const alvo = alvos.get(r.id);
      if (!alvo) {
        aVerificar.push(`${r.id} (página ${pi + 1})`);
        traco += `0.761 0.255 0.047 RG 0.7 w [1.5 1] 0 d ${numero(ret.x0)} ${numero(r.y - 1.3)} m ${numero(ret.x1)} ${numero(r.y - 1.3)} l S [] 0 d\n`;
        continue;
      }
      fundo += `${numero(ret.x0)} ${numero(ret.y0)} ${numero(ret.x1 - ret.x0)} ${numero(ret.y1 - ret.y0)} re f\n`;
      traco += `${numero(r.x0)} ${numero(r.y - 1.3)} m ${numero(r.x1)} ${numero(r.y - 1.3)} l S\n`;
      anotar(doc, page, ret, refPagina(alvo.pagina), alvo.topo, `${r.id}${titulo(r.id) ? " — " + titulo(r.id) : ""}`);
      nLinks++;
    }
    // Conteúdo: fundo dos links + texto (editado ou original) + sublinhado.
    const atual = page.node.Contents();
    const originais = atual instanceof PDFArray ? atual.asArray() : atual ? [page.node.get(PDFName.of("Contents"))!] : [];
    const meio = p === pags[pi] ? originais : [doc.context.register(doc.context.flateStream(Buffer.from(p.texto, "latin1")))];
    const antes = fundo ? [doc.context.register(doc.context.flateStream(`/Artifact BMC q 0.886 0.925 0.973 rg\n${fundo}Q EMC\n`))] : [];
    const depois = traco ? [doc.context.register(doc.context.flateStream(`/Artifact BMC q 0.114 0.333 0.588 RG 0.6 w\n${traco}Q EMC\n`))] : [];
    if (antes.length || depois.length || p !== pags[pi]) page.node.set(PDFName.of("Contents"), doc.context.obj([...antes, ...meio, ...depois]));
  });
  for (const l of apendice.links) {
    const alvo = alvos.get(l.id);
    const page = doc.getPage(l.pagina - 1);
    if (!alvo) { aVerificar.push(`${l.id} (apêndice)`); continue; }
    anotar(doc, page, l, refPagina(alvo.pagina), alvo.topo, `${l.id}${titulo(l.id) ? " — " + titulo(l.id) : ""}`);
    nLinks++;
  }

  // Verificações finais.
  const faltando = [...catalogo.definicoes.keys()].filter((id) => !alvos.has(id));
  if (faltando.length) throw new Error(`Requisitos sem destino no PDF: ${faltando.join(", ")}`);
  const sobras = editadas.flatMap((p, i) => (JURIDICO.test(textoCorrido(p).s) ? [`página ${i + 1}: ${JURIDICO.exec(textoCorrido(p).s)![0]}`] : []));
  if (sobras.length) throw new Error(`Ainda há citações jurídicas: ${sobras.join("; ")}`);
  const porTipo = [...alvos.keys()].reduce<Record<string, number>>((a, id) => ({ ...a, [tipoDoId(id)!]: (a[tipoDoId(id)!] ?? 0) + 1 }), {});

  doc.setTitle("Documento de Requisitos — Plataforma de Participação Cidadã Municipal (PPCM)");
  doc.setModificationDate(new Date());
  writeFileSync(SAIDA, await doc.save());
  console.log(["Edições:", ...relatorio].join("\n"));
  console.log(`Destinos: ${JSON.stringify(porTipo)} · links criados: ${nLinks} · referências a verificar: ${aVerificar.length ? aVerificar.join(", ") : "nenhuma"}`);
  console.log(`Páginas: ${nOriginais} originais + ${apendice.paginas} do apêndice = ${doc.getPageCount()}`);
  console.log("Gerado:", path.relative(RAIZ, SAIDA));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
