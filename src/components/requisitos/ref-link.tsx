/**
 * Apresentação das referências a requisitos (sem estado: serve a componentes de servidor e
 * de cliente). Identificador existente → link para o ponto do documento em que é descrito;
 * inexistente → marcação "a verificar", sem link (DT-24).
 */
import { Fragment, type ReactNode } from "react";
import { hrefRequisito, separarReferencias, type ResumoCatalogo } from "@/lib/requisitos/referencias";

export type OpcoesReferencia = {
  /** Fora da página do documento o link abre em nova aba, para não perder o que está na tela (ex.: formulário). */
  novaAba?: boolean;
};

export function RefRequisito({ id, existe, titulo, novaAba }: { id: string; existe: boolean; titulo?: string } & OpcoesReferencia) {
  if (!existe) {
    return (
      <span className="ref-req ref-req-verificar" data-ref={id} data-ref-situacao="verificar" title={`${id} não consta do Documento de Requisitos: referência a verificar`}>
        {id}
        <span className="ref-req-marca" aria-hidden="true">
          ?
        </span>
        <span className="sr-only"> (referência a verificar: não consta do documento de requisitos)</span>
      </span>
    );
  }
  return (
    <a href={hrefRequisito(id)} className="ref-req" data-ref={id} title={titulo ? `${id} — ${titulo}` : id} {...(novaAba ? { target: "_blank", rel: "noopener" } : {})}>
      {id}
      {novaAba && <span className="sr-only"> (abre o documento de requisitos em nova aba)</span>}
    </a>
  );
}

/** Troca cada identificador do texto pela referência correspondente. */
export function renderizarReferencias(texto: string, catalogo: ResumoCatalogo | null | undefined, opcoes: OpcoesReferencia = {}): ReactNode[] {
  return separarReferencias(texto, catalogo).map((t, i) =>
    t.tipo === "texto" ? <Fragment key={i}>{t.texto}</Fragment> : <RefRequisito key={i} id={t.id} existe={t.existe} titulo={t.titulo} novaAba={opcoes.novaAba} />,
  );
}
