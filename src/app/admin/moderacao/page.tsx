import { ActionForm, RadioGroup, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, PageHeader, Section } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { moderationQueue } from "@/server/modules/moderation/moderation.service";
import { moderateAction } from "@/server/actions/admin";
import { fmtDateTime, REPORT_REASONS } from "@/lib/labels";

export const metadata = { title: "Moderação" };

const DECISIONS = [
  { value: "manter", label: "Manter", description: "Conteúdo de acordo com a política de uso." },
  { value: "ocultar_trecho", label: "Ocultar trecho", description: "Ex.: dados pessoais expostos — informe o texto já editado." },
  { value: "remover", label: "Remover" },
];

export default async function ModeracaoPage() {
  await requireAdmin("moderacao.moderar");
  const { items, reviewItems } = await moderationQueue();
  return (
    <>
      <PageHeader title="Fila de moderação" description="Priorizada por motivo (conteúdo ilegal, ódio, dados pessoais...). A moderação nunca atua sobre votos, participações ou resultados (RN39). Denunciantes não são revelados ao autor." />
      <Alert tone="info" className="mb-6">Comentários e apoios são recursos condicionados à validação (*); propostas publicadas podem ser denunciadas sempre.</Alert>
      {reviewItems.length > 0 && (
        <Section title="Pedidos de revisão (decisão definitiva por outro moderador)" className="mb-8">
          {reviewItems.map(({ decision, content }) => (
            <Card key={decision.id} className="mb-3 space-y-3 border-amber-300">
              <p className="text-sm">
                Decisão anterior: <strong>{decision.decision}</strong> — {decision.justification}
              </p>
              <p className="text-sm">Motivo do pedido: {decision.reviewRequestReason}</p>
              <p className="prose-civic rounded-lg bg-brand-50 p-3 text-sm">{content?.text}</p>
              <ActionForm action={moderateAction.bind(null, decision.targetType as "comment", decision.targetId)}>
                <RadioGroup legend="Decisão definitiva" name="decision" required options={DECISIONS} />
                <TextArea label="Texto com trecho ocultado (se aplicável)" name="redactedText" rows={2} defaultValue={content?.text} />
                <TextArea label="Justificativa (política de uso)" name="justification" required rows={2} />
                <SubmitButton>Decidir em definitivo</SubmitButton>
              </ActionForm>
            </Card>
          ))}
        </Section>
      )}
      <Section title="Conteúdos denunciados">
        {items.map((g) => (
          <Card key={`${g.targetType}:${g.targetId}`} className="mb-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{g.targetType === "comment" ? "Comentário" : "Proposta"}</Badge>
              {Object.entries(g.reasons).map(([r, n]) => (
                <Badge key={r} tone={r === "conteudo_ilegal" || r === "discurso_odio" ? "danger" : "warning"}>
                  {REPORT_REASONS[r as keyof typeof REPORT_REASONS]} ({n})
                </Badge>
              ))}
              {content(g.content?.status)}
              <span className="text-xs text-muted">primeira denúncia em {fmtDateTime(g.first)}</span>
            </div>
            <p className="font-semibold">{g.content?.title}</p>
            <p className="prose-civic rounded-lg bg-brand-50 p-3 text-sm">{g.content?.text}</p>
            <ActionForm action={moderateAction.bind(null, g.targetType as "comment", g.targetId)}>
              <RadioGroup legend="Decisão" name="decision" required options={DECISIONS} />
              <TextArea label="Texto com trecho ocultado (se aplicável)" name="redactedText" rows={2} defaultValue={g.content?.text} />
              <TextArea label="Justificativa (política de uso)" name="justification" required rows={2} />
              <SubmitButton>Aplicar decisão</SubmitButton>
            </ActionForm>
          </Card>
        ))}
        {!items.length && <p className="text-muted">Nenhuma denúncia pendente.</p>}
      </Section>
    </>
  );
}

function content(status?: string) {
  if (status === "oculto") return <Badge tone="danger">Oculto preventivamente</Badge>;
  return null;
}
