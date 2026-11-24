import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { ActionForm, RadioGroup, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { approvalAction, deadlineAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Aprovação" };

export default async function AprovacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const roles = await consultationRolesOf(a.id, id);
  const c = data.c;
  const conflict = c.createdBy === a.id || c.lastEditedBy === a.id || data.reviews.some((r) => r.r.reviewerId === a.id);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Prazo excepcional</h2>
        {!c.exceptionalDeadline ? (
          <p className="text-sm text-muted">Não há pedido de redução de prazo.</p>
        ) : (
          <>
            <Alert tone="warning" title={`Pedido de ${c.deadlineAuthorization === "pendente" ? "redução — aguardando decisão" : c.deadlineAuthorization}`}>
              <p>Emergência alegada: {c.emergencyJustification}</p>
              <p>Período: {fmtDateTime(c.opensAt)} a {fmtDateTime(c.closesAt)}</p>
              {c.deadlineDecisionJustification && <p>Decisão: {c.deadlineDecisionJustification}</p>}
            </Alert>
            {c.status === "em_analise" && c.deadlineAuthorization === "pendente" && roles.includes("autorizador_prazo") ? (
              <ActionForm action={deadlineAction.bind(null, id)}>
                <RadioGroup legend="Decisão" name="decision" required options={[{ value: "autorizar", label: "Autorizar 10 dias" }, { value: "negar", label: "Negar (volta a Rascunho com 20 dias sugeridos)" }]} />
                <TextArea label="Justificativa (será publicada)" name="justification" required rows={3} />
                <SubmitButton>Registrar decisão</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">A decisão cabe a quem tem o papel “Autorização de prazo excepcional” nesta consulta (*).</p>
            )}
          </>
        )}
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Aprovação da versão congelada</h2>
        {c.status !== "em_analise" ? (
          <Alert tone="info">A consulta não está Em análise.{c.approvedAt && ` Aprovada em ${fmtDateTime(c.approvedAt)}.`}</Alert>
        ) : !roles.includes("aprovador") ? (
          <Alert tone="neutral">Apenas o aprovador designado pode decidir.</Alert>
        ) : conflict ? (
          <Alert tone="danger" title="Segregação de funções">
            Você elaborou, editou ou revisou esta consulta e por isso não pode aprová-la (RN20). A tentativa de aprovar seria negada e auditada.
          </Alert>
        ) : (
          <ActionForm action={approvalAction.bind(null, id)}>
            <p className="text-sm">Versão congelada: v{c.frozenVersion}. A aprovação registra autor, data e versão.</p>
            <RadioGroup legend="Decisão" name="decision" required options={[{ value: "aprovar", label: "Aprovar" }, { value: "rejeitar", label: "Rejeitar e devolver" }]} />
            <TextArea label="Justificativa (obrigatória para rejeição)" name="justification" rows={3} />
            <SubmitButton>Registrar decisão</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
