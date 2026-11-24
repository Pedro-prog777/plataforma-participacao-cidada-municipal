/**
 * Leitura do conteúdo das páginas de um PDF gerado pelo LibreOffice: posição de cada caractere,
 * para localizar trechos de texto (remoção de citações jurídicas) e identificadores de requisitos
 * (links). Cobre o que o Documento de Requisitos usa: fontes TrueType simples com ToUnicode,
 * operadores de texto (Tj, TJ, ', ") e matrizes (cm, Tm, Td, TD, T*).
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFPage, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from "pdf-lib";

export type Token =
  | { t: "num"; v: number; i: number; f: number }
  | { t: "name"; v: string; i: number; f: number }
  | { t: "str"; v: number[]; hex: boolean; i: number; f: number }
  | { t: "op"; v: string; i: number; f: number }
  | { t: "["; i: number; f: number }
  | { t: "]"; i: number; f: number }
  | { t: "<<"; i: number; f: number }
  | { t: ">>"; i: number; f: number };

const BRANCO = /[\0\t\n\f\r ]/;
const DELIM = /[()<>[\]{}/%]/;

/** Divide o fluxo de conteúdo em tokens, guardando as posições (i = início, f = fim) no texto. */
export function tokenizar(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (BRANCO.test(c)) { i++; continue; }
    if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    const ini = i;
    if (c === "[" || c === "]") { out.push({ t: c, i: ini, f: ++i }); continue; }
    if (c === "<" && s[i + 1] === "<") { i += 2; out.push({ t: "<<", i: ini, f: i }); continue; }
    if (c === ">" && s[i + 1] === ">") { i += 2; out.push({ t: ">>", i: ini, f: i }); continue; }
    if (c === "<") {
      const fim = s.indexOf(">", i);
      let hex = s.slice(i + 1, fim).replace(/\s+/g, "");
      if (hex.length % 2) hex += "0";
      const v: number[] = [];
      for (let k = 0; k < hex.length; k += 2) v.push(parseInt(hex.slice(k, k + 2), 16));
      i = fim + 1;
      out.push({ t: "str", v, hex: true, i: ini, f: i });
      continue;
    }
    if (c === "(") {
      const v: number[] = [];
      let prof = 1;
      i++;
      while (i < n && prof > 0) {
        const ch = s[i];
        if (ch === "\\") {
          const p = s[i + 1];
          const esc: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
          if (p in esc) { v.push(esc[p]); i += 2; }
          else if (/[0-7]/.test(p)) { let o = ""; i++; while (o.length < 3 && /[0-7]/.test(s[i])) o += s[i++]; v.push(parseInt(o, 8) & 255); }
          else if (p === "\r" || p === "\n") { i += 2; if (p === "\r" && s[i] === "\n") i++; }
          else { v.push(p.charCodeAt(0)); i += 2; }
          continue;
        }
        if (ch === "(") prof++;
        if (ch === ")") { prof--; if (prof === 0) { i++; break; } }
        v.push(ch.charCodeAt(0) & 255);
        i++;
      }
      out.push({ t: "str", v, hex: false, i: ini, f: i });
      continue;
    }
    if (c === "/") {
      i++;
      while (i < n && !BRANCO.test(s[i]) && !DELIM.test(s[i])) i++;
      out.push({ t: "name", v: s.slice(ini + 1, i), i: ini, f: i });
      continue;
    }
    while (i < n && !BRANCO.test(s[i]) && !DELIM.test(s[i])) i++;
    if (i === ini) { i++; continue; } // caractere solto ({ ou })
    const pal = s.slice(ini, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(pal)) out.push({ t: "num", v: parseFloat(pal), i: ini, f: i });
    else {
      out.push({ t: "op", v: pal, i: ini, f: i });
      if (pal === "BI") { // imagem embutida: pula até EI
        const fim = s.indexOf("EI", i);
        i = fim < 0 ? n : fim + 2;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fontes                                                              */
/* ------------------------------------------------------------------ */

export type Fonte = { nome: string; primeiro: number; larguras: number[]; padrao: number; unicode: Map<number, string>; codigo: Map<string, number> };

function lerCMap(texto: string): Map<number, string> {
  const mapa = new Map<number, string>();
  const hex = (h: string) => parseInt(h, 16);
  const uni = (h: string) => { let s = ""; for (let k = 0; k < h.length; k += 4) s += String.fromCharCode(parseInt(h.slice(k, k + 4), 16)); return s; };
  for (const bloco of texto.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const m of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) mapa.set(hex(m[1]), uni(m[2]));
  for (const bloco of texto.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g)) {
      const a = hex(m[1]), b = hex(m[2]);
      if (m[3].startsWith("[")) [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((x, k) => mapa.set(a + k, uni(x[1])));
      else { const base = m[3].slice(1, -1); for (let c = a; c <= b; c++) { const u = uni(base); mapa.set(c, u.slice(0, -1) + String.fromCharCode(u.charCodeAt(u.length - 1) + (c - a))); } }
    }
  }
  return mapa;
}

export function conteudoDoStream(s: PDFStream): Uint8Array {
  if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode();
  return (s as unknown as { getUnencodedContents(): Uint8Array }).getUnencodedContents();
}

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
/*
 * WinAnsiEncoding (Windows-1252). A faixa 0x80–0x9F fica em tabela explícita: no Node 20 o
 * `TextDecoder("windows-1252")` a trata como Latin-1 (0x96 vira U+0096 em vez de "–"), e o
 * projeto declara suporte a Node >= 20.11.
 */
const WIN1252_80_9F = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const WIN1252 = { decode: (b: Uint8Array) => (b[0] >= 0x80 && b[0] <= 0x9f ? WIN1252_80_9F[b[0] - 0x80] : String.fromCharCode(b[0])) };

export function lerFontes(doc: PDFDocument, page: PDFPage): Map<string, Fonte> {
  const fontes = new Map<string, Fonte>();
  const res = page.node.Resources();
  const dict = res?.lookup(PDFName.of("Font"), PDFDict);
  if (!dict) return fontes;
  for (const [chave, ref] of dict.entries()) {
    const f = doc.context.lookup(ref as PDFRef, PDFDict);
    const fc = f.lookup(PDFName.of("FirstChar"));
    const primeiro = fc instanceof PDFNumber ? fc.asNumber() : 0;
    const arr = f.lookup(PDFName.of("Widths"));
    const larguras = arr instanceof PDFArray ? arr.asArray().map((x) => (doc.context.lookup(x) as PDFNumber).asNumber()) : [];
    const tu = f.lookup(PDFName.of("ToUnicode"));
    // Fonte padrão (ex.: Helvetica do apêndice, WinAnsi): sem ToUnicode, o código é o próprio caractere.
    const unicode = tu instanceof PDFStream ? lerCMap(latin1(conteudoDoStream(tu))) : new Map(Array.from({ length: 256 }, (_, c) => [c, WIN1252.decode(new Uint8Array([c]))] as [number, string]));
    const codigo = new Map<string, number>();
    for (const [c, u] of unicode) if (!codigo.has(u)) codigo.set(u, c);
    const base = (f.lookup(PDFName.of("BaseFont")) as PDFName | undefined)?.decodeText() ?? chave.decodeText();
    fontes.set(chave.decodeText(), { nome: base, primeiro, larguras, padrao: larguras.length ? 0 : 500, unicode, codigo });
  }
  return fontes;
}

/* ------------------------------------------------------------------ */
/* Interpretação                                                        */
/* ------------------------------------------------------------------ */

type M = [number, number, number, number, number, number];
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const tr = (x: number, y: number): M => [1, 0, 0, 1, x, y];

/** Um caractere desenhado: código na fonte, texto Unicode e caixa na página (coordenadas PDF). */
export type Glifo = { cod: number; u: string; x0: number; x1: number; y: number; tam: number };
/** Um operador de texto (Tj/TJ/'/") com seus caracteres, na ordem do fluxo. */
export type Exibicao = {
  op: number; // índice do token do operador
  ini: number; // índice do primeiro token dos operandos
  bt: number; // índice do token BT do bloco
  fonte: string;
  tam: number;
  itens: ({ k: "g"; g: Glifo } | { k: "n"; v: number })[];
};
export type Pagina = { texto: string; tokens: Token[]; exibicoes: Exibicao[]; fontes: Map<string, Fonte>; tdDoBloco: Map<number, number> };

export function interpretar(texto: string, fontes: Map<string, Fonte>): Pagina {
  const tokens = tokenizar(texto);
  const exibicoes: Exibicao[] = [];
  const tdDoBloco = new Map<number, number>(); // BT → índice do primeiro Td/Tm do bloco
  const pilha: { ctm: M }[] = [];
  let ctm: M = ID;
  let tm: M = ID, tlm: M = ID;
  let fonte = "", tam = 0, tc = 0, tw = 0, th = 1, tl = 0, bt = -1;
  let ops: Token[] = [];
  let iniOps = 0;
  const avancar = (larg: number) => { tm = mul(tr(larg, 0), tm); };
  const mostrar = (opIdx: number, partes: (number[] | number)[]) => {
    const f = fontes.get(fonte);
    const ex: Exibicao = { op: opIdx, ini: iniOps, bt, fonte, tam, itens: [] };
    for (const p of partes) {
      if (typeof p === "number") { avancar((-p / 1000) * tam * th); ex.itens.push({ k: "n", v: p }); continue; }
      for (const cod of p) {
        const w = f ? (f.larguras[cod - f.primeiro] ?? f.padrao) : 500;
        const larg = ((w / 1000) * tam + tc + (cod === 32 ? tw : 0)) * th;
        const m0 = mul(tm, ctm);
        const m1 = mul(mul(tr(larg, 0), tm), ctm);
        const escala = Math.hypot(m0[2], m0[3]) || 1;
        ex.itens.push({ k: "g", g: { cod, u: f?.unicode.get(cod) ?? "�", x0: m0[4], x1: m1[4], y: m0[5], tam: tam * escala } });
        avancar(larg);
      }
    }
    exibicoes.push(ex);
  };
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.t !== "op") {
      if (!ops.length) iniOps = k;
      if (t.t === "[") { // array como operando único
        const arr: (number[] | number)[] = [];
        let j = k + 1;
        while (j < tokens.length && tokens[j].t !== "]") { const x = tokens[j]; if (x.t === "str") arr.push(x.v); else if (x.t === "num") arr.push(x.v); j++; }
        ops.push({ t: "op", v: "__arr", i: t.i, f: tokens[j].f, arr } as unknown as Token);
        k = j;
        continue;
      }
      if (t.t === "<<") { let prof = 1, j = k + 1; while (j < tokens.length && prof) { if (tokens[j].t === "<<") prof++; if (tokens[j].t === ">>") prof--; j++; } k = j - 1; ops.push(t); continue; }
      ops.push(t);
      continue;
    }
    const n = (i: number) => (ops[i] as { v: number }).v;
    switch (t.v) {
      case "q": pilha.push({ ctm }); break;
      case "Q": ctm = pilha.pop()?.ctm ?? ID; break;
      case "cm": ctm = mul([n(0), n(1), n(2), n(3), n(4), n(5)], ctm); break;
      case "BT": tm = tlm = ID; bt = k; break;
      case "Td": tlm = mul(tr(n(0), n(1)), tlm); tm = tlm; if (!tdDoBloco.has(bt)) tdDoBloco.set(bt, k); break;
      case "TD": tl = -n(1); tlm = mul(tr(n(0), n(1)), tlm); tm = tlm; if (!tdDoBloco.has(bt)) tdDoBloco.set(bt, k); break;
      case "Tm": tlm = tm = [n(0), n(1), n(2), n(3), n(4), n(5)]; if (!tdDoBloco.has(bt)) tdDoBloco.set(bt, k); break;
      case "T*": tlm = mul(tr(0, -tl), tlm); tm = tlm; break;
      case "Tf": fonte = (ops[0] as { v: string }).v; tam = n(1); break;
      case "Tc": tc = n(0); break;
      case "Tw": tw = n(0); break;
      case "Tz": th = n(0) / 100; break;
      case "TL": tl = n(0); break;
      case "Tj": mostrar(k, [(ops[0] as { v: number[] }).v]); break;
      case "'": tlm = mul(tr(0, -tl), tlm); tm = tlm; mostrar(k, [(ops[0] as { v: number[] }).v]); break;
      case '"': tw = n(0); tc = n(1); tlm = mul(tr(0, -tl), tlm); tm = tlm; mostrar(k, [(ops[2] as { v: number[] }).v]); break;
      case "TJ": mostrar(k, (ops[0] as unknown as { arr: (number[] | number)[] }).arr); break;
    }
    ops = [];
  }
  return { texto, tokens, exibicoes, fontes, tdDoBloco };
}

/** Texto corrido da página com o mapa posição → (exibição, item). Quebras de linha e vãos viram um espaço. */
export function textoCorrido(p: Pagina): { s: string; mapa: ({ e: number; it: number } | null)[] } {
  let s = "";
  const mapa: ({ e: number; it: number } | null)[] = [];
  let ult: Glifo | null = null;
  p.exibicoes.forEach((ex, e) => {
    ex.itens.forEach((it, idx) => {
      if (it.k !== "g") return;
      const g = it.g;
      if (ult && (Math.abs(g.y - ult.y) > 2 || g.x0 - ult.x1 > g.tam * 0.25 || g.x0 < ult.x0 - 1) && !/\s$/.test(s) && g.u !== " ") { s += " "; mapa.push(null); }
      for (const ch of g.u) { s += ch; mapa.push({ e, it: idx }); }
      ult = g;
    });
  });
  return { s, mapa };
}

export async function lerPaginas(doc: PDFDocument): Promise<Pagina[]> {
  return doc.getPages().map((page) => {
    const c = page.node.Contents();
    const streams = !c ? [] : c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r) as PDFStream) : [c as PDFStream];
    const texto = streams.map((st) => latin1(conteudoDoStream(st))).join("\n");
    return interpretar(texto, lerFontes(doc, page));
  });
}
