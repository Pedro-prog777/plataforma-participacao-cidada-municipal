import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { listPublishedResults } from "@/server/modules/consultations/queries.service";
import { fmtDate } from "@/lib/labels";

export const metadata = { title: "Resultados" };

export default async function ResultadosPage() {
  const all = await listPublishedResults();
  // Uma linha por consulta (versão mais recente).
  const seen = new Set<string>();
  const rows = all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return (
    <MainContainer>
      <PageHeader
        title="Resultados das consultas"
        description="Resultados oficiais publicados. São resultados de participação voluntária e não representam estatisticamente toda a população."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "Resultados" }]}
        actions={<LinkButton href="/dados-abertos" variant="secondary" icon="download">Dados abertos</LinkButton>}
      />
      {rows.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const w = r.data.alternatives.find((a) => a.id === r.data.winnerId);
            return (
              <li key={r.id} className="rounded-xl border border-line bg-white p-5">
                <div className="flex flex-wrap gap-2">
                  {r.theme && <Badge tone="primary">{r.theme}</Badge>}
                  <Badge tone={r.kind === "retificacao" ? "warning" : "success"}>{r.kind === "retificacao" ? "Corrigido" : "Final"}</Badge>
                </div>
                <h2 className="mt-2 text-lg font-bold">
                  <Link href={`/consultas/${r.slug}/resultado`} className="hover:underline">
                    {r.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">Publicado em {fmtDate(r.publishedAt)} · {r.data.participations} participações</p>
                <div className="mt-3 space-y-1.5">
                  {r.data.alternatives.map((a) => (
                    <div key={a.id}>
                      <div className="flex justify-between text-sm">
                        <span className={a.id === r.data.winnerId ? "font-semibold" : ""}>{a.label}</span>
                        <span className="tabular-nums text-muted">{a.percentage.replace(".", ",")}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-brand-50" aria-hidden="true">
                        <div className={`h-2 rounded-full ${a.id === r.data.winnerId ? "bg-civic-500" : "bg-brand-500"}`} style={{ width: `${a.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm">{w ? <>Mais votada: <strong>{w.label}</strong></> : "Sem alternativa vencedora."}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="chart" title="Nenhum resultado publicado ainda" />
      )}
    </MainContainer>
  );
}
