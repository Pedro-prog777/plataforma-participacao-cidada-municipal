/**
 * Elegibilidade (RF036) — ponte entre os dados do banco e as classes de domínio.
 *
 * A regra fica em `src/server/domain`: `AvaliadorDeElegibilidade` aplica as verificações na ordem
 * do documento, `Cidadao` define a idade mínima de 18 anos (DT-30, DT-33) e os critérios de
 * público-alvo (`CriterioDomicilio`, `CriterioTerritorio`, `CriterioFaixaEtaria`…) avaliam cada um a sua
 * condição (polimorfismo). Este módulo carrega os dados, monta os objetos e mantém as funções que o
 * restante do sistema já usa. Repetida no servidor no momento do voto.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { audienceCriteria, consultations, districts, participations, users } from "../../db/schema";
import { clock } from "../../lib/clock";
import { Cidadao } from "../../domain/entities/cidadao";
import { PublicoAlvo } from "../../domain/entities/publico-alvo";
import { AvaliadorDeElegibilidade } from "../../domain/services/avaliador-de-elegibilidade";
import type { ResultadoElegibilidade } from "../../domain/interfaces/elegibilidade";

export type EligibilityUser = {
  id: string;
  kind: "cidadao" | "admin";
  status: string;
  lockedUntil: Date | null;
  verificationLevel: string;
  districtId: string | null;
  regionId: string | null;
  domicileVerifiedAt: Date | null;
  birthDate: string | null;
};

export type EligibilityConsultation = {
  status: string;
  opensAt: Date | null;
  closesAt: Date | null;
  audienceOpen: boolean;
  criteria: { type: string; params: { districtIds?: string[]; regionIds?: string[]; minAge?: number; maxAge?: number } }[];
};

export type EligibilityResult = ResultadoElegibilidade;

/** Idade mínima da plataforma (fonte única: `Cidadao.IDADE_MINIMA`); o cadastro também a usa. */
export const IDADE_MINIMA = Cidadao.IDADE_MINIMA;

/** 18 anos completos na data de referência, no fuso de Brasília (pessoa com 17 anos e 364 dias não tem). */
export function temIdadeMinima(birthDate: string | null, now: Date = clock.now()): boolean {
  return Cidadao.temIdadeMinima(birthDate, now);
}

/** Converte a conta lida do banco no objeto de domínio. */
export function cidadaoDe(u: EligibilityUser): Cidadao {
  return new Cidadao({
    id: u.id,
    tipo: u.kind,
    situacaoDaConta: u.status,
    bloqueadoAte: u.lockedUntil,
    nivelDeVerificacao: u.verificationLevel,
    bairroId: u.districtId,
    regiaoId: u.regionId,
    domicilioComprovadoEm: u.domicileVerifiedAt,
    nascimento: u.birthDate,
  });
}

export function publicoAlvoDe(c: Pick<EligibilityConsultation, "audienceOpen" | "criteria">): PublicoAlvo {
  return PublicoAlvo.de(c.audienceOpen, c.criteria);
}

export function evaluateEligibility(u: EligibilityUser, c: EligibilityConsultation, alreadyParticipated: boolean, now: Date = clock.now()): EligibilityResult {
  const avaliador = new AvaliadorDeElegibilidade({ situacao: c.status, abertura: c.opensAt, encerramento: c.closesAt }, publicoAlvoDe(c));
  return avaliador.avaliar(cidadaoDe(u), alreadyParticipated, now);
}

export async function loadEligibilityUser(userId: string, db: DbOrTx = getDb()): Promise<EligibilityUser | null> {
  const [u] = await db
    .select({
      id: users.id,
      kind: users.kind,
      status: users.status,
      lockedUntil: users.lockedUntil,
      verificationLevel: users.verificationLevel,
      districtId: users.districtId,
      regionId: districts.regionId,
      domicileVerifiedAt: users.domicileVerifiedAt,
      birthDate: users.birthDate,
    })
    .from(users)
    .leftJoin(districts, eq(districts.id, users.districtId))
    .where(eq(users.id, userId));
  return u ?? null;
}

export async function loadEligibilityConsultation(consultationId: string, db: DbOrTx = getDb()): Promise<EligibilityConsultation | null> {
  const [c] = await db
    .select({ status: consultations.status, opensAt: consultations.opensAt, closesAt: consultations.closesAt, audienceOpen: consultations.audienceOpen })
    .from(consultations)
    .where(eq(consultations.id, consultationId));
  if (!c) return null;
  const criteria = await db.select({ type: audienceCriteria.type, params: audienceCriteria.params }).from(audienceCriteria).where(eq(audienceCriteria.consultationId, consultationId));
  return { ...c, criteria };
}

/** Critérios de público-alvo de várias consultas em uma única consulta ao banco (listagens). */
export async function loadAudienceCriteria(consultationIds: string[], db: DbOrTx = getDb()) {
  const byConsultation = new Map<string, EligibilityConsultation["criteria"]>();
  if (!consultationIds.length) return byConsultation;
  const rows = await db
    .select({ consultationId: audienceCriteria.consultationId, type: audienceCriteria.type, params: audienceCriteria.params })
    .from(audienceCriteria)
    .where(inArray(audienceCriteria.consultationId, consultationIds));
  for (const r of rows) byConsultation.set(r.consultationId, [...(byConsultation.get(r.consultationId) ?? []), { type: r.type, params: r.params }]);
  return byConsultation;
}

export async function hasParticipated(userId: string, consultationId: string, db: DbOrTx = getDb()) {
  const [p] = await db
    .select({ id: participations.id, on: participations.participatedOn })
    .from(participations)
    .where(and(eq(participations.citizenId, userId), eq(participations.consultationId, consultationId)));
  return p ?? null;
}

export async function checkEligibility(userId: string, consultationId: string, db: DbOrTx = getDb()): Promise<EligibilityResult> {
  const [u, c, p] = await Promise.all([loadEligibilityUser(userId, db), loadEligibilityConsultation(consultationId, db), hasParticipated(userId, consultationId, db)]);
  if (!u || !c) return { eligible: false, code: "nao_encontrado", reason: "Consulta ou conta não encontrada." };
  return evaluateEligibility(u, c, !!p);
}

/** Enquadramento no público-alvo que pode votar (estimativa de elegíveis e avisos), sem período nem participação. */
export function matchesAudience(u: EligibilityUser, c: Pick<EligibilityConsultation, "audienceOpen" | "criteria">, now: Date = clock.now()): boolean {
  return AvaliadorDeElegibilidade.enquadraNoPublico(cidadaoDe(u), publicoAlvoDe(c), now);
}
