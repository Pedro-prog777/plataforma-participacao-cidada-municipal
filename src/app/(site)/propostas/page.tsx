import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { listPublishedProposals } from "@/server/modules/proposals/citizen-proposals.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { getSetting } from "@/server/lib/settings";
import { fmtDate, PROPOSAL_RESPONSE } from "@/lib/labels";

export const metadata = { title: "Propostas cidadãs" };

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ q?: string; tema?: string }> }) {
  const sp = await searchParams;
  const [rows, ref, supportsOn] = await Promise.all([listPublishedProposals({ q: sp.q, themeId: sp.tema }), referenceData(), getSetting("recursos.apoios")]);
  const cls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
  return (
    <MainContainer>
      <PageHeader
        title="Propostas cidadãs"
        description="Propostas enviadas por moradores, publicadas com autorização do autor e com a resposta oficial da Prefeitura. Os dados pessoais dos autores nunca são exibidos."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "Propostas" }]}
        actions={<LinkButton href="/conta/propostas/nova" variant="civic" icon="lightbulb">Enviar proposta</LinkButton>}
      />
      <form method="get" role="search" className="mb-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-[2fr_1fr_auto]">
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">
            Palavras-chave
          </label>
          <input id="q" name="q" defaultValue={sp.q} className={cls} />
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
          <button className="min-h-11 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white">Buscar</button>
        </div>
      </form>
      {rows.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((p) => (
            <li key={p.id} className="relative rounded-xl border border-line bg-white p-5 hover:shadow-md">
              <div className="flex flex-wrap gap-2">
                {p.theme && <Badge tone="primary">{p.theme}</Badge>}
                {p.responseType && <Badge tone="success">{PROPOSAL_RESPONSE[p.responseType as keyof typeof PROPOSAL_RESPONSE]}</Badge>}
                {p.priority && <Badge tone="warning">Análise prioritária</Badge>}
              </div>
              <h2 className="mt-2 text-lg font-bold">
                <Link href={`/propostas/${p.protocol}`} className="after:absolute after:inset-0 hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="line-clamp-2 text-sm text-muted">{p.problem}</p>
              <p className="mt-2 text-xs text-muted">
                {p.protocol} · {p.district} · publicada em {fmtDate(p.publishedAt)}
                {supportsOn && ` · ${p.supports} apoios`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="lightbulb" title="Nenhuma proposta publicada encontrada" action={<LinkButton href="/conta/propostas/nova">Enviar uma proposta</LinkButton>} />
      )}
    </MainContainer>
  );
}
