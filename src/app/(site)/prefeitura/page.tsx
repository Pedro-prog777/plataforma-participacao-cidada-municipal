/**
 * "A Prefeitura" (RF050): como a administração municipal conduz as consultas, publica os resultados
 * e presta contas, com os órgãos que aparecem na plataforma. Substitui o atalho "Dados abertos" do
 * topo; a exportação em formato aberto (RF045, RNF13) continua em Transparência e Resultados.
 */
import Link from "next/link";
import { MainContainer } from "@/components/layout/site-chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { Alert, PageHeader, Section, Table } from "@/components/ui/primitives";
import { env } from "@/server/lib/env";
import { municipalOrgansSummary } from "@/server/modules/consultations/queries.service";

export const metadata = { title: "A Prefeitura" };

const ETAPAS: [IconName, string, string, string, string][] = [
  ["clipboard", "Prepara a consulta", "Cada consulta parte de uma proposta de um órgão municipal. Quem elabora não aprova: a revisão e a aprovação são feitas por outras pessoas, com registro de cada etapa.", "/consultas", "Ver consultas"],
  ["megaphone", "Divulga e abre a participação", "A consulta é publicada com antecedência, com período, público-alvo e materiais em linguagem simples. A votação abre e fecha sozinha, no horário divulgado.", "/como-funciona", "Como funciona"],
  ["chart", "Publica o resultado", "Ao encerrar, o resultado é conferido e publicado com metodologia e nota oficial. A votação é consultiva: orienta a administração, sem substituir os ritos próprios de cada tema.", "/resultados", "Ver resultados"],
  ["route", "Presta contas do que foi feito", "Depois do resultado, o órgão responsável registra os encaminhamentos — decisão, providências e situação — e todo o histórico fica público.", "/encaminhamentos", "Ver encaminhamentos"],
];

export default async function PrefeituraPage() {
  const cidade = env.municipio.replace(/^Município de /, "");
  const orgaos = await municipalOrgansSummary();
  return (
    <MainContainer>
      <PageHeader
        title={`Prefeitura de ${cidade}`}
        description="Como a Prefeitura conduz as consultas públicas, publica os resultados e presta contas do que foi feito depois."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "A Prefeitura" }]}
      />
      <Alert tone="warning" className="mb-8" title="Demonstração acadêmica">
        Esta plataforma não é um serviço oficial da Prefeitura de {cidade}. Os órgãos, as consultas e os números exibidos são fictícios.
      </Alert>

      <Section title="O papel da Prefeitura em cada consulta">
        <ol className="grid gap-4 md:grid-cols-2">
          {ETAPAS.map(([icone, titulo, texto, href, rotulo], i) => (
            <li key={titulo} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name={icone} className="size-5" />
                </span>
                <h3 className="text-lg font-bold">
                  <span className="text-civic-700">{i + 1}.</span> {titulo}
                </h3>
              </div>
              <p className="text-sm text-ink">{texto}</p>
              <Link href={href} className="mt-auto text-sm font-semibold text-brand-700 hover:underline">
                {rotulo} →
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Órgãos municipais na plataforma" description="Quantas consultas públicas cada órgão conduz e quantos encaminhamentos já registrou." className="mt-10">
        <Table
          caption="Órgãos municipais, consultas e encaminhamentos"
          head={["Órgão", "Sigla", "Consultas publicadas", "Abertas agora", "Encaminhamentos"]}
          rows={orgaos.map((o) => [o.nome, o.sigla, o.consultas, o.abertas, o.encaminhamentos])}
          empty="Nenhum órgão cadastrado."
        />
      </Section>

      <Section title="Atendimento" className="mt-10">
        <p className="max-w-3xl text-sm text-ink">
          Nos eventos participativos ligados a uma consulta (audiências, reuniões e debates), perguntas feitas por telefone podem ser registradas por um servidor do atendimento. O voto, porém, é sempre pessoal e secreto: ninguém vota no lugar de outra pessoa.
        </p>
      </Section>
    </MainContainer>
  );
}
