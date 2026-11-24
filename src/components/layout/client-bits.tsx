"use client";
/** Pequenos componentes interativos do layout (acessibilidade, mensagens, contagem regressiva). */
import { useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FLASH } from "@/lib/flash";

/* ------------------------------------------------------------------ */
/* Espaçamento ampliado para leitura (WCAG 1.4.12): linhas, palavras e  */
/* letras mais espaçadas na página inteira (DT-22).                     */
/* ------------------------------------------------------------------ */

const ESPACO_KEY = "ppcm-espacamento";
const ESPACO_EVENT = "ppcm:espacamento";

function aplicarEspacamento(on: boolean) {
  document.documentElement.dataset.espacamento = on ? "amplo" : "";
  try {
    localStorage.setItem(ESPACO_KEY, on ? "amplo" : "");
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(ESPACO_EVENT));
}

/** Estado do espaçamento ampliado, sincronizado entre os controles da página. */
function useEspacamento() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const ler = () => setOn(document.documentElement.dataset.espacamento === "amplo");
    ler();
    window.addEventListener(ESPACO_EVENT, ler);
    return () => window.removeEventListener(ESPACO_EVENT, ler);
  }, []);
  return [on, () => aplicarEspacamento(!on)] as const;
}

/**
 * Aplica em todas as páginas o espaçamento ampliado guardado no navegador e mantém o atalho de
 * teclado (tecla de acesso 5). Não aparece na tela: o controle visível fica na página de
 * Acessibilidade (DT-22).
 */
export function EspacamentoPreferencia() {
  const [on, alternar] = useEspacamento();
  useEffect(() => {
    try {
      if (localStorage.getItem(ESPACO_KEY) === "amplo") {
        document.documentElement.dataset.espacamento = "amplo";
        window.dispatchEvent(new Event(ESPACO_EVENT));
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  return (
    <button type="button" accessKey="5" tabIndex={-1} aria-pressed={on} onClick={alternar} className="sr-only">
      Alternar espaçamento ampliado para leitura (tecla de acesso 5)
    </button>
  );
}

/** Controle visível do espaçamento ampliado, na página de Acessibilidade. */
export function EspacamentoToggle() {
  const [on, alternar] = useEspacamento();
  return (
    <button type="button" aria-pressed={on} onClick={alternar} className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-left font-semibold text-brand-800 hover:bg-brand-50">
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${on ? "border-brand-700 bg-brand-700" : "border-slate-400 bg-slate-200"}`}>
        <span className={`absolute left-0 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </span>
      Espaçamento ampliado
      <span className="text-sm font-normal text-muted">{on ? "ligado" : "desligado"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tamanho do texto (A−, A, A+): escala o texto da página inteira (rem) */
/* ------------------------------------------------------------------ */

const TEXTO_KEY = "ppcm-texto";
const TEXTO_EVENT = "ppcm:texto";
const TAMANHOS = [100, 115, 130] as const;

function aplicarTamanhoTexto(nivel: number) {
  const n = Math.max(0, Math.min(TAMANHOS.length - 1, nivel));
  document.documentElement.style.fontSize = n ? `${TAMANHOS[n]}%` : "";
  document.documentElement.dataset.texto = String(n);
  try {
    localStorage.setItem(TEXTO_KEY, String(n));
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(TEXTO_EVENT));
}

function useTamanhoTexto() {
  const [nivel, setNivel] = useState(0);
  useEffect(() => {
    const ler = () => setNivel(Number(document.documentElement.dataset.texto) || 0);
    ler();
    window.addEventListener(TEXTO_EVENT, ler);
    return () => window.removeEventListener(TEXTO_EVENT, ler);
  }, []);
  return [nivel, aplicarTamanhoTexto] as const;
}

/** Aplica em todas as páginas o tamanho de texto escolhido (guardado neste navegador). */
export function TamanhoTextoPreferencia() {
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(TEXTO_KEY));
      if (v > 0) aplicarTamanhoTexto(v);
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  return null;
}

const botaoTexto = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 font-bold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40";

export function ControleTamanhoTexto() {
  const [nivel, aplicar] = useTamanhoTexto();
  return (
    <div role="group" aria-label="Tamanho do texto" className="flex items-center gap-2">
      <button type="button" className={botaoTexto} onClick={() => aplicar(nivel - 1)} disabled={nivel === 0}>
        A−<span className="sr-only"> (diminuir o texto)</span>
      </button>
      <button type="button" className={botaoTexto} onClick={() => aplicar(0)} aria-pressed={nivel === 0}>
        A<span className="sr-only"> (texto no tamanho normal)</span>
      </button>
      <button type="button" className={`${botaoTexto} text-lg`} onClick={() => aplicar(nivel + 1)} disabled={nivel === TAMANHOS.length - 1}>
        A+<span className="sr-only"> (aumentar o texto)</span>
      </button>
      <span className="text-sm text-muted" aria-live="polite">
        {TAMANHOS[nivel]}%
      </span>
    </div>
  );
}

/**
 * Indicador de carregamento entre páginas: uma barra fina no topo, que só aparece quando a
 * navegação demora mais de 150 ms (navegações rápidas não piscam).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [active, setActive] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(false);
  };
  // A rota mudou: a navegação terminou.
  useEffect(stop, [pathname, params]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      stop();
      timers.current = [setTimeout(() => setActive(true), 150), setTimeout(stop, 15_000)];
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      timers.current.forEach(clearTimeout);
    };
  }, []);
  if (!active) return null;
  return <div role="progressbar" aria-label="Carregando a página" className="barra-de-navegacao" />;
}

/** Mensagem de sucesso após redirecionamento (?ok=chave). Some da URL depois de exibida. */
export function FlashMessage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const key = params.get("ok");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (key && FLASH[key]) {
      setMsg(FLASH[key]);
      const next = new URLSearchParams(params.toString());
      next.delete("ok");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }
  }, [key, params, pathname, router]);
  if (!msg) return null;
  return (
    <div role="status" className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-green-300 bg-ok-100 px-4 py-3 text-sm font-medium text-ok-700">
      <span>{msg}</span>
      <button type="button" onClick={() => setMsg(null)} className="shrink-0 underline">
        Fechar
      </button>
    </div>
  );
}

/** Contagem regressiva textual (atualiza a cada minuto; leitores de tela recebem o texto estático). */
export function Countdown({ to, prefix }: { to: string; prefix: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span>
      {prefix} {d > 0 ? `${d} dia${d > 1 ? "s" : ""} e ` : ""}
      {h}h{String(m).padStart(2, "0")}
    </span>
  );
}

/** Atualiza o painel a cada 5 minutos (RF048). */
export function AutoRefresh({ ms = 300_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [ms, router]);
  return null;
}

/** Contador de caracteres para campos com limite (pergunta ≤ 300, título ≤ 120). */
export function CharCounter({ targetId, max }: { targetId: string; max: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    const upd = () => setN(el.value.length);
    upd();
    el.addEventListener("input", upd);
    return () => el.removeEventListener("input", upd);
  }, [targetId]);
  return (
    <p className={`text-xs ${n > max ? "font-semibold text-bad-700" : "text-muted"}`} aria-live="polite">
      {n}/{max} caracteres
    </p>
  );
}
