/**
 * Apuração determinística (RF042; RN17–RN19, RN41) — serviço de domínio puro, sem banco.
 *
 *  - votos por alternativa, válidos, abstenções e total (a abstenção não é voto válido — RF026);
 *  - percentuais sobre os válidos, com 2 casas e método do maior resto, para somar exatamente
 *    100,00% (RF059: tolerância de 0,01);
 *  - quórum de referência (polimórfico: `QuorumDeReferencia`);
 *  - vencedora por maioria simples dos votos válidos (RN18); empate sem regra publicada não tem vencedora.
 *
 * O resultado entra no hash de integridade (RF059): o mesmo conjunto de votos gera sempre o mesmo resultado.
 */
import type { QuorumDeReferencia } from "../strategies/quorum-de-referencia";

export type ResultadoDaApuracao = {
  countingRule: string;
  alternatives: { id: string; label: string; votes: number; percentage: string }[];
  validVotes: number;
  abstentions: number;
  totalVotes: number;
  participations: number;
  estimatedEligible: number | null;
  participationRate: string | null;
  quorum: { type: string; value: string | null; required: number | null; met: boolean | null };
  winnerId: string | null;
  condition: "vencedora" | "empate" | "sem_votos" | "abaixo_quorum";
  computedAt: string;
};

export type DadosDaApuracao = {
  regraDeContagem: string;
  alternativas: readonly { id: string; label: string; position: number }[];
  votos: readonly { alternativeId: string | null; abstention: boolean }[];
  participacoes: number;
  elegiveisEstimados: number | null;
  quorum: QuorumDeReferencia;
  calculadoEm: string;
};

export class Apuracao {
  readonly #dados: DadosDaApuracao;
  readonly #alternativas: readonly { id: string; label: string; position: number }[];

  constructor(dados: DadosDaApuracao) {
    this.#dados = dados;
    this.#alternativas = [...dados.alternativas].sort((a, b) => a.position - b.position);
  }

  /** Percentuais com `casas` decimais pelo método do maior resto: a soma é sempre exatamente 100. */
  static percentuaisPeloMaiorResto(contagens: readonly number[], casas = 2): string[] {
    const total = contagens.reduce((a, b) => a + b, 0);
    if (total === 0) return contagens.map(() => (0).toFixed(casas));
    const escala = 100 * 10 ** casas;
    const brutos = contagens.map((c) => (c * escala) / total);
    const pisos = brutos.map(Math.floor);
    let restantes = escala - pisos.reduce((a, b) => a + b, 0);
    const ordem = brutos.map((r, i) => ({ i, resto: r - Math.floor(r) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
    for (const o of ordem) {
      if (restantes <= 0) break;
      pisos[o.i] += 1;
      restantes--;
    }
    return pisos.map((p) => (p / 10 ** casas).toFixed(casas));
  }

  calcular(): ResultadoDaApuracao {
    const { votos, participacoes, elegiveisEstimados, quorum } = this.#dados;
    const contagens = this.#alternativas.map((a) => votos.filter((v) => !v.abstention && v.alternativeId === a.id).length);
    const validos = contagens.reduce((a, b) => a + b, 0);
    const percentuais = Apuracao.percentuaisPeloMaiorResto(contagens);
    const atingido = quorum.foiAtingido(participacoes, elegiveisEstimados);
    const { vencedora, condicao } = this.definirVencedora(contagens, validos, atingido);

    return {
      countingRule: this.#dados.regraDeContagem,
      alternatives: this.#alternativas.map((a, i) => ({ id: a.id, label: a.label, votes: contagens[i], percentage: percentuais[i] })),
      validVotes: validos,
      abstentions: votos.filter((v) => v.abstention).length,
      totalVotes: votos.length,
      participations: participacoes,
      estimatedEligible: elegiveisEstimados,
      participationRate: elegiveisEstimados ? ((participacoes / elegiveisEstimados) * 100).toFixed(2) : null,
      quorum: { type: quorum.tipo, value: quorum.valor, required: quorum.participacoesNecessarias(elegiveisEstimados), met: atingido },
      winnerId: vencedora,
      condition: condicao,
      computedAt: this.#dados.calculadoEm,
    };
  }

  /** Maioria simples dos votos válidos (RN18). Sem votos, abaixo do quórum ou empate: sem vencedora. */
  private definirVencedora(contagens: readonly number[], validos: number, quorumAtingido: boolean | null): { vencedora: string | null; condicao: ResultadoDaApuracao["condition"] } {
    if (validos === 0) return { vencedora: null, condicao: "sem_votos" };
    if (quorumAtingido === false) return { vencedora: null, condicao: "abaixo_quorum" };
    const maximo = Math.max(...contagens);
    const lideres = this.#alternativas.filter((_, i) => contagens[i] === maximo);
    if (lideres.length > 1) return { vencedora: null, condicao: "empate" };
    return { vencedora: lideres[0].id, condicao: "vencedora" };
  }
}
