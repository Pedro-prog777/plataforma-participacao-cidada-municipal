import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { unsubscribeAction } from "./action";

export const metadata = { title: "Descadastrar aviso" };

/** Descadastro pelo link do e-mail, sem login (RF052). Confirmação por clique para evitar pré-visualizadores. */
export default async function DescadastrarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Deixar de receber este aviso" />
        <Card>
          {t ? (
            <ActionForm action={unsubscribeAction.bind(null, t)}>
              <p>Você deixará de receber este tipo de aviso por e-mail. Avisos obrigatórios (segurança da conta e comprovantes) continuam sendo enviados.</p>
              <SubmitButton>Confirmar descadastro</SubmitButton>
            </ActionForm>
          ) : (
            <Alert tone="danger">Link inválido.</Alert>
          )}
        </Card>
      </div>
    </MainContainer>
  );
}
