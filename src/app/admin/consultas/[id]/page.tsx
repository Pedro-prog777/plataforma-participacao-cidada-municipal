import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Alert, Card, DescriptionList, Section, Table, Timeline } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { consultationPendencies } from "@/server/modules/consultations/lifecycle.service";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { participationCount } from "@/server/modules/voting/voting.service";
import { submitReviewAction } from "@/server/actions/admin";
import { CONSULTATION_ROLES } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/labels";

const NEXT_STEP: Record<string, string> = {
  rascunho: "Elaborador completa dados, alternativas, público-alvo e anexos; gestor define responsáveis; depois envia para revisão.",
  rejeitada: "Elaborador ajusta conforme a justificativa da rejeição e reenvia para revisão.",
  em_revisao: "Revisor (diferente do elaborador) preenche a lista de verificação.",
  em_analise: "Aprovador (que não elaborou nem revisou) aprova ou rejeita; havendo prazo excepcional, o autorizador decide antes.",
  aprovada: "Responsável publica: a consulta fica Agendada até a abertura automática.",
  agendada: "Abertura automática no horário programado. Ainda é possível ajustar a abertura ou desfazer o agendamento.",
  aberta: "Votação em andamento. Encerramento automático no horário divulgado.",
  suspensa: "Nenhum voto é aceito. O responsável pode retomar (com justificativa) ou cancelar.",
  encerrada: "Integridade verificada e apuração automática. Se houver divergência, um incidente bloqueia a apuração.",
  apurada: "Quem publica resultados homologa e publica o resultado final com nota oficial.",
  finalizada: "Registrar e atualizar encaminhamentos.",
  cancelada: "Consulta encerrada de forma irreversível.",
};

export default async function ConsultaAdminOverview({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const c = data.c;
  const [pend, myRoles, nPart] = await Promise.all([["rascunho", "rejeitada"].includes(c.status) ? consultationPendencies(id) : Promise.resolve([]), consultationRolesOf(a.id, id), participationCount(id)]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Alert tone="primary" title="Próximo passo">
          {NEXT_STEP[c.status]}
        </Alert>
        {c.reviewObservations && ["rascunho", "rejeitada"].includes(c.status) && (
          <Alert tone="warning" title="Observações da revisão/aprovação">
            {c.reviewObservations}
          </Alert>
        )}
        {["rascunho", "rejeitada"].includes(c.status) && (
          <Section title="Pendências para envio à revisão" description="Validação completa exigida antes da aprovação (RF028).">
            {pend.length ? (
              <ul className="space-y-1">
                {pend.map((p) => (
                  <li key={p.field}>
                    <Link href={p.href} className="text-sm font-semibold text-bad-700 underline">
                      {p.message}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-ok-700">Nenhuma pendência. A consulta pode ser enviada para revisão.</p>
            )}
            {myRoles.includes("elaborador") && (
              <ActionForm action={submitReviewAction.bind(null, id)}>
                <SubmitButton disabled={pend.length > 0}>Enviar para revisão</SubmitButton>
              </ActionForm>
            )}
          </Section>
        )}
        <Section title="Resumo">
          <Card>
            <DescriptionList
              items={[
                { term: "Proposta municipal", detail: data.proposal },
                { term: "Pergunta", detail: c.question || "—" },
                { term: "Alternativas", detail: data.alternatives.map((x) => x.label).join(" · ") || "—" },
                { term: "Público-alvo", detail: c.audienceOpen ? "Aberta ao público em geral" : data.criteria.map((x) => x.publicText).join(" · ") || "—" },
                { term: "Período", detail: `${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}` },
                { term: "Participações", detail: nPart },
                { term: "Elaborado por", detail: data.author },
              ]}
            />
          </Card>
        </Section>
        <Section title="Versões" description="Toda edição gera uma nova versão; nada é sobrescrito (RF024).">
          <Table head={["Versão", "Motivo", "Data"]} rows={[...data.versions].reverse().slice(0, 12).map((v) => [`v${v.version}`, v.reason ?? "—", fmtDateTime(v.createdAt)])} />
        </Section>
      </div>
      <aside className="space-y-6">
        <Section title="Responsáveis">
          <Card className="space-y-2 text-sm">
            {Object.entries(CONSULTATION_ROLES).map(([role, def]) => {
              const people = data.assignments.filter((x) => x.role === role);
              return (
                <div key={role} className="flex justify-between gap-2">
                  <span className="text-muted">{def.label}</span>
                  <span className="text-right font-medium">{people.map((p) => p.name).join(", ") || (def.required ? <span className="text-bad-700">pendente</span> : "—")}</span>
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted">Seus papéis nesta consulta: {myRoles.map((r) => CONSULTATION_ROLES[r].label).join(", ") || "nenhum"}.</p>
          </Card>
        </Section>
        <Section title="Revisões">
          {data.reviews.length ? (
            <ul className="space-y-2 text-sm">
              {data.reviews.map(({ r, reviewer }) => (
                <li key={r.id} className="rounded-lg border border-line bg-white p-3">
                  <strong>{r.outcome === "aprovada" ? "Aprovada" : "Problema apontado"}</strong> — v{r.version} por {reviewer} em {fmtDateTime(r.createdAt)}
                  {r.observations && <p className="text-muted">{r.observations}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma revisão.</p>
          )}
        </Section>
        <Section title="Histórico público">
          <Timeline items={data.events.slice(-6).map((e) => ({ date: fmtDateTime(e.occurredAt), title: e.description, body: e.justification }))} />
        </Section>
      </aside>
    </div>
  );
}
