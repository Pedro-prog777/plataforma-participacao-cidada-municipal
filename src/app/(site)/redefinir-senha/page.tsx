import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Definir nova senha" />
        <Card>
          {!token ? (
            <div className="space-y-3">
              <Alert tone="danger">Link inválido. Solicite um novo.</Alert>
              <LinkButton href="/recuperar-senha">Solicitar novo link</LinkButton>
            </div>
          ) : (
            <ActionForm action={resetPasswordAction}>
              <input type="hidden" name="token" value={token} />
              <Field label="Nova senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
              <Field label="Confirme a nova senha" name="passwordConfirm" type="password" required autoComplete="new-password" />
              <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
              <p className="text-xs text-muted">Ao salvar, todas as sessões abertas serão encerradas.</p>
            </ActionForm>
          )}
        </Card>
      </div>
    </MainContainer>
  );
}
