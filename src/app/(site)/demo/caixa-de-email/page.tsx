import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Badge, PageHeader } from "@/components/ui/primitives";
import { demoMode } from "@/server/lib/env";
import { getDb } from "@/server/db/client";
import { emailOutbox } from "@/server/db/schema";
import { fmtDateTime } from "@/lib/labels";

export const metadata = { title: "Caixa de e-mail de teste" };

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part.replace(/^https?:\/\/[^/]+/, "")} className="break-all font-semibold text-brand-700 underline">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  if (!demoMode()) notFound();
  const { para } = await searchParams;
  const all = await getDb().select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(200);
  const rows = para ? all.filter((m) => m.toAddress.includes(para)) : all;
  return (
    <MainContainer>
      <PageHeader title="Caixa de e-mail de teste" description="Nesta demonstração os e-mails não são enviados de verdade: as mensagens que o sistema mandaria aparecem aqui." breadcrumbs={[{ href: "/demo", label: "Demonstração" }, { label: "Caixa de e-mail" }]} />
      <form method="get" className="mb-4 flex max-w-md gap-2">
        <label htmlFor="para" className="sr-only">
          Filtrar por destinatário
        </label>
        <input id="para" name="para" defaultValue={para} placeholder="Filtrar por destinatário" className="block w-full rounded-lg border border-slate-300 px-3 py-2" />
        <button className="rounded-lg bg-brand-700 px-4 font-semibold text-white">Filtrar</button>
      </form>
      <Alert tone="info" className="mb-4">
        Endereços iniciados por <code>sms:</code> representam SMS simulados.
      </Alert>
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{m.toAddress}</strong>
              <Badge tone={m.status === "enviado" ? "success" : m.status === "falhou" ? "danger" : "warning"}>{m.status}</Badge>
              <span className="text-muted">{fmtDateTime(m.createdAt)}</span>
            </div>
            <p className="mt-1 font-semibold text-brand-900">{m.subject}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{linkify(m.body)}</p>
          </li>
        ))}
        {!rows.length && <p className="text-muted">Nenhuma mensagem.</p>}
      </ul>
    </MainContainer>
  );
}
