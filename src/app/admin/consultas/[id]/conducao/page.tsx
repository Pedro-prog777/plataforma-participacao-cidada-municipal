import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, Checkbox, Field, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { alterPublishedAction, cancelAction, closeSuspendedAction, publishAction, resumeAction, suspendAction, unscheduleAction } from "@/server/actions/admin";
import { fmtDateTime, toLocalInput } from "@/lib/labels";

export const metadata = { title: "Condução" };

const FIELDS = [
  { value: "summary", label: "Resumo" },
  { value: "problem", label: "Problema" },
  { value: "objective", label: "Objetivo" },
  { value: "justification", label: "Justificativa" },
  { value: "guidance", label: "Orientações" },
  { value: "nextSteps", label: "Próximos passos" },
];

export default async function ConducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const c = data.c;
  const roles = await consultationRolesOf(a.id, id);
  const isResp = roles.includes("responsavel");
  const now = new Date();
  if (!isResp) return <Alert tone="neutral">As ações de condução cabem ao responsável designado pela consulta.</Alert>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {c.status === "aprovada" && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Publicar consulta</h2>
          <p className="text-sm">A consulta ficará pública como Agendada, com endereço permanente e contagem regressiva. Abertura automática em {fmtDateTime(c.opensAt)}. Os interessados serão avisados.</p>
          <ActionForm action={publishAction.bind(null, id)}>
            <SubmitButton variant="civic">Publicar e agendar</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {c.status === "agendada" && c.opensAt && c.opensAt > now && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Desfazer agendamento</h2>
          <ActionForm action={unscheduleAction.bind(null, id)}>
            <TextArea label="Justificativa" name="justification" required rows={2} />
            <SubmitButton variant="secondary">Voltar para análise</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {["agendada", "aberta", "suspensa"].includes(c.status) && (
        <Card className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold"><RefText>Alterar consulta publicada (RF032)</RefText></h2>
          <p className="text-sm text-muted">Permitido apenas: correção textual que não mude o sentido, prorrogação antes do encerramento e ajuste da abertura enquanto Agendada. Pergunta, alternativas e público-alvo não mudam: para isso, cancele e crie nova consulta. Toda alteração tem justificativa pública e notifica quem votou.</p>
          <div className="grid gap-6 lg:grid-cols-3">
            <ActionForm action={alterPublishedAction.bind(null, id)} className="rounded-xl border border-line p-4">
              <input type="hidden" name="kind" value="correcao" />
              <p className="font-semibold">Correção textual</p>
              <SelectField label="Campo" name="field" required options={FIELDS} />
              <TextArea label="Novo texto" name="value" required rows={3} />
              <Checkbox name="changesMeaning" label="A correção muda o sentido (exige o aprovador)" />
              <TextArea label="Justificativa" name="justification" required rows={2} />
              <SubmitButton>Publicar correção</SubmitButton>
            </ActionForm>
            <ActionForm action={alterPublishedAction.bind(null, id)} className="rounded-xl border border-line p-4">
              <input type="hidden" name="kind" value="prorrogacao" />
              <p className="font-semibold">Prorrogação</p>
              <p className="text-sm text-muted">Encerramento atual: {fmtDateTime(c.closesAt)}</p>
              <Field label="Novo encerramento" name="closesAt" type="datetime-local" required defaultValue={toLocalInput(c.closesAt)} />
              <TextArea label="Justificativa" name="justification" required rows={2} />
              <SubmitButton>Prorrogar</SubmitButton>
            </ActionForm>
            {c.status === "agendada" && (
              <ActionForm action={alterPublishedAction.bind(null, id)} className="rounded-xl border border-line p-4">
                <input type="hidden" name="kind" value="ajuste_abertura" />
                <p className="font-semibold">Ajuste da abertura</p>
                <Field label="Nova abertura" name="opensAt" type="datetime-local" required defaultValue={toLocalInput(c.opensAt)} />
                <TextArea label="Justificativa" name="justification" required rows={2} />
                <SubmitButton>Ajustar abertura</SubmitButton>
              </ActionForm>
            )}
          </div>
        </Card>
      )}
      {["agendada", "aberta"].includes(c.status) && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Suspender</h2>
          <p className="text-sm text-muted">Durante a suspensão nenhum voto é aceito; os registrados são preservados. A justificativa é pública.</p>
          <ActionForm action={suspendAction.bind(null, id)}>
            <TextArea label="Justificativa pública" name="justification" required rows={3} />
            <SubmitButton variant="secondary" icon="pause">
              Suspender consulta
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
      {c.status === "suspensa" && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Retomar</h2>
          <p className="text-sm">Motivo da suspensão: {c.statusReason}</p>
          {c.closesAt && c.closesAt <= now ? (
            <>
              <Alert tone="warning">O prazo terminou durante a suspensão. Decida, com justificativa, entre apurar e cancelar.</Alert>
              <ActionForm action={closeSuspendedAction.bind(null, id)}>
                <TextArea label="Justificativa para apurar" name="justification" required rows={2} />
                <SubmitButton>Encerrar e apurar</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <ActionForm action={resumeAction.bind(null, id)}>
              <TextArea label="Justificativa" name="justification" required rows={2} />
              <Field label="Prorrogar encerramento para (opcional)" name="newClosesAt" type="datetime-local" />
              <SubmitButton icon="play">Retomar consulta</SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}
      {["aprovada", "agendada", "aberta", "suspensa", "encerrada"].includes(c.status) && (
        <Card className="space-y-3 border-red-200">
          <h2 className="text-lg font-bold text-bad-700">Cancelar consulta</h2>
          <Alert tone="danger">Irreversível. Os votos são lacrados e não serão apurados; a consulta permanece visível como Cancelada, com a justificativa. Todos que votaram serão avisados.</Alert>
          <ActionForm action={cancelAction.bind(null, id)}>
            <TextArea label="Justificativa" name="justification" required rows={3} />
            <Field label={`Digite o título para confirmar: “${c.title}”`} name="confirmTitle" required />
            <SubmitButton variant="danger" icon="ban">
              Cancelar definitivamente
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
      {["rascunho", "em_revisao", "em_analise", "rejeitada", "apurada", "finalizada", "cancelada"].includes(c.status) && <Alert tone="neutral">Nenhuma ação de condução disponível nesta situação.</Alert>}
    </div>
  );
}
