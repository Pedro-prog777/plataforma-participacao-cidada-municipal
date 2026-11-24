import Link from "next/link";
import { Suspense } from "react";
import { Emblem } from "@/components/layout/site-chrome";
import { FlashMessage } from "@/components/layout/client-bits";
import { Icon, type IconName } from "@/components/ui/icons";
import { requireAdmin } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { logoutAction } from "@/server/actions/auth";
import { demoMode } from "@/server/lib/env";
import type { Permission } from "@/lib/permissions";

const NAV: { group: string; items: [string, string, IconName, Permission | null][] }[] = [
  {
    group: "Visão geral",
    items: [
      ["/admin", "Painel", "home", null],
      ["/admin/monitoramento", "Monitoramento", "chart", "consultas.acompanhar"],
      ["/requisitos", "Documento de requisitos", "file", null],
    ],
  },
  {
    group: "Consultas",
    items: [
      ["/admin/consultas", "Consultas", "ballot", null],
      ["/admin/propostas-municipais", "Propostas municipais", "clipboard", "propostas_municipais.gerenciar"],
      ["/admin/eventos", "Eventos", "calendar", "eventos.gerenciar"],
    ],
  },
  {
    group: "Cidadãos",
    items: [
      ["/admin/propostas", "Propostas cidadãs", "lightbulb", "propostas_cidadas.analisar"],
      ["/admin/moderacao", "Moderação", "flag", "moderacao.moderar"],
      ["/admin/verificacoes", "Verificação de identidade", "shield", "identidade.analisar"],
    ],
  },
  {
    group: "Controle",
    items: [
      ["/admin/relatorios", "Relatórios", "list", "relatorios.gerar"],
      ["/admin/auditoria", "Auditoria", "eye", "auditoria.consultar"],
      ["/admin/incidentes", "Incidentes", "alert", "incidentes.tratar"],
      ["/admin/usuarios", "Usuários", "users", "usuarios.gerenciar"],
      ["/admin/papeis", "Papéis e permissões", "key", "papeis.gerenciar"],
      ["/admin/configuracoes", "Parâmetros", "settings", "configuracoes.gerenciar"],
    ],
  },
];

export const metadata = { title: { default: "Administração", template: "%s · Administração" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdmin();
  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-brand-800 bg-brand-900 text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/admin" className="flex items-center gap-2 text-white no-underline">
            <Emblem className="size-8" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">Participação Cidadã</span>
              <span className="block text-xs text-brand-200">Administração{demoMode() ? " · demonstração" : ""}</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden max-w-48 truncate px-2 text-brand-100 md:inline" title={actor.roleNames.join(", ")}>
              {actor.name}
            </span>
            <Link href="/" className="rounded px-2 py-2 hover:bg-white/10">
              Portal
            </Link>
            <Link href="/admin/senha" className="hidden rounded px-2 py-2 hover:bg-white/10 sm:inline">
              Senha
            </Link>
            <form action={logoutAction}>
              <button className="flex items-center gap-1 rounded px-2 py-2 hover:bg-white/10">
                <Icon name="logout" className="size-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Menu administrativo" className="border-b border-line bg-white lg:sticky lg:top-13.25 lg:h-[calc(100dvh-53px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <details className="lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold text-brand-800">
              <Icon name="menu" /> Menu
            </summary>
            <AdminNav actorPerms={(p) => can(actor, p)} />
          </details>
          <div className="hidden lg:block">
            <AdminNav actorPerms={(p) => can(actor, p)} />
          </div>
        </nav>
        <main id="conteudo" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <Suspense>
            <FlashMessage />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNav({ actorPerms }: { actorPerms: (p: Permission) => boolean }) {
  return (
    <div className="space-y-4 p-3">
      {NAV.map((g) => {
        const items = g.items.filter(([, , , p]) => !p || actorPerms(p));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted">{g.group}</p>
            <ul>
              {items.map(([href, label, icon]) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                    <Icon name={icon} className="size-4" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
