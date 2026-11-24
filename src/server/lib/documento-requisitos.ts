/**
 * Documento de Requisitos carregado no servidor (somente componentes de servidor importam
 * este módulo). O Markdown é embutido no build (`?raw`, ver next.config.ts): a página e o
 * catálogo de referências acompanham automaticamente qualquer alteração do documento.
 */
import markdown from "../../../docs/requisitos/REQUISITOS_COMPLETOS.md?raw";
import { montarCatalogo, resumoDoCatalogo, type Catalogo } from "@/lib/requisitos/catalogo";
import { lerMarkdown, type Bloco } from "@/lib/requisitos/markdown";
import type { ResumoCatalogo } from "@/lib/requisitos/referencias";

/** Repositório público do projeto: links relativos do documento apontam para os arquivos nele. */
export const REPOSITORIO = "https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal";

type Documento = { blocos: Bloco[]; catalogo: Catalogo; resumo: ResumoCatalogo };

let cache: Documento | null = null;

export function documentoRequisitos(): Documento {
  if (!cache) {
    const blocos = lerMarkdown(markdown);
    const catalogo = montarCatalogo(blocos);
    cache = { blocos, catalogo, resumo: resumoDoCatalogo(catalogo) };
  }
  return cache;
}

export function resumoCatalogoRequisitos(): ResumoCatalogo {
  return documentoRequisitos().resumo;
}

/** Converte um link relativo do Markdown (ex.: "PENDENCIAS_CLIENTE.md") em endereço do repositório. */
export function enderecoDoLink(href: string): string {
  if (/^(https?:|mailto:|#|\/)/.test(href)) return href;
  return `${REPOSITORIO}/blob/main/docs/requisitos/${href.replace(/^\.\//, "")}`;
}
