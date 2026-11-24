/**
 * Documento de Requisitos navegável, com referências cruzadas automáticas entre RF, RNF, RN
 * e RS (DT-24). O conteúdo vem de docs/requisitos/REQUISITOS_COMPLETOS.md.
 */
import { MainContainer } from "@/components/layout/site-chrome";
import { DocumentoRequisitos, IndiceRegrasDeNegocio } from "@/components/requisitos/documento";
import { NavegadorRequisitos } from "@/components/requisitos/navegador";
import { RefRequisito, renderizarReferencias } from "@/components/requisitos/ref-link";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { contarPorTipo } from "@/lib/requisitos/catalogo";
import { ancoraDeTitulo } from "@/lib/requisitos/markdown";
import { documentoRequisitos } from "@/server/lib/documento-requisitos";

export const metadata = { title: "Documento de requisitos" };

export default function RequisitosPage() {
  const { blocos, catalogo, resumo } = documentoRequisitos();
  const total = contarPorTipo(catalogo);
  const secoes = blocos.filter((b) => b.t === "titulo" && b.nivel === 2).map((b) => (b.t === "titulo" ? b.texto : ""));
  const exemploInexistente = "RF999";

  return (
    <MainContainer>
      <NavegadorRequisitos />
      <PageHeader
        title="Documento de requisitos"
        description="Requisitos da Plataforma de Participação Cidadã Municipal. Cada identificador citado no texto leva ao ponto em que o requisito é descrito."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "Documento de requisitos" }]}
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="como-ler" className="rounded-xl border border-line bg-white p-5">
          <h2 id="como-ler" className="text-lg font-bold">
            Como usar as referências
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <RefRequisito id="RF001" existe titulo={resumo.RF001} /> — identificador encontrado no documento: clique para ir até ele. O requisito de destino fica destacado por alguns segundos.
            </li>
            <li>
              {renderizarReferencias(exemploInexistente, resumo)} — identificador que não consta do documento: não vira link e fica marcado para verificação.
            </li>
            <li>Os botões voltar e avançar do navegador refazem o caminho entre os requisitos visitados.</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Reconhecidos automaticamente: <strong className="text-ink">{total.RF}</strong> requisitos funcionais, <strong className="text-ink">{total.RNF}</strong> não funcionais, <strong className="text-ink">{total.RN}</strong> regras de negócio e{" "}
            <strong className="text-ink">{total.RS}</strong> requisitos de segurança, em <strong className="text-ink">{catalogo.citacoes.length}</strong> referências no texto.
          </p>
        </section>

        <nav aria-labelledby="sumario" className="rounded-xl border border-line bg-white p-5">
          <h2 id="sumario" className="text-lg font-bold">
            Sumário
          </h2>
          <ol className="mt-2 space-y-1 text-sm">
            {secoes.map((s) => (
              <li key={s}>
                <a href={`#${ancoraDeTitulo(s)}`} className="text-brand-700 hover:underline">
                  {s}
                </a>
              </li>
            ))}
            <li>
              <a href="#regras-de-negocio" className="text-brand-700 hover:underline">
                Regras de negócio citadas
              </a>
            </li>
          </ol>
        </nav>
      </div>

      {catalogo.aVerificar.length > 0 && (
        <Alert tone="warning" title={`${catalogo.aVerificar.length} referência(s) a verificar`} className="mb-6">
          <ul className="list-disc pl-5">
            {catalogo.aVerificar.map((c, i) => (
              <li key={i}>
                <RefRequisito id={c.id} existe={false} /> citado em <a href={`#${c.contexto.ancora}`}>{c.contexto.rotulo}</a>, mas não consta do documento.
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <article aria-label="Conteúdo do documento de requisitos" className="max-w-none">
        <DocumentoRequisitos blocos={blocos} resumo={resumo} />
        <div className="mt-4">
          <IndiceRegrasDeNegocio catalogo={catalogo} resumo={resumo} />
        </div>
      </article>
    </MainContainer>
  );
}
