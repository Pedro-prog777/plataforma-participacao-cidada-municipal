/** Ferramentas da DEMONSTRAÇÃO ACADÊMICA. Indisponível fora do DEMO_MODE. */
import { notFound } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Card, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { demoMode } from "@/server/lib/env";
import { DEMO_ADMINS, DEMO_CITIZENS, DEMO_PASSWORD } from "@database/seeds/seed-demo";
import { totp } from "@/server/lib/totp";
import { ROLE_LABELS } from "./roles";

export const metadata = { title: "Demonstração" };

export default function DemoPage() {
  if (!demoMode()) notFound();
  return (
    <MainContainer>
      <PageHeader title="Contas e ferramentas de demonstração" description="Esta página só existe na versão de demonstração. Todas as contas e dados são fictícios." />
      <Alert tone="warning" title="Não use estas credenciais fora da demonstração">
        Senha de todas as contas: <code className="font-bold">{DEMO_PASSWORD}</code>. Os códigos do aplicativo autenticador (segundo fator) mudam a cada 30 segundos — recarregue a página.
      </Alert>
      <Section title="Cidadãos" className="mt-8">
        <Table
          head={["Conta", "E-mail", "Situação"]}
          rows={[
            ...DEMO_CITIZENS.map((c) => [c.name, <code key="e">{c.email}</code>, c.verified ? "Ativa e verificada" : "Ativa, identidade não verificada"]),
            ["Ana Pendente (fictícia)", <code key="a">ana@exemplo.com</code>, "Pendente de confirmação de e-mail"],
          ]}
        />
      </Section>
      <Section title="Contas administrativas (com segundo fator)" className="mt-8">
        <Table
          head={["Conta", "E-mail", "Papéis", "Código do autenticador agora"]}
          rows={DEMO_ADMINS.map((a) => [a.name, <code key="e">{a.email}</code>, a.roles.map((r) => ROLE_LABELS[r] ?? r).join(", "), <code key="t" className="text-lg font-bold tracking-widest">{totp(a.totp)}</code>])}
        />
      </Section>
      <Section title="Serviços simulados" className="mt-8">
        <Card className="flex flex-wrap gap-3">
          <LinkButton href="/demo/caixa-de-email" icon="bell">
            Caixa de e-mail de teste
          </LinkButton>
          <LinkButton href="/conta/verificacao" variant="secondary" icon="shield">
            Login gov.br simulado
          </LinkButton>
        </Card>
      </Section>
    </MainContainer>
  );
}
