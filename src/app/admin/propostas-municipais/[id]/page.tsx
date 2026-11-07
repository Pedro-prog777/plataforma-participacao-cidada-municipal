import { notFound } from "next/navigation";
import { AttachmentForm } from "@/components/admin/attachment-form";
import { MunicipalProposalForm } from "@/components/admin/municipal-proposal-form";
import { AttachmentList } from "@/components/attachments";
import { Alert, Card, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getMunicipalProposal } from "@/server/modules/proposals/municipal-proposals.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { listAttachments } from "@/server/modules/attachments/attachments.service";
import { listVersions } from "@/server/modules/consultations/common";
import { attachmentAction, saveMunicipalProposalAction } from "@/server/actions/admin";
import { getDb } from "@/server/db/client";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Proposta municipal" };

export default async function PropostaMunicipalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("propostas_municipais.gerenciar");
  const { id } = await params;
  const p = await getMunicipalProposal(id).catch(() => null);
  if (!p) notFound();
  const [ref, files, versions] = await Promise.all([referenceData(), listAttachments("municipal_proposal", id), listVersions(getDb(), "municipal_proposal", id)]);
  const editable = ["rascunho", "rejeitada"].includes(p.status);
  return (
    <>
      <PageHeader
        title={p.title}
        description={`Versão ${p.version}`}
        breadcrumbs={[{ href: "/admin/propostas-municipais", label: "Propostas municipais" }, { label: p.title }]}
        actions={editable ? <LinkButton href={`/admin/consultas/nova?proposta=${p.id}`} icon="ballot">Criar consulta</LinkButton> : undefined}
      />
      {!editable && <Alert tone="info" className="mb-4">Proposta em análise ou em consulta: edição bloqueada (RF024).</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <MunicipalProposalForm
            action={saveMunicipalProposalAction.bind(null, p.id)}
            disabled={!editable}
            themes={ref.themes.map((t) => ({ value: t.id, label: t.name }))}
            organs={ref.organs.map((o) => ({ value: o.id, label: o.name }))}
            d={{ version: String(p.version), title: p.title, summary: p.summary, description: p.description, justification: p.justification, objectives: p.objectives, themeId: p.themeId ?? undefined, scope: p.scope, organId: p.organId ?? undefined, estimatedCost: p.estimatedCost?.replace(".", ",") ?? undefined, fundingSource: p.fundingSource ?? undefined, executionDeadline: p.executionDeadline ?? undefined }}
          />
        </Card>
        <div className="space-y-6">
          <Section title="Anexos">
            <AttachmentList items={files} />
            {editable && (
              <Card>
                <AttachmentForm action={attachmentAction.bind(null, "municipal_proposal", p.id, `/admin/propostas-municipais/${p.id}`)} published={false} />
              </Card>
            )}
          </Section>
          <Section title="Versões">
            <Table head={["Versão", "Motivo", "Data"]} rows={[...versions].reverse().map((v) => [`v${v.version}`, v.reason ?? "—", fmtDateTime(v.createdAt)])} />
          </Section>
        </div>
      </div>
    </>
  );
}
