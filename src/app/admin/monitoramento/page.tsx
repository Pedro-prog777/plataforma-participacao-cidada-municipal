import Link from "next/link";
import { StatusBadge } from "@/components/consultation-card";
import { AutoRefresh } from "@/components/layout/client-bits";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { monitoringPanel } from "@/server/modules/admin/monitoring.service";
import { runTickAction } from "@/server/actions/admin";
import { fmtDate, fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Monitoramento" };

const REASON: Record<string, string> = {
  ja_participou: "Já participou",
  voto_duplicado: "Envio simultâneo duplicado",
  fora_do_periodo: "Fora do período",
  identidade_nao_verificada: "Identidade não verificada",
  fora_do_publico: "Fora do público-alvo",
  domicilio_nao_comprovado: "Domicílio não comprovado",
  codigo_incorreto: "Código incorreto",
  codigo_expirado: "Código expirado",
  codigo_bloqueado: "Código bloqueado",
  alternativa_invalida: "Alternativa inexistente",
  limite_tentativas: "Excesso de tentativas",
  conta_administrativa: "Conta administrativa",
  conta_inativa: "Conta inativa",
  menor_de_18: "Menos de 18 anos",
};

export default async function MonitoramentoPage() {
  const a = await requireAdmin("consultas.acompanhar");
  const items = await monitoringPanel(a);
  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Monitoramento de consultas"
        description={`Atualizado automaticamente a cada 5 minutos (última leitura: ${fmtDateTime(new Date())}). Nenhum perfil vê contagem por alternativa durante a votação (RN16), e nenhuma ação deste painel altera votos (RN39).`}
        actions={
          <ActionForm action={runTickAction} className="space-y-2!">
            <SubmitButton variant="secondary">Executar rotina agora</SubmitButton>
          </ActionForm>
        }
      />
      <div className="space-y-4">
        {items.map((m) => {
          const max = Math.max(1, ...m.daily.map((d) => d.n));
          return (
            <Card key={m.id} className={m.alerts.incidents ? "border-red-300" : m.alerts.lowParticipation ? "border-amber-300" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={m.status} />
                    {m.alerts.lowParticipation && <Badge tone="warning">Baixa participação</Badge>}
                    {m.alerts.incidents && <Badge tone="danger">{m.openIncidents} incidente(s)</Badge>}
                    {m.alerts.suggestDissemination && <Badge tone="info">Sugerir nova divulgação</Badge>}
                  </div>
                  <Link href={`/admin/consultas/${m.id}`} className="mt-1 block text-lg font-bold text-brand-900 hover:underline">
                    {m.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {fmtDateTime(m.opensAt)} a {fmtDateTime(m.closesAt)}
                    {m.msToClose && m.msToClose > 0 ? ` · encerra em ${Math.floor(m.msToClose / 86_400_000)}d ${Math.floor((m.msToClose % 86_400_000) / 3_600_000)}h` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums text-brand-900">{m.participations}</p>
                  <p className="text-xs text-muted">participações{m.estimatedEligible ? ` de ~${m.estimatedEligible} elegíveis` : ""}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">Evolução diária</p>
                  {m.daily.length ? (
                    <div className="flex h-16 items-end gap-1" role="img" aria-label={`Participações por dia: ${m.daily.map((d) => `${fmtDate(d.day)}: ${d.n}`).join("; ")}`}>
                      {m.daily.map((d) => (
                        <div key={d.day} title={`${fmtDate(d.day)}: ${d.n}`} className="flex-1 rounded-t bg-brand-500" style={{ height: `${(d.n / max) * 100}%` }} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Sem participações.</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">Tentativas recusadas</p>
                  <ul className="text-sm">
                    {m.refused.map((r) => (
                      <li key={r.motivo}>
                        {REASON[r.motivo] ?? r.motivo}: <strong>{r.n}</strong>
                      </li>
                    ))}
                    {!m.refused.length && <li className="text-muted">Nenhuma</li>}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">Pendências e atalhos</p>
                  <ul className="text-sm">
                    {m.pendencias.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm font-semibold">
                    <Link href={`/admin/consultas/${m.id}/conducao`} className="text-brand-700 underline">Alterar/suspender</Link>
                    <Link href={`/admin/consultas/${m.id}/divulgacao`} className="text-brand-700 underline">Divulgar</Link>
                    {m.alerts.incidents && <Link href="/admin/incidentes" className="text-bad-700 underline">Incidentes</Link>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {!items.length && <Alert tone="neutral">Nenhuma consulta em andamento.</Alert>}
      </div>
    </>
  );
}
