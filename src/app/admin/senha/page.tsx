import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { changePasswordAction } from "@/server/actions/citizen";

export const metadata = { title: "Alterar senha" };

export default function AdminSenhaPage() {
  return (
    <>
      <PageHeader title="Alterar senha" description="As demais sessões serão encerradas." />
      <Card className="max-w-lg">
        <ActionForm action={changePasswordAction}>
          <Field label="Senha atual" name="current" type="password" required autoComplete="current-password" />
          <Field label="Nova senha" name="password" type="password" required autoComplete="new-password" />
          <Field label="Confirme a nova senha" name="confirm" type="password" required autoComplete="new-password" />
          <SubmitButton>Alterar senha</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
