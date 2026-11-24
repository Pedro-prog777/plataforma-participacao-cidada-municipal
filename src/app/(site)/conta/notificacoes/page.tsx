import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader, Section } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { getPreferences, NOTIFICATION_TYPES, OPTIONAL_TYPES } from "@/server/modules/notifications/notifications.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { savePreferencesAction } from "@/server/actions/citizen";

export const metadata = { title: "Preferências de aviso" };

export default async function NotificacoesPage() {
  const a = await requireCitizen("/conta/notificacoes");
  const [prefs, ref] = await Promise.all([getPreferences(a.id), referenceData()]);
  const mandatory = Object.entries(NOTIFICATION_TYPES).filter(([, v]) => !v.optional);
  return (
    <>
      <PageHeader title="Preferências de aviso" description="Escolha quais avisos deseja receber, por e-mail e na central de avisos, e filtre por tema e bairro." />
      <Card>
        <ActionForm action={savePreferencesAction}>
          <div className="overflow-x-auto" role="region" aria-label="Tipos de aviso" tabIndex={0}>
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">Tipos de aviso</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-2">Tipo de aviso</th>
                  <th scope="col" className="py-2 text-center">E-mail</th>
                  <th scope="col" className="py-2 text-center">Central</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {OPTIONAL_TYPES.map((t) => (
                  <tr key={t}>
                    <th scope="row" className="py-3 text-left font-medium">
                      {NOTIFICATION_TYPES[t].label}
                    </th>
                    <td className="text-center">
                      <input type="checkbox" name={`${t}.email`} defaultChecked={prefs.types[t]?.email ?? true} aria-label={`${NOTIFICATION_TYPES[t].label} por e-mail`} className="size-5 accent-brand-700" />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" name={`${t}.inApp`} defaultChecked={prefs.types[t]?.inApp ?? true} aria-label={`${NOTIFICATION_TYPES[t].label} na central`} className="size-5 accent-brand-700" />
                    </td>
                  </tr>
                ))}
                {mandatory.map(([t, v]) => (
                  <tr key={t} className="text-muted">
                    <th scope="row" className="py-3 text-left font-medium">
                      {v.label}
                    </th>
                    <td className="text-center">sempre</td>
                    <td className="text-center">sempre</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Temas de interesse (vazio = todos)</legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ref.themes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="themeIds" value={t.id} defaultChecked={prefs.themeIds.includes(t.id)} className="size-4 accent-brand-700" /> {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Bairros de interesse (vazio = todos)</legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ref.districts.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="districtIds" value={d.id} defaultChecked={prefs.districtIds.includes(d.id)} className="size-4 accent-brand-700" /> {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <SubmitButton>Salvar preferências</SubmitButton>
        </ActionForm>
      </Card>
      <Section title="Descadastro sem login" className="mt-6">
        <p className="text-sm text-muted">Todo e-mail de aviso opcional traz um link para desativar aquele tipo de aviso sem precisar entrar na conta.</p>
      </Section>
    </>
  );
}
