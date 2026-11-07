import Link from "next/link";
import { ActionForm, Field, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card, PageHeader, Section } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { getEvent, listEvents } from "@/server/modules/events/events.service";
import { listAdminConsultations } from "@/server/modules/consultations/queries.service";
import { getSetting } from "@/server/lib/settings";
import { createEventAction, phoneQuestionAction, updateEventAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Eventos participativos" };

export default async function EventosAdminPage() {
  const a = await requireAdmin("eventos.gerenciar");
  const enabled = await getSetting("recursos.eventos");
  if (!enabled) {
    return (
      <>
        <PageHeader title="Eventos participativos (RF068)" />
        <Alert tone="warning" title="Recurso desabilitado — condicionado à validação com o cliente (*)">
          Habilite em <Link href="/admin/configuracoes">Parâmetros</Link> (“Eventos participativos e perguntas”) se o cliente aprovar esta forma de participação.
        </Alert>
      </>
    );
  }
  const [events, consultations] = await Promise.all([listEvents(), listAdminConsultations()]);
  const details = await Promise.all(events.map((e) => getEvent(e.e.id)));
  return (
    <>
      <PageHeader title="Eventos participativos" description="Audiências, reuniões e debates vinculados a consultas. A plataforma guarda apenas o link da transmissão externa e não substitui o rito legal da audiência." />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Section title="Eventos">
          {details.map((d) =>
            d ? (
              <Card key={d.e.id} className="mb-3 space-y-3">
                <p className="font-bold">
                  <Link href={`/eventos/${d.e.id}`} className="hover:underline">{d.e.title}</Link>
                </p>
                <p className="text-sm text-muted">{fmtDateTime(d.e.startsAt)} · {d.e.location} · {d.consultation} · {d.questions.length} pergunta(s)</p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">Materiais pós-evento</summary>
                  <ActionForm action={updateEventAction.bind(null, d.e.id)} className="mt-2">
                    <SelectField label="Situação" name="status" options={[{ value: "agendado", label: "Agendado" }, { value: "realizado", label: "Realizado" }, { value: "transmissao_indisponivel", label: "Transmissão indisponível" }]} defaultValue={d.e.status} />
                    <Field label="Link da gravação legendada" name="recordingUrl" type="url" defaultValue={d.e.recordingUrl ?? ""} />
                    <TextArea label="Resumo" name="summary" rows={2} defaultValue={d.e.summary ?? ""} />
                    <TextArea label="Ata" name="minutes" rows={3} defaultValue={d.e.minutes ?? ""} />
                    <SubmitButton variant="secondary">Salvar</SubmitButton>
                  </ActionForm>
                </details>
                {can(a, "atendimento.registrar") && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-brand-700">Registrar pergunta recebida por telefone</summary>
                    <ActionForm action={phoneQuestionAction.bind(null, d.e.id)} className="mt-2">
                      <TextArea label="Pergunta" name="body" required rows={2} />
                      <SubmitButton variant="secondary">Registrar com protocolo</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </Card>
            ) : null,
          )}
          {!events.length && <p className="text-muted">Nenhum evento.</p>}
        </Section>
        <Card className="space-y-3 self-start">
          <h2 className="font-bold">Novo evento</h2>
          <ActionForm action={createEventAction}>
            <SelectField label="Consulta" name="consultationId" required placeholder="Selecione" options={consultations.map((c) => ({ value: c.id, label: c.title }))} />
            <SelectField label="Tipo" name="kind" required options={[{ value: "audiencia", label: "Audiência" }, { value: "reuniao", label: "Reunião" }, { value: "debate", label: "Debate" }]} />
            <Field label="Título" name="title" required />
            <TextArea label="Pauta" name="agenda" required rows={3} />
            <Field label="Data e hora" name="startsAt" type="datetime-local" required />
            <Field label="Local" name="location" required />
            <Field label="Link de transmissão (serviço externo)" name="streamUrl" type="url" />
            <SubmitButton>Cadastrar evento</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
