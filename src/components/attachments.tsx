/** Documentos e mídias com alternativa textual (RF023, RN37). Mídias nunca são condição para participar. */
import { Icon } from "./ui/icons";
import { Badge } from "./ui/primitives";

export type AttachmentView = {
  id: string;
  kind: string;
  mediaType: string;
  title: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  url: string | null;
  altText: string | null;
  transcript: string | null;
  captionsUrl: string | null;
  addedAfterPublication: boolean;
  justification: string | null;
  linkStatus: string | null;
};

const size = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : "");

export function AttachmentList({ items }: { items: AttachmentView[] }) {
  if (!items.length) return <p className="text-sm text-muted">Nenhum documento anexado.</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-brand-900">
                <Icon name={a.kind === "link" ? "external" : "file"} className="size-4 shrink-0 text-brand-600" />
                {a.title}
              </p>
              <p className="text-xs text-muted">
                {a.kind === "link" ? "Link externo" : `${a.mime?.split("/")[1]?.toUpperCase() ?? "Arquivo"} · ${size(a.sizeBytes)}`}
                {a.sha256 && <span title={a.sha256}> · SHA-256 {a.sha256.slice(0, 12)}…</span>}
              </p>
              {a.addedAfterPublication && (
                <p className="mt-1 text-xs">
                  <Badge tone="warning">Incluído após a publicação</Badge> {a.justification}
                </p>
              )}
            </div>
            {a.kind === "link" ? (
              <a href={a.url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                Abrir <Icon name="external" className="size-4" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            ) : (
              <a href={`/api/anexos/${a.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Icon name="download" className="size-4" /> Baixar
              </a>
            )}
          </div>
          {a.mediaType === "imagem" && a.kind !== "link" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/anexos/${a.id}`} alt={a.altText ?? ""} loading="lazy" decoding="async" className="mt-3 max-h-72 rounded-lg border border-line object-contain" />
          )}
          {a.mediaType === "audio" && a.kind !== "link" && <audio controls preload="none" src={`/api/anexos/${a.id}`} className="mt-3 w-full" />}
          {a.mediaType === "video" && a.kind !== "link" && (
            <video controls preload="none" className="mt-3 w-full rounded-lg">
              <source src={`/api/anexos/${a.id}`} type={a.mime ?? undefined} />
              {a.captionsUrl && <track kind="captions" srcLang="pt-BR" src={a.captionsUrl} label="Português" />}
            </video>
          )}
          {a.linkStatus && a.linkStatus !== "ok" && <p className="mt-2 text-sm font-medium text-warn-800">O link está indisponível no momento. Use a alternativa em texto abaixo.</p>}
          {(a.transcript || (a.altText && a.mediaType !== "documento")) && (
            <details className="mt-3 text-sm" open={a.linkStatus !== null && a.linkStatus !== "ok"}>
              <summary className="cursor-pointer font-semibold text-brand-700">{a.mediaType === "imagem" ? "Descrição da imagem" : "Transcrição / resumo em texto"}</summary>
              <p className="prose-civic mt-2 text-ink">{a.transcript ?? a.altText}</p>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
