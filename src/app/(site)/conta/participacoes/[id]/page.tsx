import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { StatusBadge } from "@/components/consultation-card";
import { CopyButton } from "@/components/copy-button";
import { Icon } from "@/components/ui/icons";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { myParticipation } from "@/server/modules/voting/voting.service";
import { emailIsSimulated } from "@/server/modules/notifications/notifications.service";
import { fmtDate } from "@/lib/labels";

export const metadata = { title: "Comprovante de participação" };

/**
 * Confirmação e comprovante (RF038). Só é aberta depois que o voto foi gravado (COMMIT): o código
 * aparece na mesma guia, pronto para copiar, sem depender de e-mail (DT-32).
 */
export default async function ComprovanteParticipacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const a = await requireCitizen("/conta/participacoes");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { novo } = await searchParams;
  // Apenas o titular vê o próprio comprovante (RF009): a busca é restrita às participações dele.
  const p = await myParticipation(a.id, id);
  if (!p) notFound();
  return (
    <>
      {novo && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-ok-100 p-6 text-ok-700 ring-1 ring-green-300">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ok-700 text-white">
            <Icon name="check" className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ok-700!">Participação registrada com sucesso!</h1>
            {/* RF038: "Seu voto foi registrado" — texto do documento mantido no subtítulo. */}
            <p>Seu voto foi registrado e confirmado pelo sistema.</p>
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
        <div className="space-y-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-4 text-center">
          <p className="text-sm text-muted">Seu código de participação</p>
          <p className="break-all font-mono text-2xl font-bold tracking-widest text-brand-900 select-all">{p.receipt}</p>
          <CopyButton value={p.receipt} />
        </div>
        <p className="text-sm">
          Guarde esse código para consultar ou comprovar o registro da sua participação na página <Link href="/comprovante" className="font-semibold text-brand-700 underline">Verificar comprovante</Link>. Ele também fica guardado em{" "}
          <Link href="/conta/participacoes" className="font-semibold text-brand-700 underline">Minhas participações</Link>.
        </p>
        <Alert tone="info">Este comprovante prova que você participou, mas não informa a alternativa escolhida. Seu voto é secreto e não pode ser alterado.</Alert>
        {novo && (
          <p className="text-sm text-muted">
            {emailIsSimulated()
              ? "Nenhuma cópia por e-mail é enviada neste ambiente: o código acima é o seu comprovante."
              : "Uma cópia também será enviada para o seu e-mail cadastrado, mas não é preciso esperar por ela: o código acima já é o seu comprovante."}
          </p>
        )}
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
