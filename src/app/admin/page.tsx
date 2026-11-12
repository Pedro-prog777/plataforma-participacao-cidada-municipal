import Link from "next/link";
import { StatusBadge } from "@/components/consultation-card";
import { Alert, Badge, Card, LinkButton, PageHeader, Section, Stat, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { listAdminConsultations, pendingCitizenProposals, portalIndicators, statusCounts } from "@/server/modules/consultations/queries.service";
import { openIncidentsCount } from "@/server/modules/integrity/incidents.service";
import { moderationPendingCount } from "@/server/modules/admin/monitoring.service";
import { pendingVerificationCount } from "@/server/modules/identity/identity.service";
import { getDb } from "@/server/db/client";
import { consultationAssignments } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { CONSULTATION_ROLES, type ConsultationRole } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Painel" };

export default async function AdminDashboard() {
  const a = await requireAdmin();
  const [ind, counts, all, incidents, modCount, verifCount, propCount, mine] = await Promise.all([
    portalIndicators(),
    statusCounts(),
    listAdminConsultations(),
    openIncidentsCount(),
    moderationPendingCount(),
    pendingVerificationCount(),
    pendingCitizenProposals(),
    getDb().select().from(consultationAssignments).where(and(eq(consultationAssignments.userId, a.id), eq(consultationAssignments.active, true))),
  ]);
  const myTasks = mine
    .map((m) => ({ role: m.role as ConsultationRole, c: all.find((c) => c.id === m.consultationId) }))
    .filter((t) => t.c)
    .filter(({ role, c }) =>
      (role === "elaborador" && ["rascunho", "rejeitada"].includes(c!.status)) ||
      (role === "revisor" && c!.status === "em_revisao") ||
      ((role === "aprovador" || role === "autorizador_prazo") && c!.status === "em_analise") ||
      (role === "responsavel" && ["aprovada", "agendada", "aberta", "suspensa"].includes(c!.status)) ||
      (role === "publicacao_resultados" && c!.status === "apurada") ||
      (role === "encaminhamentos" && c!.status === "finalizada") ||
      (role === "divulgacao" && ["agendada", "aberta"].includes(c!.status)),
    );
  return (
    <>
      <PageHeader title={`Olá, ${a.name.split(" ")[0]}`} description={`Papéis: ${a.roleNames.join(", ") || "nenhum"}. Ações aparecem conforme suas permissões e designações por consulta.`} />
      {incidents.some((i) => i.severity === "alta") && can(a, "incidentes.tratar") && (
        <Alert tone="danger" title="Há incidentes de alta severidade abertos" className="mb-6">
          <Link href="/admin/incidentes">Ver incidentes</Link>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Consultas abertas" value={counts.aberta ?? 0} icon="ballot" />
        <Stat label="Em preparação" value={(counts.rascunho ?? 0) + (counts.em_revisao ?? 0) + (counts.em_analise ?? 0) + (counts.aprovada ?? 0)} icon="clipboard" />
        <Stat label="Participações totais" value={ind.participacoes.toLocaleString("pt-BR")} icon="users" />
        <Stat label="Incidentes abertos" value={incidents.length} icon="alert" />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Minhas tarefas" description="Consultas em que você está designado(a) e que aguardam sua ação.">
          <Table
            head={["Consulta", "Situação", "Seus papéis", ""]}
            rows={Array.from(new Set(myTasks.map((t) => t.c!.id))).map((cid) => {
              const c = myTasks.find((t) => t.c!.id === cid)!.c!;
              return [
                c.title,
                <StatusBadge key="s" status={c.status} />,
                myTasks.filter((t) => t.c!.id === cid).map((t) => CONSULTATION_ROLES[t.role].label).join(", "),
                <Link key="l" href={`/admin/consultas/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                  Abrir
                </Link>,
              ];
            })}
            empty="Nenhuma tarefa pendente para você."
          />
        </Section>
        <Section title="Filas">
          <Card className="divide-y divide-line p-0">
            {!["propostas_cidadas.analisar", "moderacao.moderar", "identidade.analisar", "incidentes.tratar"].some((p) => can(a, p as "moderacao.moderar")) && <p className="px-5 py-4 text-sm text-muted">Nenhuma fila de atendimento para os seus papéis.</p>}
            {[
              ["propostas_cidadas.analisar", "/admin/propostas", "Propostas cidadãs aguardando análise", propCount],
              ["moderacao.moderar", "/admin/moderacao", "Conteúdos denunciados", modCount],
              ["identidade.analisar", "/admin/verificacoes", "Verificações documentais", verifCount],
              ["incidentes.tratar", "/admin/incidentes", "Incidentes abertos", incidents.length],
            ]
              .filter(([p]) => can(a, p as "moderacao.moderar"))
              .map(([, href, label, n]) => (
                <Link key={href as string} href={href as string} className="flex items-center justify-between px-5 py-3 hover:bg-brand-50">
                  <span className="font-medium">{label}</span>
                  <Badge tone={Number(n) > 0 ? "warning" : "neutral"}>{n}</Badge>
                </Link>
              ))}
          </Card>
        </Section>
      </div>
      <Section title="Atualizadas recentemente" className="mt-8" actions={<LinkButton href="/admin/consultas" variant="ghost" iconRight="arrowRight">Todas</LinkButton>}>
        <Table
          head={["Consulta", "Situação", "Atualizada", "Participações"]}
          rows={all.slice(0, 6).map((c) => [
            <Link key="t" href={`/admin/consultas/${c.id}`} className="font-semibold text-brand-700 hover:underline">
              {c.title}
            </Link>,
            <StatusBadge key="s" status={c.status} />,
            fmtDateTime(c.updatedAt),
            c.participations,
          ])}
        />
      </Section>
    </>
  );
}
