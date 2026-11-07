import { ConsultationCard } from "@/components/consultation-card";
import { MainContainer } from "@/components/layout/site-chrome";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/primitives";
import { listPublicConsultations, referenceData } from "@/server/modules/consultations/queries.service";

export const metadata = { title: "Consultas anteriores" };

export default async function EncerradasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [result, ref] = await Promise.all([listPublicConsultations({ archive: true, q: sp.q, themeId: sp.tema, regionId: sp.regiao, year: sp.ano, page: Number(sp.pagina) || 1 }), referenceData()]);
  const year = new Date().getFullYear();
  const cls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
  return (
    <MainContainer>
      <PageHeader
        title="Consultas anteriores"
        description="Acervo público permanente das consultas finalizadas e canceladas, com documentos, histórico, resultados e encaminhamentos."
        breadcrumbs={[{ href: "/", label: "Início" }, { href: "/consultas", label: "Consultas" }, { label: "Anteriores" }]}
      />
      <form method="get" role="search" aria-label="Filtrar acervo" className="mb-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">
            Palavras-chave
          </label>
          <input id="q" name="q" defaultValue={sp.q} className={cls} />
        </div>
        <div>
          <label htmlFor="ano" className="mb-1 block text-sm font-semibold">
            Ano
          </label>
          <select id="ano" name="ano" defaultValue={sp.ano ?? ""} className={cls}>
            <option value="">Todos</option>
            {[year, year - 1, year - 2].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tema" className="mb-1 block text-sm font-semibold">
            Tema
          </label>
          <select id="tema" name="tema" defaultValue={sp.tema ?? ""} className={cls}>
            <option value="">Todos</option>
            {ref.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="min-h-11 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white">Filtrar</button>
        </div>
      </form>
      {result.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <ConsultationCard key={c.slug} c={c} />
          ))}
        </div>
      ) : (
        <EmptyState icon="list" title="Nenhuma consulta no acervo com esses filtros" />
      )}
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => `/consultas/encerradas?${new URLSearchParams({ ...(sp as Record<string, string>), pagina: String(p) })}`} />
    </MainContainer>
  );
}
