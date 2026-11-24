import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentList } from "@/components/attachments";
import { daysLeftText, StatusBadge } from "@/components/consultation-card";
import { CommentsSection } from "@/components/comments";
import { MainContainer } from "@/components/layout/site-chrome";
import { Countdown } from "@/components/layout/client-bits";
import { Icon } from "@/components/ui/icons";
import { Alert, Badge, Card, LinkButton, PageHeader, Section, Timeline } from "@/components/ui/primitives";
import { getCurrentActor } from "@/server/auth/current";
import { getPublicConsultation, listPublicOutcomes } from "@/server/modules/consultations/queries.service";
import { checkEligibility, hasParticipated } from "@/server/modules/voting/eligibility";
import { publicResults } from "@/server/modules/results/results.service";
import { listEvents } from "@/server/modules/events/events.service";
import { getSetting } from "@/server/lib/settings";
import { fmtDate, fmtDateTime, OUTCOME_STATUS, YOUTH_MODALITIES } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getPublicConsultation((await params).slug);
  return { title: c?.c.title ?? "Consulta" };
}

export default async function ConsultaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicConsultation(slug);
  if (!data) notFound();
  const c = data.c;
  const actor = await getCurrentActor();
  const [eligibility, participated, results, outcomes, commentsOn, eventsOn] = await Promise.all([
    actor?.kind === "cidadao" ? checkEligibility(actor.id, c.id) : null,
    actor?.kind === "cidadao" ? hasParticipated(actor.id, c.id) : null,
    ["finalizada", "apurada"].includes(c.status) ? publicResults(c.id) : null,
    c.status === "finalizada" ? listPublicOutcomes({ consultationId: c.id }) : [],
    getSetting("recursos.comentarios"),
    getSetting("recursos.eventos"),
  ]);
  const events = eventsOn ? (await listEvents()).filter((e) => e.e.consultationId === c.id) : [];
  const winner = results?.current?.data.alternatives.find((a) => a.id === results.current?.data.winnerId);
  const left = c.status === "aberta" ? daysLeftText(c.closesAt) : null;
  const publicEvents = data.events.filter((e) => !["agendamento_desfeito"].includes(e.type));

  return (
    <MainContainer>
      <PageHeader
        breadcrumbs={[{ href: "/", label: "Início" }, { href: "/consultas", label: "Consultas" }, { label: c.title }]}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {data.theme && <Badge tone="primary">{data.theme}</Badge>}
            {data.region && <Badge tone="neutral">{data.region}</Badge>}
            {c.exceptionalDeadline && <Badge tone="warning">Prazo excepcional de 10 dias</Badge>}
          </span>
        }
        title={c.title}
        description={c.summary}
      />

      {c.status === "suspensa" && (
        <Alert tone="warning" title="Consulta suspensa" className="mb-6">
          <p>{c.statusReason}</p>
          <p>Nenhum voto é aceito durante a suspensão. Os votos já registrados estão preservados.</p>
        </Alert>
      )}
      {c.status === "cancelada" && (
        <Alert tone="danger" title="Consulta cancelada" className="mb-6">
          <p>{c.statusReason}</p>
          <p>Os votos registrados foram lacrados e não foram apurados.</p>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-10">
          {/* Período em destaque */}
          <Card className="grid gap-4 border-brand-200 bg-brand-50 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Abertura</p>
              <p className="font-semibold">{fmtDateTime(c.opensAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Encerramento</p>
              <p className="font-semibold">{fmtDateTime(c.closesAt)}</p>
              {left && <p className="text-sm font-semibold text-civic-700">{left}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Participações</p>
              <p className="text-2xl font-bold tabular-nums text-brand-900">{data.participations.toLocaleString("pt-BR")}</p>
              {c.status === "aberta" && <p className="text-xs text-muted">Resultados por alternativa só após o encerramento.</p>}
            </div>
            {c.exceptionalDeadline && c.emergencyJustification && (
              <p className="text-sm sm:col-span-3">
                <strong>Por que o prazo é de 10 dias:</strong> {c.emergencyJustification} {c.deadlineDecisionJustification && <>Autorização: {c.deadlineDecisionJustification}</>}
              </p>
            )}
          </Card>

          <Section title="Qual é o problema?" id="problema">
            <p className="prose-civic">{c.problem}</p>
          </Section>
          <div className="grid gap-6 sm:grid-cols-2">
            <Section title="Objetivo" id="objetivo">
              <p className="prose-civic">{c.objective}</p>
            </Section>
            <Section title="Justificativa" id="justificativa">
              <p className="prose-civic">{c.justification}</p>
            </Section>
          </div>

          <Section title="Pergunta e alternativas" id="pergunta">
            <Card className="border-civic-100 bg-civic-50">
              <p className="text-lg font-semibold text-brand-900">{c.question}</p>
            </Card>
            <ol className="grid gap-3 sm:grid-cols-2">
              {data.alternatives.map((a, i) => (
                <li key={a.id} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-xs font-semibold text-muted">Alternativa {i + 1}</p>
                  <p className="font-semibold text-brand-900">{a.label}</p>
                  {a.explanation && <p className="mt-1 text-sm text-muted">{a.explanation}</p>}
                </li>
              ))}
              {c.allowAbstention && (
                <li className="rounded-xl border border-dashed border-line bg-white p-4">
                  <p className="font-semibold text-brand-900">Abstenção</p>
                  <p className="mt-1 text-sm text-muted">Registra a participação sem escolher alternativa. Não conta como voto válido.</p>
                </li>
              )}
            </ol>
            {c.guidance && (
              <div className="rounded-xl border border-line bg-white p-4">
                <p className="font-semibold">Orientações para participar</p>
                <p className="prose-civic mt-1 text-sm">{c.guidance}</p>
              </div>
            )}
          </Section>

          <Section title="Quem pode participar" id="publico">
            {c.audienceOpen ? (
              <p>Aberta ao público em geral — qualquer cidadão com conta ativa e identidade verificada.</p>
            ) : (
              <ul className="space-y-2">
                {data.criteria.map((cr) => (
                  <li key={cr.id} className="rounded-lg border border-line bg-white p-3">
                    <p className="font-medium">{cr.publicText}</p>
                    <p className="text-sm text-muted">Por quê: {cr.justification}</p>
                  </li>
                ))}
              </ul>
            )}
            {c.youthModality && (
              <p className="text-sm">
                Consulta com participação de crianças e adolescentes — modalidade: <strong>{YOUTH_MODALITIES[c.youthModality as "voto"]}</strong>. Salvaguardas: {c.youthSafeguards}
              </p>
            )}
          </Section>

          <Section title="Documentos e materiais" id="documentos" description="Vídeos e áudios são complementares e sempre têm versão em texto. Assistir não é condição para participar.">
            <AttachmentList items={data.attachments} />
          </Section>

          <Section title="Natureza consultiva e o que acontece depois" id="depois">
            <Alert tone="primary">
              <p>
                <strong>A votação é consultiva:</strong> o resultado orienta a administração municipal, mas não substitui audiência pública, plebiscito, referendo ou iniciativa popular, que seguem ritos próprios.
              </p>
              {c.ownRite && <p>Este tema possui rito próprio; a norma aplicável foi verificada pela administração.</p>}
            </Alert>
            <p className="prose-civic">{c.nextSteps}</p>
            <p className="text-sm text-muted">Unidade responsável: {data.organ ?? "—"}</p>
          </Section>

          {results?.current && (
            <Section title="Resultado" id="resultado" actions={<LinkButton href={`/consultas/${slug}/resultado`} variant="ghost" iconRight="arrowRight">Ver resultado completo</LinkButton>}>
              <Card>
                <p>
                  {winner ? (
                    <>
                      Alternativa mais votada: <strong>{winner.label}</strong> com {winner.percentage.replace(".", ",")}% dos votos válidos.
                    </>
                  ) : (
                    "Sem alternativa vencedora."
                  )}{" "}
                  {results.current.data.participations} participações.
                </p>
              </Card>
            </Section>
          )}
          {c.status === "apurada" && <Alert tone="info" title="Apuração concluída">O resultado está em homologação e será publicado em breve.</Alert>}

          {c.status === "finalizada" && (
            <Section title="Encaminhamentos" id="encaminhamentos" description="Providências registradas pela Prefeitura. A plataforma não cria compromissos: exibe apenas o que foi registrado.">
              {outcomes.length ? (
                <ul className="space-y-3">
                  {outcomes.map((o) => (
                    <li key={o.o.id} className="rounded-xl border border-line bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {o.current && <Badge tone={OUTCOME_STATUS[o.current.status].tone}>{OUTCOME_STATUS[o.current.status].label}</Badge>}
                        <span className="text-xs text-muted">{o.organ}</span>
                      </div>
                      <p className="mt-1 font-semibold">{o.o.decision}</p>
                      <p className="text-sm">{o.o.actions}</p>
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer font-semibold text-brand-700">Histórico de situações</summary>
                        <ul className="mt-2 space-y-1">
                          {o.entries.map((e) => (
                            <li key={e.id}>
                              {fmtDateTime(e.createdAt)} — {OUTCOME_STATUS[e.status].label}
                              {e.expectedDate && ` (previsto para ${fmtDate(e.expectedDate)})`}
                              {e.justification && ` — ${e.justification}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Nenhum encaminhamento registrado até {fmtDate(new Date())}.</p>
              )}
            </Section>
          )}

          {events.length > 0 && (
            <Section title="Eventos participativos" id="eventos" description="Recurso condicionado à validação com o cliente (*).">
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.e.id}>
                    <Link href={`/eventos/${e.e.id}`} className="font-semibold text-brand-700 hover:underline">
                      {e.e.title}
                    </Link>{" "}
                    — {fmtDateTime(e.e.startsAt)}, {e.e.location}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Histórico da consulta" id="historico" actions={<LinkButton href={`/consultas/${slug}/historico`} variant="ghost" iconRight="arrowRight">Histórico completo</LinkButton>}>
            <Timeline items={publicEvents.slice(-4).map((e) => ({ date: fmtDateTime(e.occurredAt), title: e.description, body: e.justification ? `Justificativa: ${e.justification}` : undefined, tone: e.type === "cancelamento" ? "danger" : e.type === "suspensao" ? "warning" : undefined }))} />
          </Section>

          {commentsOn && c.commentsEnabled && <CommentsSection targetType="consultation" targetId={c.id} back={`/consultas/${slug}`} canPost={actor?.kind === "cidadao"} />}
        </div>

        {/* Caixa de participação */}
        <aside aria-label="Participação" className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 border-brand-200">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Icon name="ballot" className="size-5 text-civic-600" /> Participar
            </h2>
            {c.status === "aberta" && c.closesAt && (
              <p className="text-sm font-semibold text-civic-700">
                <Countdown to={c.closesAt.toISOString()} prefix="Encerra em" />
              </p>
            )}
            {!actor ? (
              <>
                <p className="text-sm text-muted">{c.status === "aberta" ? "Para votar é preciso ter conta ativa e identidade verificada." : "A participação não está aberta neste momento."}</p>
                {c.status === "aberta" && (
                  <LinkButton href={`/entrar?proximo=/consultas/${slug}`} className="w-full">
                    Entre para participar
                  </LinkButton>
                )}
                <p className="text-sm">
                  Não tem conta?{" "}
                  <Link href="/cadastro" className="font-semibold text-brand-700 underline">
                    Cadastre-se
                  </Link>
                </p>
              </>
            ) : actor.kind === "admin" ? (
              <Alert tone="neutral">Contas administrativas não participam das votações.</Alert>
            ) : participated ? (
              <>
                <Alert tone="success" title={`Você já participou em ${fmtDate(participated.on)}`}>
                  Seu voto é secreto e não pode ser alterado.
                </Alert>
                <LinkButton href={`/conta/participacoes/${participated.id}`} variant="secondary" className="w-full" icon="file">
                  Ver meu comprovante
                </LinkButton>
              </>
            ) : eligibility?.eligible ? (
              <>
                <p className="text-sm">Você pode participar. São 3 passos: escolher, confirmar e guardar o comprovante.</p>
                <LinkButton href={`/consultas/${slug}/participar`} variant="civic" className="w-full" iconRight="arrowRight">
                  Participar
                </LinkButton>
              </>
            ) : (
              <>
                <Alert tone="warning" title={eligibility?.code === "fora_do_publico" || eligibility?.code === "domicilio_nao_comprovado" ? "Fora do público-alvo" : "Participação indisponível"}>
                  {eligibility && !eligibility.eligible ? eligibility.reason : ""}
                </Alert>
                {eligibility && !eligibility.eligible && eligibility.action && (
                  <LinkButton href={eligibility.action.href} variant="secondary" className="w-full">
                    {eligibility.action.label}
                  </LinkButton>
                )}
              </>
            )}
            <p className="border-t border-line pt-3 text-xs text-muted">
              <Icon name="lock" className="mr-1 inline size-3.5" /> Seu voto é secreto: a escolha é gravada sem nenhum vínculo com a sua identidade.
            </p>
          </Card>
        </aside>
      </div>
    </MainContainer>
  );
}
