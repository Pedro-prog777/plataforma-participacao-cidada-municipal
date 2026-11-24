import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, BarChart, Card, DescriptionList, Section, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { adminResults, latestIntegrity } from "@/server/modules/results/results.service";
import { participationCount } from "@/server/modules/voting/voting.service";
import { publishResultAction, recountAction, rectifyAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Resultado" };

export default async function AdminResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const c = data.c;
  const [rows, checks, roles, nPart] = await Promise.all([adminResults(id), latestIntegrity(id), consultationRolesOf(a.id, id), participationCount(id)]);
  const canPublish = roles.includes("publicacao_resultados");
  const latest = rows.at(-1);
  if (["rascunho", "em_revisao", "em_analise", "rejeitada", "aprovada", "agendada", "aberta", "suspensa"].includes(c.status)) {
    return (
      <Alert tone="info" title="Resultado indisponível durante a preparação e a votação">
        <RefText>Para nenhum perfil são exibidas contagens por alternativa antes do encerramento (RN16).</RefText> Participações registradas até agora: <strong>{nPart}</strong>.
      </Alert>
    );
  }
  return (
    <div className="space-y-6">
      {c.status === "cancelada" && <Alert tone="danger">Consulta cancelada: os votos foram lacrados e não são apurados.</Alert>}
      {c.status === "encerrada" && <Alert tone="warning" title="Apuração pendente">A apuração automática ainda não ocorreu ou foi bloqueada por falha de integridade. Veja as verificações abaixo e os incidentes.</Alert>}
      {latest && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={latest.kind === "preliminar" ? "warning" : "success"}>{latest.kind === "preliminar" ? "Preliminar" : latest.kind === "final" ? "Final" : "Retificação"}</Badge>
              <span className="text-sm text-muted">{fmtDateTime(latest.createdAt)}</span>
            </div>
            <BarChart title="Votos por alternativa" highlightId={latest.data.winnerId} data={latest.data.alternatives.map((x) => ({ id: x.id, label: x.label, value: x.votes, pct: x.percentage }))} />
          </Card>
          <Card>
            <DescriptionList
              items={[
                { term: "Participações", detail: latest.data.participations },
                { term: "Válidos / abstenções", detail: `${latest.data.validVotes} / ${latest.data.abstentions}` },
                { term: "Condição", detail: latest.data.condition },
                { term: "Quórum", detail: latest.data.quorum.type === "nenhum" ? "Não adotado" : `${latest.data.quorum.required} — ${latest.data.quorum.met ? "atingido" : "não atingido"}` },
                { term: "Hash do resultado", detail: <code className="break-all text-xs">{latest.hash}</code> },
                { term: "Hash da base", detail: <code className="break-all text-xs">{latest.baseHash}</code> },
              ]}
            />
          </Card>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {c.status === "apurada" && canPublish && (
          <Card className="space-y-4">
            <h2 className="text-lg font-bold">Homologar e publicar resultado final</h2>
            <ActionForm action={recountAction.bind(null, id)}>
              <SubmitButton variant="secondary">Recontar e comparar com a apuração anterior</SubmitButton>
            </ActionForm>
            <ActionForm action={publishResultAction.bind(null, id)}>
              <TextArea label="Nota oficial (natureza consultiva e próximos passos)" name="note" required rows={4} defaultValue={`Votação consultiva: o resultado orienta a administração, mas não substitui os ritos legais. Próximos passos: ${c.nextSteps}`} />
              <SubmitButton variant="civic">Publicar resultado final</SubmitButton>
              <p className="text-xs text-muted">A publicação torna o resultado imutável; correções só por retificação justificada e visível.</p>
            </ActionForm>
          </Card>
        )}
        {c.status === "finalizada" && canPublish && (
          <Card className="space-y-3">
            <h2 className="text-lg font-bold">Retificação</h2>
            <Alert tone="warning">Somente com erro comprovado. O resultado original permanece visível.</Alert>
            <ActionForm action={rectifyAction.bind(null, id)}>
              <TextArea label="Justificativa (erro comprovado)" name="justification" required rows={3} />
              <TextArea label="Nota oficial atualizada" name="note" rows={3} />
              <SubmitButton variant="secondary">Publicar retificação</SubmitButton>
            </ActionForm>
          </Card>
        )}
        {!canPublish && <Alert tone="neutral">A homologação cabe a quem tem o papel “Publicação de resultados” nesta consulta.</Alert>}
        <Section title="Verificações de integridade (RF059)">
          {checks.map((ch) => (
            <Card key={ch.id} className="mb-3 space-y-2">
              <p className="text-sm font-semibold">
                {ch.stage} — {fmtDateTime(ch.createdAt)} — <Badge tone={ch.passed ? "success" : "danger"}>{ch.passed ? "aprovada" : "falhou"}</Badge>
              </p>
              <ul className="space-y-0.5 text-sm">
                {ch.report.map((r) => (
                  <li key={r.check} className={r.ok ? "text-ok-700" : "font-semibold text-bad-700"}>
                    {r.ok ? "✓" : "✗"} {r.check} <span className="text-muted">({r.detail})</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {!checks.length && <p className="text-sm text-muted">Nenhuma verificação executada.</p>}
        </Section>
      </div>
      {rows.length > 1 && (
        <Section title="Histórico de apurações e publicações">
          <Table head={["Tipo", "Data", "Hash", "Justificativa"]} rows={rows.map((r) => [r.kind, fmtDateTime(r.createdAt), <code key="h">{r.hash.slice(0, 16)}…</code>, r.justification ?? "—"])} />
        </Section>
      )}
    </div>
  );
}
