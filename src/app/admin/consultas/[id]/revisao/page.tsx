import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card, DescriptionList } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { REVIEW_ITEMS } from "@/server/modules/consultations/lifecycle.service";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { reviewAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Revisão" };

export default async function RevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const roles = await consultationRolesOf(a.id, id);
  const c = data.c;
  const canReview = c.status === "em_revisao" && roles.includes("revisor");
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
      <Card>
        <h2 className="mb-2 text-lg font-bold">Conteúdo submetido (versão {c.version})</h2>
        <DescriptionList
          items={[
            { term: "Pergunta", detail: c.question },
            { term: "Alternativas", detail: <ul className="list-disc pl-5">{data.alternatives.map((x) => <li key={x.id}><strong>{x.label}</strong> — {x.explanation}</li>)}</ul> },
            { term: "Problema", detail: c.problem },
            { term: "Objetivo", detail: c.objective },
            { term: "Justificativa", detail: c.justification },
            { term: "Orientações", detail: c.guidance },
            { term: "Público-alvo", detail: c.audienceOpen ? "Aberta ao público em geral" : data.criteria.map((x) => `${x.publicText} (justificativa: ${x.justification})`).join(" · ") },
            { term: "Período", detail: `${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}${c.exceptionalDeadline ? ` — prazo excepcional: ${c.emergencyJustification}` : ""}` },
            { term: "Próximos passos", detail: c.nextSteps },
          ]}
        />
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Lista de verificação</h2>
        {!canReview ? (
          <Alert tone="info">{c.status !== "em_revisao" ? "A consulta não está aguardando revisão." : "Apenas o revisor designado (diferente do elaborador) pode revisar."}</Alert>
        ) : (
          <ActionForm action={reviewAction.bind(null, id)}>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Marque cada item conferido</legend>
              {Object.entries(REVIEW_ITEMS).map(([k, label]) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="items" value={k} className="mt-0.5 size-4 accent-brand-700" /> {label}
                </label>
              ))}
            </fieldset>
            <TextArea label="Observações (obrigatórias se algum item não foi atendido)" name="observations" rows={3} />
            <SubmitButton>Registrar revisão</SubmitButton>
            <p className="text-xs text-muted">Todos os itens marcados: a consulta segue “Em análise” com versão congelada. Algum item desmarcado: volta a Rascunho com as observações.</p>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
