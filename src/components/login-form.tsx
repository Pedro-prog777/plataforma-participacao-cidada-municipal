"use client";
import Link from "next/link";
import { ActionForm, Field, SubmitButton, type FormState } from "./ui/form";

export function LoginForm({ action, next }: { action: (s: FormState, fd: FormData) => Promise<FormState>; next: string }) {
  return (
    <ActionForm action={action}>
      {(state) => {
        const captcha = state.data?.captcha as { question: string; token: string } | null | undefined;
        return (
          <>
            <input type="hidden" name="proximo" value={next} />
            <Field label="CPF ou e-mail" name="identifier" required autoComplete="username" />
            <Field label="Senha" name="password" type="password" required autoComplete="current-password" />
            {captcha && (
              <>
                <input type="hidden" name="captchaToken" value={captcha.token} />
                <Field label={`Verificação de segurança: ${captcha.question}`} name="captchaAnswer" required inputMode="numeric" className="max-w-xs" />
              </>
            )}
            <SubmitButton className="w-full">Entrar</SubmitButton>
            {Boolean(state.data?.pendingEmail) && (
              <p className="text-sm">
                Não recebeu o link?{" "}
                <Link href="/reenviar-confirmacao" className="font-semibold text-brand-700 underline">
                  Reenviar confirmação
                </Link>
              </p>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}
