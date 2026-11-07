import { BarChart, Card, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { generateReport } from "@/server/modules/admin/monitoring.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { CITIZEN_PROPOSAL_STATUS, CONSULTATION_STATUS } from "@/lib/labels";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdmin("relatorios.gerar");
  const sp = await searchParams;
  const [r, ref] = await Promise.all([generateReport(a, { from: sp.de, to: sp.ate, themeId: sp.tema, regionId: sp.regiao, status: sp.situacao }), referenceData()]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const cls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return (
    <>
      <PageHeader
        title="Relatórios e estatísticas"
        description={`Somente dados agregados. ${r.supressao}`}
        actions={
          <>
            <LinkButton href={`/api/admin/relatorio?formato=csv&${qs}`} variant="secondary" icon="download">
              CSV
            </LinkButton>
            <LinkButton href={`/api/admin/relatorio?formato=pdf&${qs}`} variant="secondary" icon="download">
              PDF
            </LinkButton>
          </>
        }
      />
      <form method="get" className="mb-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label htmlFor="de" className="mb-1 block text-sm font-semibold">De</label>
          <input id="de" name="de" type="date" defaultValue={sp.de} className={cls} />
        </div>
        <div>
          <label htmlFor="ate" className="mb-1 block text-sm font-semibold">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={sp.ate} className={cls} />
        </div>
        <div>
          <label htmlFor="tema" className="mb-1 block text-sm font-semibold">Tema</label>
          <select id="tema" name="tema" defaultValue={sp.tema ?? ""} className={cls}>
            <option value="">Todos</option>
            {ref.themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="regiao" className="mb-1 block text-sm font-semibold">Região</label>
          <select id="regiao" name="regiao" defaultValue={sp.regiao ?? ""} className={cls}>
            <option value="">Todas</option>
            {ref.regions.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="situacao" className="mb-1 block text-sm font-semibold">Situação</label>
          <select id="situacao" name="situacao" defaultValue={sp.situacao ?? ""} className={cls}>
            <option value="">Todas</option>
            {Object.entries(CONSULTATION_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="min-h-11 w-full rounded-lg bg-brand-700 px-4 font-semibold text-white">Gerar</button>
        </div>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <BarChart title="Consultas por situação" unit="consultas" data={r.consultasPorSituacao.map((x) => ({ id: x.situacao, label: CONSULTATION_STATUS[x.situacao as "aberta"]?.label ?? x.situacao, value: x.quantidade }))} />
        </Card>
        <Card>
          <BarChart title="Propostas cidadãs por estado" unit="propostas" data={r.propostasPorEstado.map((x) => ({ id: x.estado, label: CITIZEN_PROPOSAL_STATUS[x.estado as "recebida"]?.label ?? x.estado, value: x.quantidade }))} />
          <p className="mt-3 text-sm">Tempo médio até a resposta: <strong>{r.tempoMedioRespostaPropostasDias ?? "—"} dias</strong></p>
        </Card>
        <Section title="Participação por consulta">
          <Table head={["Consulta", "Situação", "Participações"]} rows={r.participacaoPorConsulta.map((x) => [x.consulta, CONSULTATION_STATUS[x.situacao as "aberta"]?.label ?? x.situacao, x.participacoes])} />
        </Section>
        <Section title="Cadastros por região">
          <Table head={["Região", "Cadastros no período"]} rows={r.cadastrosPorRegiao.map((x) => [x.regiao, x.cadastros])} />
        </Section>
      </div>
    </>
  );
}
