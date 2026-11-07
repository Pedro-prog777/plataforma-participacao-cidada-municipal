/**
 * Seleção de destinatários dos avisos de consulta (RF053, RF054, RF055).
 * "Quem votou" é obtido de `participations` (quem participou), nunca de `votes`.
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { consultations, districts, notificationPreferences, participations, users } from "../../db/schema";
import { loadEligibilityConsultation, matchesAudience, type EligibilityUser } from "../voting/eligibility";
import { defaultPreferences, notifyUser, type NotificationType } from "./notifications.service";
import { fmtDateTime } from "@/lib/labels";

async function activeCitizens(db: DbOrTx) {
  return db
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
      prefs: notificationPreferences.types,
      themeIds: notificationPreferences.themeIds,
      districtIds: notificationPreferences.districtIds,
    })
    .from(users)
    .leftJoin(districts, eq(districts.id, users.districtId))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(and(eq(users.kind, "cidadao"), eq(users.status, "ativa")));
}

function wants(prefs: Record<string, { email: boolean; inApp: boolean }> | null, type: NotificationType) {
  const p = (prefs ?? defaultPreferences())[type];
  return !p || p.email || p.inApp;
}

async function voterIds(db: DbOrTx, consultationId: string) {
  const rows = await db.select({ id: participations.citizenId }).from(participations).where(eq(participations.consultationId, consultationId));
  return rows.map((r) => r.id);
}

/** RF053 — publicação: interessados por preferência, tema e bairro. */
export async function notifyPublished(db: DbOrTx, consultationId: string) {
  const [c] = await db.select().from(consultations).where(eq(consultations.id, consultationId));
  const citizens = await activeCitizens(db);
  for (const u of citizens) {
    if (!wants(u.prefs, "nova_consulta")) continue;
    if (u.themeIds?.length && c.themeId && !u.themeIds.includes(c.themeId)) continue;
    if (u.districtIds?.length && u.districtId && !u.districtIds.includes(u.districtId) && c.regionId) continue;
    await notifyUser(db, u.id, {
      type: "nova_consulta",
      title: `Nova consulta pública: ${c.title}`,
      body: `${c.summary}\nPeríodo de participação: de ${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}.`,
      link: `/consultas/${c.slug}`,
    });
  }
}

/** RF053 — abertura: quem se enquadra no público-alvo. */
export async function notifyOpened(db: DbOrTx, consultationId: string) {
  const [c] = await db.select().from(consultations).where(eq(consultations.id, consultationId));
  const ec = await loadEligibilityConsultation(consultationId, db);
  if (!ec) return;
  for (const u of await activeCitizens(db)) {
    if (!wants(u.prefs, "abertura") || !matchesAudience(u as EligibilityUser, ec)) continue;
    await notifyUser(db, u.id, {
      type: "abertura",
      title: `Consulta aberta: ${c.title}`,
      body: `A consulta "${c.title}" está aberta para participação até ${fmtDateTime(c.closesAt)}.`,
      link: `/consultas/${c.slug}`,
    });
  }
}

/** RF054 — alteração, suspensão, retomada, cancelamento: quem votou é SEMPRE avisado. */
export async function notifyChange(db: DbOrTx, consultationId: string, title: string, body: string) {
  const [c] = await db.select().from(consultations).where(eq(consultations.id, consultationId));
  const voters = await voterIds(db, consultationId);
  for (const id of voters) await notifyUser(db, id, { type: "voto_afetado", title, body, link: `/consultas/${c.slug}` });
  const others = await db
    .select({ id: users.id, prefs: notificationPreferences.types })
    .from(users)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(and(eq(users.kind, "cidadao"), eq(users.status, "ativa"), voters.length ? notInArray(users.id, voters) : undefined));
  for (const u of others) if (wants(u.prefs, "alteracoes")) await notifyUser(db, u.id, { type: "alteracoes", title, body, link: `/consultas/${c.slug}` });
}

/** RF055 — lembrete 48 h antes: quem se enquadra e AINDA NÃO participou. */
export async function notifyReminder(db: DbOrTx, consultationId: string) {
  const [c] = await db.select().from(consultations).where(eq(consultations.id, consultationId));
  const ec = await loadEligibilityConsultation(consultationId, db);
  const voters = new Set(await voterIds(db, consultationId));
  for (const u of await activeCitizens(db)) {
    if (voters.has(u.id) || u.verificationLevel !== "verificado" || !wants(u.prefs, "lembrete") || !ec || !matchesAudience(u as EligibilityUser, ec)) continue;
    await notifyUser(db, u.id, {
      type: "lembrete",
      title: `Faltam poucas horas: ${c.title}`,
      body: `A consulta "${c.title}" encerra em ${fmtDateTime(c.closesAt)}. Você ainda pode participar.`,
      link: `/consultas/${c.slug}`,
    });
  }
}

/** RF055 — aviso de encerramento e de resultado a quem votou; encaminhamentos a quem optou. */
export async function notifyVoters(db: DbOrTx, consultationId: string, type: "resultado" | "encaminhamentos" | "alteracoes", title: string, body: string, link: string) {
  const voters = await voterIds(db, consultationId);
  if (!voters.length) return;
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, voters));
  for (const u of rows) await notifyUser(db, u.id, { type, title, body, link });
}
