import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, FieldError, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { can, usersWithPermission } from "@/server/modules/access/access.service";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { assignmentsAction } from "@/server/actions/admin";
import { CONSULTATION_ROLES, CONSULTATION_ROLE_KEYS, type Permission } from "@/lib/permissions";

export const metadata = { title: "Responsáveis" };

export default async function ResponsaveisPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  const { id } = await params;
  const data = await getAdminConsultation(id);
  const candidates = Object.fromEntries(await Promise.all(CONSULTATION_ROLE_KEYS.map(async (r) => [r, await usersWithPermission(CONSULTATION_ROLES[r].permission as Permission)])));
  const allowed = can(a, "responsaveis.designar");
  const draft = ["rascunho", "rejeitada"].includes(data.c.status);
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Responsáveis e papéis da consulta</h2>
        <p className="text-sm text-muted"><RefText>Uma conta pode acumular papéis, exceto elaborar ou revisar e aprovar (RN20). Publicamente aparece apenas a unidade responsável, não o nome das pessoas.</RefText></p>
      </div>
      {!allowed && <Alert tone="neutral">Somente o gestor de acessos designa responsáveis.</Alert>}
      <ActionForm action={assignmentsAction.bind(null, id)}>
        <fieldset disabled={!allowed} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {CONSULTATION_ROLE_KEYS.map((role) => {
              const def = CONSULTATION_ROLES[role];
              const current = new Set(data.assignments.filter((x) => x.role === role).map((x) => x.userId));
              return (
                <fieldset key={role} className="rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">
                    {def.label} {def.required || (role === "autorizador_prazo" && data.c.exceptionalDeadline) ? <span className="text-bad-700">*</span> : <span className="font-normal text-muted">(opcional)</span>}
                  </legend>
                  <div className="space-y-1">
                    {(candidates[role] as { id: string; name: string }[]).map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={role} value={u.id} defaultChecked={current.has(u.id)} className="size-4 accent-brand-700" /> {u.name}
                      </label>
                    ))}
                    {!(candidates[role] as unknown[]).length && <p className="text-xs text-muted">Nenhuma conta com a permissão “{def.permission}”.</p>}
                  </div>
                  <FieldError name={role} />
                </fieldset>
              );
            })}
          </div>
          {!draft && <TextArea label="Justificativa da substituição (registrada no histórico público)" name="justification" required rows={2} />}
          {allowed && <SubmitButton>Salvar responsáveis</SubmitButton>}
        </fieldset>
      </ActionForm>
    </Card>
  );
}
