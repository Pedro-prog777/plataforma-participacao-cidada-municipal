import { Alert, LinkButton, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Acesso negado" };

export default function AdminAcessoNegado() {
  return (
    <>
      <PageHeader title="Acesso negado" />
      <Alert tone="danger" title="Seu perfil não tem a permissão necessária">
        Nada foi alterado e a tentativa foi registrada na trilha de auditoria. Se precisar deste acesso, fale com o gestor de acessos.
      </Alert>
      <LinkButton href="/admin" className="mt-4">
        Voltar ao painel
      </LinkButton>
    </>
  );
}
