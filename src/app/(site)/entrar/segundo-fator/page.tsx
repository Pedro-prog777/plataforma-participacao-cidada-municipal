import Link from "next/link";
import { redirect } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { mfaAction } from "@/server/actions/auth";
import { sessionToken } from "@/server/auth/current";
import { getPendingMfaSession } from "@/server/modules/auth/session.service";
import { demoMode } from "@/server/lib/env";

export const metadata = { title: "Segundo fator" };

export default async function SegundoFatorPage() {
  const s = await getPendingMfaSession(await sessionToken());
  if (!s) redirect("/entrar");
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Verificação em duas etapas" description="Digite o código de 6 dígitos do aplicativo autenticador (TOTP) cadastrado na sua conta administrativa." />
        <Card>
          <ActionForm action={mfaAction}>
            <Field label="Código do autenticador" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-48" />
            <SubmitButton className="w-full">Confirmar</SubmitButton>
          </ActionForm>
        </Card>
        {demoMode() && (
          <Alert tone="info" className="mt-4" title="Demonstração">
            Os códigos das contas fictícias aparecem em <Link href="/demo">Contas e ferramentas de teste</Link>.
          </Alert>
        )}
      </div>
    </MainContainer>
  );
}
