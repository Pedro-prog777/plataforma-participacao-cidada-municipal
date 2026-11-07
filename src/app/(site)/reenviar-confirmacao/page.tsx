import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { resendConfirmationAction } from "@/server/actions/auth";

export const metadata = { title: "Reenviar confirmação" };

export default function ReenviarPage() {
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Reenviar link de confirmação" description="Limite de 3 reenvios por hora." />
        <Card>
          <ActionForm action={resendConfirmationAction}>
            <Field label="E-mail cadastrado" name="email" type="email" required autoComplete="email" />
            <SubmitButton className="w-full">Reenviar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </MainContainer>
  );
}
