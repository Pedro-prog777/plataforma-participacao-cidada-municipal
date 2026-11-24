/**
 * Gera docs/requisitos/Documento_de_Requisitos_v6.pdf a partir do original preservado em
 * docs/requisitos/original/, mantendo o layout (DT-24):
 *  1. remove do próprio PDF as citações jurídicas (o texto sai do arquivo, não é só coberto);
 *  2. transforma cada RF, RNF e RS citado em link interno para o ponto em que é descrito,
 *     com sublinhado e fundo azul-claro; identificador sem descrição fica marcado, sem link.
 *
 * As regras de negócio (RN) são citadas pelo nome, mas o documento não as descreve: sem destino,
 * ficam como texto normal. O apêndice com o índice das RN foi retirado a pedido da equipe
 * (24/11/2026); o PDF mantém as mesmas páginas do original.
 *
 * Uso: npm run requisitos:pdf   (falha se algum trecho esperado não for encontrado)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFNull, PDFNumber, PDFPage, PDFRef } from "pdf-lib";
import { montarCatalogo } from "../../src/lib/requisitos/catalogo";
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
/* 2. Links                                                             */
/* ------------------------------------------------------------------ */

type Alvo = { pagina: number; topo: number };

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

  // 1. Edições de texto. Sem páginas acrescentadas, o rodapé "Página N de 39" do original continua correto.
  const marcas = pags.map(novasMarcas);
  const relatorio: string[] = [];
  for (const ed of EDICOES) {
    const n = pags.reduce((soma, p, i) => soma + aplicarEdicao(p, marcas[i], ed), 0);
    if (n !== ed.n) throw new Error(`Edição "${ed.nome}": esperado ${ed.n}, encontrado ${n}.`);
    relatorio.push(`  ✓ ${ed.nome} (${n})`);
  }
  const editadas = pags.map((p, i) => {
    const m = marcas[i];
    if (!m.removidos.size && !m.insercoes.size && !m.subirBt.size) return p;
    return interpretar(aplicarMarcas(p, m), p.fontes);
  });

  // 2. Destinos e links.
  const defs = localizarDefinicoes(editadas);
  const paginasDoc = doc.getPages();
  const refPagina = (n: number) => paginasDoc[n - 1]?.ref ?? doc.getPage(n - 1).ref;
  const alvos = new Map<string, Alvo>([...defs].map(([id, d]) => [id, { pagina: d.pagina, topo: d.topo }]));
  const catalogo = montarCatalogo(lerMarkdown(readFileSync(TRANSCRICAO, "utf8")));
  const titulo = (id: string) => catalogo.definicoes.get(id)?.titulo;
  let nLinks = 0;
  const aVerificar: string[] = [];
  editadas.forEach((p, pi) => {
    const page = paginasDoc[pi];
    let fundo = "", traco = "";
    for (const r of localizarReferencias(p)) {
      // RN: citada pelo nome, sem descrição no documento — fica como texto normal (sem link nem alerta).
      if (tipoDoId(r.id) === "RN") continue;
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
  // Verificações finais.
  const faltando = [...catalogo.definicoes.keys()].filter((id) => tipoDoId(id) !== "RN" && !alvos.has(id));
  if (faltando.length) throw new Error(`Requisitos sem destino no PDF: ${faltando.join(", ")}`);
  const sobras = editadas.flatMap((p, i) => (JURIDICO.test(textoCorrido(p).s) ? [`página ${i + 1}: ${JURIDICO.exec(textoCorrido(p).s)![0]}`] : []));
  if (sobras.length) throw new Error(`Ainda há citações jurídicas: ${sobras.join("; ")}`);
  const porTipo = [...alvos.keys()].reduce<Record<string, number>>((a, id) => ({ ...a, [tipoDoId(id)!]: (a[tipoDoId(id)!] ?? 0) + 1 }), {});

  doc.setTitle("Documento de Requisitos — Plataforma de Participação Cidadã Municipal (PPCM)");
  doc.setModificationDate(new Date());
  writeFileSync(SAIDA, await doc.save());
  console.log(["Edições:", ...relatorio].join("\n"));
  console.log(`Destinos: ${JSON.stringify(porTipo)} · links criados: ${nLinks} · referências a verificar: ${aVerificar.length ? aVerificar.join(", ") : "nenhuma"}`);
  console.log(`Páginas: ${doc.getPageCount()} (as mesmas ${nOriginais} do original)`);
  console.log("Gerado:", path.relative(RAIZ, SAIDA));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
