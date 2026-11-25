import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { confirmEmailAction } from "@/server/actions/auth";

export const metadata = { title: "Confirmar e-mail" };

/** A confirmação exige um clique (POST): evita que pré-visualizadores de link consumam o token de uso único. */
export default async function ConfirmarEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Confirmar e-mail" />
        <Card className="space-y-4">
          {token ? (
            <ActionForm action={confirmEmailAction.bind(null, token)}>
              <p>Clique para confirmar a posse do e-mail e ativar sua conta.</p>
              <SubmitButton className="w-full">Confirmar e-mail</SubmitButton>
            </ActionForm>
          ) : (
            <Alert tone="danger">Link inválido.</Alert>
          )}
          <p className="text-sm">
            Link expirado? <LinkButton href="/reenviar-confirmacao" variant="ghost" className="min-h-0! px-1!">Reenviar confirmação</LinkButton>
          </p>
        </Card>
      </div>
    </MainContainer>
  );
}
