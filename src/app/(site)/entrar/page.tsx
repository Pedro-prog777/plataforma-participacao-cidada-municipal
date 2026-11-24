import Link from "next/link";
import { redirect } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { LoginForm } from "@/components/login-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { loginAction } from "@/server/actions/auth";
import { getCurrentActor } from "@/server/auth/current";
import { getIdentityProvider } from "@/server/lib/identity-provider";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const sp = await searchParams;
  const actor = await getCurrentActor();
  if (actor) redirect(actor.kind === "admin" ? "/admin" : "/conta");
  let providerName = "";
  try {
    providerName = getIdentityProvider().name;
  } catch {
    providerName = "";
  }
  return (
    <MainContainer>
      <div className="mx-auto max-w-md">
        <PageHeader title="Entrar" description="Acesse com CPF ou e-mail e senha. Contas administrativas pedem também o código do aplicativo autenticador." />
        <Card className="space-y-5">
          <LoginForm action={loginAction} next={sp.proximo ?? ""} />
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link href="/recuperar-senha" className="font-semibold text-brand-700 underline">
              Esqueci minha senha
            </Link>
            <Link href="/cadastro" className="font-semibold text-brand-700 underline">
              Criar conta
            </Link>
          </div>
          {providerName && (
            <p className="border-t border-line pt-4 text-xs text-muted">
              Entrar com <strong>{providerName}</strong>: disponível depois do cadastro, na etapa de verificação de identidade.
            </p>
          )}
        </Card>
      </div>
    </MainContainer>
  );
}
