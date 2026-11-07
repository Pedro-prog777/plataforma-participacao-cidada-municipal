"use client";
/** Editor de alternativas (RF026): 2 a 10, rótulo, explicação e ordem; modelos Sim/Não e Concordo/Discordo. */
import { useState } from "react";
import { ActionForm, Checkbox, FieldError, SubmitButton, type FormState } from "../ui/form";
import { Button } from "../ui/primitives";

type Item = { label: string; explanation: string };

export function AlternativesEditor({ action, initial, allowAbstention, disabled }: { action: (s: FormState, fd: FormData) => Promise<FormState>; initial: Item[]; allowAbstention: boolean; disabled: boolean }) {
  const [items, setItems] = useState<Item[]>(initial.length ? initial : [{ label: "", explanation: "" }, { label: "", explanation: "" }]);
  const move = (i: number, d: number) => setItems((arr) => {
    const n = [...arr];
    const j = i + d;
    if (j < 0 || j >= n.length) return arr;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const cls = "block w-full rounded-lg border border-slate-300 px-3 py-2";
  return (
    <ActionForm action={action}>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="self-center text-muted">Usar modelo:</span>
          <Button type="button" variant="secondary" onClick={() => setItems([{ label: "Sim", explanation: "Concordo com a proposta apresentada." }, { label: "Não", explanation: "Não concordo com a proposta apresentada." }])}>
            Sim / Não
          </Button>
          <Button type="button" variant="secondary" onClick={() => setItems([{ label: "Concordo", explanation: "Sou a favor da proposta." }, { label: "Discordo", explanation: "Sou contra a proposta." }])}>
            Concordo / Discordo
          </Button>
        </div>
        <FieldError name="items" />
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-[2rem_1fr_2fr_auto] sm:items-start">
              <span className="pt-2 font-bold text-muted">{i + 1}.</span>
              <div>
                <label htmlFor={`alt-label-${i}`} className="text-xs font-semibold">
                  Rótulo
                </label>
                <input id={`alt-label-${i}`} name="label" value={it.label} maxLength={120} onChange={(e) => setItems((a) => a.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className={cls} />
                <FieldError name={`items.${i}.label`} />
              </div>
              <div>
                <label htmlFor={`alt-exp-${i}`} className="text-xs font-semibold">
                  Explicação
                </label>
                <input id={`alt-exp-${i}`} name="explanation" value={it.explanation} maxLength={1000} onChange={(e) => setItems((a) => a.map((x, k) => (k === i ? { ...x, explanation: e.target.value } : x)))} className={cls} />
              </div>
              <div className="flex gap-1 pt-5">
                <Button type="button" variant="ghost" aria-label={`Subir alternativa ${i + 1}`} onClick={() => move(i, -1)}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" aria-label={`Descer alternativa ${i + 1}`} onClick={() => move(i, 1)}>
                  ↓
                </Button>
                <Button type="button" variant="ghost" aria-label={`Remover alternativa ${i + 1}`} onClick={() => setItems((a) => a.filter((_, k) => k !== i))}>
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {items.length < 10 && (
          <Button type="button" variant="secondary" onClick={() => setItems((a) => [...a, { label: "", explanation: "" }])}>
            Adicionar alternativa
          </Button>
        )}
        <Checkbox name="allowAbstention" defaultChecked={allowAbstention} label="Permitir abstenção" hint="A abstenção registra participação, mas não é voto válido." />
        <SubmitButton>Salvar alternativas</SubmitButton>
      </fieldset>
    </ActionForm>
  );
}
