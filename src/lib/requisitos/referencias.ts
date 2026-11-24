/**
 * Referências cruzadas entre requisitos — reconhecimento automático dos identificadores
 * RF (funcionais), RNF (não funcionais), RN (regras de negócio) e RS (segurança).
 *
 * Módulo puro, usado no servidor e no navegador. Não existe cadastro manual de links: o
 * conjunto de identificadores válidos é sempre o catálogo montado a partir do próprio
 * Documento de Requisitos (`catalogo.ts`). Um identificador fora do catálogo não vira link
 * e é sinalizado como "referência a verificar" (DT-24).
 */

export type TipoRequisito = "RF" | "RNF" | "RN" | "RS";

/** Quantidade de dígitos de cada tipo, conforme a seção 1.2.1 do documento (RF001, RNF01, RN01, RS001). */
export const DIGITOS: Record<TipoRequisito, number> = { RF: 3, RNF: 2, RN: 2, RS: 3 };

/**
 * Captura os identificadores no texto. Aceita de 2 a 4 dígitos de propósito: formatos
 * parecidos com os oficiais (RF01, RN001) também são encontrados e, como não constam do
 * catálogo, aparecem como "a verificar" em vez de passarem despercebidos.
 */
export const PADRAO_REFERENCIA = /\b(RNF|RF|RN|RS)(\d{2,4})\b/g;

/** Rota da página que exibe o documento completo. */
export const ROTA_DOCUMENTO = "/requisitos";

/** Catálogo enviado à interface: identificador → título curto (só o necessário para o link). */
export type ResumoCatalogo = Readonly<Record<string, string>>;

export type Trecho = { tipo: "texto"; texto: string } | { tipo: "ref"; id: string; existe: boolean; titulo?: string };

export function temReferencia(texto: string): boolean {
  return new RegExp(PADRAO_REFERENCIA.source).test(texto);
}

/** Divide o texto em trechos simples e referências, marcando se cada uma existe no documento. */
export function separarReferencias(texto: string, catalogo: ResumoCatalogo | null | undefined): Trecho[] {
  const trechos: Trecho[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(PADRAO_REFERENCIA)) {
    const id = m[0];
    const inicio = m.index ?? 0;
    if (inicio > ultimo) trechos.push({ tipo: "texto", texto: texto.slice(ultimo, inicio) });
    const titulo = catalogo && Object.prototype.hasOwnProperty.call(catalogo, id) ? catalogo[id] : undefined;
    trechos.push(titulo === undefined ? { tipo: "ref", id, existe: false } : { tipo: "ref", id, existe: true, titulo });
    ultimo = inicio + id.length;
  }
  if (ultimo < texto.length) trechos.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return trechos;
}

/** Lista os identificadores citados num texto, na ordem em que aparecem. */
export function referenciasDoTexto(texto: string): string[] {
  return [...texto.matchAll(PADRAO_REFERENCIA)].map((m) => m[0]);
}

export function tipoDoId(id: string): TipoRequisito | null {
  const m = /^(RNF|RF|RN|RS)\d+$/.exec(id);
  return m ? (m[1] as TipoRequisito) : null;
}

/** O identificador segue o formato oficial (não garante que exista no documento). */
export function formatoOficial(id: string): boolean {
  const tipo = tipoDoId(id);
  return tipo !== null && id.length === tipo.length + DIGITOS[tipo];
}

/** Endereço do requisito no documento: a âncora é o próprio identificador. */
export function hrefRequisito(id: string): string {
  return `${ROTA_DOCUMENTO}#${id}`;
}
