import { notFound } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { Card, PageHeader, Timeline } from "@/components/ui/primitives";
import { getPublicConsultation } from "@/server/modules/consultations/queries.service";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Histórico da consulta" };

const TYPE_LABEL: Record<string, string> = {
  publicacao: "Publicação",
  divulgacao: "Divulgação",
  abertura: "Abertura",
  alteracao: "Alteração",
  suspensao: "Suspensão",
  retomada: "Retomada",
  cancelamento: "Cancelamento",
  encerramento: "Encerramento",
  apuracao: "Contagem dos votos",
  resultado: "Resultado",
  retificacao: "Correção do resultado",
  encaminhamento: "Encaminhamento",
  substituicao_responsavel: "Substituição de responsáveis",
  agendamento_desfeito: "Agendamento desfeito",
};

export default async function HistoricoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicConsultation(slug);
  if (!data) notFound();
  return (
    <MainContainer>
      <PageHeader
        title="Histórico da consulta"
        description={`Linha do tempo pública de “${data.c.title}”. Os registros não podem ser editados nem excluídos.`}
        breadcrumbs={[{ href: "/consultas", label: "Consultas" }, { href: `/consultas/${slug}`, label: data.c.title }, { label: "Histórico" }]}
      />
      <Card className="max-w-3xl">
        <Timeline
          items={data.events.map((e) => ({
            date: `${fmtDateTime(e.occurredAt)} · ${TYPE_LABEL[e.type] ?? e.type}`,
            title: e.description,
            tone: e.type === "cancelamento" ? "danger" : e.type === "suspensao" ? "warning" : e.type === "resultado" ? "success" : undefined,
            body: (
              <>
                {e.justification && <p>Justificativa: {e.justification}</p>}
                {e.details && "antes" in e.details && (
                  <p className="text-muted">
                    Antes: {String(e.details.antes)} → Depois: {String(e.details.depois)}
                  </p>
                )}
                {e.unitName && <p className="text-xs text-muted">Unidade responsável: {e.unitName}</p>}
              </>
            ),
          }))}
        />
      </Card>
    </MainContainer>
  );
}
