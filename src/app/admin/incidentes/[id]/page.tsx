import { notFound } from "next/navigation";
import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, RadioGroup, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, DescriptionList, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getIncident } from "@/server/modules/integrity/incidents.service";
import { incidentUpdateAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Incidente" };

export default async function IncidentePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("incidentes.tratar");
  const { id } = await params;
  const r = await getIncident(id).catch(() => null);
  if (!r) notFound();
  const i = r.i;
  return (
    <>
      <PageHeader title={`Incidente: ${i.type}`} eyebrow={<Badge tone={i.severity === "alta" ? "danger" : i.severity === "media" ? "warning" : "neutral"}>Severidade {i.severity}</Badge>} breadcrumbs={[{ href: "/admin/incidentes", label: "Incidentes" }, { label: i.type }]} />
      {i.suggestion && (
        <Alert tone="danger" className="mb-4" title="Sugestão do sistema">
          <RefText>{i.suggestion}</RefText> {i.consultationId && <LinkButton href={`/admin/consultas/${i.consultationId}/conducao`} variant="secondary" className="ml-2">Ir para a condução</LinkButton>}
        </Alert>
      )}
      {i.type === "cadastro_suspeito" && <Alert tone="info" className="mb-4">Se contas fraudulentas já votaram, como os votos não são vinculados às contas, decide-se publicamente entre manter o resultado e cancelar a consulta (RF034).</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <DescriptionList
            items={[
              { term: "Aberto em", detail: fmtDateTime(i.createdAt) },
              { term: "Situação", detail: i.status },
              { term: "Consulta", detail: r.consultation ?? "—" },
              { term: "Descrição", detail: i.description },
              { term: "Evidências", detail: <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(i.evidence, null, 2)}</pre> },
              ...(i.conclusion ? [{ term: "Conclusão", detail: i.conclusion }] : []),
              ...(i.closedAt ? [{ term: "Encerrado em", detail: fmtDateTime(i.closedAt) }] : []),
            ]}
          />
        </Card>
        {i.status !== "encerrado" && (
          <Card>
            <ActionForm action={incidentUpdateAction.bind(null, id)}>
              <RadioGroup legend="Atualizar" name="status" required options={[{ value: "em_analise", label: "Em análise" }, { value: "encerrado", label: "Encerrar com conclusão" }]} />
              <TextArea label="Conclusão (obrigatória para encerrar)" name="conclusion" rows={3} />
              <SubmitButton>Salvar</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
