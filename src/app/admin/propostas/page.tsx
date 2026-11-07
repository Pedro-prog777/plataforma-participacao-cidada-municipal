import Link from "next/link";
import { Badge, PageHeader, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { proposalQueue } from "@/server/modules/proposals/citizen-proposals.service";
import { CITIZEN_PROPOSAL_STATUS, fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Propostas cidadãs" };

export default async function AdminPropostasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin("propostas_cidadas.analisar");
  const sp = await searchParams;
  const rows = await proposalQueue({ status: sp.estado });
  return (
    <>
      <PageHeader title="Fila de propostas cidadãs" description="Das mais antigas para as mais recentes; propostas que atingiram a meta de apoios aparecem primeiro." />
      <nav aria-label="Filtrar" className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/propostas" className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-brand-200">Em aberto</Link>
        {Object.entries(CITIZEN_PROPOSAL_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/propostas?estado=${k}`} className={`rounded-full px-3 py-1.5 font-semibold ring-1 ring-brand-200 ${sp.estado === k ? "bg-brand-700 text-white" : "bg-white"}`}>
            {v.label}
          </Link>
        ))}
      </nav>
      <Table
        head={["Protocolo", "Título", "Tema / bairro", "Recebida", "Estado"]}
        rows={rows.map(({ p, theme, district }) => [
          <code key="p">{p.protocol}</code>,
          <span key="t">
            <Link href={`/admin/propostas/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.title}</Link>
            {p.priority && <Badge tone="warning" className="ml-2">Prioritária</Badge>}
            {p.hidden && <Badge tone="danger" className="ml-2">Oculta</Badge>}
          </span>,
          `${theme} · ${district}`,
          fmtDateTime(p.createdAt),
          <Badge key="s" tone={CITIZEN_PROPOSAL_STATUS[p.status].tone}>{CITIZEN_PROPOSAL_STATUS[p.status].label}</Badge>,
        ])}
        empty="Nenhuma proposta nesta fila."
      />
    </>
  );
}
