"use client";
/**
 * Fluxo de participação em 3 passos (RNF02): escolher → revisar e confirmar identidade (RF011) → comprovante.
 * A escolha permanece apenas no navegador até a confirmação; o servidor só a recebe no envio final.
 */
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, cx } from "./ui/primitives";
import { Icon } from "./ui/icons";

type State = { ok?: boolean; message?: string; data?: Record<string, unknown>; values?: Record<string, string>; fieldErrors?: Record<string, string[]> };
type Action = (s: State, fd: FormData) => Promise<State>;

function Submit({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "civic" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? "Aguarde…" : children}
    </Button>
  );
}

export function VotingWizard({
  question,
  alternatives,
  allowAbstention,
  hasPhone,
  prepare,
  cast,
}: {
  question: string;
  alternatives: { id: string; label: string; explanation: string }[];
  allowAbstention: boolean;
  hasPhone: boolean;
  prepare: Action;
  cast: Action;
}) {
  const [prepState, prepAction] = useActionState(prepare, {});
  const [castState, castAction] = useActionState(cast, {});
  const [step, setStep] = useState<"escolher" | "confirmar">("escolher");
  const [choice, setChoice] = useState<string>("");
  // Erro da confirmação só aparece no passo 1 quando o próprio servidor mandou recomeçar
  // (ex.: código bloqueado). Ao voltar por vontade própria, a mensagem antiga
  // ("Código incorreto. Restam 2 tentativa(s).") não deve continuar na tela.
  const [castErrorVisible, setCastErrorVisible] = useState(false);

  useEffect(() => {
    if (prepState.data?.step === "confirmar") {
      setStep("confirmar");
      setChoice(String(prepState.data.choice));
    }
  }, [prepState]);
  useEffect(() => {
    setCastErrorVisible(!!castState.message);
    if (castState.data?.step === "escolher") setStep("escolher");
  }, [castState]);
  const castError = castErrorVisible ? castState.message : undefined;

  const chosen = choice === "abstencao" ? { label: "Abstenção", explanation: "Registra a participação sem escolher alternativa." } : alternatives.find((a) => a.id === choice);
  const steps = ["Escolher", "Revisar e confirmar", "Comprovante"];

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da participação">
        {steps.map((s, i) => {
          const current = (step === "escolher" && i === 0) || (step === "confirmar" && i === 1);
          const done = step === "confirmar" && i === 0;
          return (
            <li key={s} aria-current={current ? "step" : undefined} className={cx("rounded-lg border px-3 py-2 text-sm", current ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : done ? "border-green-300 bg-ok-100 text-ok-700" : "border-line bg-white text-muted")}>
              <span className="block text-xs">Passo {i + 1}</span>
              {s}
            </li>
          );
        })}
      </ol>

      {step === "escolher" ? (
        <form action={prepAction} className="space-y-5" noValidate>
          {(castError || (prepState.message && !prepState.ok)) && <Alert tone="danger">{castError || prepState.message}</Alert>}
          <fieldset className="space-y-3">
            <legend className="mb-2 text-lg font-semibold text-brand-900">{question}</legend>
            {alternatives.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-200">
                <input type="radio" name="choice" value={a.id} defaultChecked={(prepState.values?.choice ?? choice) === a.id} className="mt-1 size-5 shrink-0 accent-brand-700" />
                <span>
                  <span className="block font-semibold">{a.label}</span>
                  {a.explanation && <span className="block text-sm text-muted">{a.explanation}</span>}
                </span>
              </label>
            ))}
            {allowAbstention && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 has-checked:border-brand-600 has-checked:bg-brand-50">
                <input type="radio" name="choice" value="abstencao" defaultChecked={(prepState.values?.choice ?? choice) === "abstencao"} className="mt-1 size-5 shrink-0 accent-brand-700" />
                <span>
                  <span className="block font-semibold">Abstenção</span>
                  <span className="block text-sm text-muted">Participar sem escolher alternativa (não conta como voto válido).</span>
                </span>
              </label>
            )}
            {prepState.fieldErrors?.choice && <p className="text-sm font-medium text-bad-700">{prepState.fieldErrors.choice.join(" ")}</p>}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Onde receber o código de confirmação</legend>
            <label className="mr-6 inline-flex items-center gap-2">
              <input type="radio" name="channel" value="email" defaultChecked className="size-4 accent-brand-700" /> E-mail
            </label>
            {hasPhone && (
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="channel" value="celular" className="size-4 accent-brand-700" /> Celular (SMS — simulado nesta demonstração)
              </label>
            )}
          </fieldset>
          <Submit>Revisar minha escolha</Submit>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border-2 border-brand-600 bg-brand-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Sua escolha</p>
            <p className="mt-1 text-xl font-bold text-brand-900">{chosen?.label}</p>
            {chosen?.explanation && <p className="text-sm text-muted">{chosen.explanation}</p>}
          </div>
          <Alert tone="warning" title="Atenção: o voto não poderá ser alterado depois de confirmado">
            Confira a escolha. Após a confirmação, o voto é gravado de forma secreta e não pode ser mudado nem cancelado por ninguém.
          </Alert>
          <form action={castAction} className="space-y-4" noValidate>
            <input type="hidden" name="choice" value={choice} />
            {castError && <Alert tone="danger">{castError}</Alert>}
            <div className="space-y-1.5">
              <label htmlFor="code" className="block text-sm font-semibold">
                Código de confirmação
              </label>
              <p id="code-dica" className="text-xs text-muted">
                Enviamos um código de 6 dígitos para {String(prepState.data?.destination ?? "o seu e-mail")}. Ele vale por 5 minutos.
              </p>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                aria-describedby="code-dica"
                className="block w-40 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Submit variant="civic">
                <Icon name="check" className="size-4" /> Confirmar meu voto
              </Submit>
              <Button type="button" variant="secondary" onClick={() => { setCastErrorVisible(false); setStep("escolher"); }}>
                Voltar e mudar a escolha
              </Button>
            </div>
          </form>
          <form action={prepAction}>
            <input type="hidden" name="choice" value={choice} />
            <input type="hidden" name="channel" value={String(prepState.data?.channel ?? "email")} />
            <button className="text-sm font-semibold text-brand-700 underline">Não recebi: reenviar código</button>
          </form>
        </div>
      )}
    </div>
  );
}
