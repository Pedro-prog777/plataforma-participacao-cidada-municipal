import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, DescriptionList, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { eligibilitySummary, getProfile } from "@/server/modules/profile/profile.service";
import { ACCOUNT_STATUS, fmtDate, fmtDateTime, VERIFICATION_LEVEL } from "@/lib/labels";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const a = await requireCitizen();
  const [p, summary] = await Promise.all([getProfile(a.id), eligibilitySummary(a.id)]);
  if (!p) notFound();
  return (
    <>
      <PageHeader
        title="Meu perfil"
        description="Seus dados cadastrais. O CPF é exibido mascarado e não pode ser alterado."
        actions={
          <>
            <LinkButton href="/conta/perfil/editar" icon="settings">
              Atualizar dados
            </LinkButton>
            <LinkButton href="/conta/senha" variant="secondary" icon="key">
              Alterar senha
            </LinkButton>
          </>
        }
      />
      <div className="space-y-8">
        <Section title="Situação para participar" description="Resumo de elegibilidade: o motivo e a ação necessária quando houver impedimento.">
          <div className="grid gap-3 md:grid-cols-2">
            {summary.map((s) => (
              <Card key={s.label} className={s.ok ? "border-green-300" : "border-amber-300"}>
                <p className="text-sm font-semibold text-muted">{s.label}</p>
                <p className={`mt-1 font-semibold ${s.ok ? "text-ok-700" : "text-warn-800"}`}>{s.ok ? "Você pode participar" : s.reason}</p>
                {!s.ok && s.action && (
                  <LinkButton href={s.action.href} variant="secondary" className="mt-3">
                    {s.action.label}
                  </LinkButton>
                )}
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted">Cada consulta pode ter critérios próprios (território, faixa etária). A verificação final é feita no momento do voto.</p>
        </Section>
        <Section title="Dados da conta">
          <Card>
            <DescriptionList
              items={[
                { term: "Nome completo", detail: p.fullName },
                { term: "Nome social", detail: p.socialName ?? "—" },
                { term: "CPF", detail: <span className="font-mono">{p.cpfMasked}</span> },
                { term: "Data de nascimento", detail: fmtDate(p.birthDate) },
                { term: "E-mail", detail: <>{p.email} {p.pendingEmail && <Badge tone="warning">Troca para {p.pendingEmail} aguardando confirmação</Badge>}</> },
                { term: "Celular", detail: p.phone ?? "—" },
                { term: "Endereço", detail: p.street ? `${p.street}, ${p.number}${p.complement ? ` — ${p.complement}` : ""} · ${p.district ?? p.externalCity} · CEP ${p.cep}` : "—" },
                { term: "Região", detail: p.region ?? "Fora do município" },
                { term: "Situação da conta", detail: <Badge tone={ACCOUNT_STATUS[p.status].tone}>{ACCOUNT_STATUS[p.status].label}</Badge> },
                { term: "Verificação de identidade", detail: <><Badge tone={VERIFICATION_LEVEL[p.verificationLevel].tone}>{VERIFICATION_LEVEL[p.verificationLevel].label}</Badge>{p.verifiedAt && <span className="ml-2 text-xs text-muted">em {fmtDate(p.verifiedAt)}</span>}</> },
                { term: "Domicílio", detail: p.domicileVerifiedAt ? `Comprovado em ${fmtDate(p.domicileVerifiedAt)}` : "Não comprovado" },
                { term: "Termos aceitos", detail: `Versão ${p.termsVersion} em ${fmtDateTime(p.termsAcceptedAt)}` },
                { term: "Cadastro", detail: fmtDateTime(p.createdAt) },
              ]}
            />
          </Card>
        </Section>
        {p.verificationLevel !== "verificado" && (
          <Alert tone="warning" title="Verifique sua identidade para votar">
            <Link href="/conta/verificacao">Fazer a verificação agora</Link>
          </Alert>
        )}
      </div>
    </>
  );
}
