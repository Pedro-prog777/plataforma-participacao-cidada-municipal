import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requestResetAction } from "@/server/actions/auth";

export const metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Recuperar senha" description="Informe seu CPF ou e-mail. Se houver conta, enviaremos um link de uso único válido por 30 minutos." breadcrumbs={[{ href: "/entrar", label: "Entrar" }, { label: "Recuperar senha" }]} />
        <Card>
          <ActionForm action={requestResetAction}>
            <Field label="CPF ou e-mail" name="identifier" required autoComplete="username" />
            <SubmitButton className="w-full">Enviar link</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </MainContainer>
  );
}
