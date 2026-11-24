import { MainContainer } from "@/components/layout/site-chrome";
import { Card, PageHeader, Section, Table } from "@/components/ui/primitives";
import { DATA_DICTIONARY } from "@/server/modules/results/open-data.service";

export const metadata = { title: "Dados abertos" };

const field = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";

export default function DadosAbertosPage() {
  return (
    <MainContainer>
      <PageHeader
        title="Dados abertos"
        description="Baixe os resultados e os encaminhamentos para abrir em planilhas ou usar em outros sistemas. Só números gerais: sem dados pessoais e sem votos individuais."
        breadcrumbs={[{ href: "/", label: "Início" }, { href: "/transparencia", label: "Transparência" }, { label: "Dados abertos" }]}
      />
      <div className="grid gap-6 md:grid-cols-2">
        {(["resultados", "encaminhamentos"] as const).map((ds) => (
          <Card key={ds} className="space-y-3">
            <h2 className="text-lg font-bold capitalize">{ds}</h2>
            <form method="get" action={`/api/dados-abertos/${ds}`} className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`${ds}-formato`} className="mb-1 block text-sm font-semibold">
                  Formato
                </label>
                <select id={`${ds}-formato`} name="formato" className={field}>
                  <option value="csv">Planilha (CSV)</option>
                  <option value="json">Dados para sistemas (JSON)</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              {ds === "resultados" && (
                <>
                  <div>
                    <label htmlFor="de" className="mb-1 block text-sm font-semibold">
                      Publicado de
                    </label>
                    <input id="de" name="de" type="date" className={field} />
                  </div>
                  <div>
                    <label htmlFor="ate" className="mb-1 block text-sm font-semibold">
                      Até
                    </label>
                    <input id="ate" name="ate" type="date" className={field} />
                  </div>
                </>
              )}
              <div className="sm:col-span-3">
                <button className="min-h-11 rounded-lg bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Baixar arquivo</button>
              </div>
            </form>
          </Card>
        ))}
      </div>
      {(["resultados", "encaminhamentos"] as const).map((ds) => (
        <Section key={ds} title={`O que significa cada coluna — ${ds}`} className="mt-10">
          <Table head={["Campo", "Tipo", "Descrição"]} rows={DATA_DICTIONARY[ds].map((d) => [<code key="c">{d.campo}</code>, d.tipo, d.descricao])} />
        </Section>
      ))}
      <p className="mt-6 text-sm text-muted">Informações técnicas: a planilha usa “;” como separador e codificação UTF-8; as datas seguem o padrão ISO 8601, no horário UTC.</p>
    </MainContainer>
  );
}
