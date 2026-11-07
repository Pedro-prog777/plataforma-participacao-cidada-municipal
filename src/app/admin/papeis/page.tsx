import { ActionForm, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { Badge, Card, PageHeader, Section } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { listRoles } from "@/server/modules/admin/users.service";
import { deleteRoleAction, saveRoleAction } from "@/server/actions/admin";
import { FORBIDDEN_COMBINATIONS, PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Papéis e permissões" };

function PermissionChecks({ selected }: { selected: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {Object.entries(PERMISSIONS).map(([k, label]) => (
        <label key={k} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="permissions" value={k} defaultChecked={selected.includes(k)} className="mt-0.5 size-4 accent-brand-700" />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default async function PapeisPage() {
  await requireAdmin("papeis.gerenciar");
  const roles = await listRoles();
  return (
    <>
      <PageHeader title="Papéis e permissões" description={`Papéis são conjuntos de permissões atribuídos às contas. Combinações vedadas no mesmo papel: ${FORBIDDEN_COMBINATIONS.map(([, , w]) => w).join("; ")} (RN20).`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Section title="Papéis cadastrados">
          <div className="space-y-3">
            {roles.map((r) => (
              <Card key={r.id}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong className="text-brand-900">{r.name}</strong> {r.system && <Badge tone="primary">previsto no documento</Badge>}
                      <span className="block text-sm text-muted">{r.description}</span>
                    </span>
                    <Badge tone="neutral">{r.members} conta(s)</Badge>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <ActionForm action={saveRoleAction.bind(null, r.id)}>
                      <Field label="Nome" name="name" required defaultValue={r.name} />
                      <TextArea label="Descrição" name="description" rows={2} defaultValue={r.description} />
                      <PermissionChecks selected={r.permissions} />
                      <SubmitButton>Salvar papel</SubmitButton>
                    </ActionForm>
                    {!r.system && (
                      <ActionForm action={deleteRoleAction.bind(null, r.id)}>
                        <SubmitButton variant="danger">Excluir papel</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </Section>
        <Card className="space-y-3 self-start">
          <h2 className="font-bold">Novo papel</h2>
          <ActionForm action={saveRoleAction.bind(null, null)}>
            <Field label="Nome" name="name" required />
            <TextArea label="Descrição" name="description" rows={2} />
            <PermissionChecks selected={[]} />
            <SubmitButton>Criar papel</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
