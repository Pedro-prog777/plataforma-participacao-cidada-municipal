import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, DescriptionList, PageHeader, Section } from "@/components/ui/primitives";
import { getCurrentActor } from "@/server/auth/current";
import { getEvent } from "@/server/modules/events/events.service";
import { getSetting } from "@/server/lib/settings";
import { eventQuestionAction } from "@/server/actions/citizen";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Evento participativo" };

const KIND: Record<string, string> = { audiencia: "Audiência", reuniao: "Reunião", debate: "Debate" };

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSetting("recursos.eventos"))) notFound();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ev = await getEvent(id);
  if (!ev) notFound();
  const actor = await getCurrentActor();
  const live = ev.e.status === "agendado" && Math.abs(Date.now() - ev.e.startsAt.getTime()) < 4 * 3600_000;
  return (
    <MainContainer>
      <PageHeader
        title={ev.e.title}
        eyebrow={<Badge tone="primary">{KIND[ev.e.kind]}</Badge>}
        breadcrumbs={[{ href: `/consultas/${ev.slug}`, label: ev.consultation }, { label: "Evento" }]}
        description="Recurso condicionado à validação com o cliente (*). O evento não substitui o rito legal da audiência pública; a plataforma não transmite vídeo."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <DescriptionList
              items={[
                { term: "Data e hora", detail: fmtDateTime(ev.e.startsAt) },
                { term: "Local", detail: ev.e.location },
                { term: "Pauta", detail: <span className="prose-civic">{ev.e.agenda}</span> },
                { term: "Transmissão", detail: ev.e.streamUrl ? <a href={ev.e.streamUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Abrir no serviço externo</a> : "—" },
                { term: "Gravação", detail: ev.e.recordingUrl ? <a href={ev.e.recordingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Assistir (legendada)</a> : "Disponível após o evento" },
              ]}
            />
          </Card>
          {ev.e.status === "transmissao_indisponivel" && <Alert tone="warning">Transmissão indisponível. A gravação será publicada posteriormente.</Alert>}
          {(ev.e.minutes || ev.e.summary) && (
            <Section title="Ata e resumo">
              <Card className="space-y-2">
                {ev.e.summary && <p className="prose-civic">{ev.e.summary}</p>}
                {ev.e.minutes && <p className="prose-civic text-sm">{ev.e.minutes}</p>}
              </Card>
            </Section>
          )}
          <Section title="Perguntas recebidas">
            <ul className="space-y-2">
              {ev.questions.map((q) => (
                <li key={q.id} className="rounded-lg border border-line bg-white p-3 text-sm">
                  <Badge tone="neutral">{q.channel === "telefone" ? "Por telefone" : q.channel === "ao_vivo" ? "Ao vivo" : "Antecipada"}</Badge> <span className="text-muted">{q.protocol}</span>
                  <p className="mt-1">{q.body}</p>
                </li>
              ))}
              {!ev.questions.length && <p className="text-muted">Nenhuma pergunta ainda.</p>}
            </ul>
          </Section>
        </div>
        <aside>
          <Card className="space-y-3">
            <h2 className="font-bold">Enviar pergunta</h2>
            {actor?.kind === "cidadao" ? (
              <ActionForm action={eventQuestionAction.bind(null, ev.e.id, live ? "ao_vivo" : "antecipada")}>
                <TextArea label="Sua pergunta" name="body" required maxLength={1000} />
                <SubmitButton>Enviar</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm">
                <Link href={`/entrar?proximo=/eventos/${ev.e.id}`} className="font-semibold text-brand-700 underline">
                  Entre
                </Link>{" "}
                para enviar perguntas. Também é possível perguntar por telefone ao atendimento da Prefeitura.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </MainContainer>
  );
}
