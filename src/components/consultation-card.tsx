import Link from "next/link";
import { Badge, cx } from "./ui/primitives";
import { Icon } from "./ui/icons";
import { CONSULTATION_STATUS, fmtDate, type ConsultationStatus } from "@/lib/labels";

export type CardConsultation = {
  slug: string;
  title: string;
  summary: string;
  status: string;
  opensAt: Date | null;
  closesAt: Date | null;
  theme: string | null;
  region?: string | null;
  participations: number;
  exceptionalDeadline?: boolean;
  viewerState?: "participou" | "pode_participar" | "nao_se_enquadra" | null;
  viewerReason?: string | null;
};

export function StatusBadge({ status }: { status: string }) {
  const s = CONSULTATION_STATUS[status as ConsultationStatus];
  return <Badge tone={s?.tone ?? "neutral"}>{s?.label ?? status}</Badge>;
}

export function daysLeftText(closesAt: Date | null, now = new Date()) {
  if (!closesAt) return null;
  const ms = closesAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  const d = Math.ceil(ms / 86_400_000);
  return d <= 1 ? "Encerra em menos de 1 dia" : `Faltam ${d} dias`;
}

export function ConsultationCard({ c }: { c: CardConsultation }) {
  const left = c.status === "aberta" ? daysLeftText(c.closesAt) : null;
  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-line bg-white p-5 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-brand-200">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={c.status} />
        {c.theme && <Badge tone="primary">{c.theme}</Badge>}
        {c.exceptionalDeadline && <Badge tone="warning">Prazo excepcional de 10 dias</Badge>}
      </div>
      <h3 className="text-lg font-bold leading-snug text-brand-900">
        <Link href={`/consultas/${c.slug}`} className="after:absolute after:inset-0 after:content-[''] group-hover:underline">
          {c.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm text-muted">{c.summary}</p>
      <div className="mt-auto space-y-2 pt-4 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 text-ink">
          <Icon name="calendar" className="size-4 text-brand-600" />
          {fmtDate(c.opensAt)} a {fmtDate(c.closesAt)}
          {left && <strong className="text-civic-700">· {left}</strong>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-ink">
          <Icon name="users" className="size-4 text-brand-600" />
          {c.participations.toLocaleString("pt-BR")} participaç{c.participations === 1 ? "ão" : "ões"}
          {c.region && <span className="text-muted">· {c.region}</span>}
        </p>
        {c.viewerState && (
          <p
            className={cx(
              "flex items-center gap-2 font-semibold",
              c.viewerState === "participou" ? "text-ok-700" : c.viewerState === "pode_participar" ? "text-brand-700" : "text-warn-800",
            )}
          >
            <Icon name={c.viewerState === "participou" ? "check" : c.viewerState === "pode_participar" ? "ballot" : "info"} className="size-4" />
            {c.viewerState === "participou" ? "Você já participou" : c.viewerState === "pode_participar" ? "Você pode participar" : "Você não se enquadra no público-alvo"}
          </p>
        )}
      </div>
    </article>
  );
}
