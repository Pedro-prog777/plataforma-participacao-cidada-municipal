import { notFound } from "next/navigation";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, PageHeader, Section, Table } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { getProfile } from "@/server/modules/profile/profile.service";
import { myVerifications } from "@/server/modules/identity/identity.service";
import { startIdentityProviderAction, submitDocumentsAction } from "@/server/actions/citizen";
import { getIdentityProvider } from "@/server/lib/identity-provider";
import { fmtDateTime, VERIFICATION_LEVEL } from "@/lib/labels";

export const metadata = { title: "Verificação de identidade" };

export default async function VerificacaoPage() {
  const a = await requireCitizen("/conta/verificacao");
  const [p, history] = await Promise.all([getProfile(a.id), myVerifications(a.id)]);
  if (!p) notFound();
  let provider: { name: string; simulated: boolean } | null = null;
  try {
    const ip = getIdentityProvider();
    provider = { name: ip.name, simulated: ip.simulated };
  } catch {
    provider = null;
  }
  const verified = p.verificationLevel === "verificado";
  const pending = history.some((h) => h.status === "em_analise");
  return (
    <>
      <PageHeader
        title="Verificação de identidade e domicílio"
        description="Comprove que você é titular do CPF e, quando a consulta exigir, que mora no município. A verificação é necessária para votar e enviar propostas."
        eyebrow={<Badge tone={VERIFICATION_LEVEL[p.verificationLevel].tone}>{VERIFICATION_LEVEL[p.verificationLevel].label}</Badge>}
      />
      {verified && (
        <Alert tone="success" className="mb-6" title="Identidade verificada">
          {p.domicileVerifiedAt ? "Seu domicílio no município também está comprovado." : "Para consultas restritas a moradores, comprove o domicílio enviando um comprovante de residência abaixo."}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Opção 1 — Conta gov.br</h2>
          <p className="text-sm text-muted">Mais rápido: entre com a sua conta gov.br (nível prata ou ouro). O sistema confere se o CPF é o mesmo do cadastro.</p>
          {provider?.simulated && (
            <Alert tone="warning" title="Demonstração">
              Nesta demonstração, a entrada com gov.br é simulada: nenhum dado é enviado ao gov.br de verdade.
            </Alert>
          )}
          {provider && !(verified && p.domicileVerifiedAt) ? (
            <form action={startIdentityProviderAction}>
              <button className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Continuar com gov.br</button>
            </form>
          ) : (
            !provider && <Alert tone="neutral">A entrada com gov.br está indisponível no momento. Use a verificação por documentos.</Alert>
          )}
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Opção 2 — Análise de documentos</h2>
          <p className="text-sm text-muted">Envie documento com foto e, se quiser comprovar domicílio, um comprovante de residência. Um atendente da Prefeitura analisa e aprova ou recusa, sempre explicando o motivo.</p>
          {pending ? (
            <Alert tone="info">Você já tem documentos em análise. Aguarde a decisão.</Alert>
          ) : (
            <ActionForm action={submitDocumentsAction}>
              <div className="space-y-1.5">
                <label htmlFor="files" className="block text-sm font-semibold">
                  Documentos (PDF, JPG ou PNG, até 5 MB cada, no máximo 4) <span className="text-bad-700">*</span>
                </label>
                <input id="files" name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:font-semibold file:text-brand-800" />
              </div>
              <Checkbox name="includesAddressProof" label="Incluí comprovante de residência no município" />
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-brand-700">Pedir correção de nome civil ou data de nascimento</summary>
                <div className="mt-3 space-y-3">
                  <Field label="Nome civil correto" name="fullName" />
                  <Field label="Data de nascimento correta" name="birthDate" mask="data" inputMode="numeric" placeholder="DD/MM/AAAA" />
                </div>
              </details>
              <SubmitButton>Enviar para análise</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
      <Section title="Histórico de verificações" className="mt-8">
        <Table
          head={["Data", "Método", "Situação", "Motivo"]}
          rows={history.map((h) => [fmtDateTime(h.createdAt), h.method === "govbr" ? "Conta gov.br" : "Documentos", h.status === "aprovada" ? <Badge key="a" tone="success">Aprovada</Badge> : h.status === "recusada" ? <Badge key="r" tone="danger">Recusada</Badge> : <Badge key="e" tone="info">Em análise</Badge>, h.reason ?? "—"])}
          empty="Nenhuma verificação realizada."
        />
      </Section>
    </>
  );
}
