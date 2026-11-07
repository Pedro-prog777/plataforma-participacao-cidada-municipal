import { ActionForm, Field, SelectField, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { listRoles } from "@/server/modules/admin/users.service";
import { inviteAction } from "@/server/actions/admin";

export const metadata = { title: "Convidar servidor" };

export default async function ConvidarPage() {
  await requireAdmin("usuarios.gerenciar");
  const [ref, roles] = await Promise.all([referenceData(), listRoles()]);
  return (
    <>
      <PageHeader title="Convidar conta administrativa" description="O convite vale por 72 horas. O convidado define a senha e o segundo fator (aplicativo autenticador)." breadcrumbs={[{ href: "/admin/usuarios", label: "Usuários" }, { label: "Convidar" }]} />
      <Card className="max-w-2xl">
        <ActionForm action={inviteAction}>
          <Field label="Nome completo" name="name" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matrícula" name="registration" required />
            <Field label="E-mail institucional" name="email" type="email" required />
          </div>
          <SelectField label="Órgão" name="organId" required placeholder="Selecione" options={ref.organs.map((o) => ({ value: o.id, label: o.name }))} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Papéis iniciais</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {roles.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="roleIds" value={r.id} className="mt-0.5 size-4 accent-brand-700" />
                  <span>
                    <strong>{r.name}</strong>
                    <span className="block text-xs text-muted">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>Enviar convite</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
