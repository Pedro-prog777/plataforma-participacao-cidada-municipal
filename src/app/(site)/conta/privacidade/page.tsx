import { ActionForm, Field, RadioGroup, SubmitButton } from "@/components/ui/form";
import { Alert, Button, Card, LinkButton, PageHeader, Section, Table } from "@/components/ui/primitives";
import { getSession, requireCitizen } from "@/server/auth/current";
import { listDataExports } from "@/server/modules/profile/profile.service";
import { listActiveSessions } from "@/server/modules/auth/session.service";
import { deactivateAction, requestDataAction, revokeOtherSessionsAction } from "@/server/actions/citizen";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Privacidade e meus dados" };

export default async function PrivacidadeContaPage() {
  const a = await requireCitizen("/conta/privacidade");
  const s = await getSession();
  const [exports, sessions] = await Promise.all([listDataExports(a.id), listActiveSessions(a.id)]);
  return (
    <>
      <PageHeader title="Privacidade e meus dados" description="Direitos do titular de dados: obter cópia dos dados e desativar a conta." />
      <div className="space-y-8">
        <Section title="Baixar meus dados" description="Cópia estruturada dos seus dados pessoais, disponível por 48 horas. A alternativa votada não consta porque não é vinculada à sua conta.">
          <Card>
            <ActionForm action={requestDataAction}>
              <RadioGroup
                legend="Formato"
                name="format"
                defaultValue="pdf"
                options={[
                  { value: "pdf", label: "PDF — para ler e imprimir" },
                  { value: "json", label: "Arquivo de dados (JSON) — para usar em outros sistemas" },
                ]}
              />
              <Field label="Confirme com sua senha" name="password" type="password" required autoComplete="current-password" className="max-w-sm" />
              <SubmitButton icon="download">Gerar cópia</SubmitButton>
            </ActionForm>
            {exports.length > 0 && (
              <div className="mt-4 space-y-2">
                {exports.map((e) => (
                  <p key={e.id} className="text-sm">
                    <LinkButton href={`/api/conta/dados/${e.id}`} variant="secondary" icon="download">
                      Baixar {e.format.toUpperCase()}
                    </LinkButton>{" "}
                    <span className="text-muted">disponível até {fmtDateTime(e.expiresAt)}</span>
                  </p>
                ))}
              </div>
            )}
          </Card>
        </Section>
        <Section title="Sessões ativas" description="Encerre o acesso em outros dispositivos.">
          <Table
            head={["Dispositivo", "Início", "Última atividade", ""]}
            rows={sessions.map((x) => [x.userAgent?.slice(0, 60) ?? "—", fmtDateTime(x.createdAt), fmtDateTime(x.lastActivityAt), x.id === s?.sessionId ? "Esta sessão" : ""])}
          />
          {sessions.length > 1 && (
            <form action={revokeOtherSessionsAction}>
              <Button variant="secondary" icon="logout">
                Encerrar as outras sessões
              </Button>
            </form>
          )}
        </Section>
        <Section title="Desativar conta">
          <Card className="space-y-4 border-red-200">
            <Alert tone="danger" title="Ação definitiva">
              Suas sessões serão encerradas e nome, e-mail, celular, endereço e data de nascimento serão anonimizados. Votos e resultados não são alterados. O código protegido do CPF é mantido para impedir novo voto nas mesmas consultas.
            </Alert>
            <ActionForm action={deactivateAction}>
              <Field label="Senha" name="password" type="password" required autoComplete="current-password" className="max-w-sm" />
              <Field label='Digite "DESATIVAR" para confirmar' name="confirmText" required className="max-w-sm" />
              <SubmitButton variant="danger">Desativar minha conta</SubmitButton>
            </ActionForm>
          </Card>
        </Section>
      </div>
    </>
  );
}
