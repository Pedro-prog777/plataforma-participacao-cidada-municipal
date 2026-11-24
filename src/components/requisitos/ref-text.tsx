"use client";
/**
 * Referências automáticas na interface: qualquer texto passado por <RefText> tem os
 * identificadores RF/RNF/RN/RS transformados em links para o Documento de Requisitos. O
 * catálogo vem do layout raiz (montado no servidor a partir do documento), então não há
 * lista de links mantida à mão.
 */
import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ROTA_DOCUMENTO, temReferencia, type ResumoCatalogo } from "@/lib/requisitos/referencias";
import { renderizarReferencias } from "./ref-link";

const CatalogoCtx = createContext<ResumoCatalogo | null>(null);

export function ProvedorCatalogoRequisitos({ catalogo, children }: { catalogo: ResumoCatalogo; children: ReactNode }) {
  return <CatalogoCtx.Provider value={catalogo}>{children}</CatalogoCtx.Provider>;
}

export function RefText({ children }: { children: string }) {
  const catalogo = useContext(CatalogoCtx);
  const naPaginaDoDocumento = usePathname() === ROTA_DOCUMENTO;
  if (!catalogo || !temReferencia(children)) return <>{children}</>;
  return <>{renderizarReferencias(children, catalogo, { novaAba: !naPaginaDoDocumento })}</>;
}
