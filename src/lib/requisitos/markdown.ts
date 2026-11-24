/**
 * Leitor do Markdown do Documento de Requisitos (`docs/requisitos/REQUISITOS_COMPLETOS.md`).
 *
 * Cobre só o que o documento usa — títulos, citação, parágrafos, listas (inclusive
 * aninhadas e numeradas), tabelas, negrito, itálico, código e links — e devolve uma árvore
 * simples para a página renderizar. O texto não é alterado: as referências RF/RNF/RN/RS são
 * reconhecidas depois, na renderização (`referencias.ts`).
 */

export type Inline =
  | { t: "texto"; v: string }
  | { t: "forte"; c: Inline[] }
  | { t: "enfase"; c: Inline[] }
  | { t: "codigo"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Alinhamento = "esquerda" | "centro" | "direita" | null;

export type ItemLista = { numero?: number; c: Inline[]; sub?: BlocoLista };
export type BlocoLista = { t: "lista"; ordenada: boolean; itens: ItemLista[] };

export type Bloco =
  | { t: "titulo"; nivel: number; texto: string; c: Inline[] }
  | { t: "paragrafo"; c: Inline[] }
  | { t: "citacao"; linhas: Inline[][] }
  | BlocoLista
  | { t: "tabela"; cabecalho: Inline[][]; alinhamentos: Alinhamento[]; linhas: Inline[][][] };

/* ------------------------------------------------------------------ */
/* Trechos dentro da linha                                             */
/* ------------------------------------------------------------------ */

// Asterisco literal: "\*" e o marcador "(*)" de itens pendentes não abrem itálico.
const ASTERISCO = "";

function preparar(s: string): string {
  return s
    .replace(/\\\*/g, ASTERISCO)
    .replace(/\(\*\)/g, `(${ASTERISCO})`)
    .replace(/\\([\\`_{}[\]()#+\-.!|])/g, "$1");
}

const restaurar = (s: string) => s.split(ASTERISCO).join("*");

const REGRAS: [RegExp, (m: RegExpExecArray) => Inline][] = [
  [/`([^`]+)`/, (m) => ({ t: "codigo", v: restaurar(m[1]) })],
  [/<(https?:\/\/[^\s>]+)>/, (m) => ({ t: "link", href: m[1], c: [{ t: "texto", v: m[1] }] })],
  [/\[([^\]]+)\]\(([^)\s]+)\)/, (m) => ({ t: "link", href: m[2], c: lerTrechos(m[1]) })],
  [/\*\*(.+?)\*\*/, (m) => ({ t: "forte", c: lerTrechos(m[1]) })],
  [/\*(?=\S)(.+?)(?<=\S)\*/, (m) => ({ t: "enfase", c: lerTrechos(m[1]) })],
];

function lerTrechos(s: string): Inline[] {
  const saida: Inline[] = [];
  let resto = s;
  while (resto) {
    let melhor: { m: RegExpExecArray; criar: (m: RegExpExecArray) => Inline } | null = null;
    for (const [re, criar] of REGRAS) {
      const m = re.exec(resto);
      // Em empate vence a regra declarada antes (ex.: negrito antes de itálico).
      if (m && (!melhor || m.index < melhor.m.index)) melhor = { m, criar };
    }
    if (!melhor) {
      saida.push({ t: "texto", v: restaurar(resto) });
      break;
    }
    if (melhor.m.index > 0) saida.push({ t: "texto", v: restaurar(resto.slice(0, melhor.m.index)) });
    saida.push(melhor.criar(melhor.m));
    resto = resto.slice(melhor.m.index + melhor.m[0].length);
  }
  return saida;
}

export function lerInline(s: string): Inline[] {
  return lerTrechos(preparar(s));
}

/** Texto puro de uma sequência de trechos (sem marcação). */
export function textoPuro(c: Inline[]): string {
  return c.map((n) => (n.t === "texto" || n.t === "codigo" ? n.v : textoPuro(n.c))).join("");
}

/* ------------------------------------------------------------------ */
/* Blocos                                                              */
/* ------------------------------------------------------------------ */

const TITULO = /^(#{1,6})\s+(.*)$/;
const ITEM = /^(\s*)(?:[-*+]|(\d+)\.)\s+(.*)$/;
const LINHA_TABELA = /^\s*\|/;
const SEPARADOR_TABELA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function comecaBloco(l: string): boolean {
  return TITULO.test(l) || l.startsWith(">") || LINHA_TABELA.test(l) || ITEM.test(l);
}

function celulas(linha: string): string[] {
  let s = linha.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

function alinhamento(c: string): Alinhamento {
  const e = c.startsWith(":");
  const d = c.endsWith(":");
  return e && d ? "centro" : d ? "direita" : e ? "esquerda" : null;
}

type ItemBruto = { recuo: number; ordenada: boolean; numero?: number; texto: string };

function montarLista(itens: ItemBruto[], inicio: number, recuo: number): [BlocoLista, number] {
  const lista: BlocoLista = { t: "lista", ordenada: itens[inicio].ordenada, itens: [] };
  let j = inicio;
  while (j < itens.length && itens[j].recuo >= recuo) {
    const it = itens[j];
    const anterior = lista.itens[lista.itens.length - 1];
    if (it.recuo > recuo && anterior) {
      const [sub, proximo] = montarLista(itens, j, it.recuo);
      anterior.sub = sub;
      j = proximo;
      continue;
    }
    lista.itens.push({ numero: it.numero, c: lerInline(it.texto) });
    j++;
  }
  return [lista, j];
}

export function lerMarkdown(md: string): Bloco[] {
  const linhas = md.replace(/\r\n?/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) {
      i++;
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      const texto = titulo[2].trim();
      blocos.push({ t: "titulo", nivel: titulo[1].length, texto: textoPuro(lerInline(texto)), c: lerInline(texto) });
      i++;
      continue;
    }

    if (linha.startsWith(">")) {
      const citacao: Inline[][] = [];
      while (i < linhas.length && linhas[i].startsWith(">")) citacao.push(lerInline(linhas[i++].replace(/^>\s?/, "")));
      blocos.push({ t: "citacao", linhas: citacao });
      continue;
    }

    if (LINHA_TABELA.test(linha)) {
      const grupo: string[] = [];
      while (i < linhas.length && LINHA_TABELA.test(linhas[i])) grupo.push(linhas[i++]);
      const temSeparador = grupo.length > 1 && SEPARADOR_TABELA.test(grupo[1]);
      const cabecalho = celulas(grupo[0]);
      const alinhamentos = temSeparador ? celulas(grupo[1]).map(alinhamento) : cabecalho.map(() => null);
      const corpo = grupo.slice(temSeparador ? 2 : 1).map((l) => {
        const cs = celulas(l);
        while (cs.length < cabecalho.length) cs.push("");
        return cs.map(lerInline);
      });
      blocos.push({ t: "tabela", cabecalho: cabecalho.map(lerInline), alinhamentos, linhas: corpo });
      continue;
    }

    if (ITEM.test(linha)) {
      const brutos: ItemBruto[] = [];
      while (i < linhas.length && linhas[i].trim()) {
        const m = ITEM.exec(linhas[i]);
        if (m) brutos.push({ recuo: m[1].length, ordenada: m[2] !== undefined, numero: m[2] ? Number(m[2]) : undefined, texto: m[3] });
        else if (/^\s+\S/.test(linhas[i]) && brutos.length) brutos[brutos.length - 1].texto += ` ${linhas[i].trim()}`;
        else break;
        i++;
      }
      let j = 0;
      while (j < brutos.length) {
        const [lista, proximo] = montarLista(brutos, j, brutos[j].recuo);
        blocos.push(lista);
        j = proximo;
      }
      continue;
    }

    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !comecaBloco(linhas[i])) paragrafo.push(linhas[i++].trim());
    blocos.push({ t: "paragrafo", c: lerInline(paragrafo.join(" ")) });
  }
  return blocos;
}

/** Âncora legível para títulos que não são requisitos (ex.: "2.1 Abrangência…" → "2-1-abrangencia…"). */
export function ancoraDeTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
