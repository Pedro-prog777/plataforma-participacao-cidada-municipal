/**
 * Base das entidades com ciclo de vida: a consulta pública (Documento v6, seção 6.1 — RF019) e a
 * proposta cidadã (RN30). As duas têm uma situação que só pode mudar por transições permitidas.
 *
 * Encapsulamento: os dados ficam em campos privados (`#`). A situação só muda por `transicionar()`,
 * que confere se a transição parte de uma situação permitida e aplica, junto, os campos que a
 * acompanham. As subclasses expõem métodos de negócio (`publicar()`, `suspender()`…); quem usa a
 * entidade nunca altera a situação diretamente.
 *
 * Persistência: a entidade não conhece o banco. O repositório lê `alteracoesPendentes()` — só o que
 * mudou desde a leitura — e grava (ver `src/server/repositories`).
 */
import { DomainError } from "../../lib/errors";

export type Transicao<S extends string> = { readonly de: S; readonly para: S };

export abstract class EntidadeComCicloDeVida<S extends string, P extends { situacao: S }> {
  /** Como a entidade foi lida: base para saber o que mudou. */
  readonly #original: Readonly<P>;
  #atual: P;
  readonly #transicoes: Transicao<S>[] = [];

  protected constructor(propriedades: P) {
    this.#original = Object.freeze({ ...propriedades });
    this.#atual = { ...propriedades };
  }

  /** Nome da entidade nas mensagens ("Consulta", "Proposta cidadã"); cada subclasse informa o seu. */
  abstract get descricao(): string;

  get situacao(): S {
    return this.#atual.situacao;
  }

  /** Transições feitas desde a leitura, na ordem (auditoria e testes). */
  get transicoes(): readonly Transicao<S>[] {
    return [...this.#transicoes];
  }

  estaEm(...situacoes: readonly S[]): boolean {
    return situacoes.includes(this.#atual.situacao);
  }

  /** Leitura protegida para as subclasses; de fora, só pelos getters que cada uma expõe. */
  protected get dados(): Readonly<P> {
    return this.#atual;
  }

  /** Recusa a operação se a entidade não estiver numa das situações permitidas. */
  protected garantirSituacao(permitidas: readonly S[], recusa: string, codigo?: string): void {
    if (!this.estaEm(...permitidas)) throw new DomainError(recusa, codigo);
  }

  /**
   * Única forma de mudar a situação: confere a origem e aplica a nova situação e os campos que a
   * acompanham de uma só vez (não existe meia transição).
   */
  protected transicionar(para: S, permitidasDe: readonly S[], recusa: string, campos: Partial<Omit<P, "situacao">> = {}, codigo?: string): void {
    this.garantirSituacao(permitidasDe, recusa, codigo);
    this.#transicoes.push({ de: this.#atual.situacao, para });
    this.#atual = { ...this.#atual, ...campos, situacao: para };
  }

  /** Alteração que não muda a situação (ex.: decisão sobre o prazo excepcional). */
  protected alterar(campos: Partial<Omit<P, "situacao">>): void {
    this.#atual = { ...this.#atual, ...campos };
  }

  /** O que mudou desde a leitura — é isso que o repositório grava. */
  alteracoesPendentes(): Partial<P> {
    const mudou: Partial<P> = {};
    for (const chave of Object.keys(this.#atual) as (keyof P)[]) {
      if (!mesmoValor(this.#original[chave], this.#atual[chave])) mudou[chave] = this.#atual[chave];
    }
    return mudou;
  }

  get temAlteracoes(): boolean {
    return Object.keys(this.alteracoesPendentes()).length > 0;
  }
}

function mesmoValor(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}
