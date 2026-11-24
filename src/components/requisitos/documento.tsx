/**
 * Renderização do Documento de Requisitos (componente de servidor). O conteúdo é o do
 * Markdown, sem reescrita; muda só a apresentação: cada RF vira um bloco com âncora, as linhas
 * das tabelas de RNF e RS viram cartões (legíveis a 320 px) e todo identificador citado vira
 * referência automática.
 */
import { Fragment, type ReactNode } from "react";
import { citadoEm, type Catalogo } from "@/lib/requisitos/catalogo";
import { ancoraDeTitulo, type Bloco, type BlocoLista, type Inline } from "@/lib/requisitos/markdown";
import type { ResumoCatalogo } from "@/lib/requisitos/referencias";
import { enderecoDoLink } from "@/server/lib/documento-requisitos";
import { RefRequisito, renderizarReferencias } from "./ref-link";

const RF_TITULO = /^(RF\d{3})\s*[–-]\s*(.+)$/;
const tituloAteNivel = (b: Bloco, nivel: number) => b.t === "titulo" && b.nivel <= nivel;

function Trechos({ c, resumo, semReferencias }: { c: Inline[]; resumo: ResumoCatalogo; semReferencias?: boolean }) {
  const texto = (v: string) => (semReferencias ? v : renderizarReferencias(v, resumo));
  return (
    <>
      {c.map((n, i) => {
        switch (n.t) {
          case "texto":
            return <Fragment key={i}>{texto(n.v)}</Fragment>;
          case "forte":
            return (
              <strong key={i} className="font-semibold text-ink">
                <Trechos c={n.c} resumo={resumo} semReferencias={semReferencias} />
              </strong>
            );
          case "enfase":
            return (
              <em key={i}>
                <Trechos c={n.c} resumo={resumo} semReferencias={semReferencias} />
              </em>
            );
          case "codigo":
            return (
              <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-ink">
                {texto(n.v)}
              </code>
            );
          case "link": {
            const href = enderecoDoLink(n.href);
            const externo = /^https?:/.test(href);
            return (
              // Texto de link não recebe referências: não existe link dentro de link.
              <a key={i} href={href} className="font-semibold text-brand-700 underline wrap-break-word" {...(externo ? { target: "_blank", rel: "noopener" } : {})}>
                <Trechos c={n.c} resumo={resumo} semReferencias />
                {externo && <span className="sr-only"> (abre em nova aba)</span>}
              </a>
            );
          }
        }
      })}
    </>
  );
}

function Lista({ lista, resumo }: { lista: BlocoLista; resumo: ResumoCatalogo }) {
  const itens = lista.itens.map((it, i) => (
    <li key={i} value={lista.ordenada ? it.numero : undefined}>
      <Trechos c={it.c} resumo={resumo} />
      {it.sub && <Lista lista={it.sub} resumo={resumo} />}
    </li>
  ));
  return lista.ordenada ? <ol className="list-decimal space-y-1.5 pl-6">{itens}</ol> : <ul className="list-disc space-y-1.5 pl-5 [&_ul]:mt-1.5 [&_ul]:list-[circle]">{itens}</ul>;
}

type Tabela = Extract<Bloco, { t: "tabela" }>;

/** Tabelas de definição (seções 4 e 5: primeira coluna "ID"): um cartão por requisito. */
function CartoesDeDefinicao({ tabela, resumo }: { tabela: Tabela; resumo: ResumoCatalogo }) {
  const rotulos = tabela.cabecalho.map((c) => c.map((n) => (n.t === "texto" ? n.v : "")).join(""));
  return (
    <div className="grid gap-3">
      {tabela.linhas.map((linha, i) => {
        const id = linha[0]?.map((n) => (n.t === "texto" ? n.v : "")).join("").trim() ?? "";
        return (
          <article key={i} id={id} aria-labelledby={`${id}-titulo`} className="req-alvo req-cartao">
            <h3 id={`${id}-titulo`} className="text-base font-bold">
              <span className="req-id">{id}</span>
            </h3>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
              {linha.slice(1).map((celula, k) => (
                <Fragment key={k}>
                  <dt className="font-semibold text-muted">{rotulos[k + 1]}</dt>
                  <dd className="min-w-0">
                    <Trechos c={celula} resumo={resumo} />
                  </dd>
                </Fragment>
              ))}
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function TabelaSimples({ tabela, resumo, rotulo }: { tabela: Tabela; resumo: ResumoCatalogo; rotulo: string }) {
  const alinhar = (k: number) => (tabela.alinhamentos[k] === "direita" ? "text-right" : tabela.alinhamentos[k] === "centro" ? "text-center" : "text-left");
  return (
    // Tabela larga rola dentro da própria caixa; a página continua sem rolagem horizontal (RNF03).
    <div className="overflow-x-auto rounded-lg border border-line bg-white" role="region" aria-label={rotulo} tabIndex={0}>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-brand-50 text-brand-900">
          <tr>
            {tabela.cabecalho.map((c, k) => (
              <th key={k} scope="col" className={`border-b border-line px-3 py-2 align-bottom font-semibold ${alinhar(k)}`}>
                <Trechos c={c} resumo={resumo} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabela.linhas.map((linha, i) => (
            <tr key={i} className="border-b border-line last:border-0 even:bg-slate-50/60">
              {linha.map((c, k) =>
                k === 0 ? (
                  <th key={k} scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-semibold">
                    <Trechos c={c} resumo={resumo} />
                  </th>
                ) : (
                  <td key={k} className={`px-3 py-1.5 align-top ${alinhar(k)}`}>
                    <Trechos c={c} resumo={resumo} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocoSimples({ bloco, resumo, tituloAtual }: { bloco: Bloco; resumo: ResumoCatalogo; tituloAtual: string }) {
  switch (bloco.t) {
    case "titulo": {
      const id = ancoraDeTitulo(bloco.texto);
      if (bloco.nivel <= 2)
        return (
          <h2 id={id} className="border-b border-line pt-6 pb-2 text-2xl font-bold tracking-tight">
            <Trechos c={bloco.c} resumo={resumo} />
          </h2>
        );
      return (
        <h3 id={id} className="pt-3 text-lg font-bold">
          <Trechos c={bloco.c} resumo={resumo} />
        </h3>
      );
    }
    case "paragrafo":
      return (
        <p>
          <Trechos c={bloco.c} resumo={resumo} />
        </p>
      );
    case "citacao":
      return (
        <blockquote className="space-y-1 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {bloco.linhas.map((l, i) => (
            <p key={i}>
              <Trechos c={l} resumo={resumo} />
            </p>
          ))}
        </blockquote>
      );
    case "lista":
      return <Lista lista={bloco} resumo={resumo} />;
    case "tabela": {
      const primeira = bloco.cabecalho[0]?.map((n) => (n.t === "texto" ? n.v : "")).join("").trim();
      return primeira === "ID" ? <CartoesDeDefinicao tabela={bloco} resumo={resumo} /> : <TabelaSimples tabela={bloco} resumo={resumo} rotulo={`Tabela: ${tituloAtual}`} />;
    }
  }
}

export function DocumentoRequisitos({ blocos, resumo }: { blocos: Bloco[]; resumo: ResumoCatalogo }) {
  const saida: ReactNode[] = [];
  let tituloAtual = "";
  let i = 0;
  while (i < blocos.length) {
    const b = blocos[i];
    if (b.t === "titulo") tituloAtual = b.texto;
    // O título geral do arquivo é substituído pelo cabeçalho da página.
    if (b.t === "titulo" && b.nivel === 1) {
      i++;
      continue;
    }
    const rf = b.t === "titulo" && b.nivel === 3 ? RF_TITULO.exec(b.texto) : null;
    if (rf) {
      // Requisito funcional: título e conteúdo até o próximo título formam o alvo da navegação.
      const corpo: Bloco[] = [];
      let j = i + 1;
      while (j < blocos.length && !tituloAteNivel(blocos[j], 3)) corpo.push(blocos[j++]);
      const [, id, titulo] = rf;
      saida.push(
        <section key={i} id={id} aria-labelledby={`${id}-titulo`} className="req-alvo req-cartao space-y-2">
          <h3 id={`${id}-titulo`} className="text-lg font-bold">
            <span className="req-id">{id}</span> <span className="text-muted">–</span> {titulo}
          </h3>
          {corpo.map((c, k) => (
            <BlocoSimples key={k} bloco={c} resumo={resumo} tituloAtual={tituloAtual} />
          ))}
        </section>,
      );
      i = j;
      continue;
    }
    saida.push(<BlocoSimples key={i} bloco={b} resumo={resumo} tituloAtual={tituloAtual} />);
    i++;
  }
  return <div className="space-y-4 leading-relaxed">{saida}</div>;
}

/**
 * Índice das regras de negócio, gerado a partir das citações: o documento nomeia cada RN nos
 * requisitos ("CPF único (RN02)") mas não as descreve numa seção própria.
 */
export function IndiceRegrasDeNegocio({ catalogo, resumo }: { catalogo: Catalogo; resumo: ResumoCatalogo }) {
  const regras = [...catalogo.definicoes.values()].filter((d) => d.tipo === "RN").sort((a, b) => a.id.localeCompare(b.id));
  return (
    <section id="regras-de-negocio" aria-labelledby="regras-de-negocio-titulo" className="space-y-4">
      <h2 id="regras-de-negocio-titulo" className="border-b border-line pt-6 pb-2 text-2xl font-bold tracking-tight">
        Regras de negócio citadas no documento
      </h2>
      <p className="max-w-3xl text-sm text-muted">
        O documento cita cada regra de negócio pelo nome dentro dos requisitos, mas não traz uma seção que descreva as regras uma a uma. Este índice é montado automaticamente a partir dessas citações: mostra o nome usado no documento e os requisitos que citam a regra, onde está o comportamento esperado.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {regras.map((r) => {
          const locais = citadoEm(catalogo, r.id);
          return (
            <article key={r.id} id={r.id} aria-labelledby={`${r.id}-titulo`} className="req-alvo req-cartao">
              <h3 id={`${r.id}-titulo`} className="text-base font-bold">
                <span className="req-id">{r.id}</span> {r.titulo}
              </h3>
              <p className="mt-1 text-sm">
                <span className="font-semibold text-muted">Citada em: </span>
                {locais.map((ctx, k) => (
                  <Fragment key={ctx.ancora}>
                    {k > 0 && ", "}
                    {ctx.requisito ? (
                      <RefRequisito id={ctx.ancora} existe={ctx.ancora in resumo} titulo={resumo[ctx.ancora]} />
                    ) : (
                      <a href={`#${ctx.ancora}`} className="font-semibold text-brand-700 underline">
                        {ctx.rotulo}
                      </a>
                    )}
                  </Fragment>
                ))}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
