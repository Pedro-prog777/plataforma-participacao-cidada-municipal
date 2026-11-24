import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { StatusBadge } from "@/components/consultation-card";
import { Badge, Breadcrumbs } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";

const TABS: [string, string][] = [
  ["", "Visão geral"],
  ["/editar", "Dados"],
  ["/alternativas", "Alternativas"],
  ["/publico-alvo", "Público-alvo"],
  ["/responsaveis", "Responsáveis"],
  ["/anexos", "Anexos"],
  ["/revisao", "Revisão"],
  ["/aprovacao", "Aprovação"],
  ["/conducao", "Condução"],
  ["/divulgacao", "Divulgação"],
  ["/resultado", "Resultado"],
  ["/encaminhamentos", "Encaminhamentos"],
];

export default async function ConsultaAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id).catch(() => null);
  if (!data) notFound();
  const c = data.c;
  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ href: "/admin/consultas", label: "Consultas" }, { label: c.title }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-2">
            <StatusBadge status={c.status} />
            {data.theme && <Badge tone="primary">{data.theme}</Badge>}
            {c.exceptionalDeadline && <Badge tone="warning">Prazo excepcional ({c.deadlineAuthorization})</Badge>}
            <Badge tone="neutral">Versão {c.version}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
        </div>
        {["agendada", "aberta", "suspensa", "encerrada", "apurada", "finalizada", "cancelada"].includes(c.status) && (
          <Link href={`/consultas/${c.slug}`} className="text-sm font-semibold text-brand-700 underline">
            Ver página pública
          </Link>
        )}
      </div>
      <nav aria-label="Seções da consulta" className="-mx-1 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-line px-1">
          {TABS.map(([suffix, label]) => (
            <li key={suffix}>
              <Link href={`/admin/consultas/${id}${suffix}`} className="block rounded-t-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-white">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
