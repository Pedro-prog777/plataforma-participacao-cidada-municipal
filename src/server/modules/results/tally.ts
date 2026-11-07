/**
 * Apuração determinística (RF042, RN17–RN19, RN41) — função pura, testável isoladamente.
 * Percentuais sobre os votos VÁLIDOS (abstenção não é voto válido — RF026), com 2 casas e
 * método do maior resto para que a soma seja exatamente 100,00% (RF059: tolerância 0,01).
 */
import type { ResultData } from "../../db/schema";

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
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => (0).toFixed(decimals));
  const scale = 100 * 10 ** decimals;
  const raw = counts.map((c) => (c * scale) / total);
  const floors = raw.map(Math.floor);
  let remaining = scale - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const o of order) {
    if (remaining <= 0) break;
    floors[o.i] += 1;
    remaining--;
  }
  return floors.map((f) => (f / 10 ** decimals).toFixed(decimals));
}

export function tally(input: TallyInput): ResultData {
  const alts = [...input.alternatives].sort((a, b) => a.position - b.position);
  const counts = alts.map((a) => input.votes.filter((v) => !v.abstention && v.alternativeId === a.id).length);
  const abstentions = input.votes.filter((v) => v.abstention).length;
  const validVotes = counts.reduce((a, b) => a + b, 0);
  const totalVotes = input.votes.length;
  const pct = largestRemainderPercentages(counts);

  // Quórum de referência (RN17): comparecimento (participações) frente ao número absoluto
  // ou ao percentual dos elegíveis estimados no retrato da abertura.
  let required: number | null = null;
  let met: boolean | null = null;
  if (input.quorumType === "absoluto" && input.quorumValue) required = Math.ceil(Number(input.quorumValue));
  if (input.quorumType === "percentual" && input.quorumValue && input.estimatedEligible) required = Math.ceil((Number(input.quorumValue) / 100) * input.estimatedEligible);
  if (input.quorumType !== "nenhum") met = required === null ? null : input.participations >= required;

  let winnerId: string | null = null;
  let condition: ResultData["condition"] = "vencedora";
  if (validVotes === 0) condition = "sem_votos";
  else if (met === false) condition = "abaixo_quorum";
  else {
    const max = Math.max(...counts);
    const leaders = alts.filter((_, i) => counts[i] === max);
    // Maioria simples dos votos válidos (RN18). Empate sem regra de desempate publicada: sem vencedora.
    if (leaders.length > 1) condition = "empate";
    else winnerId = leaders[0].id;
  }

  return {
    countingRule: input.countingRule,
    alternatives: alts.map((a, i) => ({ id: a.id, label: a.label, votes: counts[i], percentage: pct[i] })),
    validVotes,
    abstentions,
    totalVotes,
    participations: input.participations,
    estimatedEligible: input.estimatedEligible,
    participationRate: input.estimatedEligible ? ((input.participations / input.estimatedEligible) * 100).toFixed(2) : null,
    quorum: { type: input.quorumType, value: input.quorumValue, required, met },
    winnerId,
    condition,
    computedAt: input.computedAt,
  };
}
