"use client";
/** Pequenos componentes interativos do layout (contraste, mensagens, contagem regressiva). */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FLASH } from "@/lib/flash";

const CONTRAST_KEY = "ppcm-contraste";
const CONTRAST_EVENT = "ppcm:contraste";

function applyContrast(on: boolean) {
  document.documentElement.dataset.contraste = on ? "alto" : "";
  try {
    localStorage.setItem(CONTRAST_KEY, on ? "alto" : "");
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(CONTRAST_EVENT));
}

/** Estado do alto contraste, sincronizado entre os controles da página. */
function useContrast() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(document.documentElement.dataset.contraste === "alto");
    read();
    window.addEventListener(CONTRAST_EVENT, read);
    return () => window.removeEventListener(CONTRAST_EVENT, read);
  }, []);
  return [on, () => applyContrast(!on)] as const;
}

/**
 * Aplica em todas as páginas a preferência de alto contraste guardada no navegador e mantém o
 * atalho de teclado (tecla de acesso 5). Não aparece na tela: o controle visível fica na página
 * de Acessibilidade (DT-22).
 */
export function ContrastPreference() {
  const [on, toggle] = useContrast();
  useEffect(() => {
    try {
      if (localStorage.getItem(CONTRAST_KEY) === "alto") {
        document.documentElement.dataset.contraste = "alto";
        window.dispatchEvent(new Event(CONTRAST_EVENT));
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  return (
    <button type="button" accessKey="5" tabIndex={-1} aria-pressed={on} onClick={toggle} className="sr-only">
      Alternar alto contraste (tecla de acesso 5)
    </button>
  );
}

/** Controle visível do alto contraste (eMAG 3.1), na página de Acessibilidade. */
export function ContrastToggle() {
  const [on, toggle] = useContrast();
  return (
    <button type="button" aria-pressed={on} onClick={toggle} className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-brand-800 hover:bg-brand-50">
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${on ? "border-brand-700 bg-brand-700" : "border-slate-400 bg-slate-200"}`}>
        <span className={`ac-preenchido absolute left-0 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </span>
      Alto contraste
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
 * Botão "Acessibilidade" da faixa superior (DT-22): abre um painel com alto contraste, tamanho do
 * texto e o link para a página de Acessibilidade. Esc ou clique fora fecham o painel.
 */
export function MenuAcessibilidade() {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);
  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-acessibilidade"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-white/10"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="7" r="1.2" fill="currentColor" />
          <path d="m7 10 5 1 5-1m-5 1v3m0 0-2.5 4.5M12 14l2.5 4.5" />
        </svg>
        <span className="sr-only sm:not-sr-only">Acessibilidade</span>
      </button>
      {aberto && (
        <div id="menu-acessibilidade" role="group" aria-label="Opções de acessibilidade" className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-4 whitespace-normal rounded-xl border border-line bg-white p-4 text-sm text-ink shadow-lg">
          <div className="space-y-1.5">
            <p className="font-semibold">Cores</p>
            <ContrastToggle />
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold">Tamanho do texto</p>
            <ControleTamanhoTexto />
          </div>
          <Link href="/acessibilidade" onClick={() => setAberto(false)} className="inline-block font-semibold text-brand-700 underline">
            Mais recursos de acessibilidade
          </Link>
        </div>
      )}
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
