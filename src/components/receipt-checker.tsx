"use client";
import { ActionForm, Field, SubmitButton, type FormState } from "./ui/form";
import { Alert } from "./ui/primitives";

export function ReceiptChecker({ action }: { action: (s: FormState, fd: FormData) => Promise<FormState> }) {
  return (
    <ActionForm action={action} hideMessage>
      {(state) => {
        const result = state.data?.result as { consultationTitle: string; date: string; situation: string; slug: string } | undefined;
        const captcha = state.data?.captcha as { question: string; token: string } | undefined;
        return (
          <>
            <Field label="Código do comprovante" name="code" required placeholder="XXXX-XXXX-XXXX" autoComplete="off" maxLength={20} className="max-w-xs" />
            {captcha && (
              <>
                <input type="hidden" name="captchaToken" value={captcha.token} />
                <Field label={`Verificação: ${captcha.question}`} name="captchaAnswer" required inputMode="numeric" className="max-w-xs" />
              </>
            )}
            <SubmitButton>Verificar</SubmitButton>
            {state.message && !state.ok && <Alert tone="danger">{state.message}</Alert>}
            {result && (
              <Alert tone={result.situation === "Consulta cancelada" ? "warning" : "success"} title={`Situação: ${result.situation}`}>
                <p>
                  Consulta: <a href={`/consultas/${result.slug}`}>{result.consultationTitle}</a>
                </p>
                <p>Data da participação: {result.date.split("-").reverse().join("/")}</p>
                <p className="text-xs">
                  {result.situation === "Contabilizado"
                    ? "A participação foi incluída na apuração."
                    : result.situation === "Registrado"
                      ? "A participação está registrada e será contabilizada na apuração."
                      : "A consulta foi cancelada e os votos não foram apurados."}
                </p>
              </Alert>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}
