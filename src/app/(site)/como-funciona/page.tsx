import { MainContainer } from "@/components/layout/site-chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { Card, LinkButton, PageHeader, Section } from "@/components/ui/primitives";

export const metadata = { title: "Como funciona" };

const TOPICS: [IconName, string, string][] = [
  ["info", "Natureza consultiva", "A votação é consultiva: o resultado orienta a administração municipal, mas não substitui audiência pública, plebiscito, referendo ou iniciativa popular, que seguem ritos próprios previstos em lei. Cada resultado traz uma nota oficial explicando os próximos passos."],
  ["lock", "Sigilo do voto", "Quando você vota, o sistema grava duas coisas separadas: que você participou (para impedir voto duplo) e qual alternativa foi escolhida, sem nenhuma ligação com você, sem horário e sem o código do comprovante. Por isso, ninguém — nem servidores da Prefeitura — consegue saber em quem você votou."],
  ["check", "Voto único e irretratável", "Cada pessoa vota uma única vez em cada consulta. O banco de dados recusa um segundo voto mesmo em outro aparelho ou com cliques repetidos. Depois de confirmado, o voto não pode ser alterado."],
  ["users", "Quem pode participar", "Pessoas com conta ativa e identidade verificada (pelo provedor de identidade ou por documentos). Cada consulta informa seu público-alvo: aberta ao público em geral ou com limitações justificadas, como morar em determinado bairro. Contas administrativas não votam."],
  ["clock", "Prazos", "O período padrão de participação é de 20 dias. Em emergência justificada e autorizada, pode ser de 10 dias, com selo e justificativa publicados. A abertura e o encerramento são automáticos, sempre pelo horário oficial do servidor."],
  ["chart", "Apuração e resultados", "Ao encerrar, o sistema verifica a integridade (votos iguais às participações, somas, percentuais) e apura automaticamente pela regra publicada antes da abertura — maioria simples dos votos válidos. Durante a votação, só o número de participações é divulgado. O resultado é homologado, publicado com metodologia e hash, e não pode ser alterado, apenas retificado de forma justificada e visível."],
  ["shield", "Comprovante", "Ao votar, você recebe um código de 12 caracteres que prova a participação sem revelar a alternativa. Qualquer pessoa pode verificar um código na página pública de comprovantes."],
  ["route", "Encaminhamentos", "Depois do resultado, a Prefeitura registra os encaminhamentos — decisões, providências, órgão responsável e situação. A plataforma publica apenas o que foi registrado e mantém o histórico de cada mudança."],
];

export default function ComoFuncionaPage() {
  return (
    <MainContainer>
      <PageHeader title="Como funciona a participação" description="Entenda as regras da votação consultiva, como o sigilo é garantido e o que acontece depois." breadcrumbs={[{ href: "/", label: "Início" }, { label: "Como funciona" }]} />
      <ol className="mb-10 grid gap-4 md:grid-cols-4">
        {["Crie sua conta e confirme o e-mail", "Verifique sua identidade", "Escolha, confirme com o código e vote", "Guarde o comprovante e acompanhe"].map((s, i) => (
          <li key={s} className="rounded-xl border border-line bg-white p-4">
            <span className="text-3xl font-bold text-civic-600">{i + 1}</span>
            <p className="mt-1 font-semibold text-brand-900">{s}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-2">
        {TOPICS.map(([icon, title, text]) => (
          <Card key={title} as="section" className="space-y-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Icon name={icon} className="size-5 text-civic-600" /> {title}
            </h2>
            <p className="text-sm text-ink">{text}</p>
          </Card>
        ))}
      </div>
      <Section title="Propostas cidadãs" className="mt-10">
        <p>
          Você também pode enviar propostas de competência municipal. Cada proposta recebe protocolo e passa pelos estados <strong>Recebida → Em análise → (Ajuste solicitado) → Respondida → Publicada (se você autorizar) → Encerrada</strong>. A resposta é sempre justificada. Uma proposta não gera votação automática.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/consultas">Ver consultas</LinkButton>
          <LinkButton href="/conta/propostas/nova" variant="secondary">
            Enviar proposta
          </LinkButton>
        </div>
      </Section>
    </MainContainer>
  );
}
