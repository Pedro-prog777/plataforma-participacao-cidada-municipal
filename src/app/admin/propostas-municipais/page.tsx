import Link from "next/link";
import { Badge, LinkButton, PageHeader, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { listMunicipalProposals } from "@/server/modules/proposals/municipal-proposals.service";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Propostas municipais" };

const STATUS: Record<string, string> = { rascunho: "Rascunho", em_analise: "Em análise", em_consulta: "Em consulta", rejeitada: "Rejeitada" };

export default async function PropostasMunicipaisPage() {
  await requireAdmin("propostas_municipais.gerenciar");
  const rows = await listMunicipalProposals();
  return (
    <>
      <PageHeader title="Propostas municipais" description="Propostas oficiais que podem ser objeto de consulta pública (RF022)." actions={<LinkButton href="/admin/propostas-municipais/nova" icon="clipboard">Nova proposta</LinkButton>} />
      <Table
        head={["Título", "Tema", "Órgão", "Situação", "Versão", "Atualizada", ""]}
        rows={rows.map(({ p, theme, organ }) => [
          <Link key="t" href={`/admin/propostas-municipais/${p.id}`} className="font-semibold text-brand-700 hover:underline">
            {p.title}
          </Link>,
          theme ?? "—",
          organ ?? "—",
          <Badge key="s" tone={p.status === "rascunho" ? "neutral" : "info"}>
            {STATUS[p.status] ?? p.status}
          </Badge>,
          `v${p.version}`,
          fmtDateTime(p.updatedAt),
          p.originCitizenProposalId ? <Badge key="o" tone="primary">De proposta cidadã</Badge> : "",
        ])}
      />
    </>
  );
}
