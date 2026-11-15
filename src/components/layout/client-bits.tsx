"use client";
/** Pequenos componentes interativos do layout (contraste, mensagens, contagem regressiva). */
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
        <span className={`ac-preenchido absolute left-0 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
      Alto contraste
      <span className="text-sm font-normal text-muted">{on ? "ligado" : "desligado"}</span>
    </button>
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
