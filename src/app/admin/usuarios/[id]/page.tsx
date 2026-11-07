import { notFound } from "next/navigation";
import { ActionForm, RadioGroup, SubmitButton, TextArea } from "@/components/ui/form";
import { Alert, Badge, Card, DescriptionList, PageHeader, Section, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { listRoles, userRoleIds } from "@/server/modules/admin/users.service";
import { getProfile } from "@/server/modules/profile/profile.service";
import { searchAudit } from "@/server/modules/audit/audit.service";
import { accountStatusAction, userRolesAction } from "@/server/actions/admin";
import { ACCOUNT_STATUS, fmtDateTime, VERIFICATION_LEVEL } from "@/lib/labels";

export const metadata = { title: "Conta" };

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin("usuarios.gerenciar");
  const { id } = await params;
  const p = await getProfile(id).catch(() => null);
  if (!p) notFound();
  const [roles, mine, history] = await Promise.all([listRoles(), userRoleIds(id), searchAudit({ objectId: id }, 15)]);
  return (
    <>
      <PageHeader title={p.fullName} eyebrow={<Badge tone={ACCOUNT_STATUS[p.status].tone}>{ACCOUNT_STATUS[p.status].label}</Badge>} breadcrumbs={[{ href: "/admin/usuarios", label: "Usuários" }, { label: p.fullName }]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <DescriptionList
            items={[
              { term: "Perfil", detail: p.kind === "admin" ? "Administrador" : "Cidadão" },
              { term: "E-mail", detail: p.email },
              ...(p.kind === "cidadao"
                ? [
                    { term: "CPF", detail: p.cpfMasked ?? "—" },
                    { term: "Verificação", detail: VERIFICATION_LEVEL[p.verificationLevel].label },
                    { term: "Bairro", detail: p.district ?? p.externalCity ?? "—" },
                  ]
                : [{ term: "Matrícula", detail: p.registration ?? "—" }, { term: "Segundo fator", detail: p.mfaEnabledAt ? `Ativo desde ${fmtDateTime(p.mfaEnabledAt)}` : "Não configurado" }]),
              { term: "Cadastro", detail: fmtDateTime(p.createdAt) },
              { term: "Último acesso", detail: fmtDateTime(p.lastLoginAt) },
            ]}
          />
          <p className="mt-3 text-xs text-muted">Senhas e votos nunca são exibidos. Participações não revelam a alternativa escolhida.</p>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Situação da conta</h2>
          {id === a.id ? (
            <Alert tone="neutral">Não é permitido bloquear ou desativar a própria conta.</Alert>
          ) : p.status === "desativada" ? (
            <Alert tone="neutral">Conta desativada.</Alert>
          ) : (
            <ActionForm action={accountStatusAction.bind(null, id)}>
              <RadioGroup
                legend="Ação"
                name="action"
                required
                options={[
                  ...(p.status === "bloqueada" ? [{ value: "desbloquear", label: "Desbloquear" }] : [{ value: "bloquear", label: "Bloquear", description: "Encerra as sessões; atos anteriores permanecem válidos." }]),
                  { value: "desativar", label: "Desativar" },
                ]}
              />
              <TextArea label="Justificativa" name="justification" required rows={2} />
              <SubmitButton variant="secondary">Aplicar</SubmitButton>
            </ActionForm>
          )}
        </Card>
        {p.kind === "admin" && can(a, "papeis.gerenciar") && (
          <Card className="space-y-3">
            <h2 className="font-bold">Papéis</h2>
            <ActionForm action={userRolesAction.bind(null, id)}>
              <div className="grid gap-1 sm:grid-cols-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="roleIds" value={r.id} defaultChecked={mine.includes(r.id)} className="size-4 accent-brand-700" /> {r.name}
                  </label>
                ))}
              </div>
              <SubmitButton>Salvar papéis</SubmitButton>
              <p className="text-xs text-muted">As permissões passam a valer na próxima requisição.</p>
            </ActionForm>
          </Card>
        )}
        <Section title="Registros de auditoria sobre esta conta">
          <Table head={["Data", "Ação", "Resultado"]} rows={history.map((h) => [fmtDateTime(h.occurredAt), h.action, h.result])} />
        </Section>
      </div>
    </>
  );
}
