/**
 * Apuração (RF042, RN17–RN19, RN41) — ponte para o domínio.
 *
 * A regra fica em `src/server/domain/services/apuracao.ts` (classe `Apuracao`) e o quórum de
 * referência em `src/server/domain/strategies/quorum-de-referencia.ts` (`SemQuorum`,
 * `QuorumAbsoluto`, `QuorumPercentual`). Este módulo mantém as funções que o serviço de resultados
 * e os testes já usam.
 */
import type { ResultData } from "../../db/schema";
import { Apuracao } from "../../domain/services/apuracao";
import { QuorumDeReferencia } from "../../domain/strategies/quorum-de-referencia";

export type TallyInput = {
  countingRule: string;
  alternatives: { id: string; label: string; position: number }[];
  votes: { alternativeId: string | null; abstention: boolean }[];
  participations: number;
  estimatedEligible: number | null;
  quorumType: string;
  quorumValue: string | null;
  computedAt: string;
};

export function largestRemainderPercentages(counts: number[], decimals = 2): string[] {
  return Apuracao.percentuaisPeloMaiorResto(counts, decimals);
}

export function tally(input: TallyInput): ResultData {
  return new Apuracao({
    regraDeContagem: input.countingRule,
    alternativas: input.alternatives,
    votos: input.votes,
    participacoes: input.participations,
    elegiveisEstimados: input.estimatedEligible,
    quorum: QuorumDeReferencia.criar(input.quorumType, input.quorumValue),
    calculadoEm: input.computedAt,
  }).calcular();
}
