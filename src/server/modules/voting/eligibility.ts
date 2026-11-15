/**
 * Verificação de elegibilidade (RF036) — avaliada NA ORDEM do documento:
 *  1) conta ativa e desbloqueada; 2) identidade verificada; 3) perfil Cidadão;
 *  4) enquadramento no público-alvo (domicílio, território, faixa etária justificada);
 *  5) consulta Aberta e no período (horário do servidor); 6) ausência de participação anterior.
 * Não existe idade mínima geral (RN01, RN40). Repetida no servidor no momento do voto.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { audienceCriteria, consultations, districts, participations, users } from "../../db/schema";
import { ageOn, clock } from "../../lib/clock";

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

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; code: string; reason: string; action?: { label: string; href: string } };

export function evaluateEligibility(u: EligibilityUser, c: EligibilityConsultation, alreadyParticipated: boolean, now: Date = clock.now()): EligibilityResult {
  if (u.status !== "ativa" || (u.lockedUntil && u.lockedUntil > now)) {
    return { eligible: false, code: "conta_inativa", reason: "Sua conta não está ativa no momento.", action: { label: "Ver meu perfil", href: "/conta/perfil" } };
  }
  if (u.kind === "cidadao" && u.verificationLevel !== "verificado") {
    return {
      eligible: false,
      code: "identidade_nao_verificada",
      reason: "Para participar, é preciso verificar sua identidade.",
      action: { label: "Verificar identidade", href: "/conta/verificacao" },
    };
  }
  if (u.kind !== "cidadao") {
    // RN22: contas administrativas não votam.
    return { eligible: false, code: "conta_administrativa", reason: "Contas administrativas não participam das votações." };
  }
  if (!c.audienceOpen) {
    for (const crit of c.criteria) {
      const r = checkCriterion(u, crit, now);
      if (r) return r;
    }
  }
  if (c.status !== "aberta" || !c.opensAt || !c.closesAt || now < c.opensAt || now >= c.closesAt) {
    return { eligible: false, code: "fora_do_periodo", reason: c.status === "suspensa" ? "A consulta está suspensa. Nenhum voto é aceito durante a suspensão." : "A consulta não está aberta para participação neste momento." };
  }
  if (alreadyParticipated) return { eligible: false, code: "ja_participou", reason: "Você já participou desta consulta.", action: { label: "Ver meu comprovante", href: "/conta/participacoes" } };
  return { eligible: true };
}

function checkCriterion(u: EligibilityUser, crit: EligibilityConsultation["criteria"][number], now: Date): EligibilityResult | null {
  const comprovar = { label: "Atualizar endereço e comprovar domicílio", href: "/conta/verificacao" };
  switch (crit.type) {
    case "domicilio":
      if (!u.districtId) return { eligible: false, code: "fora_do_publico", reason: "Esta consulta é destinada a quem mora no município.", action: { label: "Atualizar endereço", href: "/conta/perfil/editar" } };
      if (!u.domicileVerifiedAt) return { eligible: false, code: "domicilio_nao_comprovado", reason: "Esta consulta exige comprovação de domicílio no município.", action: comprovar };
      return null;
    case "territorio": {
      const ds = crit.params.districtIds ?? [];
      const rs = crit.params.regionIds ?? [];
      const inside = (u.districtId && ds.includes(u.districtId)) || (u.regionId && rs.includes(u.regionId));
      if (!inside) return { eligible: false, code: "fora_do_publico", reason: "Esta consulta é destinada a moradores de bairros ou regiões específicos, e seu endereço não está entre eles." };
      if (!u.domicileVerifiedAt) return { eligible: false, code: "domicilio_nao_comprovado", reason: "Esta consulta exige comprovação de domicílio no território.", action: comprovar };
      return null;
    }
    case "faixa_etaria": {
      if (!u.birthDate) return { eligible: false, code: "fora_do_publico", reason: "Não foi possível conferir sua idade." };
      const age = ageOn(u.birthDate, now);
      if ((crit.params.minAge !== undefined && age < crit.params.minAge) || (crit.params.maxAge !== undefined && age > crit.params.maxAge)) {
        return { eligible: false, code: "fora_do_publico", reason: "Esta consulta é destinada a uma faixa etária específica, e você não se enquadra nela." };
      }
      return null;
    }
    default:
      // Critério "outro": apenas informativo, não verificado automaticamente (ver PENDENCIAS_CLIENTE).
      return null;
  }
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

/** Enquadramento apenas no público-alvo (para estimativa e avisos), sem período nem participação. */
export function matchesAudience(u: EligibilityUser, c: Pick<EligibilityConsultation, "audienceOpen" | "criteria">, now: Date = clock.now()): boolean {
  if (u.kind !== "cidadao" || u.status !== "ativa") return false;
  if (c.audienceOpen) return true;
  return c.criteria.every((crit) => checkCriterion({ ...u, domicileVerifiedAt: u.domicileVerifiedAt ?? now }, crit, now) === null);
}
