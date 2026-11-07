import { MunicipalProposalForm } from "@/components/admin/municipal-proposal-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { saveMunicipalProposalAction } from "@/server/actions/admin";

export const metadata = { title: "Nova proposta municipal" };

export default async function NovaPropostaMunicipalPage() {
  await requireAdmin("propostas_municipais.gerenciar");
  const ref = await referenceData();
  return (
    <>
      <PageHeader title="Cadastrar proposta municipal" breadcrumbs={[{ href: "/admin/propostas-municipais", label: "Propostas municipais" }, { label: "Nova" }]} />
      <Card>
        <MunicipalProposalForm action={saveMunicipalProposalAction.bind(null, null)} themes={ref.themes.map((t) => ({ value: t.id, label: t.name }))} organs={ref.organs.map((o) => ({ value: o.id, label: o.name }))} />
      </Card>
    </>
  );
}
