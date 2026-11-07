/** Páginas institucionais estáticas: privacidade (LGPD), termos de uso, acessibilidade e acesso negado. */
import { notFound } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { env } from "@/server/lib/env";

const PAGES: Record<string, { title: string; body: (m: string) => React.ReactNode }> = {
  privacidade: {
    title: "Privacidade e proteção de dados (LGPD)",
    body: (m) => (
      <>
        <p>Controlador: Prefeitura de {m.replace(/^Município de /, "")} (dados fictícios nesta demonstração).</p>
        <h2 className="text-lg font-bold">Dados coletados e finalidade</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>CPF</strong> — garantir uma conta por pessoa e verificar a identidade. É guardado apenas como código protegido (HMAC) e em forma mascarada; nunca é exibido.</li>
          <li><strong>Data de nascimento</strong> — usada somente em consultas com critério de idade justificado. Não há idade mínima geral.</li>
          <li><strong>Endereço no município</strong> — usado em consultas restritas a bairros ou regiões.</li>
          <li><strong>E-mail e celular</strong> — confirmação de conta, recuperação de senha, comprovantes e avisos.</li>
        </ul>
        <h2 className="text-lg font-bold">O seu voto</h2>
        <p>O voto é secreto. A escolha é gravada sem vínculo com a sua identidade, sem horário e sem o código do comprovante. Nem a cópia dos seus dados contém a alternativa escolhida.</p>
        <h2 className="text-lg font-bold">Seus direitos</h2>
        <p>Na área “Privacidade e meus dados” você pode baixar uma cópia dos seus dados (JSON ou PDF) e desativar a conta. Na desativação, nome, e-mail, celular e endereço são anonimizados; os votos e resultados não são alterados e o código protegido do CPF é mantido para impedir novo voto na mesma consulta.</p>
        <p>Páginas públicas, exportações e relatórios contêm apenas dados agregados. Relatórios ocultam grupos com menos de 10 pessoas.</p>
      </>
    ),
  },
  termos: {
    title: "Termos de uso",
    body: () => (
      <>
        <p>Versão 1.0 (demonstração acadêmica).</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>A plataforma destina-se à participação consultiva em consultas públicas municipais e ao envio de propostas.</li>
          <li>Cada pessoa pode ter apenas uma conta de cidadão. Informações falsas podem levar ao bloqueio da conta.</li>
          <li>O voto é único, secreto e irretratável depois de confirmado.</li>
          <li>Conteúdos enviados (propostas, comentários) devem respeitar a lei e a política de uso: são proibidos ofensas, discurso de ódio, exposição de dados pessoais, propaganda e conteúdo ilegal. Conteúdos denunciados podem ser moderados com justificativa, com direito a um pedido de revisão.</li>
          <li>O resultado das consultas tem caráter consultivo e não substitui os ritos legais de participação.</li>
        </ol>
      </>
    ),
  },
  acessibilidade: {
    title: "Acessibilidade",
    body: () => (
      <>
        <p>Este portal busca conformidade com o nível AA da WCAG 2.2 e as recomendações do eMAG 3.1 (Lei Brasileira de Inclusão, art. 63).</p>
        <h2 className="text-lg font-bold">Atalhos de teclado</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Alt + 1 (ou Alt + Shift + 1 no Firefox): ir para o conteúdo</li>
          <li>Alt + 2: ir para o menu</li>
          <li>Alt + 3: ir para a busca de consultas</li>
          <li>Alt + 4: ir para o rodapé</li>
          <li>Alt + 5: alternar alto contraste</li>
        </ul>
        <h2 className="text-lg font-bold">Recursos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Funciona a partir de 320 px de largura, sem rolagem horizontal; alvos de toque com no mínimo 24 × 24 px.</li>
          <li>Imagens com texto alternativo; vídeos e áudios com transcrição ou resumo e legendas quando há fala.</li>
          <li>Gráficos de resultado acompanhados de tabela de dados.</li>
          <li>Conteúdos essenciais legíveis sem vídeo nem plug-ins; imagens carregadas sob demanda.</li>
        </ul>
        <p>Encontrou alguma barreira? Informe a Ouvidoria-Geral do Município.</p>
      </>
    ),
  },
  "acesso-negado": {
    title: "Acesso negado",
    body: () => (
      <>
        <p>Você não tem permissão para acessar esta área. A tentativa foi registrada.</p>
        <LinkButton href="/">Voltar ao início</LinkButton>
      </>
    ),
  },
};

export default async function StaticPage({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  const page = PAGES[pagina];
  if (!page) notFound();
  return (
    <MainContainer>
      <PageHeader title={page.title} breadcrumbs={[{ href: "/", label: "Início" }, { label: page.title }]} />
      <Card className="max-w-3xl space-y-4 leading-relaxed">{page.body(env.municipio)}</Card>
    </MainContainer>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }) {
  return { title: PAGES[(await params).pagina]?.title ?? "Página" };
}
