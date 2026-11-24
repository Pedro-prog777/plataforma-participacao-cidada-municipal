/** Componentes de apresentação reutilizáveis (servidor). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { RefText } from "@/components/requisitos/ref-text";
import { Icon, type IconName } from "./icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Texto simples ganha referências automáticas a requisitos (RF/RNF/RN/RS → link, DT-24). */
export function comReferencias(conteudo: ReactNode): ReactNode {
  return typeof conteudo === "string" ? <RefText>{conteudo}</RefText> : conteudo;
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "civic";
const variants: Record<Variant, string> = {
  primary: "btn-primary bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
  civic: "bg-civic-700 text-white hover:bg-[#873d04] shadow-sm",
  secondary: "bg-white text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-bad-700 text-white hover:bg-red-800",
};
const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function Button({ variant = "primary", icon, className, children, ...rest }: ComponentProps<"button"> & { variant?: Variant; icon?: IconName }) {
  return (
    <button className={cx(base, variants[variant], className)} {...rest}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", icon, iconRight, className, children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; icon?: IconName; iconRight?: IconName }) {
  const content = (
    <>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
      {iconRight && <Icon name={iconRight} className="size-4" />}
    </>
  );
  // Rotas de arquivo (/api/...) são downloads: âncora simples, sem o pré-carregamento do roteador.
  if (typeof rest.href === "string" && rest.href.startsWith("/api/")) {
    return (
      <a href={rest.href} className={cx(base, variants[variant], "no-underline", className)}>
        {content}
      </a>
    );
  }
  return (
    <Link className={cx(base, variants[variant], "no-underline", className)} {...rest}>
      {content}
    </Link>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-300",
  info: "bg-info-100 text-info-700 ring-sky-300",
  success: "bg-ok-100 text-ok-700 ring-green-300",
  warning: "bg-warn-100 text-warn-800 ring-amber-300",
  danger: "bg-bad-100 text-bad-700 ring-red-300",
  primary: "bg-brand-100 text-brand-800 ring-brand-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

export function Card({ children, className, as: As = "div", ...rest }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "aside" } & Record<string, unknown>) {
  return (
    <As className={cx("rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,50,94,0.06)]", className)} {...rest}>
      {children}
    </As>
  );
}

const alertTone: Record<Tone, { cls: string; icon: IconName }> = {
  neutral: { cls: "border-slate-300 bg-slate-50 text-slate-800", icon: "info" },
  info: { cls: "border-sky-300 bg-info-100 text-info-700", icon: "info" },
  success: { cls: "border-green-300 bg-ok-100 text-ok-700", icon: "check" },
  warning: { cls: "border-amber-300 bg-warn-100 text-warn-800", icon: "alert" },
  danger: { cls: "border-red-300 bg-bad-100 text-bad-700", icon: "alert" },
  primary: { cls: "border-brand-200 bg-brand-50 text-brand-800", icon: "info" },
};

export function Alert({ tone = "info", title, children, className, role }: { tone?: Tone; title?: string; children?: ReactNode; className?: string; role?: "alert" | "status" }) {
  const t = alertTone[tone];
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cx("flex gap-3 rounded-lg border px-4 py-3 text-sm", t.cls, className)}>
      <Icon name={t.icon} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{comReferencias(title)}</p>}
        {children && <div className="[&_a]:font-semibold [&_a]:underline">{comReferencias(children)}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions, breadcrumbs }: { title: string; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; breadcrumbs?: { href?: string; label: string }[] }) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <div className="text-sm font-semibold text-civic-700">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{comReferencias(title)}</h1>
          {description && <div className="max-w-3xl text-base text-muted">{comReferencias(description)}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" className="size-3.5" />}
            {it.href ? (
              <Link href={it.href} className="hover:text-brand-700 hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EmptyState({ icon = "info", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="text-lg font-semibold text-brand-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        {icon && <Icon name={icon} className="size-4 text-brand-600" />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-brand-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Section({ title, description, children, actions, id, className }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className={cx("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={id ? `${id}-titulo` : undefined} className="text-lg font-bold sm:text-xl">
            {comReferencias(title)}
          </h2>
          {description && <p className="text-sm text-muted">{comReferencias(description)}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DescriptionList({ items }: { items: { term: string; detail: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((it) => (
        <div key={it.term} className="grid gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">{it.term}</dt>
          <dd className="text-sm sm:col-span-2">{comReferencias(it.detail)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ head, rows, caption, empty = "Nenhum registro." }: { head: ReactNode[]; rows: ReactNode[][]; caption?: string; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[36rem] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-brand-50 text-xs uppercase tracking-wide text-brand-800">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {comReferencias(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-8 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="align-top hover:bg-brand-50/40">
                {r.map((c, j) => (
                  <td key={j} className="px-4 py-3">
                    {comReferencias(c)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2 pt-2">
      {page > 1 ? (
        <LinkButton variant="secondary" href={hrefFor(page - 1)} icon="arrowLeft">
          Anterior
        </LinkButton>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <LinkButton variant="secondary" href={hrefFor(page + 1)} iconRight="arrowRight">
          Próxima
        </LinkButton>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Timeline({ items }: { items: { title: ReactNode; date: ReactNode; body?: ReactNode; tone?: Tone }[] }) {
  if (!items.length) return <p className="text-sm text-muted">Nenhum evento registrado.</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-brand-100 pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className={cx("absolute -left-[31px] top-1.5 size-3.5 rounded-full ring-4 ring-white", it.tone === "danger" ? "bg-bad-700" : it.tone === "warning" ? "bg-civic-500" : it.tone === "success" ? "bg-ok-700" : "bg-brand-600")} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{it.date}</p>
          <p className="font-semibold text-brand-900">{comReferencias(it.title)}</p>
          {it.body && <div className="mt-1 text-sm text-ink/90">{comReferencias(it.body)}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Gráfico de barras horizontal acessível (acompanha tabela de dados — RF044, RNF01). */
export function BarChart({ data, title, highlightId, unit = "votos" }: { data: { id: string; label: string; value: number; pct?: string }[]; title: string; highlightId?: string | null; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-semibold text-brand-900">{title}</figcaption>
      <ul className="space-y-3" aria-hidden="true">
        {data.map((d) => (
          <li key={d.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">
                {d.label}
                {highlightId === d.id && (
                  <Badge tone="success" className="ml-2">
                    mais votada
                  </Badge>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {d.pct ? `${d.pct.replace(".", ",")}% · ` : ""}
                {d.value.toLocaleString("pt-BR")} {unit}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-brand-50">
              <div className={cx("ac-preenchido h-full rounded-full", highlightId === d.id ? "bg-civic-500" : "bg-brand-600")} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{comReferencias(children)}</span>
    </div>
  );
}
