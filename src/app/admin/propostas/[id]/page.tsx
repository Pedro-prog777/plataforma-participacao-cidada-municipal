import { RefText } from "@/components/requisitos/ref-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, DescriptionList, PageHeader, Section, Timeline } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getProposalAdmin } from "@/server/modules/proposals/citizen-proposals.service";
import { analyzeAction } from "@/server/actions/admin";
import { CITIZEN_PROPOSAL_STATUS, fmtDateTime, PROPOSAL_RESPONSE } from "@/lib/labels";

export const metadata = { title: "Análise de proposta" };

export default async function AnaliseProposta({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("propostas_cidadas.analisar");
  const { id } = await params;
  const d = await getProposalAdmin(id).catch(() => null);
  if (!d) notFound();
  const p = d.p;
  const act = analyzeAction.bind(null, id);
  return (
    <>
      <PageHeader
        title={p.title}
        eyebrow={<Badge tone={CITIZEN_PROPOSAL_STATUS[p.status].tone}>{CITIZEN_PROPOSAL_STATUS[p.status].label}</Badge>}
        description={`Protocolo ${p.protocol} · recebida em ${fmtDateTime(p.createdAt)}`}
        breadcrumbs={[{ href: "/admin/propostas", label: "Propostas cidadãs" }, { label: p.protocol }]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <DescriptionList
              items={[
                { term: "Autor (visível só à administração)", detail: `${d.author} — ${d.authorEmail}` },
                { term: "Problema", detail: <span className="prose-civic">{p.problem}</span> },
                { term: "Solução sugerida", detail: <span className="prose-civic">{p.solution}</span> },
                { term: "Tema / bairro", detail: `${d.theme} · ${d.district}` },
                { term: "Autoriza publicação", detail: p.authorizePublication ? "Sim" : "Não" },
                { term: "Anexos", detail: d.files.length ? d.files.map((f) => <a key={f.id} href={`/api/anexos/${f.id}`} className="mr-2 font-semibold text-brand-700 underline">{f.title}</a>) : "—" },
                { term: "Apoios", detail: d.supports },
                ...(p.responseText ? [{ term: "Resposta", detail: `${PROPOSAL_RESPONSE[p.responseType as keyof typeof PROPOSAL_RESPONSE]}: ${p.responseText}` }] : []),
                ...(p.municipalProposalId ? [{ term: "Proposta municipal vinculada", detail: <Link href={`/admin/propostas-municipais/${p.municipalProposalId}`} className="font-semibold text-brand-700 underline">abrir</Link> }] : []),
              ]}
            />
          </Card>
          <Section title="Histórico">
            <Timeline items={d.events.map((e) => ({ date: fmtDateTime(e.createdAt), title: CITIZEN_PROPOSAL_STATUS[e.status].label, body: e.note }))} />
          </Section>
        </div>
        <Card className="space-y-4 self-start">
          <h2 className="font-bold"><RefText>Análise (RN30)</RefText></h2>
          {p.hidden && <Alert tone="warning">Conteúdo oculto por denúncias; siga a moderação (RF066).</Alert>}
          {p.status === "recebida" && (
            <ActionForm action={act}>
              <input type="hidden" name="action" value="iniciar_analise" />
              <SubmitButton>Iniciar análise</SubmitButton>
            </ActionForm>
          )}
          {p.status === "em_analise" && (
            <>
              <ActionForm action={act} className="rounded-xl border border-line p-3">
                <input type="hidden" name="action" value="responder" />
                <SelectField label="Resposta" name="responseType" required placeholder="Selecione" options={Object.entries(PROPOSAL_RESPONSE).map(([value, label]) => ({ value, label }))} />
                <TextArea label="Justificativa ao autor" name="responseText" required rows={3} />
                <SubmitButton>Responder</SubmitButton>
                <p className="text-xs text-muted">“Convertida” cria automaticamente uma proposta municipal vinculada em Rascunho.</p>
              </ActionForm>
              <ActionForm action={act} className="rounded-xl border border-line p-3">
                <input type="hidden" name="action" value="solicitar_ajuste" />
                <TextArea label="Orientação para o ajuste" name="guidance" required rows={2} />
                <SubmitButton variant="secondary">Solicitar ajuste</SubmitButton>
              </ActionForm>
            </>
          )}
          {p.status === "respondida" && p.authorizePublication && (
            <ActionForm action={act}>
              <input type="hidden" name="action" value="publicar" />
              <SubmitButton variant="civic">Publicar no portal (sem dados do autor)</SubmitButton>
            </ActionForm>
          )}
          {p.status !== "encerrada" && (
            <ActionForm action={act} className="rounded-xl border border-line p-3">
              <input type="hidden" name="action" value="encerrar" />
              <TextArea label="Justificativa do encerramento" name="justification" required rows={2} />
              <SubmitButton variant="secondary">Encerrar</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
