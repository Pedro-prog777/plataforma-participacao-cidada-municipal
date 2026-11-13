/** Cabeçalho, rodapé e barra de acessibilidade do portal (RNF01, eMAG). */
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon } from "../ui/icons";
import { ContrastToggle, FlashMessage } from "./client-bits";

export function Emblem({ className = "size-10" }: { className?: string }) {
  // Marca gráfica própria e genérica (não reproduz brasões ou marcas oficiais).
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#134074" />
      <path d="M10 27V17l10-6 10 6v10" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M15 27v-6h10v6" fill="none" stroke="#e07a1f" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="20" cy="17.5" r="2.2" fill="#e07a1f" />
    </svg>
  );
}

export function AccessibilityBar({ municipio }: { municipio: string }) {
  return (
    <div className="relative bg-brand-950 text-xs text-white">
      <div className="container-page flex items-center justify-between gap-x-4 py-1">
        <span className="min-w-0 truncate font-medium">
          {/* No celular aparece só o nome do município; leitores de tela recebem o texto completo. */}
          <span className="sr-only sm:not-sr-only">Prefeitura de </span>
          {municipio.replace(/^Município de /, "")}
        </span>
        <nav aria-label="Acessibilidade" className="flex shrink-0 items-center gap-x-1 whitespace-nowrap lg:gap-x-3">
          <a href="#conteudo" accessKey="1" className="atalho">
            Ir para o conteúdo [1]
          </a>
          <a href="#menu" accessKey="2" className="atalho">
            Ir para o menu [2]
          </a>
          <a href="#rodape" accessKey="4" className="atalho">
            Ir para o rodapé [4]
          </a>
          <ContrastToggle />
          <Link href="/acessibilidade" className="rounded px-1.5 py-1 hover:underline">
            Acessibilidade
          </Link>
        </nav>
      </div>
    </div>
  );
}

const NAV = [
  { href: "/consultas", label: "Consultas" },
  { href: "/propostas", label: "Propostas" },
  { href: "/resultados", label: "Resultados" },
  { href: "/transparencia", label: "Transparência" },
  { href: "/como-funciona", label: "Como funciona" },
];

export function SiteHeader({ user }: { user: { name: string; kind: "cidadao" | "admin"; unread: number } | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page flex items-center justify-between gap-2 py-2 sm:gap-4 sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline sm:gap-3">
          <Emblem className="size-9 shrink-0 sm:size-10" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-bold text-brand-900 sm:text-lg">Participação Cidadã</span>
            <span className="hidden truncate text-xs text-muted sm:block">Consultas públicas e propostas</span>
          </span>
        </Link>
        <nav id="menu" aria-label="Menu principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="rounded-md px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <Link href={user.kind === "admin" ? "/admin" : "/conta"} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">
              <span className="relative">
                <Icon name={user.kind === "admin" ? "shield" : "user"} className="size-5" />
                {user.unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-civic-700 px-1 text-[10px] font-bold text-white">
                    {user.unread}
                    <span className="sr-only"> avisos não lidos</span>
                  </span>
                )}
              </span>
              <span className="hidden max-w-36 truncate sm:inline">{user.kind === "admin" ? "Administração" : user.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <>
              {/* No celular cabe um só botão ao lado do nome: "Entrar"; "Criar conta" abre o menu. */}
              <Link href="/entrar" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50 min-[360px]:inline-flex">
                Entrar
              </Link>
              <Link href="/cadastro" className="hidden min-h-11 items-center whitespace-nowrap rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:inline-flex">
                Criar conta
              </Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-lg text-brand-800 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
              <Icon name="menu" className="size-6" />
              <span className="sr-only">Abrir menu</span>
            </summary>
            <nav aria-label="Menu principal (celular)" className="absolute right-0 top-12 w-64 rounded-xl border border-line bg-white p-2 shadow-lg">
              <ul>
                {!user && (
                  <li className="mb-2 border-b border-line pb-2 sm:hidden">
                    <Link href="/cadastro" className="flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">
                      Criar conta
                    </Link>
                    <Link href="/entrar" className="mt-1 block rounded-md px-3 py-2.5 text-center font-semibold text-brand-800 hover:bg-brand-50">
                      Já tenho conta: entrar
                    </Link>
                  </li>
                )}
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="block rounded-md px-3 py-2.5 font-semibold text-brand-800 hover:bg-brand-50">
                      {n.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/comprovante" className="block rounded-md px-3 py-2.5 font-semibold text-brand-800 hover:bg-brand-50">
                    Verificar comprovante
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ municipio, demo }: { municipio: string; demo: boolean }) {
  return (
    <footer id="rodape" className="mt-16 border-t border-line bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Emblem className="size-8" />
            <span className="font-bold text-brand-900">Participação Cidadã</span>
          </div>
          <p className="text-sm text-muted">Plataforma de Participação Cidadã Municipal — {municipio}. As votações têm caráter consultivo.</p>
        </div>
        <FooterCol title="Participar" links={[["/consultas", "Consultas públicas"], ["/propostas", "Propostas cidadãs"], ["/conta/propostas/nova", "Enviar proposta"], ["/comprovante", "Verificar comprovante"]]} />
        <FooterCol title="Transparência" links={[["/transparencia", "Portal de transparência"], ["/resultados", "Resultados"], ["/encaminhamentos", "Encaminhamentos"], ["/dados-abertos", "Dados abertos"]]} />
        <FooterCol title="Informações" links={[["/como-funciona", "Como funciona"], ["/privacidade", "Privacidade e LGPD"], ["/termos", "Termos de uso"], ["/acessibilidade", "Acessibilidade"]]} />
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-muted sm:flex-row sm:justify-between">
          <p>Trabalho acadêmico — Engenharia de Software, CESMAC. Equipe: João Pedro e Flávia Marina.</p>
          {demo && <p className="font-semibold text-civic-700">Ambiente de demonstração: todos os dados são fictícios.</p>}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-900">{title}</h2>
      <ul className="space-y-1.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-muted hover:text-brand-700 hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MainContainer({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main id="conteudo" tabIndex={-1} className={wide ? "outline-none" : "container-page py-8 outline-none sm:py-10"}>
      <Suspense>{!wide && <FlashMessage />}</Suspense>
      {children}
    </main>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-amber-300 bg-civic-50 text-xs text-warn-800 sm:text-sm">
      <div className="container-page flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 sm:gap-x-3">
        <Icon name="info" className="size-4 shrink-0" />
        {/* Texto curto em telas estreitas (uma linha); completo a partir de 1024 px. */}
        <span className="lg:hidden">
          <strong>Demonstração:</strong> dados fictícios.
        </span>
        <span className="hidden lg:inline">
          <strong>Demonstração acadêmica.</strong> Dados fictícios; e-mails e o provedor de identidade são simulados.
        </span>
        <Link href="/demo" className="font-semibold underline">
          Contas <span className="hidden lg:inline">e ferramentas </span>de teste
        </Link>
      </div>
    </div>
  );
}
