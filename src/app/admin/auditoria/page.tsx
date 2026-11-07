import { Alert, Badge, LinkButton, PageHeader, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { audit, searchAudit, verifyAuditChain } from "@/server/modules/audit/audit.service";
import { openIncident } from "@/server/modules/integrity/incidents.service";
import { getDb } from "@/server/db/client";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Auditoria" };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdmin("auditoria.consultar");
  const sp = await searchParams;
  const filter = { from: sp.de, to: sp.ate, actorId: sp.usuario, action: sp.acao, objectType: sp.objeto, result: sp.resultado };
  const [rows, chain] = await Promise.all([searchAudit(filter, 300), sp.verificar ? verifyAuditChain() : Promise.resolve(null)]);
  if (chain && !chain.ok) {
    await openIncident(getDb(), { severity: "alta", type: "quebra_auditoria", description: `Encadeamento da auditoria quebrado no registro ${chain.firstInvalidId}: ${chain.reason}.`, evidence: { primeiroInconsistente: chain.firstInvalidId } });
  }
  // A própria consulta à trilha é auditada (RF058).
  await audit(getDb(), { actorId: a.id, actorRole: "gestor_acessos", action: "auditoria_consultada", objectType: "auditoria", objectId: "consulta", details: { filtros: Object.keys(filter).filter((k) => filter[k as keyof typeof filter]) } });
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "verificar") as [string, string][]).toString();
  const cls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return (
    <>
      <PageHeader
        title="Trilha de auditoria"
        description="Registros somente de acréscimo, encadeados por hash (SHA-256). Sem senhas, tokens, CPF ou conteúdo de votos."
        actions={
          <>
            <LinkButton href={`/admin/auditoria?${qs}${qs ? "&" : ""}verificar=1`} variant="secondary" icon="shield">
              Verificar encadeamento
            </LinkButton>
            <LinkButton href={`/api/admin/auditoria?${qs}`} variant="secondary" icon="download">
              Exportar CSV
            </LinkButton>
          </>
        }
      />
      {chain && (
        <Alert tone={chain.ok ? "success" : "danger"} className="mb-4" title={chain.ok ? `Encadeamento íntegro (${chain.total} registros)` : `Encadeamento quebrado no registro #${chain.firstInvalidId}`}>
          {chain.ok ? "Nenhum registro foi alterado, removido ou inserido fora de ordem." : `${chain.reason}. Um incidente de alta severidade foi aberto.`}
        </Alert>
      )}
      <form method="get" className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label htmlFor="de" className="mb-1 block text-sm font-semibold">De</label>
          <input id="de" name="de" type="date" defaultValue={sp.de} className={cls} />
        </div>
        <div>
          <label htmlFor="ate" className="mb-1 block text-sm font-semibold">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={sp.ate} className={cls} />
        </div>
        <div>
          <label htmlFor="acao" className="mb-1 block text-sm font-semibold">Ação</label>
          <input id="acao" name="acao" defaultValue={sp.acao} placeholder="ex.: login" className={cls} />
        </div>
        <div>
          <label htmlFor="objeto" className="mb-1 block text-sm font-semibold">Objeto</label>
          <select id="objeto" name="objeto" defaultValue={sp.objeto ?? ""} className={cls}>
            <option value="">Todos</option>
            {["consulta", "usuario", "proposta_cidada", "proposta_municipal", "incidente", "papel", "permissao", "verificacao", "auditoria"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="resultado" className="mb-1 block text-sm font-semibold">Resultado</label>
          <select id="resultado" name="resultado" defaultValue={sp.resultado ?? ""} className={cls}>
            <option value="">Todos</option>
            <option value="sucesso">Sucesso</option>
            <option value="negado">Negado</option>
            <option value="falha">Falha</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="min-h-11 w-full rounded-lg bg-brand-700 px-4 font-semibold text-white">Filtrar</button>
        </div>
      </form>
      <Table
        head={["#", "Data e hora", "Autor / papel", "Ação", "Objeto", "Resultado", "Justificativa", "Hash"]}
        rows={rows.map((r) => [
          r.id,
          fmtDateTime(r.occurredAt),
          <span key="a" className="text-xs">{r.actorId ? `${r.actorId.slice(0, 8)}…` : "sistema"}<br />{r.actorRole}</span>,
          <code key="c" className="text-xs">{r.action}</code>,
          <span key="o" className="text-xs">{r.objectType} {r.objectId ? `${String(r.objectId).slice(0, 8)}…` : ""}</span>,
          <Badge key="r" tone={r.result === "sucesso" ? "success" : r.result === "negado" ? "danger" : "warning"}>{r.result}</Badge>,
          <span key="j" className="text-xs">{r.justification ?? ""}</span>,
          <code key="h" className="text-xs" title={r.hash}>{r.hash.slice(0, 10)}…</code>,
        ])}
      />
    </>
  );
}
