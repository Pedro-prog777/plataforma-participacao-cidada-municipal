/**
 * Catálogo de requisitos montado automaticamente a partir do Documento de Requisitos.
 *
 * Onde cada tipo é descrito no documento (e, portanto, para onde o link aponta):
 * - RF: título "### RFxxx – Nome" da seção 3;
 * - RNF: linha da tabela da seção 4 (primeira coluna = identificador);
 * - RS: linha da tabela da seção 5;
 * - RN: o documento cita as regras pelo nome — "CPF único (RN02)" — mas não traz uma seção
 *   que as descreva (DECISOES_TECNICAS, "As regras RN01–RN42 são citadas mas não definidas na
 *   v6"). O catálogo usa o nome escrito nas linhas "Regras:" e a página monta um índice com
 *   esse nome e os requisitos que citam cada regra. Nada é inventado: sem nome no documento,
 *   a RN fica "a verificar".
 */
import { ancoraDeTitulo, textoPuro, type Bloco, type Inline } from "./markdown";
import { PADRAO_REFERENCIA, tipoDoId, type ResumoCatalogo, type TipoRequisito } from "./referencias";

export type Definicao = { id: string; tipo: TipoRequisito; titulo: string };
/** Local do documento onde uma referência aparece. */
export type Contexto = { ancora: string; rotulo: string; requisito: boolean };
export type Citacao = { id: string; contexto: Contexto };

export type Catalogo = {
  definicoes: Map<string, Definicao>;
  /** Todas as referências encontradas no texto (exceto a própria definição). */
  citacoes: Citacao[];
  /** Referências cujo identificador não consta do documento. */
  aVerificar: Citacao[];
};

const RF_TITULO = /^(RF\d{3})\s*[–-]\s*(.+)$/;
const RN_NOMEADA = /^(.+?)\s*\((RN\d{2})\)\.?$/;

function numeroDaSecao(texto: string): number | null {
  const m = /^(\d+)\./.exec(texto);
  return m ? Number(m[1]) : null;
}

function* trechosDeTexto(c: Inline[]): Generator<string> {
  for (const n of c) {
    if (n.t === "texto" || n.t === "codigo") yield n.v;
    else yield* trechosDeTexto(n.c);
  }
}

/** Percorre o documento chamando `visitar` para cada sequência de trechos, com o contexto atual. */
export function percorrer(blocos: Bloco[], visitar: (c: Inline[], ctx: Contexto, papel: "titulo" | "celula-id" | "texto") => void) {
  let secao: number | null = null;
  let ctx: Contexto = { ancora: "", rotulo: "Introdução", requisito: false };
  for (const b of blocos) {
    if (b.t === "titulo") {
      if (b.nivel === 2) secao = numeroDaSecao(b.texto) ?? secao;
      const rf = b.nivel === 3 ? RF_TITULO.exec(b.texto) : null;
      if (rf) ctx = { ancora: rf[1], rotulo: rf[1], requisito: true };
      else if (b.nivel <= 3) {
        const num = /^(\d+(?:\.\d+)*)\s/.exec(b.texto)?.[1];
        ctx = { ancora: ancoraDeTitulo(b.texto), rotulo: num ? `Seção ${num}` : b.texto, requisito: false };
      }
      visitar(b.c, ctx, rf ? "titulo" : "texto");
    } else if (b.t === "paragrafo") visitar(b.c, ctx, "texto");
    else if (b.t === "citacao") b.linhas.forEach((l) => visitar(l, ctx, "texto"));
    else if (b.t === "lista") {
      const itens = (l: typeof b): void =>
        l.itens.forEach((it) => {
          visitar(it.c, ctx, "texto");
          if (it.sub) itens(it.sub);
        });
      itens(b);
    } else if (b.t === "tabela") {
      b.cabecalho.forEach((c) => visitar(c, ctx, "texto"));
      const definidora = secao === 4 || secao === 5;
      for (const linha of b.linhas) {
        const id = textoPuro(linha[0] ?? []).trim();
        const linhaDefine = definidora && tipoDoId(id) === (secao === 4 ? "RNF" : "RS");
        const ctxLinha: Contexto = linhaDefine ? { ancora: id, rotulo: id, requisito: true } : ctx;
        linha.forEach((c, k) => visitar(c, ctxLinha, linhaDefine && k === 0 ? "celula-id" : "texto"));
      }
    }
  }
}

export function montarCatalogo(blocos: Bloco[]): Catalogo {
  const definicoes = new Map<string, Definicao>();
  const nomesRN = new Map<string, Map<string, number>>();
  let secao: number | null = null;

  for (const b of blocos) {
    if (b.t === "titulo" && b.nivel === 2) secao = numeroDaSecao(b.texto) ?? secao;
    if (b.t === "titulo" && b.nivel === 3 && secao === 3) {
      const m = RF_TITULO.exec(b.texto);
      if (m) definicoes.set(m[1], { id: m[1], tipo: "RF", titulo: m[2].trim() });
    }
    if (b.t === "tabela" && (secao === 4 || secao === 5)) {
      const tipo = secao === 4 ? "RNF" : "RS";
      for (const linha of b.linhas) {
        const id = textoPuro(linha[0] ?? []).trim();
        if (tipoDoId(id) !== tipo) continue;
        // RNF: o nome é o trecho em negrito da descrição ("**Acesso para todos.**").
        const negrito = tipo === "RNF" ? linha[2]?.find((n) => n.t === "forte") : undefined;
        const titulo = negrito && negrito.t === "forte" ? textoPuro(negrito.c).replace(/\.$/, "").trim() : tipo === "RNF" ? textoPuro(linha[1] ?? []).trim() : "Requisito de segurança";
        definicoes.set(id, { id, tipo, titulo });
      }
    }
    if (b.t === "lista") {
      const visitarItens = (l: typeof b): void =>
        l.itens.forEach((it) => {
          const primeiro = it.c[0];
          if (primeiro?.t === "forte" && textoPuro(primeiro.c).trim() === "Regras:") {
            for (const parte of textoPuro(it.c.slice(1)).split(";")) {
              const m = RN_NOMEADA.exec(parte.trim());
              if (!m) continue;
              const contagem = nomesRN.get(m[2]) ?? new Map<string, number>();
              contagem.set(m[1].trim(), (contagem.get(m[1].trim()) ?? 0) + 1);
              nomesRN.set(m[2], contagem);
            }
          }
          if (it.sub) visitarItens(it.sub);
        });
      visitarItens(b);
    }
  }

  // Regras de negócio: o nome mais usado nas linhas "Regras:" do documento.
  for (const id of [...nomesRN.keys()].sort()) {
    const [titulo] = [...nomesRN.get(id)!.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    definicoes.set(id, { id, tipo: "RN", titulo });
  }

  const citacoes: Citacao[] = [];
  percorrer(blocos, (c, contexto, papel) => {
    for (const texto of trechosDeTexto(c)) {
      for (const m of texto.matchAll(PADRAO_REFERENCIA)) {
        // A própria definição (título do RF, primeira célula da linha RNF/RS) não é citação.
        if ((papel === "titulo" || papel === "celula-id") && m[0] === contexto.ancora) continue;
        citacoes.push({ id: m[0], contexto });
      }
    }
  });

  return { definicoes, citacoes, aVerificar: citacoes.filter((c) => !definicoes.has(c.id)) };
}

/** Versão compacta enviada à interface (identificador → título). */
export function resumoDoCatalogo(cat: Catalogo): ResumoCatalogo {
  return Object.freeze(Object.fromEntries([...cat.definicoes.values()].map((d) => [d.id, d.titulo])));
}

/** Requisitos (ou seções) que citam um identificador, sem repetição e na ordem do documento. */
export function citadoEm(cat: Catalogo, id: string): Contexto[] {
  const vistos = new Set<string>();
  const saida: Contexto[] = [];
  for (const c of cat.citacoes) {
    if (c.id !== id || c.contexto.ancora === id || vistos.has(c.contexto.ancora)) continue;
    vistos.add(c.contexto.ancora);
    saida.push(c.contexto);
  }
  return saida;
}

export function contarPorTipo(cat: Catalogo): Record<TipoRequisito, number> {
  const n: Record<TipoRequisito, number> = { RF: 0, RNF: 0, RN: 0, RS: 0 };
  for (const d of cat.definicoes.values()) n[d.tipo]++;
  return n;
}
