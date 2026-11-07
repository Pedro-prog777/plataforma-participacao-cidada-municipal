import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { listPublicOutcomes } from "@/server/modules/consultations/queries.service";
import { fmtDate, fmtDateTime, OUTCOME_STATUS } from "@/lib/labels";

export const metadata = { title: "Encaminhamentos da Prefeitura" };

export default async function EncaminhamentosPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const sp = await searchParams;
  const all = await listPublicOutcomes();
  const rows = sp.situacao ? all.filter((o) => o.current?.status === sp.situacao) : all;
  return (
    <MainContainer>
      <PageHeader
        title="Encaminhamentos da Prefeitura"
        description="O que foi feito depois de cada resultado. A plataforma publica apenas o que a administração registra; não acompanha obras nem orçamento."
        breadcrumbs={[{ href: "/", label: "Início" }, { href: "/transparencia", label: "Transparência" }, { label: "Encaminhamentos" }]}
        actions={<LinkButton href="/api/dados-abertos/encaminhamentos?formato=csv" variant="secondary" icon="download">CSV</LinkButton>}
      />
      <nav aria-label="Filtrar por situação" className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/encaminhamentos" className={`rounded-full px-3 py-1.5 font-semibold ${!sp.situacao ? "bg-brand-700 text-white" : "bg-white text-brand-800 ring-1 ring-brand-200"}`}>
          Todos ({all.length})
        </Link>
        {Object.entries(OUTCOME_STATUS).map(([k, v]) => (
          <Link key={k} href={`/encaminhamentos?situacao=${k}`} className={`rounded-full px-3 py-1.5 font-semibold ${sp.situacao === k ? "bg-brand-700 text-white" : "bg-white text-brand-800 ring-1 ring-brand-200"}`}>
            {v.label} ({all.filter((o) => o.current?.status === k).length})
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((o) => (
            <li key={o.o.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {o.current && <Badge tone={OUTCOME_STATUS[o.current.status].tone}>{OUTCOME_STATUS[o.current.status].label}</Badge>}
                <span className="text-sm text-muted">{o.organ}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold">{o.o.decision}</h2>
              <p className="text-sm">{o.o.actions}</p>
              <p className="mt-1 text-sm">
                Consulta:{" "}
                <Link href={`/consultas/${o.slug}`} className="font-semibold text-brand-700 hover:underline">
                  {o.consultation}
                </Link>
              </p>
              <ol className="mt-3 space-y-1 border-l-2 border-brand-100 pl-4 text-sm">
                {o.entries.map((e) => (
                  <li key={e.id}>
                    <span className="text-muted">{fmtDateTime(e.createdAt)}</span> — <strong>{OUTCOME_STATUS[e.status].label}</strong>
                    {e.expectedDate && ` · previsto para ${fmtDate(e.expectedDate)}`}
                    {e.justification && ` · ${e.justification}`}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="route" title={`Nenhum encaminhamento registrado até ${fmtDate(new Date())}`} />
      )}
    </MainContainer>
  );
}
