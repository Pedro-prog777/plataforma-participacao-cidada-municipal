import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextArea, Field } from "@/components/ui/form";
import { Badge, Card, PageHeader, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { listIncidents } from "@/server/modules/integrity/incidents.service";
import { listAdminConsultations } from "@/server/modules/consultations/queries.service";
import { incidentCreateAction } from "@/server/actions/admin";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Incidentes" };

const SEV = { baixa: "neutral", media: "warning", alta: "danger" } as const;

export default async function IncidentesPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  await requireAdmin("incidentes.tratar");
  const sp = await searchParams;
  const [rows, consultations] = await Promise.all([listIncidents({ status: sp.situacao }), listAdminConsultations()]);
  return (
    <>
      <PageHeader title="Inconsistências e incidentes de segurança" description="Falhas de integridade, adulteração, excesso de tentativas, cadastros suspeitos e quebra da auditoria. Em severidade alta com consulta aberta, o sistema sugere suspensão — a decisão é sempre humana." />
      <nav className="mb-4 flex gap-2 text-sm">
        {[["", "Todos"], ["aberto", "Abertos"], ["em_analise", "Em análise"], ["encerrado", "Encerrados"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/incidentes?situacao=${k}` : "/admin/incidentes"} className={`rounded-full px-3 py-1.5 font-semibold ring-1 ring-brand-200 ${sp.situacao === k || (!sp.situacao && !k) ? "bg-brand-700 text-white" : "bg-white"}`}>{l}</Link>
        ))}
      </nav>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Table
          head={["Data", "Severidade", "Tipo", "Consulta", "Situação"]}
          rows={rows.map(({ i, consultation }) => [
            fmtDateTime(i.createdAt),
            <Badge key="s" tone={SEV[i.severity as keyof typeof SEV] ?? "neutral"}>{i.severity}</Badge>,
            <Link key="t" href={`/admin/incidentes/${i.id}`} className="font-semibold text-brand-700 hover:underline">{i.type}</Link>,
            consultation ?? "—",
            i.status,
          ])}
          empty="Nenhum incidente."
        />
        <Card className="space-y-3 self-start">
          <h2 className="font-bold">Registrar incidente manual</h2>
          <ActionForm action={incidentCreateAction}>
            <SelectField label="Severidade" name="severity" required options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }]} />
            <Field label="Tipo" name="type" required placeholder="ex.: cadastro_suspeito" />
            <SelectField label="Consulta (opcional)" name="consultationId" placeholder="Nenhuma" options={consultations.map((c) => ({ value: c.id, label: c.title }))} />
            <TextArea label="Descrição e evidências" name="description" required rows={3} />
            <SubmitButton>Registrar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
