import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { ActionForm, Field, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, Section } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { listPublicOutcomes, referenceData } from "@/server/modules/consultations/queries.service";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { outcomeAction, outcomeStatusAction } from "@/server/actions/admin";
import { fmtDate, fmtDateTime, OUTCOME_STATUS } from "@/lib/labels";

export const metadata = { title: "Encaminhamentos" };

const STATUS_OPTS = Object.entries(OUTCOME_STATUS).map(([value, v]) => ({ value, label: v.label }));

export default async function AdminEncaminhamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [data, outcomes, ref, roles] = await Promise.all([getAdminConsultation(id), listPublicOutcomes({ consultationId: id }), referenceData(), consultationRolesOf(a.id, id)]);
  const can = roles.includes("encaminhamentos") && data.c.status === "finalizada";
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <Section title="Encaminhamentos registrados" description="Cada atualização gera um novo estado datado; o anterior permanece.">
        {outcomes.map((o) => (
          <Card key={o.o.id} className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {o.current && <Badge tone={OUTCOME_STATUS[o.current.status].tone}>{OUTCOME_STATUS[o.current.status].label}</Badge>}
              <span className="text-sm text-muted">{o.organ}</span>
            </div>
            <p className="font-semibold">{o.o.decision}</p>
            <p className="text-sm">{o.o.actions}</p>
            <ul className="text-xs text-muted">
              {o.entries.map((e) => (
                <li key={e.id}>
                  {fmtDateTime(e.createdAt)} — {OUTCOME_STATUS[e.status].label}
                  {e.expectedDate && ` (prevista ${fmtDate(e.expectedDate)})`}
                  {e.justification && ` — ${e.justification}`}
                </li>
              ))}
            </ul>
            {can && (
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand-700">Atualizar situação</summary>
                <ActionForm action={outcomeStatusAction.bind(null, id, o.o.id)} className="mt-2">
                  <SelectField label="Nova situação" name="status" required options={STATUS_OPTS} />
                  <TextArea label="Justificativa (obrigatória se Não realizada)" name="justification" rows={2} />
                  <Field label="Data prevista" name="expectedDate" type="date" />
                  <SubmitButton variant="secondary">Atualizar</SubmitButton>
                </ActionForm>
              </details>
            )}
          </Card>
        ))}
        {!outcomes.length && <p className="text-muted">Nenhum encaminhamento registrado até {fmtDate(new Date())}.</p>}
      </Section>
      <Card className="space-y-3">
        <h2 className="font-bold">Novo encaminhamento</h2>
        {!can ? (
          <Alert tone="neutral">{data.c.status !== "finalizada" ? "Disponível após a publicação do resultado final." : "Cabe a quem tem o papel “Encaminhamentos” nesta consulta."}</Alert>
        ) : (
          <ActionForm action={outcomeAction.bind(null, id)}>
            <TextArea label="Decisão relacionada" name="decision" required rows={2} />
            <TextArea label="Providências" name="actions" required rows={3} />
            <SelectField label="Órgão responsável" name="organId" required placeholder="Selecione" options={ref.organs.map((o) => ({ value: o.id, label: o.name }))} />
            <SelectField label="Situação" name="status" required options={STATUS_OPTS} />
            <TextArea label="Justificativa (obrigatória se Não realizada)" name="justification" rows={2} />
            <Field label="Data prevista" name="expectedDate" type="date" />
            <SubmitButton>Registrar e publicar</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
