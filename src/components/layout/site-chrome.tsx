/** Faixa institucional, cabeçalho e rodapé do portal (RNF01). */
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon } from "../ui/icons";
import { FlashMessage } from "./client-bits";

export function Emblem({ className = "size-10" }: { className?: string }) {
  // Desenho próprio, inspirado nos elementos do brasão de Maceió (coroa mural, jangada, ondas e
  // as faixas verde, branca e azul). NÃO é o brasão oficial: o uso do símbolo oficial depende de
  // autorização da Prefeitura (DT-21).
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden="true">
      {/* coroa mural simplificada (símbolo de cidade) */}
      <path d="M7 10V2h4v3h3V2h4v3h4V2h4v3h3V2h4v8Z" fill="#c9971c" />
      {/* escudo: faixa verde com jangada, faixa branca com onda vermelha, base azul */}
      <path d="M4 11h32v19c0 9-7.5 14-16 17C11.5 44 4 39 4 30Z" fill="#1f5fa8" />
      <path d="M4 11h32v11H4Z" fill="#17803d" />
      <path d="M4 22h32v8H4Z" fill="#fff" />
      <path d="M4 26q4-3.4 8 0t8 0 8 0 8 0" fill="none" stroke="#d0202e" strokeWidth="2.4" />
      <path d="M20.5 12.6c3 2.5 4.1 4.8 4.3 6.8h-8.6c2.4-1.8 3.8-4.1 4.3-6.8Z" fill="#fff" />
      <path d="M13.5 20.7h14" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.4 36q1.9-1.8 3.8 0t3.8 0 3.8 0 3.8 0M16.2 40q1.9-1.8 3.8 0t3.8 0" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 11h32v19c0 9-7.5 14-16 17C11.5 44 4 39 4 30Z" fill="none" stroke="#0b2545" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Faixa institucional do topo: nome da Prefeitura e serviços de uso rápido pelo cidadão. */
export function TopBar({ municipio, uf }: { municipio: string; uf: string }) {
  const cidade = municipio.replace(/^Município de /, "");
  return (
    <div className="relative bg-brand-950 text-xs text-white">
      {/* Atalhos de teclado (WCAG 2.4.1, eMAG): invisíveis até receberem foco pelo teclado. */}
      <nav aria-label="Atalhos de teclado">
        <a href="#conteudo" accessKey="1" className="atalho">
          Ir para o conteúdo
        </a>
        <a href="#menu" accessKey="2" className="atalho">
          Ir para o menu
        </a>
        <a href="#rodape" accessKey="4" className="atalho">
          Ir para o rodapé
        </a>
      </nav>
      <div className="container-page flex items-center justify-between gap-x-4 py-1">
        <p className="min-w-0 truncate font-semibold tracking-wide">
          {/* No celular aparece só "Maceió · AL"; leitores de tela recebem o texto completo. */}
          <span className="sr-only sm:not-sr-only">Prefeitura de </span>
          {cidade}
          <span className="font-normal text-brand-200"> · {uf}</span>
        </p>
        <nav aria-label="Serviços" className="flex shrink-0 items-center gap-x-1 whitespace-nowrap sm:gap-x-3">
          <Link href="/comprovante" className="rounded px-1.5 py-1 hover:bg-white/10">
            Verificar comprovante
          </Link>
          <Link href="/prefeitura" className="hidden rounded px-1.5 py-1 hover:bg-white/10 sm:inline">
            A Prefeitura
          </Link>
        </nav>
      </div>
      {/* Faixa nas cores do município (verde, vermelho e azul do brasão). */}
      <div className="flex h-1" aria-hidden="true">
        <span className="flex-4 bg-municipal-green" />
        <span className="flex-1 bg-municipal-red" />
        <span className="flex-4 bg-municipal-blue" />
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

export function SiteHeader({ user, municipio }: { user: { name: string; kind: "cidadao" | "admin"; unread: number } | null; municipio: string }) {
  const cidade = municipio.replace(/^Município de /, "");
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85">
      <div className="container-page flex items-center justify-between gap-2 py-2 sm:gap-4 sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline sm:gap-3">
          <Emblem className="size-9 shrink-0 sm:size-10" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-bold text-brand-900 sm:text-lg">Participação Cidadã</span>
            <span className="hidden truncate text-xs text-muted sm:block">Consultas públicas de {cidade}</span>
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
        <FooterCol title="Informações" links={[["/prefeitura", "A Prefeitura"], ["/como-funciona", "Como funciona"], ["/privacidade", "Privacidade e dados pessoais"], ["/termos", "Termos de uso"], ["/acessibilidade", "Acessibilidade"], ["/requisitos", "Documento de requisitos"]]} />
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-muted sm:flex-row sm:justify-between">
          <p>Trabalho acadêmico — Engenharia de Software, CESMAC. Equipe: João Pedro e Flávia Marina. Não é um serviço oficial da Prefeitura de {municipio.replace(/^Município de /, "")}.</p>
          {demo && <p className="font-semibold text-civic-700">Ambiente de demonstração: consultas e pessoas são fictícias.</p>}
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
          <strong>Demonstração:</strong> não é o site oficial.
        </span>
        <span className="hidden lg:inline">
          <strong>Demonstração acadêmica.</strong> Não é o site oficial da Prefeitura; consultas e pessoas são fictícias, e-mails e provedor de identidade são simulados.
        </span>
        <Link href="/demo" className="font-semibold underline">
          Contas <span className="hidden lg:inline">e ferramentas </span>de teste
        </Link>
      </div>
    </div>
  );
}
