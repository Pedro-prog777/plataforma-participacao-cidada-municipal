import Link from "next/link";
import { StatusBadge } from "@/components/consultation-card";
import { LinkButton, PageHeader, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { listAdminConsultations } from "@/server/modules/consultations/queries.service";
import { CONSULTATION_STATUS } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Consultas" };

export default async function AdminConsultasPage({ searchParams }: { searchParams: Promise<{ situacao?: string; q?: string }> }) {
  const a = await requireAdmin();
  const sp = await searchParams;
  const rows = await listAdminConsultations({ status: sp.situacao, q: sp.q });
  const cls = "rounded-lg border border-slate-300 bg-white px-3 py-2";
  return (
    <>
      <PageHeader
        title="Gerenciamento de consultas"
        description="Todas as situações, inclusive as que ainda não são públicas."
        actions={can(a, "consultas.elaborar") ? <LinkButton href="/admin/consultas/nova" icon="ballot">Nova consulta</LinkButton> : undefined}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">
            Buscar
          </label>
          <input id="q" name="q" defaultValue={sp.q} className={cls} />
        </div>
        <div>
          <label htmlFor="situacao" className="mb-1 block text-sm font-semibold">
            Situação
          </label>
          <select id="situacao" name="situacao" defaultValue={sp.situacao ?? ""} className={cls}>
            <option value="">Todas</option>
            {Object.entries(CONSULTATION_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <button className="min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white">Filtrar</button>
      </form>
      <Table
        head={["Consulta", "Situação", "Período", "Participações", "Atualizada"]}
        rows={rows.map((c) => [
          <span key="t">
            <Link href={`/admin/consultas/${c.id}`} className="font-semibold text-brand-700 hover:underline">
              {c.title}
            </Link>
            <span className="block text-xs text-muted">
              {c.theme} · v{c.version} · por {c.author}
            </span>
          </span>,
          <StatusBadge key="s" status={c.status} />,
          `${fmtDate(c.opensAt)} – ${fmtDate(c.closesAt)}`,
          c.participations,
          fmtDateTime(c.updatedAt),
        ])}
        empty="Nenhuma consulta."
      />
    </>
  );
}
