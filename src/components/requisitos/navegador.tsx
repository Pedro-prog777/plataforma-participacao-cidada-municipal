"use client";
/**
 * Navegação entre requisitos na página do documento: ao seguir uma referência (clique,
 * endereço com âncora vindo de outra página, voltar/avançar do navegador), rola até o
 * requisito, move o foco para ele e aplica um destaque temporário.
 */
import { useEffect } from "react";

const DURACAO_DESTAQUE = 3000;

export function NavegadorRequisitos() {
  useEffect(() => {
    let atual: HTMLElement | null = null;
    let temporizador: number | undefined;
    let esperandoRolagem: (() => void) | null = null;
    const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function pararDeEsperarRolagem() {
      if (esperandoRolagem) window.removeEventListener("scrollend", esperandoRolagem);
      esperandoRolagem = null;
    }

    function destacar(id: string, suave: boolean): boolean {
      const alvo = id ? document.getElementById(id) : null;
      if (!alvo || !alvo.classList.contains("req-alvo")) return false;
      window.clearTimeout(temporizador);
      pararDeEsperarRolagem();
      atual?.classList.remove("req-destaque");
      void alvo.offsetWidth; // reinicia a transição quando o mesmo requisito é destacado de novo
      alvo.classList.add("req-destaque");
      atual = alvo;
      if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
      const rolagemSuave = suave && !movimentoReduzido();
      alvo.scrollIntoView({ behavior: rolagemSuave ? "smooth" : "auto", block: "start" });
      alvo.focus({ preventScroll: true });
      // O destaque dura alguns segundos depois que a rolagem termina (num documento longo a
      // rolagem suave pode levar mais de um segundo).
      const contar = () => {
        window.clearTimeout(temporizador);
        temporizador = window.setTimeout(() => alvo.classList.remove("req-destaque"), DURACAO_DESTAQUE);
      };
      if (rolagemSuave && "onscrollend" in window) {
        const aoTerminar = () => {
          pararDeEsperarRolagem();
          contar();
        };
        esperandoRolagem = aoTerminar;
        window.addEventListener("scrollend", aoTerminar);
        // Se não houver rolagem (requisito já visível), o evento não acontece.
        temporizador = window.setTimeout(aoTerminar, 1500);
      } else contar();
      return true;
    }

    const idDaAncora = () => decodeURIComponent(window.location.hash.slice(1));

    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href*='#']");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      const url = new URL(link.href);
      if (url.pathname !== window.location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      if (!document.getElementById(id)?.classList.contains("req-alvo")) return;
      e.preventDefault();
      if (window.location.hash !== url.hash) window.history.pushState(window.history.state, "", url.hash);
      destacar(id, true);
    }

    function aoMudarAncora() {
      destacar(idDaAncora(), false);
    }

    // Chegada com âncora: link de outra página (ex.: "RN16" no painel administrativo).
    aoMudarAncora();
    document.addEventListener("click", aoClicar);
    window.addEventListener("hashchange", aoMudarAncora);
    window.addEventListener("popstate", aoMudarAncora);
    return () => {
      window.clearTimeout(temporizador);
      pararDeEsperarRolagem();
      document.removeEventListener("click", aoClicar);
      window.removeEventListener("hashchange", aoMudarAncora);
      window.removeEventListener("popstate", aoMudarAncora);
    };
  }, []);
  return null;
}
