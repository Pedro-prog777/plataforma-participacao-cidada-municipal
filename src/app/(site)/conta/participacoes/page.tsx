import Link from "next/link";
import { StatusBadge } from "@/components/consultation-card";
import { Badge, EmptyState, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { myParticipations } from "@/server/modules/voting/voting.service";
import { myProposals } from "@/server/modules/proposals/citizen-proposals.service";
import { CITIZEN_PROPOSAL_STATUS, fmtDate } from "@/lib/labels";

export const metadata = { title: "Minhas participações" };

export default async function ParticipacoesPage({ searchParams }: { searchParams: Promise<{ situacao?: string; ano?: string }> }) {
  const a = await requireCitizen("/conta/participacoes");
  const sp = await searchParams;
  const [parts, props] = await Promise.all([myParticipations(a.id), myProposals(a.id)]);
  const filtered = parts.filter((p) => (!sp.situacao || p.status === sp.situacao) && (!sp.ano || p.date.startsWith(sp.ano)));
  const years = Array.from(new Set(parts.map((p) => p.date.slice(0, 4))));
  const cls = "rounded-lg border border-slate-300 bg-white px-3 py-2";
  return (
    <>
      <PageHeader title="Minhas participações" description="Consultas em que você votou, com comprovante e situação. A opção votada nunca é exibida — nem para você." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="situacao" className="mb-1 block text-sm font-semibold">
            Situação
          </label>
          <select id="situacao" name="situacao" defaultValue={sp.situacao ?? ""} className={cls}>
            <option value="">Todas</option>
            <option value="aberta">Aberta</option>
            <option value="finalizada">Resultado publicado</option>
            <option value="cancelada">Cancelada</option>
            <option value="apurada">Resultado em conferência</option>
          </select>
        </div>
        <div>
          <label htmlFor="ano" className="mb-1 block text-sm font-semibold">
            Ano
          </label>
          <select id="ano" name="ano" defaultValue={sp.ano ?? ""} className={cls}>
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <button className="min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white">Filtrar</button>
      </form>
      {filtered.length ? (
        <Table
          head={["Consulta", "Data", "Comprovante", "Situação", ""]}
          rows={filtered.map((p) => [
            <Link key="t" href={`/consultas/${p.slug}`} className="font-semibold text-brand-700 hover:underline">
              {p.title}
            </Link>,
            fmtDate(p.date),
            <code key="c">{p.receipt}</code>,
            <span key="s" className="space-y-1">
              <StatusBadge status={p.status} />
              {p.status === "cancelada" && <span className="block text-xs text-bad-700">Votos não apurados</span>}
            </span>,
            <span key="l" className="flex flex-col gap-1">
              <Link href={`/conta/participacoes/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                Comprovante
              </Link>
              {p.status === "finalizada" && (
                <Link href={`/consultas/${p.slug}/resultado`} className="text-brand-700 hover:underline">
                  Resultado e encaminhamentos
                </Link>
              )}
            </span>,
          ])}
        />
      ) : (
        <EmptyState icon="ballot" title="Nenhuma participação encontrada" action={<LinkButton href="/consultas?situacao=aberta">Ver consultas abertas</LinkButton>} />
      )}
      <Section title="Minhas propostas" className="mt-10" actions={<LinkButton href="/conta/propostas" variant="ghost" iconRight="arrowRight">Ver todas</LinkButton>}>
        {props.length ? (
        <ul className="space-y-2">
          {props.slice(0, 5).map(({ p }) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3">
              <Link href={`/conta/propostas/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                {p.title}
              </Link>
              <Badge tone={CITIZEN_PROPOSAL_STATUS[p.status].tone}>{CITIZEN_PROPOSAL_STATUS[p.status].label}</Badge>
            </li>
          ))}
        </ul>
        ) : (
          // Fora da lista: <p> como filho direto de <ul> é inválido para leitores de tela (axe: list).
          <p className="text-sm text-muted">Você ainda não enviou propostas.</p>
        )}
      </Section>
    </>
  );
}
