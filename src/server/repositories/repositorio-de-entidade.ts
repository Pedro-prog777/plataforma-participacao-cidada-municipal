/**
 * Base dos repositórios das entidades com ciclo de vida (camada de persistência, Drizzle ORM).
 *
 * Método-modelo: o fluxo é sempre o mesmo — buscar o registro (com bloqueio da linha quando a
 * operação vai alterá-lo), convertê-lo na entidade e, ao salvar, gravar só as colunas que a entidade
 * mudou. Cada repositório concreto informa a tabela e o mapeamento entre colunas e propriedades.
 */
import type { DbOrTx } from "../db/client";
import { NotFoundError } from "../lib/errors";

/** O que o repositório precisa da entidade para gravá-la. */
export interface EntidadePersistivel<P> {
  readonly id: string;
  alteracoesPendentes(): Partial<P>;
}

export abstract class RepositorioDeEntidade<E extends EntidadePersistivel<P>, P extends object, R> {
  protected constructor(protected readonly db: DbOrTx) {}

  /** Mensagem quando o registro não existe. */
  protected abstract get naoEncontrado(): string;
  protected abstract buscarRegistro(id: string, paraAtualizar: boolean): Promise<R | undefined>;
  protected abstract paraPropriedades(registro: R): P;
  protected abstract criarEntidade(propriedades: P): E;
  /** Nome da coluna de cada propriedade alterável. */
  protected abstract colunaDe(propriedade: keyof P): string;
  protected abstract gravarColunas(id: string, colunas: Record<string, unknown>): Promise<void>;

  /** Busca e reconstrói a entidade; `paraAtualizar` bloqueia a linha até o fim da transação (FOR UPDATE). */
  async obter(id: string, opcoes: { paraAtualizar?: boolean } = {}): Promise<E> {
    const registro = await this.buscarRegistro(id, !!opcoes.paraAtualizar);
    if (!registro) throw new NotFoundError(this.naoEncontrado);
    return this.deRegistro(registro);
  }

  /** Reconstrói a entidade a partir de um registro já lido (quem chama também usa outras colunas). */
  deRegistro(registro: R): E {
    return this.criarEntidade(this.paraPropriedades(registro));
  }

  /** Grava só o que mudou desde a leitura; sem alterações, não acessa o banco. */
  async salvar(entidade: E): Promise<void> {
    const alteracoes = entidade.alteracoesPendentes();
    const colunas: Record<string, unknown> = {};
    for (const [propriedade, valor] of Object.entries(alteracoes)) colunas[this.colunaDe(propriedade as keyof P)] = valor;
    if (Object.keys(colunas).length) await this.gravarColunas(entidade.id, colunas);
  }
}
