import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { ConsultationFields } from "@/components/admin/consultation-form";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { updateConsultationAction } from "@/server/actions/admin";
import { getSetting } from "@/server/lib/settings";
import { toLocalInput } from "@/lib/labels";

export const metadata = { title: "Dados da consulta" };

export default async function EditarConsultaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [data, ref, padrao, excepcional] = await Promise.all([getAdminConsultation(id), referenceData(), getSetting("consulta.prazo_padrao_dias"), getSetting("consulta.prazo_excepcional_dias")]);
  const c = data.c;
  const editable = ["rascunho", "rejeitada"].includes(c.status);
  return (
    <Card>
      {!editable && (
        <Alert tone="info" className="mb-4" title="Edição bloqueada nesta situação">
          {["em_revisao", "em_analise"].includes(c.status) ? "A consulta está em revisão/análise (versão congelada)." : "Consulta publicada: use a aba Condução para correções textuais justificadas, prorrogação ou ajuste da abertura (RF032)."}
        </Alert>
      )}
      <ActionForm action={updateConsultationAction.bind(null, id)}>
        <input type="hidden" name="version" value={c.version} />
        <fieldset disabled={!editable} className="space-y-5">
          <ConsultationFields
            themes={ref.themes.map((t) => ({ value: t.id, label: t.name }))}
            regions={ref.regions.map((r) => ({ value: r.id, label: r.name }))}
            organs={ref.organs.map((o) => ({ value: o.id, label: o.name }))}
            prazo={{ padrao, excepcional }}
            d={{
              title: c.title,
              summary: c.summary,
              themeId: c.themeId ?? undefined,
              regionId: c.regionId ?? undefined,
              organId: c.organId ?? undefined,
              problem: c.problem,
              objective: c.objective,
              justification: c.justification,
              question: c.question,
              guidance: c.guidance,
              opensAt: toLocalInput(c.opensAt),
              closesAt: toLocalInput(c.closesAt),
              exceptionalDeadline: c.exceptionalDeadline,
              emergencyJustification: c.emergencyJustification ?? undefined,
              quorumType: c.quorumType,
              quorumValue: c.quorumValue ?? undefined,
              nextSteps: c.nextSteps,
              ownRite: c.ownRite,
              ownRiteConfirmed: c.ownRiteConfirmed,
            }}
          />
          {editable && <SubmitButton>Salvar nova versão</SubmitButton>}
        </fieldset>
      </ActionForm>
    </Card>
  );
}
