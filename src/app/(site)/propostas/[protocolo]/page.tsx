import { notFound } from "next/navigation";
import { CommentsSection } from "@/components/comments";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, PageHeader, Section } from "@/components/ui/primitives";
import { getCurrentActor } from "@/server/auth/current";
import { getPublishedProposal } from "@/server/modules/proposals/citizen-proposals.service";
import { getSetting } from "@/server/lib/settings";
import { reportAction, supportAction } from "@/server/actions/citizen";
import { fmtDate, PROPOSAL_RESPONSE, REPORT_REASONS } from "@/lib/labels";

export const metadata = { title: "Proposta cidadã" };

export default async function PropostaPage({ params }: { params: Promise<{ protocolo: string }> }) {
  const { protocolo } = await params;
  const p = await getPublishedProposal(decodeURIComponent(protocolo));
  if (!p) notFound();
  const actor = await getCurrentActor();
  const [supportsOn, commentsOn, goal] = await Promise.all([getSetting("recursos.apoios"), getSetting("recursos.comentarios"), getSetting("apoios.meta")]);
  const back = `/propostas/${p.protocol}`;
  return (
    <MainContainer>
      <PageHeader
        breadcrumbs={[{ href: "/propostas", label: "Propostas" }, { label: p.protocol }]}
        eyebrow={
          <span className="flex flex-wrap gap-2">
            {p.theme && <Badge tone="primary">{p.theme}</Badge>}
            {p.priority && <Badge tone="warning">Análise prioritária</Badge>}
          </span>
        }
        title={p.title}
        description={`Protocolo ${p.protocol} · ${p.district} · enviada em ${fmtDate(p.createdAt)} · publicada em ${fmtDate(p.publishedAt)}`}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <Section title="Problema">
            <p className="prose-civic">{p.problem}</p>
          </Section>
          <Section title="Solução sugerida">
            <p className="prose-civic">{p.solution}</p>
          </Section>
          <Section title="Resposta da Prefeitura">
            <Card className="border-brand-200 bg-brand-50">
              {p.responseType && <Badge tone="success">{PROPOSAL_RESPONSE[p.responseType as keyof typeof PROPOSAL_RESPONSE]}</Badge>}
              <p className="prose-civic mt-2">{p.responseText}</p>
            </Card>
          </Section>
          {commentsOn && <CommentsSection targetType="citizen_proposal" targetId={p.id} back={back} canPost={actor?.kind === "cidadao"} />}
        </div>
        <aside className="space-y-4">
          {supportsOn && (
            <Card className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Apoios (recurso condicionado *)</p>
              <p className="text-3xl font-bold tabular-nums text-brand-900">{p.supports}</p>
              {goal > 0 && <p className="text-sm text-muted">Meta para análise prioritária: {goal} apoios no prazo definido.</p>}
              <p className="text-xs text-muted">Apoio não é voto nem subscrição de iniciativa popular.</p>
              {actor?.kind === "cidadao" ? (
                <ActionForm action={supportAction.bind(null, p.id, p.protocol)}>
                  <SubmitButton variant="civic" className="w-full">
                    Apoiar esta proposta
                  </SubmitButton>
                </ActionForm>
              ) : (
                <Alert tone="neutral">Entre com conta de cidadão para apoiar.</Alert>
              )}
            </Card>
          )}
          <Card>
            <details>
              <summary className="cursor-pointer font-semibold text-muted">Denunciar conteúdo</summary>
              {actor ? (
                <ActionForm action={reportAction.bind(null, "citizen_proposal", p.id, back)} className="mt-3">
                  <SelectField label="Motivo" name="reason" required placeholder="Selecione" options={Object.entries(REPORT_REASONS).map(([value, label]) => ({ value, label }))} />
                  <TextArea label="Detalhes" name="details" rows={2} />
                  <SubmitButton variant="secondary">Enviar denúncia</SubmitButton>
                </ActionForm>
              ) : (
                <p className="mt-2 text-sm">Entre para denunciar. Sua identidade não é revelada ao autor.</p>
              )}
            </details>
          </Card>
        </aside>
      </div>
    </MainContainer>
  );
}
