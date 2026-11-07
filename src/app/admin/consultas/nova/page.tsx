import Link from "next/link";
import { ConsultationFields } from "@/components/admin/consultation-form";
import { ActionForm, SelectField, SubmitButton } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { listMunicipalProposals } from "@/server/modules/proposals/municipal-proposals.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { createConsultationAction } from "@/server/actions/admin";
import { getSetting } from "@/server/lib/settings";
import { toLocalInput } from "@/lib/labels";

export const metadata = { title: "Nova consulta" };

export default async function NovaConsultaPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  await requireAdmin("consultas.elaborar");
  const sp = await searchParams;
  const [proposals, ref, padrao, excepcional, antecedencia] = await Promise.all([listMunicipalProposals(), referenceData(), getSetting("consulta.prazo_padrao_dias"), getSetting("consulta.prazo_excepcional_dias"), getSetting("consulta.antecedencia_minima_horas")]);
  const drafts = proposals.filter((p) => p.p.status === "rascunho");
  const chosen = drafts.find((p) => p.p.id === sp.proposta)?.p;
  const opens = new Date(Date.now() + (antecedencia + 48) * 3600_000);
  opens.setMinutes(0, 0, 0);
  return (
    <>
      <PageHeader title="Criar consulta pública" description="Você será designado(a) como elaborador(a). O gestor de acessos define os demais responsáveis antes do envio para revisão." breadcrumbs={[{ href: "/admin/consultas", label: "Consultas" }, { label: "Nova" }]} />
      {!drafts.length ? (
        <Alert tone="warning" title="Nenhuma proposta municipal em Rascunho">
          A consulta é criada a partir de uma proposta municipal. <Link href="/admin/propostas-municipais/nova">Cadastrar proposta municipal</Link>
        </Alert>
      ) : (
        <Card>
          <ActionForm action={createConsultationAction}>
            <SelectField label="Proposta municipal objeto da consulta" name="municipalProposalId" required placeholder="Selecione" options={drafts.map((p) => ({ value: p.p.id, label: p.p.title }))} defaultValue={chosen?.id} />
            <ConsultationFields
              themes={ref.themes.map((t) => ({ value: t.id, label: t.name }))}
              regions={ref.regions.map((r) => ({ value: r.id, label: r.name }))}
              organs={ref.organs.map((o) => ({ value: o.id, label: o.name }))}
              prazo={{ padrao: padrao, excepcional: excepcional }}
              d={{ title: chosen?.title, summary: chosen?.summary, themeId: chosen?.themeId ?? undefined, organId: chosen?.organId ?? undefined, problem: chosen?.description, objective: chosen?.objectives, justification: chosen?.justification, opensAt: toLocalInput(opens), closesAt: toLocalInput(new Date(opens.getTime() + padrao * 86_400_000)) }}
            />
            <SubmitButton>Salvar em Rascunho</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
