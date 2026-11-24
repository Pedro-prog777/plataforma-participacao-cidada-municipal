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
  abaixo_quorum: "A participação ficou abaixo do mínimo de referência: não há alternativa vencedora.",
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
        eyebrow={shown ? <Badge tone={current ? "success" : "warning"}>{current ? (current.kind === "retificacao" ? "Final (corrigido)" : "Final") : "Preliminar"}</Badge> : undefined}
        actions={
          shown ? (
            <>
              <LinkButton href={`/api/dados-abertos/resultados?formato=pdf&consulta=${id}`} variant="secondary" icon="download">
                Baixar em PDF
              </LinkButton>
              <LinkButton href={`/api/dados-abertos/resultados?formato=csv&consulta=${id}`} variant="secondary" icon="download">
                Planilha
              </LinkButton>
            </>
          ) : undefined
        }
      />
      {!shown ? (
        <Alert tone={c.status === "cancelada" ? "danger" : "info"} title={c.status === "cancelada" ? "Consulta cancelada" : "Resultado ainda não publicado"}>
          {c.status === "cancelada" ? "Os votos foram guardados sem contagem e não entram em nenhum resultado. Não há números por alternativa." : "Durante a votação, só o número de participações é divulgado. O resultado por alternativa aparece depois que os votos forem contados e conferidos."}
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
                  { term: "Pessoas que podiam participar (estimativa)", detail: shown.data.estimatedEligible?.toLocaleString("pt-BR") ?? "—" },
                  { term: "Participação entre quem podia participar", detail: shown.data.participationRate ? `${shown.data.participationRate.replace(".", ",")}%` : "—" },
                  {
                    term: "Participação mínima de referência",
                    detail: shown.data.quorum.type === "nenhum" ? "Não adotado" : `${shown.data.quorum.required ?? "—"} participações — ${shown.data.quorum.met ? "atingida" : "não atingida"}`,
                  },
                  { term: "Período", detail: `${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}` },
                  ...(c.exceptionalDeadline ? [{ term: "Prazo reduzido", detail: c.emergencyJustification ?? "" }] : []),
                ]}
              />
            </Card>
          </div>

          <Section title="Números em tabela" description="Os mesmos números do gráfico, também para quem usa leitor de tela.">
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

          <Section title="Como o resultado foi calculado">
            <Card className="space-y-2 text-sm">
              <p>
                <strong>Regra:</strong> vence a alternativa com mais votos válidos. A regra foi definida e publicada antes de a votação abrir. As porcentagens são calculadas sobre os votos válidos, com duas casas decimais, e somam 100%.
              </p>
              <p>
                <strong>Sigilo:</strong> os votos são guardados sem identificar quem votou, sem o comprovante e sem horário. A contagem é automática e, se for refeita, chega sempre ao mesmo resultado.
              </p>
              <details className="rounded-lg border border-line px-3 py-2">
                <summary className="cursor-pointer font-semibold text-brand-800">Códigos de verificação (para conferência técnica)</summary>
                <p className="mt-2 text-muted">Permitem que qualquer pessoa confira que o resultado publicado e os votos contados não foram alterados.</p>
                <p className="mt-2 break-all">
                  <strong>Código do resultado:</strong> <code>{shown.hash}</code>
                </p>
                <p className="break-all">
                  <strong>Código dos votos contados:</strong> <code>{shown.baseHash}</code>
                </p>
              </details>
              {current?.note && (
                <p>
                  <strong>Nota oficial:</strong> {current.note}
                </p>
              )}
              {current && <p className="text-muted">Publicado em {fmtDateTime(current.createdAt)}.</p>}
            </Card>
          </Section>

          {history.length > 1 && (
            <Section title="Versões publicadas" description="Quando o resultado é corrigido, a versão original continua visível.">
              <Table
                head={["Tipo", "Data", "Justificativa", "Código de verificação"]}
                rows={history.map((h) => [h.kind === "retificacao" ? "Correção" : "Final", fmtDateTime(h.createdAt), h.justification ?? "—", <code key={h.id}>{h.hash.slice(0, 16)}…</code>])}
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
