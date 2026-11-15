import Link from "next/link";
import { Badge, LinkButton, PageHeader, Pagination, Table } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { searchUsers } from "@/server/modules/admin/users.service";
import { ACCOUNT_STATUS, fmtDateTime, VERIFICATION_LEVEL } from "@/lib/labels";

export const metadata = { title: "Usuários" };

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; situacao?: string; pagina?: string }> }) {
  const a = await requireAdmin("usuarios.gerenciar");
  const sp = await searchParams;
  const { items: rows, total, page, pages } = await searchUsers(a, { q: sp.q, kind: sp.tipo, status: sp.situacao, page: Number(sp.pagina) || 1 });
  const hrefFor = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ q: sp.q, tipo: sp.tipo, situacao: sp.situacao }).filter(([, v]) => v) as [string, string][]);
    if (p > 1) qs.set("pagina", String(p));
    return `/admin/usuarios${qs.size ? `?${qs}` : ""}`;
  };
  const cls = "rounded-lg border border-slate-300 bg-white px-3 py-2";
  return (
    <>
      <PageHeader title="Gerenciamento de usuários" description="Pesquise contas, convide servidores e bloqueie, desbloqueie ou desative contas com justificativa. Senhas e votos nunca são visíveis." actions={<LinkButton href="/admin/usuarios/convidar" icon="users">Convidar servidor</LinkButton>} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">Nome, e-mail ou matrícula</label>
          <input id="q" name="q" defaultValue={sp.q} className={cls} />
        </div>
        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-semibold">Perfil</label>
          <select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className={cls}>
            <option value="">Todos</option>
            <option value="cidadao">Cidadão</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div>
          <label htmlFor="situacao" className="mb-1 block text-sm font-semibold">Situação</label>
          <select id="situacao" name="situacao" defaultValue={sp.situacao ?? ""} className={cls}>
            <option value="">Todas</option>
            {Object.entries(ACCOUNT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button className="min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white">Pesquisar</button>
      </form>
      <Table
        head={["Nome", "Perfil", "Situação", "Verificação", "Papéis", "Último acesso"]}
        rows={rows.map((u) => [
          <span key="n">
            <Link href={`/admin/usuarios/${u.id}`} className="font-semibold text-brand-700 hover:underline">{u.name}</Link>
            <span className="block text-xs text-muted">{u.email}{u.registration ? ` · ${u.registration}` : ""}{u.cpfMasked ? ` · CPF ${u.cpfMasked}` : ""}</span>
          </span>,
          u.kind === "admin" ? `Administrador${u.organ ? ` (${u.organ})` : ""}` : "Cidadão",
          <Badge key="s" tone={ACCOUNT_STATUS[u.status].tone}>{ACCOUNT_STATUS[u.status].label}</Badge>,
          u.kind === "cidadao" ? <Badge key="v" tone={VERIFICATION_LEVEL[u.verificationLevel].tone}>{VERIFICATION_LEVEL[u.verificationLevel].label}</Badge> : "—",
          u.roles.join(", ") || "—",
          fmtDateTime(u.lastLoginAt),
        ])}
      />
      <p className="mt-3 text-sm text-muted" role="status">
        {total === 0 ? "Nenhuma conta encontrada." : `${total.toLocaleString("pt-BR")} conta(s) no total.`}
      </p>
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
