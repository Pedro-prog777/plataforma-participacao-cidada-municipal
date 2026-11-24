/**
 * PROVEDOR DE IDENTIDADE SIMULADO — demonstração acadêmica.
 * Não reproduz marca, layout ou endereço do gov.br. Representa o retorno de um provedor OIDC
 * com CPF e nível de confiabilidade, para exercitar as regras do RF004.
 */
import { notFound } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, RadioGroup, SubmitButton } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { simulatedProviderReturnAction } from "@/server/actions/citizen";
import { requireCitizen } from "@/server/auth/current";
import { demoMode, env } from "@/server/lib/env";

export const metadata = { title: "Login gov.br simulado" };

export default async function ProvedorPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (!demoMode()) notFound();
  await requireCitizen("/conta/verificacao");
  const { state = "" } = await searchParams;
  return (
    <MainContainer>
      <div className="mx-auto max-w-xl">
        <PageHeader title="Login gov.br (simulado)" description="Ambiente de demonstração: informe os dados que o provedor real devolveria após o login." />
        <Alert tone="warning" className="mb-4" title="Isto não é o gov.br">
          A integração oficial exige credenciamento no Login Único. Aqui você simula o retorno: CPF da conta no provedor e nível de confiabilidade (é exigido nível prata ou ouro).
        </Alert>
        <Card>
          <ActionForm action={simulatedProviderReturnAction}>
            <input type="hidden" name="state" value={state} />
            <Field label="CPF da conta no provedor" name="cpf" required inputMode="numeric" hint="Para aprovar, use o mesmo CPF do seu cadastro. Um CPF diferente gera recusa registrada na auditoria." />
            <RadioGroup
              legend="Nível da conta"
              name="level"
              required
              defaultValue="prata"
              options={[
                { value: "bronze", label: "Bronze", description: "Cadastro autodeclarado — insuficiente." },
                { value: "prata", label: "Prata", description: "Validação biométrica ou bancária." },
                { value: "ouro", label: "Ouro", description: "Certificado digital ou biometria TSE." },
              ]}
            />
            <Field label="Município de residência informado (opcional)" name="residenceCity" defaultValue={env.municipio} hint="Quando coincide com o município e há bairro no cadastro, o domicílio também é considerado comprovado (simulação)." />
            <SubmitButton>Autorizar e voltar à plataforma</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </MainContainer>
  );
}
