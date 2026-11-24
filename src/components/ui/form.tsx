"use client";
/**
 * Formulários com Server Actions: mensagens de erro por campo (RF002), associação
 * rótulo/erro acessível (aria-describedby, aria-invalid) e preservação dos valores após erro.
 */
import { createContext, useActionState, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, comReferencias, cx } from "./primitives";
import { caretAfterDigits, maskValue, type MaskKind } from "@/lib/masks";

export type FormState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]>; data?: Record<string, unknown>; values?: Record<string, string> };
type Action = (state: FormState, fd: FormData) => Promise<FormState>;

const Ctx = createContext<FormState>({});
export const useFormCtx = () => useContext(Ctx);

export function ActionForm({
  action,
  children,
  className,
  initial,
  id,
  hideMessage,
}: {
  action: Action;
  children: ReactNode | ((state: FormState) => ReactNode);
  className?: string;
  initial?: FormState;
  id?: string;
  hideMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, initial ?? {});
  const pendencies = (state.data?.pendencies as { message: string; href: string }[] | undefined) ?? [];
  return (
    <Ctx.Provider value={state}>
      <form action={formAction} className={cx("space-y-5", className)} noValidate id={id}>
        {!hideMessage && state.message && (
          <Alert tone={state.ok ? "success" : "danger"} title={state.ok ? undefined : "Não foi possível concluir"}>
            <p>{comReferencias(state.message)}</p>
            {pendencies.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {pendencies.map((p) => (
                  <li key={p.message}>
                    <a href={p.href}>{p.message}</a>
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {typeof children === "function" ? children(state) : children}
      </form>
    </Ctx.Provider>
  );
}

export function SubmitButton({ children, pendingText = "Enviando…", ...rest }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending ? pendingText : children}
    </Button>
  );
}

function useFieldIds(name: string) {
  const id = useId();
  const state = useFormCtx();
  const errors = state.fieldErrors?.[name] ?? [];
  return { inputId: `${name}-${id}`, hintId: `${name}-${id}-dica`, errId: `${name}-${id}-erro`, errors, value: state.values?.[name] };
}

type FieldShellProps = { label: ReactNode; hint?: ReactNode; required?: boolean; children: (ids: { id: string; describedBy?: string; invalid: boolean; value?: string }) => ReactNode; name: string; className?: string; forcedId?: string };

export function FieldShell({ label, hint, required, children, name, className, forcedId }: FieldShellProps) {
  const ids = useFieldIds(name);
  const { hintId, errId, errors, value } = ids;
  const inputId = forcedId ?? ids.inputId;
  const describedBy = [hint ? hintId : null, errors.length ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
        {comReferencias(label)}
        {required ? (
          <span className="text-bad-700" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-muted"> (opcional)</span>
        )}
      </label>
      {children({ id: inputId, describedBy, invalid: errors.length > 0, value })}
      {errors.length > 0 && (
        <p id={errId} className="flex items-start gap-1 text-sm font-medium text-bad-700">
          {comReferencias(errors.join(" "))}
        </p>
      )}
      {/* A dica fica abaixo do campo: campos lado a lado permanecem alinhados mesmo com dicas de tamanhos diferentes. */}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {comReferencias(hint)}
        </p>
      )}
    </div>
  );
}

const inputCls = (invalid: boolean) =>
  cx("block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200", invalid ? "border-bad-700" : "border-slate-300");

export function Field({
  label,
  hint,
  name,
  required,
  className,
  id: forcedId,
  mask,
  ...input
}: { label: ReactNode; hint?: ReactNode; name: string; required?: boolean; className?: string; /** Pontuação automática enquanto a pessoa digita. */ mask?: MaskKind } & Omit<ComponentProps<"input">, "name">) {
  const initial = (v: unknown) => (mask && typeof v === "string" ? maskValue(mask, v) : (v as string | undefined));
  return (
    <FieldShell label={label} hint={hint} name={name} required={required} className={className} forcedId={forcedId}>
      {({ id, describedBy, invalid, value }) => (
        <input
          id={id}
          name={name}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={inputCls(invalid)}
          {...input}
          defaultValue={input.type === "password" ? undefined : initial(value ?? input.defaultValue)}
          onChange={(e) => {
            if (mask) {
              const el = e.currentTarget;
              const digitsBefore = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, "").length;
              const next = maskValue(mask, el.value);
              if (next !== el.value) {
                el.value = next;
                const pos = caretAfterDigits(next, digitsBefore);
                el.setSelectionRange(pos, pos);
              }
            }
            input.onChange?.(e);
          }}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({ label, hint, name, required, className, id: forcedId, ...input }: { label: ReactNode; hint?: ReactNode; name: string; required?: boolean; className?: string } & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <FieldShell label={label} hint={hint} name={name} required={required} className={className} forcedId={forcedId}>
      {({ id, describedBy, invalid, value }) => (
        <textarea id={id} name={name} rows={4} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} className={inputCls(invalid)} {...input} defaultValue={value ?? input.defaultValue} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  name,
  required,
  options,
  placeholder,
  className,
  ...input
}: { label: ReactNode; hint?: ReactNode; name: string; required?: boolean; options: { value: string; label: string }[]; placeholder?: string; className?: string } & Omit<ComponentProps<"select">, "name">) {
  return (
    <FieldShell label={label} hint={hint} name={name} required={required} className={className}>
      {({ id, describedBy, invalid, value }) => (
        // A chave recria o campo quando o servidor devolve o formulário com erro: o React não
        // reaplica defaultValue em <select> já montado e a escolha se perdia.
        <select key={value ?? "inicial"} id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} className={inputCls(invalid)} {...input} defaultValue={value ?? input.defaultValue ?? ""}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Checkbox({ label, name, hint, defaultChecked, value = "on", required }: { label: ReactNode; name: string; hint?: ReactNode; defaultChecked?: boolean; value?: string; required?: boolean }) {
  const { inputId, errId, errors, hintId } = useFieldIds(name);
  const state = useFormCtx();
  const checked = state.values ? (state.values[name] ?? "").split(",").includes(value) : defaultChecked;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={checked}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={[hint ? hintId : null, errors.length ? errId : null].filter(Boolean).join(" ") || undefined}
          aria-required={required || undefined}
          className="mt-1 size-5 shrink-0 rounded border-slate-400 accent-brand-700"
        />
        <label htmlFor={inputId} className="text-sm">
          {comReferencias(label)}
          {hint && (
            <span id={hintId} className="block text-xs text-muted">
              {comReferencias(hint)}
            </span>
          )}
        </label>
      </div>
      {errors.length > 0 && (
        <p id={errId} className="pl-8 text-sm font-medium text-bad-700">
          {comReferencias(errors.join(" "))}
        </p>
      )}
    </div>
  );
}

export function RadioGroup({ legend, name, options, required, defaultValue, hint }: { legend: ReactNode; name: string; options: { value: string; label: ReactNode; description?: ReactNode }[]; required?: boolean; defaultValue?: string; hint?: ReactNode }) {
  const { errors, errId, value, hintId } = useFieldIds(name);
  const current = value ?? defaultValue;
  return (
    <fieldset className="space-y-2" aria-describedby={[hint ? hintId : null, errors.length ? errId : null].filter(Boolean).join(" ") || undefined}>
      <legend className="text-sm font-semibold text-ink">
        {comReferencias(legend)}
        {required && (
          <span className="text-bad-700" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {comReferencias(hint)}
        </p>
      )}
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-3 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-200">
            <input type="radio" name={name} value={o.value} defaultChecked={current === o.value} className="mt-1 size-5 shrink-0 accent-brand-700" aria-invalid={errors.length > 0 || undefined} />
            <span>
              <span className="block font-semibold text-ink">{comReferencias(o.label)}</span>
              {o.description && <span className="block text-sm text-muted">{comReferencias(o.description)}</span>}
            </span>
          </label>
        ))}
      </div>
      {errors.length > 0 && (
        <p id={errId} className="text-sm font-medium text-bad-700">
          {comReferencias(errors.join(" "))}
        </p>
      )}
    </fieldset>
  );
}

/** Mensagem de erro de um campo composto (ex.: itens dinâmicos). */
export function FieldError({ name }: { name: string }) {
  const state = useFormCtx();
  const errs = state.fieldErrors?.[name];
  if (!errs?.length) return null;
  return <p className="text-sm font-medium text-bad-700">{comReferencias(errs.join(" "))}</p>;
}
