import { MainContainer } from "@/components/layout/site-chrome";
import { BarChart, Card, PageHeader, Section, Stat, Table } from "@/components/ui/primitives";
import { participationByTheme, portalIndicators, statusCounts } from "@/server/modules/consultations/queries.service";
import { CONSULTATION_STATUS, PUBLIC_STATUSES } from "@/lib/labels";

export const metadata = { title: "Painel de indicadores" };

export default async function IndicadoresPage() {
  const [ind, byTheme, counts] = await Promise.all([portalIndicators(), participationByTheme(), statusCounts()]);
  const statusData = PUBLIC_STATUSES.map((s) => ({ id: s, label: CONSULTATION_STATUS[s].label, value: counts[s] ?? 0 })).filter((d) => d.value > 0);
  return (
    <MainContainer>
      <PageHeader title="Painel de indicadores" description="Números agregados da participação no município. Sem dados pessoais." breadcrumbs={[{ href: "/", label: "Início" }, { href: "/transparencia", label: "Transparência" }, { label: "Indicadores" }]} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Participações" value={ind.participacoes.toLocaleString("pt-BR")} icon="users" />
        <Stat label="Consultas publicadas" value={ind.publicadas} icon="ballot" />
        <Stat label="Propostas recebidas" value={ind.propostas_recebidas} icon="lightbulb" />
        <Stat label="Encaminhamentos" value={ind.encaminhamentos} icon="route" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <BarChart title="Participações por tema" unit="participações" data={byTheme.map((t) => ({ id: t.tema, label: t.tema, value: t.participacoes }))} />
        </Card>
        <Card>
          <BarChart title="Consultas por situação" unit="consultas" data={statusData} />
        </Card>
      </div>
      <Section title="Tabela de dados" className="mt-8">
        <Table head={["Tema", "Consultas", "Participações"]} rows={byTheme.map((t) => [t.tema, t.consultas, t.participacoes.toLocaleString("pt-BR")])} caption="Participação por tema" />
      </Section>
    </MainContainer>
  );
}
