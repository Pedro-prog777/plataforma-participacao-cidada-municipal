"use client";
/** Pequenos componentes interativos do layout (contraste, mensagens, contagem regressiva). */
import { useEffect, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FLASH } from "@/lib/flash";

/** Alto contraste (eMAG 3.1). Preferência guardada só no navegador. */
export function ContrastToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ppcm-contraste") === "alto";
      setOn(saved);
      document.documentElement.dataset.contraste = saved ? "alto" : "";
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  return (
    <button
      type="button"
      accessKey="5"
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        document.documentElement.dataset.contraste = next ? "alto" : "";
        try {
          localStorage.setItem("ppcm-contraste", next ? "alto" : "");
        } catch {
          /* ignora */
        }
      }}
      className="rounded px-1.5 py-1 hover:underline"
    >
      Alto contraste<span className="hidden lg:inline"> [5]</span>
    </button>
  );
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
