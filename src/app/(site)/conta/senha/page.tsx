import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { changePasswordAction } from "@/server/actions/citizen";

export const metadata = { title: "Alterar senha" };

export default function SenhaPage() {
  return (
    <>
      <PageHeader title="Alterar senha" description="Ao alterar, as demais sessões são encerradas e você recebe uma confirmação por e-mail." breadcrumbs={[{ href: "/conta", label: "Meu perfil" }, { label: "Alterar senha" }]} />
      <Card className="max-w-lg">
        <ActionForm action={changePasswordAction}>
          <Field label="Senha atual" name="current" type="password" required autoComplete="current-password" />
          <Field label="Nova senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números; diferente do CPF, nascimento e e-mail." />
          <Field label="Confirme a nova senha" name="confirm" type="password" required autoComplete="new-password" />
          <SubmitButton>Alterar senha</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
