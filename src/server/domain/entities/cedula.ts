/**
 * Cédula preenchida (RF037, RN13): exatamente uma alternativa válida desta consulta, ou abstenção
 * quando a consulta a admite.
 *
 * Sigilo por construção (RN07, RS002): a cédula só conhece a consulta e a escolha. Não existe campo
 * para quem votou, para o comprovante nem para o horário — o registro gravado em `votes` sai daqui e,
 * por isso, não tem como ligar o voto a uma pessoa. A participação (quem votou) é outro registro,
 * gravado na mesma transação pelo serviço de votação.
 */
import { VoteRejected } from "../erros";

export type OpcoesDaConsulta = { consultaId: string; alternativasValidas: readonly string[]; permiteAbstencao: boolean };
export type Escolha = { abstencao: boolean; alternativaId: string | null };
export type RegistroDeVoto = { readonly consultaId: string; readonly alternativaId: string | null; readonly abstencao: boolean };

export class Cedula {
  readonly #consultaId: string;
  readonly #alternativaId: string | null;

  private constructor(consultaId: string, alternativaId: string | null) {
    this.#consultaId = consultaId;
    this.#alternativaId = alternativaId;
  }

  /** Única forma de obter uma cédula: a escolha é conferida contra as opções da consulta. */
  static preencher(opcoes: OpcoesDaConsulta, escolha: Escolha): Cedula {
    if (escolha.abstencao) {
      if (!opcoes.permiteAbstencao) throw new VoteRejected("Esta consulta não admite abstenção.", "alternativa_invalida");
      return new Cedula(opcoes.consultaId, null);
    }
    if (!escolha.alternativaId || !opcoes.alternativasValidas.includes(escolha.alternativaId)) {
      // Alternativa inexistente ou de outra consulta: o serviço abre incidente (RF060).
      throw new VoteRejected("Alternativa inexistente.", "alternativa_invalida");
    }
    return new Cedula(opcoes.consultaId, escolha.alternativaId);
  }

  get abstencao(): boolean {
    return this.#alternativaId === null;
  }

  /** O que vai para `votes`: consulta e escolha — e nada que identifique o eleitor. */
  paraRegistro(): RegistroDeVoto {
    return Object.freeze({ consultaId: this.#consultaId, alternativaId: this.#alternativaId, abstencao: this.abstencao });
  }
}
