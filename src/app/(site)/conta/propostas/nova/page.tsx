import Link from "next/link";
import { ProposalFields } from "@/components/proposal-fields";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Alert, Card, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { findSimilar } from "@/server/modules/proposals/citizen-proposals.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { getProfile } from "@/server/modules/profile/profile.service";
import { submitProposalAction } from "@/server/actions/citizen";
import { getSetting } from "@/server/lib/settings";

export const metadata = { title: "Enviar proposta" };

export default async function NovaPropostaPage({ searchParams }: { searchParams: Promise<{ titulo?: string; tema?: string }> }) {
  const a = await requireCitizen("/conta/propostas/nova");
  const sp = await searchParams;
  const [ref, profile, supportsOn] = await Promise.all([referenceData(), getProfile(a.id), getSetting("recursos.apoios")]);
  const similar = sp.titulo ? await findSimilar(sp.titulo, sp.tema) : null;
  const themes = ref.themes.map((t) => ({ value: t.id, label: t.name }));
  const districts = ref.districts.map((d) => ({ value: d.id, label: d.name }));
  const cls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
  return (
    <>
      <PageHeader title="Enviar proposta" description="Proponha uma melhoria de competência municipal. Você receberá um protocolo e a resposta será sempre justificada. A proposta não gera votação automática." breadcrumbs={[{ href: "/conta/propostas", label: "Minhas propostas" }, { label: "Nova" }]} />
      {profile?.verificationLevel !== "verificado" ? (
        <Alert tone="warning" title="Verifique sua identidade para enviar propostas">
          <Link href="/conta/verificacao">Fazer a verificação</Link>
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-bold">1. Antes de escrever, veja se já existe algo parecido</h2>
            <form method="get" className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
              <div>
                <label htmlFor="titulo" className="mb-1 block text-sm font-semibold">
                  Título da ideia
                </label>
                <input id="titulo" name="titulo" defaultValue={sp.titulo} maxLength={120} className={cls} required />
              </div>
              <div>
                <label htmlFor="tema" className="mb-1 block text-sm font-semibold">
                  Tema
                </label>
                <select id="tema" name="tema" defaultValue={sp.tema ?? ""} className={cls}>
                  <option value="">Todos</option>
                  {themes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button className="min-h-11 w-full rounded-lg bg-white px-4 font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50">Ver semelhantes</button>
              </div>
            </form>
            {similar && (
              <Section title="Resultados semelhantes">
                {similar.proposals.length + similar.consultations.length === 0 ? (
                  <p className="text-sm text-muted">Nada parecido encontrado. Siga para o envio.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {similar.proposals.map((p) => (
                      <li key={p.id}>
                        Proposta{" "}
                        <Link href={`/propostas/${p.protocol}`} className="font-semibold text-brand-700 underline">
                          {p.title}
                        </Link>
                        {supportsOn && ` — você pode apoiá-la (${p.supports} apoios)`}
                      </li>
                    ))}
                    {similar.consultations.map((c) => (
                      <li key={c.slug}>
                        Consulta{" "}
                        <Link href={`/consultas/${c.slug}`} className="font-semibold text-brand-700 underline">
                          {c.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">2. Complete e envie</h2>
            <ActionForm action={submitProposalAction}>
              <ProposalFields themes={themes} districts={districts} defaults={{ title: sp.titulo, themeId: sp.tema }} withFiles />
              <SubmitButton variant="civic">Enviar proposta</SubmitButton>
            </ActionForm>
          </Card>
          <LinkButton href="/propostas" variant="ghost">
            Ver propostas publicadas
          </LinkButton>
        </div>
      )}
    </>
  );
}
