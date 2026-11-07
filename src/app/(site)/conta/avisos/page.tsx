import Link from "next/link";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Badge, Button, EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { listNotifications } from "@/server/modules/notifications/notifications.service";
import { myModerationDecisions } from "@/server/modules/moderation/moderation.service";
import { markReadAction, requestReviewAction } from "@/server/actions/citizen";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Central de avisos" };

export default async function AvisosPage() {
  const a = await requireCitizen("/conta/avisos");
  const [items, decisions] = await Promise.all([listNotifications(a.id), myModerationDecisions(a.id)]);
  const unread = items.filter((n) => !n.readAt).length;
  const reviewable = decisions.filter((d) => !d.isReview && !d.reviewRequestedAt && !decisions.some((x) => x.reviewRequestedAt && x.createdAt > d.createdAt));
  return (
    <>
      <PageHeader
        title="Central de avisos"
        description={`${unread} não lido(s). Avisos obrigatórios (segurança, comprovantes e mudanças em consultas em que você votou) não podem ser desligados.`}
        actions={
          unread > 0 ? (
            <form action={markReadAction}>
              <Button variant="secondary" icon="check">
                Marcar todos como lidos
              </Button>
            </form>
          ) : undefined
        }
      />
      {items.length ? (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-xl border bg-white p-4 ${n.readAt ? "border-line" : "border-brand-200 ring-1 ring-brand-100"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {!n.readAt && <Badge tone="primary">Novo</Badge>}
                {n.mandatory && <Badge tone="neutral">Obrigatório</Badge>}
                <span className="text-muted">{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 font-semibold text-brand-900">{n.title}</p>
              <p className="whitespace-pre-line text-sm">{n.body}</p>
              {n.link && (
                <Link href={n.link} className="mt-1 inline-block text-sm font-semibold text-brand-700 underline">
                  Abrir
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="bell" title="Nenhum aviso" />
      )}
      {reviewable.length > 0 && (
        <Section title="Decisões de moderação sobre seu conteúdo" className="mt-10" description="Você pode pedir uma revisão, feita por outro moderador, que decide em definitivo.">
          {reviewable.map((d) => (
            <div key={d.id} className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm">
                Decisão: <strong>{d.decision}</strong> — {d.justification}
              </p>
              <ActionForm action={requestReviewAction.bind(null, d.id)} className="mt-3">
                <TextArea label="Por que você pede revisão?" name="reason" rows={2} required />
                <SubmitButton variant="secondary">Pedir revisão</SubmitButton>
              </ActionForm>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
