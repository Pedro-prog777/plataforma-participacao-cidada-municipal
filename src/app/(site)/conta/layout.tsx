import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { requireCitizen } from "@/server/auth/current";
import { logoutAction } from "@/server/actions/auth";

const NAV: [string, string, IconName][] = [
  ["/conta", "Meu perfil", "user"],
  ["/conta/verificacao", "Verificação de identidade", "shield"],
  ["/conta/participacoes", "Minhas participações", "ballot"],
  ["/conta/propostas", "Minhas propostas", "lightbulb"],
  ["/conta/avisos", "Central de avisos", "bell"],
  ["/conta/notificacoes", "Preferências de aviso", "settings"],
  ["/conta/privacidade", "Privacidade e meus dados", "lock"],
];

export default async function ContaLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCitizen();
  return (
    <MainContainer>
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside aria-label="Minha conta" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 truncate px-3 text-sm font-semibold text-muted">Olá, {actor.name.split(" ")[0]}</p>
          <nav>
            <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
              {NAV.map(([href, label, icon]) => (
                <li key={href} className="shrink-0">
                  <Link href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-white">
                    <Icon name={icon} className="size-4" /> {label}
                  </Link>
                </li>
              ))}
              <li className="shrink-0">
                <form action={logoutAction}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-bad-700 hover:bg-white">
                    <Icon name="logout" className="size-4" /> Sair
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </MainContainer>
  );
}
