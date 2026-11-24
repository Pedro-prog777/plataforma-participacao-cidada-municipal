import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { StatusBadge } from "@/components/consultation-card";
import { Icon } from "@/components/ui/icons";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { myParticipations } from "@/server/modules/voting/voting.service";
import { fmtDate } from "@/lib/labels";

export const metadata = { title: "Comprovante de participação" };

export default async function ComprovanteParticipacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const a = await requireCitizen("/conta/participacoes");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { novo } = await searchParams;
  // Apenas o titular vê o próprio comprovante (RF009): a busca é restrita às participações dele.
  const p = (await myParticipations(a.id)).find((x) => x.id === id);
  if (!p) notFound();
  return (
    <>
      {novo && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-ok-100 p-6 text-ok-700 ring-1 ring-green-300">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ok-700 text-white">
            <Icon name="check" className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-bold !text-ok-700">Seu voto foi registrado</h1>
            <p>Obrigado por participar. Enviamos o comprovante também para o seu e-mail.</p>
          </div>
        </div>
      )}
      {!novo && <PageHeader title="Comprovante de participação" breadcrumbs={[{ href: "/conta/participacoes", label: "Minhas participações" }, { label: "Comprovante" }]} />}
      <Card className="max-w-xl space-y-4">
        <div>
          <p className="text-sm text-muted">Consulta</p>
          <p className="text-lg font-semibold text-brand-900">{p.title}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted">Data</p>
            <p className="font-semibold">{fmtDate(p.date)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Situação da consulta</p>
            <StatusBadge status={p.status} />
          </div>
        </div>
        <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-4 text-center">
          <p className="text-sm text-muted">Código do comprovante</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand-900">{p.receipt}</p>
        </div>
        <Alert tone="info">Este comprovante prova que você participou, mas não informa a alternativa escolhida. Seu voto é secreto e não pode ser alterado.</Alert>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={`/api/conta/comprovante/${p.id}`} icon="download">
            Baixar PDF
          </LinkButton>
          <LinkButton href="/comprovante" variant="secondary" icon="shield">
            Verificar publicamente
          </LinkButton>
          <LinkButton href={`/consultas/${p.slug}`} variant="ghost">
            Voltar à consulta
          </LinkButton>
        </div>
      </Card>
    </>
  );
}
