import Link from "next/link";
import { ConsultationCard } from "@/components/consultation-card";
import { MainContainer } from "@/components/layout/site-chrome";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, LinkButton, PageHeader, Pagination } from "@/components/ui/primitives";
import { getCurrentActor } from "@/server/auth/current";
import { listPublicConsultations, referenceData } from "@/server/modules/consultations/queries.service";
import { CONSULTATION_STATUS, PUBLIC_STATUSES } from "@/lib/labels";

export const metadata = { title: "Consultas públicas" };

type SP = Promise<Record<string, string | undefined>>;

export default async function ConsultasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const actor = await getCurrentActor();
  const viewerId = actor?.kind === "cidadao" ? actor.id : null;
  const filter = {
    q: sp.q,
    status: sp.situacao,
    themeId: sp.tema,
    regionId: sp.regiao,
    from: sp.de,
    to: sp.ate,
    page: Number(sp.pagina) || 1,
    notParticipated: sp.nao_participei === "1",
    canParticipate: sp.posso_participar === "1",
  };
  const [result, ref] = await Promise.all([listPublicConsultations(filter, viewerId), referenceData()]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/consultas${p.size ? `?${p}` : ""}`;
  };
  const active: { key: string; label: string }[] = [];
  if (sp.q) active.push({ key: "q", label: `“${sp.q}”` });
  if (sp.situacao) active.push({ key: "situacao", label: CONSULTATION_STATUS[sp.situacao as "aberta"]?.label ?? sp.situacao });
  if (sp.tema) active.push({ key: "tema", label: ref.themes.find((t) => t.id === sp.tema)?.name ?? "Tema" });
  if (sp.regiao) active.push({ key: "regiao", label: ref.regions.find((r) => r.id === sp.regiao)?.name ?? "Região" });
  if (sp.de) active.push({ key: "de", label: `a partir de ${sp.de.split("-").reverse().join("/")}` });
  if (sp.ate) active.push({ key: "ate", label: `até ${sp.ate.split("-").reverse().join("/")}` });
  if (sp.nao_participei) active.push({ key: "nao_participei", label: "Ainda não participei" });
  if (sp.posso_participar) active.push({ key: "posso_participar", label: "Posso participar" });

  return (
    <MainContainer>
      <PageHeader
        title="Consultas públicas"
        description="Consultas abertas aparecem primeiro, pelo encerramento mais próximo. Use a busca para encontrar por palavra, tema, região ou período."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "Consultas" }]}
        actions={
          <LinkButton href="/consultas/encerradas" variant="secondary" icon="list">
            Consultas anteriores
          </LinkButton>
        }
      />

      <form role="search" aria-label="Pesquisar consultas" method="get" action="/consultas" className="mb-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">
            Palavras-chave
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input id="q" name="q" defaultValue={sp.q} accessKey="3" placeholder="Ex.: ciclofaixa, escola, saúde" className="block w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3" />
          </div>
        </div>
        <Select id="situacao" label="Situação" name="situacao" value={sp.situacao} options={PUBLIC_STATUSES.map((s) => ({ value: s, label: CONSULTATION_STATUS[s].label }))} />
        <Select id="tema" label="Tema" name="tema" value={sp.tema} options={ref.themes.map((t) => ({ value: t.id, label: t.name }))} />
        <Select id="regiao" label="Região" name="regiao" value={sp.regiao} options={ref.regions.map((r) => ({ value: r.id, label: r.name }))} />
        <div className="flex items-end">
          <button className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Buscar</button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:col-span-2 lg:col-span-5">
          {viewerId && (
            <>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="nao_participei" value="1" defaultChecked={sp.nao_participei === "1"} className="size-4 accent-brand-700" /> Ainda não participei
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="posso_participar" value="1" defaultChecked={sp.posso_participar === "1"} className="size-4 accent-brand-700" /> Posso participar
              </label>
            </>
          )}
          <Link href="/consultas/pesquisa" className="font-semibold text-brand-700 hover:underline">
            Pesquisa avançada (período)
          </Link>
        </div>
      </form>

      {active.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Filtros aplicados">
          <span className="text-muted">Filtros:</span>
          {active.map((f) => (
            <Link key={f.key} href={qs({ [f.key]: undefined, pagina: undefined })} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-800 hover:bg-brand-200" aria-label={`Remover filtro ${f.label}`}>
              {f.label} <Icon name="x" className="size-3.5" />
            </Link>
          ))}
          <Link href="/consultas" className="font-semibold text-brand-700 underline">
            Limpar tudo
          </Link>
        </div>
      )}

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {result.total} consulta{result.total === 1 ? "" : "s"} encontrada{result.total === 1 ? "" : "s"}
      </p>

      {result.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <ConsultationCard key={c.slug} c={c} />
          ))}
        </div>
      ) : active.length ? (
        <EmptyState icon="search" title="Nenhuma consulta encontrada" action={<LinkButton href="/consultas" variant="secondary">Remover filtros</LinkButton>}>
          Tente remover alguns filtros ou usar outras palavras.
        </EmptyState>
      ) : (
        <EmptyState icon="bell" title="Ainda não há consultas publicadas" action={<LinkButton href={viewerId ? "/conta/notificacoes" : "/cadastro"}>Quero ser avisado(a)</LinkButton>}>
          Inscreva-se para receber um aviso quando uma nova consulta for publicada.
        </EmptyState>
      )}
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => qs({ pagina: String(p) })} />
      <p className="mt-6 text-xs text-muted">
        <Badge tone="neutral">Consultivo</Badge> As votações orientam a administração e não substituem plebiscito, referendo, iniciativa popular ou audiência pública com rito legal.
      </p>
    </MainContainer>
  );
}

function Select({ id, label, name, value, options }: { id: string; label: string; name: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
        <option value="">Todas</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
