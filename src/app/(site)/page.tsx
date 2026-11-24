import Link from "next/link";
import { ConsultationCard, daysLeftText, StatusBadge } from "@/components/consultation-card";
import { MainContainer } from "@/components/layout/site-chrome";
import { Countdown } from "@/components/layout/client-bits";
import { Icon } from "@/components/ui/icons";
import { Badge, LinkButton, Section } from "@/components/ui/primitives";
import { getCurrentActor } from "@/server/auth/current";
import { env } from "@/server/lib/env";
import { listPublicConsultations, listPublicOutcomes, listPublishedResults, portalIndicators } from "@/server/modules/consultations/queries.service";
import { fmtDate, fmtDateTime, OUTCOME_STATUS } from "@/lib/labels";

export default async function HomePage() {
  const actor = await getCurrentActor();
  // Tudo em paralelo e só com o que a página mostra (3 resultados e 3 encaminhamentos mais recentes).
  const [{ items }, indicators, results, outcomes, scheduled] = await Promise.all([
    listPublicConsultations({ status: "aberta" }, actor?.kind === "cidadao" ? actor.id : null),
    portalIndicators(),
    listPublishedResults(3),
    listPublicOutcomes({ limit: 3 }),
    listPublicConsultations({ status: "agendada" }),
  ]);
  const featured = items[0];
  const upcoming = scheduled.items.slice(0, 2);

  return (
    <MainContainer wide>
      {/* Abertura */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="container-page relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-civic-100">
              <Icon name="mapPin" className="size-4" /> {env.municipio}
            </p>
            <h1 className="text-3xl font-bold tracking-tight !text-white sm:text-5xl">Sua opinião orienta as decisões da cidade.</h1>
            <p className="max-w-xl text-lg text-brand-100">
              Conheça as consultas públicas da Prefeitura, vote de forma segura e secreta, envie propostas e acompanhe o que foi feito depois de cada resultado.
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/consultas?situacao=aberta" variant="civic" iconRight="arrowRight">
                Ver consultas abertas
              </LinkButton>
              <LinkButton href="/como-funciona" variant="secondary" className="!bg-transparent !text-white !ring-white/40 hover:!bg-white/10">
                Como funciona
              </LinkButton>
            </div>
            <p className="text-sm text-brand-200">Votação consultiva: o resultado orienta a administração e não substitui plebiscito, referendo ou audiência pública.</p>
          </div>

          {featured ? (
            <div className="rounded-2xl bg-white p-6 text-ink shadow-xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={featured.status} />
                {featured.theme && <Badge tone="primary">{featured.theme}</Badge>}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-civic-700">Em votação agora</p>
              <h2 className="mt-1 text-xl font-bold">{featured.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{featured.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-brand-50 p-4 text-sm">
                <div>
                  <dt className="text-muted">Encerra em</dt>
                  <dd className="font-semibold">{fmtDateTime(featured.closesAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Participações</dt>
                  <dd className="font-semibold tabular-nums">{featured.participations.toLocaleString("pt-BR")}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm font-semibold text-civic-700">
                {featured.closesAt && <Countdown to={featured.closesAt.toISOString()} prefix="Tempo restante:" />}
                <noscript>{daysLeftText(featured.closesAt)}</noscript>
              </p>
              <LinkButton href={`/consultas/${featured.slug}`} className="mt-4 w-full" iconRight="arrowRight">
                Conhecer e participar
              </LinkButton>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 p-6">
              <p className="text-lg font-semibold">Nenhuma consulta aberta neste momento.</p>
              <p className="mt-1 text-brand-100">Cadastre-se para receber um aviso quando uma nova consulta for publicada.</p>
            </div>
          )}
        </div>
      </section>

      <div className="container-page space-y-14 py-12">
        {/* Indicadores */}
        <section aria-label="Indicadores da participação" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Consultas abertas", indicators.abertas, "ballot"],
            ["Participações registradas", indicators.participacoes, "users"],
            ["Propostas cidadãs recebidas", indicators.propostas_recebidas, "lightbulb"],
            ["Encaminhamentos publicados", indicators.encaminhamentos, "route"],
          ].map(([label, value, icon]) => (
            <div key={label as string} className="rounded-xl border border-line bg-white p-4">
              <Icon name={icon as "users"} className="size-5 text-civic-600" />
              <p className="mt-2 text-2xl font-bold tabular-nums text-brand-900">{Number(value).toLocaleString("pt-BR")}</p>
              <p className="text-sm text-muted">{label}</p>
            </div>
          ))}
        </section>

        <Section id="abertas" title="Consultas em votação" description="Participe enquanto o prazo estiver aberto. Cada pessoa vota uma única vez." actions={<LinkButton href="/consultas" variant="ghost" iconRight="arrowRight">Todas as consultas</LinkButton>}>
          {items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 6).map((c) => (
                <ConsultationCard key={c.slug} c={c} />
              ))}
            </div>
          ) : (
            <p className="text-muted">Não há consultas abertas agora.</p>
          )}
          {upcoming.length > 0 && (
            <p className="text-sm text-muted">
              Em breve:{" "}
              {upcoming.map((u, i) => (
                <span key={u.slug}>
                  {i > 0 && " · "}
                  <Link href={`/consultas/${u.slug}`} className="font-semibold text-brand-700 hover:underline">
                    {u.title}
                  </Link>{" "}
                  (abre em {fmtDate(u.opensAt)})
                </span>
              ))}
            </p>
          )}
        </Section>

        {/* Passos */}
        <section aria-labelledby="passos" className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 id="passos" className="text-xl font-bold">
            Participar leva três passos
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              ["Escolha", "Leia a consulta, os documentos e as alternativas explicadas. Escolha a sua."],
              ["Confirme", "Revise a escolha e confirme sua identidade com um código enviado ao seu e-mail."],
              ["Guarde o comprovante", "Você recebe um código que prova sua participação sem revelar o voto."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-civic-100 text-lg font-bold text-civic-700">{i + 1}</span>
                <div>
                  <p className="font-semibold text-brand-900">{t}</p>
                  <p className="text-sm text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
            <span className="flex items-center gap-2 text-ink">
              <Icon name="lock" className="size-4 text-brand-600" /> O voto é secreto: ninguém, nem a Prefeitura, vê sua escolha.
            </span>
            <Link href="/comprovante" className="font-semibold text-brand-700 hover:underline">
              Verificar um comprovante →
            </Link>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Resultados recentes" actions={<LinkButton href="/resultados" variant="ghost" iconRight="arrowRight">Ver todos</LinkButton>}>
            <ul className="space-y-3">
              {results.slice(0, 3).map((r) => {
                const winner = r.data.alternatives.find((a) => a.id === r.data.winnerId);
                return (
                  <li key={r.id + r.kind}>
                    <Link href={`/consultas/${r.slug}/resultado`} className="block rounded-xl border border-line bg-white p-4 hover:shadow-md">
                      <p className="text-xs font-medium text-muted">
                        {r.theme} · publicado em {fmtDate(r.publishedAt)}
                      </p>
                      <p className="font-semibold text-brand-900">{r.title}</p>
                      <p className="mt-1 text-sm text-ink">
                        {winner ? (
                          <>
                            Mais votada: <strong>{winner.label}</strong> ({winner.percentage.replace(".", ",")}% dos votos válidos)
                          </>
                        ) : (
                          "Sem alternativa vencedora (empate, participação abaixo do mínimo de referência ou nenhum voto)."
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
              {!results.length && <p className="text-muted">Nenhum resultado publicado ainda.</p>}
            </ul>
          </Section>
          <Section title="O que foi feito depois" description="Encaminhamentos registrados pela Prefeitura após os resultados." actions={<LinkButton href="/encaminhamentos" variant="ghost" iconRight="arrowRight">Ver todos</LinkButton>}>
            <ul className="space-y-3">
              {outcomes.slice(0, 3).map((o) => (
                <li key={o.o.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {o.current && <Badge tone={OUTCOME_STATUS[o.current.status].tone}>{OUTCOME_STATUS[o.current.status].label}</Badge>}
                    <span className="text-xs text-muted">{o.organ}</span>
                  </div>
                  <p className="mt-1 font-semibold text-brand-900">{o.o.decision}</p>
                  <Link href={`/consultas/${o.slug}#encaminhamentos`} className="text-sm text-brand-700 hover:underline">
                    {o.consultation}
                  </Link>
                </li>
              ))}
              {!outcomes.length && <p className="text-muted">Nenhum encaminhamento registrado até o momento.</p>}
            </ul>
          </Section>
        </div>

        <section className="grid gap-6 rounded-2xl bg-civic-50 p-6 ring-1 ring-civic-100 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-bold">Tem uma ideia para o seu bairro?</h2>
            <p className="mt-1 text-muted">Envie uma proposta à Prefeitura. Ela recebe protocolo, é analisada e respondida com justificativa. Seus dados pessoais nunca são publicados.</p>
          </div>
          <LinkButton href="/conta/propostas/nova" variant="civic" icon="lightbulb">
            Enviar proposta
          </LinkButton>
        </section>
      </div>
    </MainContainer>
  );
}
