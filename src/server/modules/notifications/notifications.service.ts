/**
 * Notificações por e-mail e central de avisos (RF052–RF055).
 * O e-mail é colocado numa fila (email_outbox) e enviado pela rotina automática com até
 * 3 tentativas (RF053). Sem SMTP configurado, as mensagens ficam visíveis na caixa de
 * e-mail simulada (/demo/caixa-de-email) — apenas em DEMO_MODE.
 */
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { emailOutbox, notificationPreferences, notifications, users } from "../../db/schema";
import { signPayload } from "../../lib/crypto";
import { env } from "../../lib/env";
import { clock } from "../../lib/clock";

export const NOTIFICATION_TYPES = {
  nova_consulta: { label: "Novas consultas publicadas", optional: true },
  abertura: { label: "Abertura de consultas para as quais você se enquadra", optional: true },
  alteracoes: { label: "Alterações, suspensões e cancelamentos", optional: true },
  lembrete: { label: "Lembrete 48 horas antes do encerramento", optional: true },
  resultado: { label: "Resultados de consultas em que participei", optional: true },
  encaminhamentos: { label: "Novos encaminhamentos", optional: true },
  respostas_propostas: { label: "Respostas às minhas propostas", optional: true },
  conta: { label: "Segurança da conta (obrigatório)", optional: false },
  comprovante: { label: "Comprovantes de participação (obrigatório)", optional: false },
  voto_afetado: { label: "Mudanças que afetam consultas em que votei (obrigatório)", optional: false },
  moderacao: { label: "Decisões de moderação sobre meu conteúdo (obrigatório)", optional: false },
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export const OPTIONAL_TYPES = (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((t) => NOTIFICATION_TYPES[t].optional);

export function defaultPreferences() {
  return Object.fromEntries(OPTIONAL_TYPES.map((t) => [t, { email: true, inApp: true }])) as Record<string, { email: boolean; inApp: boolean }>;
}

export async function queueEmail(db: DbOrTx, to: string, subject: string, body: string) {
  await db.insert(emailOutbox).values({ toAddress: to, subject, body });
}

export type NotifyInput = { type: NotificationType; title: string; body: string; link?: string; emailSubject?: string };

/** Envia aviso respeitando preferências; avisos obrigatórios não podem ser desligados (RF052). */
export async function notifyUser(db: DbOrTx, userId: string, input: NotifyInput) {
  const [u] = await db
    .select({ email: users.email, status: users.status, prefs: notificationPreferences.types })
    .from(users)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(eq(users.id, userId));
  if (!u || u.status === "desativada") return;
  const mandatory = !NOTIFICATION_TYPES[input.type].optional;
  const pref = (u.prefs ?? defaultPreferences())[input.type] ?? { email: true, inApp: true };
  if (mandatory || pref.inApp) {
    await db.insert(notifications).values({ userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null, mandatory });
  }
  if (mandatory || pref.email) {
    const link = input.link ? `\n\nAcesse: ${env.appUrl}${input.link}` : "";
    const unsubscribe = mandatory
      ? ""
      : `\n\nPara deixar de receber este tipo de aviso, acesse: ${env.appUrl}/avisos/descadastrar?t=${encodeURIComponent(signPayload({ u: userId, t: input.type }))}`;
    await queueEmail(db, u.email, input.emailSubject ?? input.title, `${input.body}${link}${unsubscribe}\n\n— ${env.municipio} · Plataforma de Participação Cidadã`);
  }
}

export async function listNotifications(userId: string, db: DbOrTx = getDb()) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function unreadCount(userId: string, db: DbOrTx = getDb()) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function markAllRead(userId: string, db: DbOrTx = getDb()) {
  await db.update(notifications).set({ readAt: clock.now() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function getPreferences(userId: string, db: DbOrTx = getDb()) {
  const [p] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return p ?? { userId, types: defaultPreferences(), themeIds: [] as string[], districtIds: [] as string[], updatedAt: clock.now() };
}

export async function savePreferences(userId: string, input: { types: Record<string, { email: boolean; inApp: boolean }>; themeIds: string[]; districtIds: string[] }, db: DbOrTx = getDb()) {
  const types = Object.fromEntries(OPTIONAL_TYPES.map((t) => [t, { email: !!input.types[t]?.email, inApp: !!input.types[t]?.inApp }]));
  await db
    .insert(notificationPreferences)
    .values({ userId, types, themeIds: input.themeIds, districtIds: input.districtIds, updatedAt: clock.now() })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { types, themeIds: input.themeIds, districtIds: input.districtIds, updatedAt: clock.now() } });
}

/** Descadastro pelo link do e-mail, sem login (RF052). */
export async function unsubscribe(userId: string, type: string, db: DbOrTx = getDb()) {
  if (!(OPTIONAL_TYPES as string[]).includes(type)) return false;
  const p = await getPreferences(userId, db);
  const types = { ...p.types, [type]: { ...(p.types[type] ?? { inApp: true }), email: false } };
  await savePreferences(userId, { types, themeIds: p.themeIds, districtIds: p.districtIds }, db);
  return true;
}

/* ------------------------- Envio da fila ------------------------- */

/** Sem SMTP configurado nenhum e-mail sai de verdade: a interface não pode dizer que enviou. */
export function emailIsSimulated(): boolean {
  return !process.env.SMTP_URL?.trim();
}

type Transport = { send: (to: string, subject: string, body: string) => Promise<void>; simulated: boolean };

let transport: Transport | null = null;
async function getTransport(): Promise<Transport> {
  if (transport) return transport;
  const url = process.env.SMTP_URL?.trim();
  if (url) {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport(url);
    const from = process.env.SMTP_FROM || `PPCM <nao-responda@${new URL(env.appUrl).hostname}>`;
    transport = { simulated: false, send: async (to, subject, text) => void (await t.sendMail({ from, to, subject, text })) };
  } else {
    transport = { simulated: true, send: async () => {} };
  }
  return transport;
}

export async function processOutbox(db: DbOrTx = getDb(), batch = 50) {
  const t = await getTransport();
  const pending = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pendente"), lt(emailOutbox.attempts, 3)))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(batch);
  let sent = 0;
  for (const m of pending) {
    try {
      await t.send(m.toAddress, m.subject, m.body);
      // Transporte simulado (sem SMTP): a mensagem não saiu de verdade e não é registrada como "enviado".
      await db.update(emailOutbox).set({ status: t.simulated ? "simulado" : "enviado", sentAt: clock.now(), attempts: m.attempts + 1 }).where(eq(emailOutbox.id, m.id));
      sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db
        .update(emailOutbox)
        .set({ attempts, lastError: String((e as Error).message).slice(0, 300), status: attempts >= 3 ? "falhou" : "pendente" })
        .where(eq(emailOutbox.id, m.id));
    }
  }
  return { sent, simulated: t.simulated };
}
