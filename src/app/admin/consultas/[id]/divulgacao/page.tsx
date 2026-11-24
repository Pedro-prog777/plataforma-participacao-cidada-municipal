import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, Field, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card, DescriptionList, Section, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { disseminationMaterial, listDissemination } from "@/server/modules/dissemination/dissemination.service";
import { consultationRolesOf } from "@/server/modules/access/access.service";
import { disseminationAction } from "@/server/actions/admin";
import { getSetting } from "@/server/lib/settings";
import { DISSEMINATION_CHANNELS, fmtDate } from "@/lib/labels";

export const metadata = { title: "Divulgação" };

export default async function DivulgacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  const [m, records, roles, days] = await Promise.all([disseminationMaterial(id), listDissemination(id), consultationRolesOf(a.id, id), getSetting("divulgacao.sugerir_dias_antes")]);
  const c = m.consultation;
  const active = ["agendada", "aberta"].includes(c.status);
  const nearEnd = c.status === "aberta" && c.closesAt && c.closesAt.getTime() - Date.now() <= days * 86_400_000;
  return (
    <div className="space-y-6">
      {nearEnd && <Alert tone="warning" title="Sugestão">Faltam menos de {days} dias para o encerramento: considere uma nova divulgação.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">Material gerado a partir dos dados aprovados</h2>
          <p className="text-xs text-muted"><RefText>Sem resultados parciais (RN16). A publicação externa é manual.</RefText></p>
          <div>
            <p className="text-sm font-semibold">Texto curto</p>
            <p className="rounded-lg bg-brand-50 p-3 text-sm">{m.shortText}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Link permanente</p>
            <code className="block break-all rounded-lg bg-brand-50 p-3 text-sm">{m.link}</code>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">Cartão</p>
            <div className="rounded-xl border-2 border-brand-700 p-4">
              <p className="text-xs font-bold uppercase text-civic-700">Consulta pública · {m.card.tema}</p>
              <p className="text-lg font-bold">{c.title}</p>
              <DescriptionList items={[{ term: "Pergunta", detail: m.card.pergunta }, { term: "Objetivo", detail: m.card.objetivo }, { term: "Quem participa", detail: m.card.publico }, { term: "Período", detail: m.card.periodo }, { term: "Como participar", detail: m.card.instrucoes }]} />
            </div>
          </div>
        </Card>
        <Card className="space-y-2 text-center">
          <p className="text-sm font-semibold">QR Code</p>
          <div className="mx-auto w-48 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR Code para ${m.link}`} dangerouslySetInnerHTML={{ __html: m.qrSvg }} />
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Canais utilizados">
          <Table head={["Data", "Canal", "Observações"]} rows={records.map((r) => [fmtDate(r.usedOn), DISSEMINATION_CHANNELS[r.channel as keyof typeof DISSEMINATION_CHANNELS], r.notes ?? "—"])} empty="Nenhuma divulgação registrada." />
        </Section>
        <Card className="space-y-3">
          <h2 className="font-bold">Registrar divulgação</h2>
          {!active ? (
            <Alert tone="neutral">Disponível para consultas Agendadas ou Abertas.</Alert>
          ) : !roles.includes("divulgacao") ? (
            <Alert tone="neutral">Cabe a quem tem o papel de divulgação nesta consulta.</Alert>
          ) : (
            <ActionForm action={disseminationAction.bind(null, id)}>
              <SelectField label="Canal" name="channel" required placeholder="Selecione" options={Object.entries(DISSEMINATION_CHANNELS).map(([value, label]) => ({ value, label }))} />
              <Field label="Data" name="usedOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              <TextArea label="Texto livre usado (se diferente do gerado)" name="customText" rows={2} hint="Textos que divergem da pergunta aprovada exigem revisão." />
              <Field label="Observações" name="notes" />
              <SubmitButton>Registrar</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </div>
  );
}
