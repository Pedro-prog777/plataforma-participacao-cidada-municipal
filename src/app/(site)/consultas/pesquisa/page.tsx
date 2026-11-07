import { MainContainer } from "@/components/layout/site-chrome";
import { Card, PageHeader } from "@/components/ui/primitives";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { CONSULTATION_STATUS, PUBLIC_STATUSES } from "@/lib/labels";

export const metadata = { title: "Pesquisa de consultas" };

const field = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";

export default async function PesquisaPage() {
  const ref = await referenceData();
  return (
    <MainContainer>
      <PageHeader
        title="Pesquisa avançada"
        description="Combine palavras-chave com situação, tema, região e período. A busca não diferencia maiúsculas nem acentos."
        breadcrumbs={[{ href: "/", label: "Início" }, { href: "/consultas", label: "Consultas" }, { label: "Pesquisa avançada" }]}
      />
      <Card className="max-w-3xl">
        <form method="get" action="/consultas" role="search" className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="q" className="mb-1 block text-sm font-semibold">
              Palavras-chave
            </label>
            <input id="q" name="q" className={field} placeholder="Busca no título, resumo e proposta" />
          </div>
          <div>
            <label htmlFor="situacao" className="mb-1 block text-sm font-semibold">
              Situação
            </label>
            <select id="situacao" name="situacao" className={field} defaultValue="">
              <option value="">Todas</option>
              {PUBLIC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONSULTATION_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tema" className="mb-1 block text-sm font-semibold">
              Tema
            </label>
            <select id="tema" name="tema" className={field} defaultValue="">
              <option value="">Todos</option>
              {ref.themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="regiao" className="mb-1 block text-sm font-semibold">
              Região
            </label>
            <select id="regiao" name="regiao" className={field} defaultValue="">
              <option value="">Todas</option>
              {ref.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="grid grid-cols-2 gap-3 sm:col-span-2">
            <legend className="mb-1 text-sm font-semibold">Período de participação</legend>
            <div>
              <label htmlFor="de" className="mb-1 block text-xs text-muted">
                De
              </label>
              <input id="de" name="de" type="date" className={field} />
            </div>
            <div>
              <label htmlFor="ate" className="mb-1 block text-xs text-muted">
                Até
              </label>
              <input id="ate" name="ate" type="date" className={field} />
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <button className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800">Pesquisar</button>
          </div>
        </form>
      </Card>
    </MainContainer>
  );
}
