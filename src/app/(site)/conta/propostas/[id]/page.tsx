import { notFound } from "next/navigation";
import { ProposalFields } from "@/components/proposal-fields";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, DescriptionList, PageHeader, Section, Timeline } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { getProposalForAuthor } from "@/server/modules/proposals/citizen-proposals.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { resubmitProposalAction } from "@/server/actions/citizen";
import { CITIZEN_PROPOSAL_STATUS, fmtDateTime, PROPOSAL_RESPONSE } from "@/lib/labels";

export const metadata = { title: "Acompanhar proposta" };

const STEPS = ["recebida", "em_analise", "respondida", "publicada", "encerrada"] as const;

export default async function AcompanharPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireCitizen("/conta/propostas");
  const { id } = await params;
  // Somente o autor acessa (RF009); para outros usuários a proposta "não existe".
  const data = await getProposalForAuthor(a.id, id);
  if (!data) notFound();
  const { p } = data;
  const ref = p.status === "ajuste_solicitado" ? await referenceData() : null;
  const reached = new Set(data.events.map((e) => e.status));
  return (
    <>
      <PageHeader
        title={p.title}
        eyebrow={<Badge tone={CITIZEN_PROPOSAL_STATUS[p.status].tone}>{CITIZEN_PROPOSAL_STATUS[p.status].label}</Badge>}
        description={`Protocolo ${p.protocol}`}
        breadcrumbs={[{ href: "/conta/propostas", label: "Minhas propostas" }, { label: p.protocol }]}
      />
      <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Andamento">
        {STEPS.map((s) => (
          <li key={s} className={`rounded-full px-3 py-1 font-semibold ${reached.has(s) ? "bg-brand-700 text-white" : "bg-white text-muted ring-1 ring-line"}`}>
            {CITIZEN_PROPOSAL_STATUS[s].label}
          </li>
        ))}
      </ol>
      {p.status === "ajuste_solicitado" && ref && (
        <Card className="mb-6 space-y-4 border-amber-300">
          <Alert tone="warning" title="A Prefeitura pediu um ajuste">
            <p>{p.adjustmentGuidance}</p>
            <p>Prazo: até {fmtDateTime(p.adjustmentDeadline)}. Sem retorno no prazo, a proposta é encerrada.</p>
          </Alert>
          <ActionForm action={resubmitProposalAction.bind(null, p.id)}>
            <ProposalFields
              themes={ref.themes.map((t) => ({ value: t.id, label: t.name }))}
              districts={ref.districts.map((d) => ({ value: d.id, label: d.name }))}
              defaults={{ title: p.title, problem: p.problem, solution: p.solution, themeId: p.themeId, districtId: p.districtId, authorizePublication: p.authorizePublication ? "sim" : "nao" }}
            />
            <SubmitButton>Enviar ajustes</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {p.responseText && (
        <Alert tone="success" className="mb-6" title={`Resposta: ${PROPOSAL_RESPONSE[p.responseType as keyof typeof PROPOSAL_RESPONSE] ?? ""}`}>
          {p.responseText}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <DescriptionList
            items={[
              { term: "Problema", detail: <span className="prose-civic">{p.problem}</span> },
              { term: "Solução sugerida", detail: <span className="prose-civic">{p.solution}</span> },
              { term: "Tema", detail: data.theme },
              { term: "Região ou bairro", detail: data.district },
              { term: "Publicação autorizada", detail: p.authorizePublication ? "Sim" : "Não" },
              { term: "Anexos", detail: data.files.length ? data.files.map((f) => f.title).join(", ") : "—" },
              { term: "Enviada em", detail: fmtDateTime(p.createdAt) },
            ]}
          />
        </Card>
        <Section title="Histórico">
          <Timeline items={data.events.map((e) => ({ date: fmtDateTime(e.createdAt), title: CITIZEN_PROPOSAL_STATUS[e.status].label, body: e.note }))} />
        </Section>
      </div>
    </>
  );
}
