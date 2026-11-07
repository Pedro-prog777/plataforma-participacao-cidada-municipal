/** Divulgação (RF062): material em linguagem simples, link permanente, QR Code e registro de canais. Sem parciais (RN16). */
import QRCode from "qrcode";
import { asc, eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { audienceCriteria, consultations, disseminationRecords, themes } from "../../db/schema";
import { brDate, clock } from "../../lib/clock";
import { env } from "../../lib/env";
import { DomainError, ValidationError } from "../../lib/errors";
import { DISSEMINATION_CHANNELS, fmtDateTime } from "@/lib/labels";
import { normalizeSearch, sanitizePlainText } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertConsultationRole, type Actor } from "../access/access.service";
import { getConsultationOrThrow, recordPublicEvent } from "../consultations/common";

export async function disseminationMaterial(consultationId: string, db: DbOrTx = getDb()) {
  const c = await getConsultationOrThrow(db, consultationId);
  const [theme] = c.themeId ? await db.select().from(themes).where(eq(themes.id, c.themeId)) : [];
  const crit = await db.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, consultationId));
  const link = `${env.appUrl}/consultas/${c.slug}`;
  const audience = c.audienceOpen ? "Aberta ao público em geral." : crit.map((x) => x.publicText).join(" ");
  const shortText = `${env.municipio} quer ouvir você! Consulta pública "${c.title}". Participe de ${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)} em ${link}`;
  const card = {
    tema: theme?.name ?? "—",
    objetivo: c.objective,
    publico: audience,
    periodo: `${fmtDateTime(c.opensAt)} a ${fmtDateTime(c.closesAt)}`,
    instrucoes: "Acesse o link ou leia o QR Code, entre com sua conta verificada, escolha uma alternativa, confirme com o código enviado e guarde seu comprovante.",
    pergunta: c.question,
  };
  const qrSvg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b2545", light: "#ffffff" } });
  return { consultation: c, link, shortText, card, qrSvg };
}

export async function registerDissemination(actor: Actor, consultationId: string, input: { channel: string; usedOn: string; notes?: string; customText?: string }, db: DbOrTx = getDb()) {
  await assertConsultationRole(actor, consultationId, "divulgacao", db);
  const c = await getConsultationOrThrow(db, consultationId);
  if (!["agendada", "aberta"].includes(c.status)) throw new DomainError("A divulgação é registrada para consultas Agendadas ou Abertas.");
  if (!(input.channel in DISSEMINATION_CHANNELS)) throw new ValidationError({ channel: ["Selecione o canal."] });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.usedOn ?? "")) throw new ValidationError({ usedOn: ["Informe a data."] });
  // Texto livre divergente da pergunta: exige revisão (RF062).
  const custom = sanitizePlainText(input.customText ?? "");
  if (custom && c.question) {
    const qWords = normalizeSearch(c.question).split(" ").filter((w) => w.length > 4);
    const overlap = qWords.filter((w) => normalizeSearch(custom).includes(w)).length;
    if (qWords.length && overlap / qWords.length < 0.5) {
      throw new ValidationError({ customText: ["O texto livre parece divergir da pergunta aprovada. Revise-o (use o texto gerado ou mantenha os termos da pergunta)."] });
    }
  }
  await db.transaction(async (tx) => {
    await tx.insert(disseminationRecords).values({ consultationId, channel: input.channel, usedOn: input.usedOn, notes: sanitizePlainText(input.notes ?? "") || null, createdBy: actor.id, createdAt: clock.now() });
    await recordPublicEvent(tx, consultationId, "divulgacao", `Divulgação registrada: ${DISSEMINATION_CHANNELS[input.channel as keyof typeof DISSEMINATION_CHANNELS]} (${input.usedOn.split("-").reverse().join("/")}).`);
    await audit(tx, { actorId: actor.id, actorRole: "divulgacao", action: "divulgacao_registrada", objectType: "consulta", objectId: consultationId, details: { canal: input.channel } });
  });
}

export async function listDissemination(consultationId: string, db: DbOrTx = getDb()) {
  return db.select().from(disseminationRecords).where(eq(disseminationRecords.consultationId, consultationId)).orderBy(asc(disseminationRecords.usedOn));
}

export { brDate, consultations };
