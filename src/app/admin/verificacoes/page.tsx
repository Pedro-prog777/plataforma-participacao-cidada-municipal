import { ActionForm, Checkbox, RadioGroup, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { listPendingVerifications, verificationDocuments } from "@/server/modules/identity/identity.service";
import { verificationDecisionAction } from "@/server/actions/admin";
import { fmtDate, fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Verificação de identidade" };

export default async function VerificacoesPage() {
  await requireAdmin("identidade.analisar");
  const pending = await listPendingVerifications();
  const docs = await Promise.all(pending.map((p) => verificationDocuments(p.v.id)));
  return (
    <>
      <PageHeader title="Verificação documental de identidade" description="Documentos com acesso restrito. Aprove ou recuse com motivo. Não é permitido analisar o próprio pedido." />
      {!pending.length && <Alert tone="neutral">Nenhum pedido em análise.</Alert>}
      <div className="space-y-4">
        {pending.map((p, i) => (
          <Card key={p.v.id} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <DescriptionList
                items={[
                  { term: "Titular", detail: p.name },
                  { term: "CPF", detail: p.cpfMasked },
                  { term: "Bairro declarado", detail: p.district ?? p.externalCity ?? "—" },
                  { term: "Enviado em", detail: fmtDateTime(p.v.createdAt) },
                  { term: "Comprovante de residência", detail: p.v.includesAddressProof ? "Declarado como incluído" : "Não" },
                  ...(p.v.requestedChanges ? [{ term: "Correção pedida", detail: `${p.v.requestedChanges.fullName ? `Nome: ${p.v.requestedChanges.fullName}. ` : ""}${p.v.requestedChanges.birthDate ? `Nascimento: ${fmtDate(p.v.requestedChanges.birthDate)}` : ""}` }] : []),
                ]}
              />
              <ul className="space-y-1 text-sm">
                {docs[i].map((d) => (
                  <li key={d.id}>
                    <a href={`/api/anexos/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                      {d.title}
                    </a>{" "}
                    <span className="text-muted">({d.mime})</span>
                  </li>
                ))}
              </ul>
            </div>
            <ActionForm action={verificationDecisionAction.bind(null, p.v.id)}>
              <RadioGroup legend="Decisão" name="decision" required options={[{ value: "aprovar", label: "Aprovar" }, { value: "recusar", label: "Recusar" }]} />
              {p.v.includesAddressProof && <Checkbox name="confirmAddress" label="O comprovante confirma domicílio no município" />}
              <TextArea label="Motivo (obrigatório na recusa)" name="reason" rows={2} />
              <SubmitButton>Registrar decisão</SubmitButton>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
