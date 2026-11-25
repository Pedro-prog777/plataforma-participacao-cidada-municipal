import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { MainContainer } from "@/components/layout/site-chrome";
import { Alert, Badge, PageHeader } from "@/components/ui/primitives";
import { demoMode } from "@/server/lib/env";
import { getDb } from "@/server/db/client";
import { emailOutbox, users } from "@/server/db/schema";
import { getCurrentActor } from "@/server/auth/current";
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

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = { enviado: "success", falhou: "danger", pendente: "warning", simulado: "neutral" };

/**
 * Caixa simulada (somente DEMO_MODE). Nunca lista as mensagens de todo mundo (DT-32): mostra as da
 * conta que entrou ou as de UM destinatário informado por completo — quem acabou de se cadastrar,
 * ainda sem poder entrar, informa o próprio e-mail para ler o link de confirmação.
 */
export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  if (!demoMode()) notFound();
  const para = ((await searchParams).para ?? "").trim();
  const actor = await getCurrentActor();
  let addresses: string[] = [];
  if (para) addresses = [para.startsWith("sms:") ? para : para.toLowerCase()];
  else if (actor) {
    const [u] = await getDb().select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, actor.id));
    if (u) addresses = [u.email, ...(u.phone ? [`sms:${u.phone}`] : [])];
  }
  const rows = addresses.length
    ? await getDb().select().from(emailOutbox).where(inArray(emailOutbox.toAddress, addresses)).orderBy(desc(emailOutbox.createdAt)).limit(50)
    : [];
  return (
    <MainContainer>
      <PageHeader
        title="Caixa de e-mail de teste"
        description="Nesta demonstração os e-mails não são enviados de verdade: as mensagens que o sistema mandaria aparecem aqui, uma pessoa por vez."
        breadcrumbs={[{ href: "/demo", label: "Demonstração" }, { label: "Caixa de e-mail" }]}
      />
      <form method="get" className="mb-4 flex max-w-md gap-2">
        <label htmlFor="para" className="sr-only">
          E-mail do destinatário
        </label>
        <input id="para" name="para" type="email" defaultValue={para} placeholder="E-mail completo do destinatário" className="block w-full rounded-lg border border-slate-300 px-3 py-2" />
        <button className="rounded-lg bg-brand-700 px-4 font-semibold text-white">Abrir</button>
      </form>
      <Alert tone="info" className="mb-4">
        {actor && !para
          ? "Estas são as mensagens da sua conta. Para ver as de outro endereço (por exemplo, o de uma conta que acabou de ser criada), informe o e-mail completo."
          : "Informe o e-mail completo do destinatário, ou entre na conta, para ver as mensagens. A caixa não lista as mensagens de todas as pessoas."}
      </Alert>
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong className="break-all">{m.toAddress.startsWith("sms:") ? `SMS simulado para ${m.toAddress.slice(4)}` : m.toAddress}</strong>
                <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status === "simulado" ? "simulado (não enviado)" : m.status}</Badge>
                <span className="text-muted">{fmtDateTime(m.createdAt)}</span>
              </div>
              <p className="mt-1 font-semibold text-brand-900">{m.subject}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{linkify(m.body)}</p>
            </li>
          ))}
          {!rows.length && <p className="text-muted">Nenhuma mensagem para este endereço.</p>}
        </ul>
      )}
    </MainContainer>
  );
}
