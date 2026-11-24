import { RefText } from "@/components/requisitos/ref-text";
import { ActionForm, Checkbox, Field, FieldError, SelectField, SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAllSettings } from "@/server/lib/settings";
import { settingsAction } from "@/server/actions/admin";

export const metadata = { title: "Parâmetros" };

export default async function ConfiguracoesPage() {
  await requireAdmin("configuracoes.gerenciar");
  const all = await getAllSettings();
  const groups = Array.from(new Set(all.map((s) => s.group)));
  return (
    <>
      <PageHeader title="Parâmetros do sistema" description="Prazos, limites, metas e recursos configuráveis sem alterar o código (RNF12). Toda alteração é auditada." />
      <Alert tone="warning" className="mb-6" title="Itens marcados como pendentes dependem de validação do cliente (*)">
        Os valores padrão são propostas da equipe e não decisões aprovadas. Recursos condicionados (comentários, apoios e eventos) começam desligados.
      </Alert>
      <ActionForm action={settingsAction}>
        {groups.map((g) => (
          <Card key={g} as="section" className="space-y-4">
            <h2 className="text-lg font-bold">{g}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {all
                .filter((s) => s.group === g)
                .map((s) => {
                  const label = (
                    <>
                      <RefText>{s.label}</RefText> {"pendente" in s && s.pendente && <Badge tone="warning">pendente (*)</Badge>}{" "}
                      <span className="text-xs font-normal text-muted">
                        [<RefText>{s.source}</RefText>]
                      </span>
                    </>
                  );
                  if (s.kind === "boolean")
                    return (
                      <div key={s.key}>
                        <Checkbox name={s.key} label={label} defaultChecked={Boolean(s.value)} />
                        <FieldError name={s.key} />
                      </div>
                    );
                  if (s.kind === "select") return <SelectField key={s.key} name={s.key} label={label} required options={(s.options ?? []).map((o) => ({ value: o, label: o }))} defaultValue={String(s.value)} />;
                  return <Field key={s.key} name={s.key} label={label} required type={s.kind === "number" ? "number" : "text"} min={0} defaultValue={String(s.value)} />;
                })}
            </div>
          </Card>
        ))}
        <SubmitButton>Salvar parâmetros</SubmitButton>
      </ActionForm>
    </>
  );
}
