import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, Checkbox, Field, RadioGroup, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { audienceAction } from "@/server/actions/admin";
import { YOUTH_MODALITIES, YOUTH_MODALITIES_PERMITIDAS } from "@/lib/labels";

export const metadata = { title: "Público-alvo" };

export default async function PublicoAlvoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [data, ref] = await Promise.all([getAdminConsultation(id), referenceData()]);
  const editable = ["rascunho", "rejeitada"].includes(data.c.status);
  const crit = (t: string) => data.criteria.find((c) => c.type === t);
  const terr = crit("territorio");
  const age = crit("faixa_etaria");
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Público-alvo e critérios de participação</h2>
        <p className="text-sm text-muted"><RefText>“Aberta ao público em geral” ou limitações justificadas, publicadas em linguagem simples. Contas e votos são só para quem tem 18 anos completos (RF036); um critério etário da consulta só pode restringir mais, com justificativa (RN40). Consulta voltada a crianças e adolescentes só pode ser informativa ou educativa.</RefText> Elegíveis estimados atuais: <strong>{data.c.estimatedEligible ?? "—"}</strong>.</p>
      </div>
      <Alert tone="warning" title="Pendente de validação com o cliente (*)">
        O público-alvo padrão (domicílio no município) foi herdado da versão anterior do documento. Critérios do tipo “outro” são apenas informativos e não são verificados automaticamente.
      </Alert>
      <ActionForm action={audienceAction.bind(null, id)}>
        <fieldset disabled={!editable} className="space-y-5">
          <RadioGroup
            legend="Modo"
            name="mode"
            defaultValue={data.c.audienceOpen ? "aberta" : "limitada"}
            options={[
              { value: "aberta", label: "Aberta ao público em geral", description: "Qualquer cidadão com 18 anos completos, conta ativa e identidade verificada." },
              { value: "limitada", label: "Com limitações justificadas", description: "Marque e justifique cada limitação abaixo." },
            ]}
          />
          <div className="space-y-3 rounded-xl border border-line p-4">
            <Checkbox name="domicilio.on" label="Domicílio no município (comprovado)" defaultChecked={!!crit("domicilio")} />
            <TextArea label="Justificativa" name="domicilio.justification" rows={2} defaultValue={crit("domicilio")?.justification} />
            <Field label="Texto público (linguagem simples)" name="domicilio.publicText" defaultValue={crit("domicilio")?.publicText ?? "Pessoas que moram no município, com domicílio comprovado."} />
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <Checkbox name="territorio.on" label="Território (bairros ou regiões)" defaultChecked={!!terr} />
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Regiões</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {ref.regions.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="territorio.regionIds" value={r.id} defaultChecked={terr?.params.regionIds?.includes(r.id)} className="size-4 accent-brand-700" /> {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Ou bairros específicos</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {ref.districts.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="territorio.districtIds" value={d.id} defaultChecked={terr?.params.districtIds?.includes(d.id)} className="size-4 accent-brand-700" /> {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextArea label="Justificativa" name="territorio.justification" rows={2} defaultValue={terr?.justification} />
            <Field label="Texto público" name="territorio.publicText" defaultValue={terr?.publicText} />
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <Checkbox name="faixa_etaria.on" label="Faixa etária (somente com justificativa)" defaultChecked={!!age} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Idade mínima" name="faixa_etaria.minAge" type="number" min={0} defaultValue={age?.params.minAge} />
              <Field label="Idade máxima" name="faixa_etaria.maxAge" type="number" min={0} defaultValue={age?.params.maxAge} />
            </div>
            <TextArea label="Justificativa" name="faixa_etaria.justification" rows={2} defaultValue={age?.justification} />
            <Field label="Texto público" name="faixa_etaria.publicText" defaultValue={age?.publicText} />
            <SelectField label="Modalidade para crianças e adolescentes (RN40)" name="youthModality" placeholder="Não se aplica" options={YOUTH_MODALITIES_PERMITIDAS.map((value) => ({ value, label: YOUTH_MODALITIES[value] }))} defaultValue={data.c.youthModality ?? undefined} />
            <TextArea label="Salvaguardas (coleta mínima, linguagem adequada, consentimento de um dos pais quando for a base legal)" name="youthSafeguards" rows={2} defaultValue={data.c.youthSafeguards ?? undefined} />
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <Checkbox name="outro.on" label="Outro critério (informativo)" defaultChecked={!!crit("outro")} />
            <TextArea label="Justificativa" name="outro.justification" rows={2} defaultValue={crit("outro")?.justification} />
            <Field label="Texto público" name="outro.publicText" defaultValue={crit("outro")?.publicText} />
          </div>
          {editable && <SubmitButton>Salvar público-alvo</SubmitButton>}
        </fieldset>
      </ActionForm>
    </Card>
  );
}
