import Link from "next/link";
import { Badge, EmptyState, LinkButton, PageHeader, Table } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { myProposals } from "@/server/modules/proposals/citizen-proposals.service";
import { CITIZEN_PROPOSAL_STATUS, fmtDate } from "@/lib/labels";

export const metadata = { title: "Minhas propostas" };

export default async function MinhasPropostasPage() {
  const a = await requireCitizen("/conta/propostas");
  const rows = await myProposals(a.id);
  return (
    <>
      <PageHeader title="Minhas propostas" description="Acompanhe o andamento pelo protocolo. Seus dados pessoais nunca são publicados." actions={<LinkButton href="/conta/propostas/nova" variant="civic" icon="lightbulb">Nova proposta</LinkButton>} />
      {rows.length ? (
        <Table
          head={["Protocolo", "Título", "Tema", "Envio", "Estado"]}
          rows={rows.map(({ p, theme }) => [
            <code key="p">{p.protocol}</code>,
            <Link key="t" href={`/conta/propostas/${p.id}`} className="font-semibold text-brand-700 hover:underline">
              {p.title}
            </Link>,
            theme,
            fmtDate(p.createdAt),
            <Badge key="s" tone={CITIZEN_PROPOSAL_STATUS[p.status].tone}>
              {CITIZEN_PROPOSAL_STATUS[p.status].label}
            </Badge>,
          ])}
        />
      ) : (
        <EmptyState icon="lightbulb" title="Você ainda não enviou propostas" action={<LinkButton href="/conta/propostas/nova">Enviar a primeira</LinkButton>} />
      )}
    </>
  );
}
