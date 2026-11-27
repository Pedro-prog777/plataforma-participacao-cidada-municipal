/**
 * Público-alvo de uma consulta (RF027): "aberta ao público em geral" ou uma lista de critérios
 * justificados. Composição: o público-alvo é formado pelos seus critérios e os consulta sem saber
 * o tipo de cada um (polimorfismo em `CriterioPublicoAlvo.avaliar`).
 */
import type { Cidadao } from "./cidadao";
import type { Inelegibilidade } from "../interfaces/elegibilidade";
import { CriterioPublicoAlvo, type ParametrosDoCriterio } from "../strategies/criterios-publico-alvo";

export class PublicoAlvo {
  readonly #abertoAoPublicoEmGeral: boolean;
  readonly #criterios: readonly CriterioPublicoAlvo[];

  constructor(abertoAoPublicoEmGeral: boolean, criterios: readonly CriterioPublicoAlvo[]) {
    this.#abertoAoPublicoEmGeral = abertoAoPublicoEmGeral;
    this.#criterios = [...criterios];
  }

  /** Monta o público-alvo a partir dos critérios gravados (`audience_criteria`). */
  static de(abertoAoPublicoEmGeral: boolean, criterios: readonly { type: string; params: ParametrosDoCriterio }[]): PublicoAlvo {
    return new PublicoAlvo(
      abertoAoPublicoEmGeral,
      criterios.map((c) => CriterioPublicoAlvo.criar(c.type, c.params)),
    );
  }

  get abertoAoPublicoEmGeral(): boolean {
    return this.#abertoAoPublicoEmGeral;
  }

  get criterios(): readonly CriterioPublicoAlvo[] {
    return this.#criterios;
  }

  /** Primeiro critério que o cidadão não atende, na ordem em que foram definidos; null se atende a todos. */
  restricaoPara(cidadao: Cidadao, agora: Date): Inelegibilidade | null {
    if (this.#abertoAoPublicoEmGeral) return null;
    for (const criterio of this.#criterios) {
      const motivo = criterio.avaliar(cidadao, agora);
      if (motivo) return motivo;
    }
    return null;
  }

  /** Enquadramento para estimativa e avisos (domicílio ainda não comprovado não exclui). */
  enquadra(cidadao: Cidadao, agora: Date): boolean {
    return this.#abertoAoPublicoEmGeral || this.#criterios.every((c) => c.enquadra(cidadao, agora));
  }
}
