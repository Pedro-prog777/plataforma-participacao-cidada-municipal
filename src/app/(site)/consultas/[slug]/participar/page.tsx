import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { MainContainer } from "@/components/layout/site-chrome";
import { VotingWizard } from "@/components/voting-wizard";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { getPublicConsultation } from "@/server/modules/consultations/queries.service";
import { checkEligibility, hasParticipated } from "@/server/modules/voting/eligibility";
import { castVoteAction, prepareVoteAction } from "@/server/actions/citizen";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { demoMode } from "@/server/lib/env";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Participar" };

export default async function ParticiparPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await requireCitizen(`/consultas/${slug}/participar`);
  const data = await getPublicConsultation(slug);
  if (!data) notFound();
  const c = data.c;
  const done = await hasParticipated(actor.id, c.id);
  if (done) redirect(`/conta/participacoes/${done.id}`);
  const el = await checkEligibility(actor.id, c.id);
  const [u] = await getDb().select({ phone: users.phone }).from(users).where(eq(users.id, actor.id));

  return (
    <MainContainer>
      <PageHeader
        title="Participar da consulta"
        description={c.title}
        breadcrumbs={[{ href: "/consultas", label: "Consultas" }, { href: `/consultas/${slug}`, label: c.title }, { label: "Participar" }]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Card>
          {el.eligible ? (
            <VotingWizard
              question={c.question}
              alternatives={data.alternatives.map((a) => ({ id: a.id, label: a.label, explanation: a.explanation }))}
              allowAbstention={c.allowAbstention}
              hasPhone={!!u?.phone}
              prepare={prepareVoteAction.bind(null, c.id)}
              cast={castVoteAction.bind(null, c.id)}
            />
          ) : (
            <div className="space-y-4">
              <Alert tone="warning" title="Você não pode participar desta consulta agora">
                {el.reason}
              </Alert>
              {el.action && <LinkButton href={el.action.href}>{el.action.label}</LinkButton>}
            </div>
          )}
        </Card>
        <aside className="space-y-4 text-sm">
          <Card className="space-y-2">
            <p className="font-semibold text-brand-900">Antes de confirmar</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Cada pessoa vota uma única vez.</li>
              <li>O voto não pode ser alterado depois de confirmado.</li>
              <li>Ninguém — nem a Prefeitura — vê a sua escolha.</li>
              <li>Prazo: até {fmtDateTime(c.closesAt)} (horário de Brasília).</li>
            </ul>
          </Card>
          {demoMode() && (
            <Alert tone="info" title="Demonstração">
              Nesta demonstração os e-mails não são enviados de verdade: o código aparece na <Link href="/demo/caixa-de-email">caixa de e-mail de teste</Link>.
            </Alert>
          )}
        </aside>
      </div>
    </MainContainer>
  );
}
