import { notFound } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Badge, BarChart, Card, DescriptionList, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { getConsultationIdBySlug, getPublicConsultation, listPublicOutcomes } from "@/server/modules/consultations/queries.service";
import { publicResults } from "@/server/modules/results/results.service";
import { fmtDate, fmtDateTime, OUTCOME_STATUS } from "@/lib/labels";
import type { ResultData } from "@/server/db/schema";

export const metadata = { title: "Resultado da consulta" };

const CONDITION: Record<ResultData["condition"], string> = {
  vencedora: "Alternativa mais votada pela maioria simples dos votos válidos.",
  empate: "Empate entre alternativas, sem regra de desempate publicada: não há alternativa vencedora.",
  sem_votos: "Não houve votos válidos.",
  abaixo_quorum: "O quórum de referência não foi atingido: não há alternativa vencedora.",
};

export default async function ResultadoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await getConsultationIdBySlug(slug);
  const pub = id ? await getPublicConsultation(slug) : null;
  if (!id || !pub) notFound();
  const { consultation: c, current, history, preliminary } = await publicResults(id);
  const shown = current ?? preliminary;
  const outcomes = c.status === "finalizada" ? await listPublicOutcomes({ consultationId: id }) : [];

  return (
    <MainContainer>
      <PageHeader
        title={`Resultado: ${c.title}`}
        breadcrumbs={[{ href: "/resultados", label: "Resultados" }, { href: `/consultas/${slug}`, label: c.title }, { label: "Resultado" }]}
        eyebrow={shown ? <Badge tone={current ? "success" : "warning"}>{current ? (current.kind === "retificacao" ? "Final (retificado)" : "Final") : "Preliminar"}</Badge> : undefined}
        actions={
          shown ? (
            <>
              <LinkButton href={`/api/dados-abertos/resultados?formato=csv&consulta=${id}`} variant="secondary" icon="download">
                CSV
              </LinkButton>
              <LinkButton href={`/api/dados-abertos/resultados?formato=json&consulta=${id}`} variant="secondary" icon="download">
                JSON
              </LinkButton>
              <LinkButton href={`/api/dados-abertos/resultados?formato=pdf&consulta=${id}`} variant="secondary" icon="download">
                PDF
              </LinkButton>
            </>
          ) : undefined
        }
      />
      {!shown ? (
        <Alert tone={c.status === "cancelada" ? "danger" : "info"} title={c.status === "cancelada" ? "Consulta cancelada" : "Resultado ainda não publicado"}>
          {c.status === "cancelada" ? "Os votos foram lacrados e não foram apurados. Não há números por alternativa." : "Durante a votação, apenas o número de participações é divulgado. O resultado por alternativa aparece depois da apuração e da homologação."}
        </Alert>
      ) : (
        <div className="space-y-8">
          <Alert tone="warning" title="Resultado de participação voluntária">
            Não representa estatisticamente toda a população do município. A votação é consultiva: orienta a administração, mas não substitui plebiscito, referendo, iniciativa popular ou audiência pública.
          </Alert>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card className="space-y-6">
              <p className="text-lg font-semibold text-brand-900">{pub.c.question}</p>
              <BarChart
                title="Votos por alternativa (percentual sobre os votos válidos)"
                highlightId={shown.data.winnerId}
                data={shown.data.alternatives.map((a) => ({ id: a.id, label: a.label, value: a.votes, pct: a.percentage }))}
              />
              <p className="text-sm font-medium">{CONDITION[shown.data.condition]}</p>
            </Card>
            <Card>
              <DescriptionList
                items={[
                  { term: "Participações", detail: shown.data.participations.toLocaleString("pt-BR") },
                  { term: "Votos válidos", detail: shown.data.validVotes.toLocaleString("pt-BR") },
                  { term: "Abstenções", detail: shown.data.abstentions.toLocaleString("pt-BR") },
                  { term: "Elegíveis estimados", detail: shown.data.estimatedEligible?.toLocaleString("pt-BR") ?? "—" },
                  { term: "Participação sobre elegíveis", detail: shown.data.participationRate ? `${shown.data.participationRate.replace(".", ",")}% (indicador descritivo)` : "—" },
                  {
                    term: "Quórum de referência",
                    detail: shown.data.quorum.type === "nenhum" ? "Não adotado" : `${shown.data.quorum.required ?? "—"} participações — ${shown.data.quorum.met ? "atingido" : "não atingido"}`,
                  },
                  { term: "Período", detail: `${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}` },
                  ...(c.exceptionalDeadline ? [{ term: "Prazo reduzido", detail: c.emergencyJustification ?? "" }] : []),
                ]}
              />
            </Card>
          </div>

          <Section title="Tabela de dados" description="Mesmos números do gráfico, para leitores de tela e conferência.">
            <Table
              caption="Votos por alternativa"
              head={["Alternativa", "Votos", "% dos válidos"]}
              rows={[
                ...shown.data.alternatives.map((a) => [a.label, a.votes.toLocaleString("pt-BR"), `${a.percentage.replace(".", ",")}%`]),
                ["Abstenções (não são votos válidos)", shown.data.abstentions.toLocaleString("pt-BR"), "—"],
                [<strong key="t">Total de votos</strong>, <strong key="v">{shown.data.totalVotes.toLocaleString("pt-BR")}</strong>, "100%"],
              ]}
            />
          </Section>

          <Section title="Metodologia">
            <Card className="space-y-2 text-sm">
              <p>
                <strong>Forma de contabilização:</strong> maioria simples dos votos válidos, definida e publicada antes da abertura. Percentuais calculados sobre os votos válidos com duas casas decimais (método do maior resto, somando 100%).
              </p>
              <p>
                <strong>Sigilo:</strong> os votos são gravados sem identificação de quem votou, sem comprovante e sem horário. A apuração é automática e determinística.
              </p>
              <p className="break-all">
                <strong>Hash do resultado:</strong> <code>{shown.hash}</code>
              </p>
              <p className="break-all">
                <strong>Hash da base apurada:</strong> <code>{shown.baseHash}</code>
              </p>
              {current?.note && (
                <p>
                  <strong>Nota oficial:</strong> {current.note}
                </p>
              )}
              {current && <p className="text-muted">Publicado em {fmtDateTime(current.createdAt)}.</p>}
            </Card>
          </Section>

          {history.length > 1 && (
            <Section title="Versões publicadas" description="O resultado original permanece visível após retificações.">
              <Table
                head={["Tipo", "Data", "Justificativa", "Hash"]}
                rows={history.map((h) => [h.kind === "retificacao" ? "Retificação" : "Final", fmtDateTime(h.createdAt), h.justification ?? "—", <code key={h.id}>{h.hash.slice(0, 16)}…</code>])}
              />
            </Section>
          )}

          {c.status === "finalizada" && (
            <Section title="Encaminhamentos" id="encaminhamentos">
              {outcomes.length ? (
                <Table
                  head={["Decisão", "Órgão", "Situação", "Atualizado"]}
                  rows={outcomes.map((o) => [o.o.decision, o.organ, o.current ? <Badge key="b" tone={OUTCOME_STATUS[o.current.status].tone}>{OUTCOME_STATUS[o.current.status].label}</Badge> : "—", fmtDate(o.current?.createdAt)])}
                />
              ) : (
                <p className="text-muted">Nenhum encaminhamento registrado até {fmtDate(new Date())}.</p>
              )}
            </Section>
          )}
        </div>
      )}
    </MainContainer>
  );
}
