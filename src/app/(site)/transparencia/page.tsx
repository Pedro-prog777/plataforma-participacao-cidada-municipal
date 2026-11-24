import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { Alert, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { portalIndicators } from "@/server/modules/consultations/queries.service";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Portal de transparência" };

const LINKS: [string, string, string, IconName][] = [
  ["/consultas", "Consultas públicas", "Todas as consultas publicadas, com documentos, período e público-alvo.", "ballot"],
  ["/consultas/encerradas", "Acervo de consultas", "Consultas finalizadas e canceladas, para sempre disponíveis.", "list"],
  ["/resultados", "Resultados", "Resultados oficiais, com a explicação de como foram calculados.", "chart"],
  ["/encaminhamentos", "Encaminhamentos", "O que a Prefeitura registrou como providência após cada resultado.", "route"],
  ["/propostas", "Propostas cidadãs publicadas", "Propostas cujo autor autorizou a publicação, com a resposta oficial.", "lightbulb"],
  ["/indicadores", "Painel de indicadores", "Números gerais de participação por tema e situação.", "users"],
  ["/dados-abertos", "Dados abertos", "Baixe resultados e encaminhamentos em planilha ou PDF.", "download"],
  ["/como-funciona", "Como funciona", "Para que serve a votação, sigilo do voto, voto único, contagem e comprovantes.", "info"],
  ["/comprovante", "Verificar comprovante", "Confirme que uma participação consta e foi contabilizada.", "shield"],
];

export default async function TransparenciaPage() {
  const ind = await portalIndicators();
  return (
    <MainContainer>
      <PageHeader title="Portal de transparência" description="Tudo o que é público na plataforma, sem necessidade de login. Nenhum dado pessoal é exibido." breadcrumbs={[{ href: "/", label: "Início" }, { label: "Transparência" }]} />
      <Section title="Indicadores do dia" description={`Atualizado em ${fmtDateTime(new Date())}.`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Consultas publicadas" value={ind.publicadas} icon="ballot" />
          <Stat label="Abertas agora" value={ind.abertas} icon="clock" />
          <Stat label="Participações" value={ind.participacoes.toLocaleString("pt-BR")} icon="users" />
          <Stat label="Resultados publicados" value={ind.finalizadas} icon="chart" />
          <Stat label="Propostas recebidas" value={ind.propostas_recebidas} icon="lightbulb" />
          <Stat label="Propostas publicadas" value={ind.propostas_publicadas} icon="megaphone" />
          <Stat label="Encaminhamentos" value={ind.encaminhamentos} icon="route" />
          <Stat label="Cidadãos com conta ativa" value={ind.cidadaos} icon="user" />
        </div>
      </Section>
      <Section title="Acesse" className="mt-10">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(([href, title, desc, icon]) => (
            <li key={href}>
              <Link href={href} className="flex h-full gap-3 rounded-xl border border-line bg-white p-4 hover:border-brand-200 hover:shadow-md">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon name={icon} />
                </span>
                <span>
                  <span className="block font-semibold text-brand-900">{title}</span>
                  <span className="block text-sm text-muted">{desc}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Alert tone="info" className="mt-10" title="Sobre os números">
        Durante a votação, apenas o total de participações é divulgado — nunca a contagem por alternativa. Isso evita influenciar quem ainda não votou.
      </Alert>
    </MainContainer>
  );
}
