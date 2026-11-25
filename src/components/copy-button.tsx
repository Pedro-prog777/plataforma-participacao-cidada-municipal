"use client";
/**
 * Botão "Copiar" para o código do comprovante (RF038): copia sem sair da página e avisa o
 * leitor de tela. Quando a área de transferência não está disponível (endereço sem HTTPS, por
 * exemplo), usa a cópia por seleção; se nada funcionar, orienta a copiar manualmente.
 */
import { useRef, useState } from "react";
import { Button } from "./ui/primitives";

function copiarPorSelecao(texto: string): boolean {
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  campo.remove();
  return ok;
}

export function CopyButton({ value, label = "Copiar código" }: { value: string; label?: string }) {
  const [situacao, setSituacao] = useState<"" | "copiado" | "falhou">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copiar() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copiarPorSelecao(value);
    setSituacao(ok ? "copiado" : "falhou");
    if (timer.current) clearTimeout(timer.current);
    if (ok) timer.current = setTimeout(() => setSituacao(""), 4000);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button type="button" variant="secondary" icon={situacao === "copiado" ? "check" : "clipboard"} onClick={copiar}>
        {situacao === "copiado" ? "Código copiado" : label}
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
        {situacao === "copiado" ? "O código foi copiado." : situacao === "falhou" ? "Não foi possível copiar automaticamente. Selecione o código e copie." : ""}
      </p>
    </div>
  );
}
