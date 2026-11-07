/**
 * Registro de voto com sigilo (RF011, RF037–RF041; RN05–RN09, RN13; RS001, RS002, RS009; RNF07, RNF14).
 *
 * GARANTIAS IMPLEMENTADAS
 *  - Voto único: índice único (consulta, cidadão) em `participations` + verificação na regra e na tela.
 *  - Sigilo: `votes` não tem cidadão, comprovante nem horário; nada liga participação a voto.
 *    O código de confirmação (RF011) também não guarda a alternativa.
 *  - Atomicidade: participação e voto na MESMA transação; qualquer falha desfaz tudo.
 *  - Período: conferido pelo horário do servidor dentro da transação, com a linha da consulta
 *    bloqueada (FOR SHARE), para que o encerramento aguarde votos em andamento (RF035).
 *  - Nunca registra a alternativa em logs, auditoria, notificações ou e-mails.
 */
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { alternatives, consultations, oneTimeCodes, participations, users, votes } from "../../db/schema";
import { brDate, clock, MINUTE } from "../../lib/clock";
import { decrypt, encrypt, formatReceiptCode, normalizeReceiptCode, numericCode, receiptCode, sha256 } from "../../lib/crypto";
import { DomainError, isUniqueViolation } from "../../lib/errors";
import { hit } from "../../lib/rate-limit";
import { audit } from "../audit/audit.service";
import { notifyUser, queueEmail } from "../notifications/notifications.service";
import { openIncident } from "../integrity/incidents.service";
import { evaluateEligibility, hasParticipated, loadEligibilityConsultation, loadEligibilityUser } from "./eligibility";
import { fmtDate } from "@/lib/labels";

export class VoteRejected extends DomainError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = "VoteRejected";
  }
}

/** Tentativas excessivas (RF039): mais de 5 por minuto limita e abre incidente (RF060). */
async function guardAttempts(db: DbOrTx, userId: string, consultationId: string) {
  const n = hit(`voto:${userId}:${consultationId}`, MINUTE);
  if (n > 5) {
    if (n === 6) {
      await openIncident(db, {
        severity: "media",
        type: "excesso_tentativas_voto",
        consultationId,
        description: "Mais de 5 tentativas de voto por minuto a partir da mesma conta.",
        evidence: { tentativasPorMinuto: n },
      });
    }
    throw new VoteRejected("Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.", "limite_tentativas");
  }
}

async function rejectAndAudit(db: DbOrTx, userId: string, consultationId: string, code: string, message: string): Promise<never> {
  // Auditoria da recusa SEM a alternativa escolhida (RF039, RF040).
  await audit(db, { actorId: userId, actorRole: "cidadao", action: "voto_recusado", result: "negado", objectType: "consulta", objectId: consultationId, details: { motivo: code } });
  throw new VoteRejected(message, code);
}

/* ------------------------------------------------------------------ */
/* RF011 — Confirmação de identidade antes do voto                     */
/* ------------------------------------------------------------------ */
function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{2})/g, "*");
}

export async function requestVoteCode(userId: string, consultationId: string, channel: "email" | "celular", db: DbOrTx = getDb()) {
  await guardAttempts(db, userId, consultationId);
  const [u, c, p] = await Promise.all([loadEligibilityUser(userId, db), loadEligibilityConsultation(consultationId, db), hasParticipated(userId, consultationId, db)]);
  if (!u || !c) throw new VoteRejected("Consulta não encontrada.", "nao_encontrado");
  const el = evaluateEligibility(u, c, !!p);
  if (!el.eligible) await rejectAndAudit(db, userId, consultationId, el.code, el.reason);
  const [acc] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, userId));
  if (channel === "celular" && !acc.phone) throw new DomainError("Não há celular cadastrado. Use o e-mail.", "sem_celular");
  const code = numericCode(6);
  await db
    .update(oneTimeCodes)
    .set({ consumedAt: clock.now() })
    .where(and(eq(oneTimeCodes.userId, userId), eq(oneTimeCodes.purpose, "voto"), eq(oneTimeCodes.scope, consultationId), isNull(oneTimeCodes.consumedAt)));
  await db.insert(oneTimeCodes).values({ userId, purpose: "voto", scope: consultationId, codeHash: sha256(`${userId}:${code}`), channel, expiresAt: new Date(clock.now().getTime() + 5 * MINUTE) });
  const msg = `Seu código para confirmar a participação é ${code}. Ele vale por 5 minutos. Não compartilhe este código.`;
  if (channel === "email") await queueEmail(db, acc.email, "Código de confirmação de participação", msg);
  else await queueEmail(db, `sms:${acc.phone}`, "SMS (simulado) — código de confirmação", msg);
  return { maskedDestination: channel === "email" ? maskEmail(acc.email) : maskPhone(acc.phone!) };
}

async function verifyVoteCode(db: DbOrTx, userId: string, consultationId: string, code: string) {
  const now = clock.now();
  const [row] = await db
    .select()
    .from(oneTimeCodes)
    .where(and(eq(oneTimeCodes.userId, userId), eq(oneTimeCodes.purpose, "voto"), eq(oneTimeCodes.scope, consultationId), isNull(oneTimeCodes.consumedAt)))
    .orderBy(oneTimeCodes.createdAt);
  if (!row || row.expiresAt <= now) throw new VoteRejected("Código expirado ou inexistente. Solicite um novo código.", "codigo_expirado");
  if (row.codeHash !== sha256(`${userId}:${String(code).replace(/\D/g, "")}`)) {
    const attempts = row.attempts + 1;
    await db.update(oneTimeCodes).set({ attempts, consumedAt: attempts >= 3 ? now : null }).where(eq(oneTimeCodes.id, row.id));
    if (attempts >= 3) {
      await audit(db, { actorId: userId, actorRole: "cidadao", action: "voto_interrompido_codigo", result: "negado", objectType: "consulta", objectId: consultationId });
      throw new VoteRejected("Código incorreto 3 vezes. Por segurança, a votação foi interrompida. Recomece a participação.", "codigo_bloqueado");
    }
    throw new VoteRejected(`Código incorreto. Restam ${3 - attempts} tentativa(s).`, "codigo_incorreto");
  }
  return row.id;
}

/* ------------------------------------------------------------------ */
/* RF037 — Registrar voto                                              */
/* ------------------------------------------------------------------ */
export type CastInput = { consultationId: string; alternativeId: string | null; abstention: boolean; code: string };

export async function castVote(userId: string, input: CastInput, db: DbOrTx = getDb()) {
  await guardAttempts(db, userId, input.consultationId);
  const codeId = await verifyVoteCode(db, userId, input.consultationId, input.code);
  const receipt = receiptCode();
  try {
    const result = await db.transaction(async (tx) => {
      // Bloqueia a linha da consulta em modo compartilhado: o encerramento (UPDATE) aguarda os votos em andamento.
      const [c] = await tx.select().from(consultations).where(eq(consultations.id, input.consultationId)).for("share");
      if (!c) throw new VoteRejected("Consulta não encontrada.", "nao_encontrado");
      // Elegibilidade repetida no servidor no momento do voto (RF036, RF040) — horário do servidor.
      const [u, ec, p] = await Promise.all([loadEligibilityUser(userId, tx), loadEligibilityConsultation(input.consultationId, tx), hasParticipated(userId, input.consultationId, tx)]);
      const el = evaluateEligibility(u!, ec!, !!p, clock.now());
      if (!el.eligible) throw new VoteRejected(el.reason, el.code);
      // Exatamente uma alternativa válida desta consulta (RN13).
      if (input.abstention) {
        if (!c.allowAbstention) throw new VoteRejected("Esta consulta não admite abstenção.", "alternativa_invalida");
      } else {
        const [alt] = input.alternativeId
          ? await tx.select({ id: alternatives.id }).from(alternatives).where(and(eq(alternatives.id, input.alternativeId), eq(alternatives.consultationId, c.id)))
          : [];
        if (!alt) throw new VoteRejected("Alternativa inexistente.", "alternativa_invalida");
      }
      const participatedOn = brDate(clock.now());
      await tx.insert(participations).values({ consultationId: c.id, citizenId: userId, participatedOn, receiptHash: sha256(receipt), receiptEnc: encrypt(receipt) });
      await tx.insert(votes).values({ consultationId: c.id, alternativeId: input.abstention ? null : input.alternativeId, abstention: input.abstention });
      await tx.update(oneTimeCodes).set({ consumedAt: clock.now() }).where(eq(oneTimeCodes.id, codeId));
      return { consultation: c, participatedOn };
    });
    // Comprovante (RF038): e-mail e central de avisos — sem a alternativa.
    await notifyUser(db, userId, {
      type: "comprovante",
      title: `Comprovante de participação — ${result.consultation.title}`,
      body: `Sua participação foi registrada em ${fmtDate(result.participatedOn)}.\nCódigo do comprovante: ${formatReceiptCode(receipt)}\nO comprovante prova que você participou, mas não informa a alternativa escolhida. Verifique em /comprovante.`,
      link: `/conta/participacoes`,
    }).catch(() => {
      /* Falha no e-mail: o comprovante permanece no histórico (RF038). */
    });
    return { receipt: formatReceiptCode(receipt), consultationId: result.consultation.id, participatedOn: result.participatedOn };
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Requisições simultâneas: o banco recusa o segundo voto (RF039, RS001).
      await rejectAndAudit(db, userId, input.consultationId, "voto_duplicado", "Você já participou desta consulta. Apenas um voto por pessoa é aceito.");
    }
    if (e instanceof VoteRejected) {
      if (e.code === "alternativa_invalida") {
        await openIncident(db, { severity: "baixa", type: "alternativa_inexistente", consultationId: input.consultationId, description: "Tentativa de voto com alternativa inexistente ou de outra consulta.", evidence: {} });
      }
      await rejectAndAudit(db, userId, input.consultationId, e.code, e.message);
    }
    throw new DomainError("Não foi possível registrar seu voto agora. Nada foi gravado; tente novamente.", "falha_gravacao");
  }
}

/* ------------------------------------------------------------------ */
/* RF041 — Verificação pública de comprovante                          */
/* ------------------------------------------------------------------ */
export async function verifyReceipt(code: string, db: DbOrTx = getDb()) {
  const normalized = normalizeReceiptCode(code);
  if (normalized.length !== 12) return null;
  const [r] = await db
    .select({ title: consultations.title, slug: consultations.slug, status: consultations.status, date: participations.participatedOn })
    .from(participations)
    .innerJoin(consultations, eq(consultations.id, participations.consultationId))
    .where(eq(participations.receiptHash, sha256(normalized)));
  if (!r) return null;
  const situation = r.status === "cancelada" ? "Consulta cancelada" : ["apurada", "finalizada"].includes(r.status) ? "Contabilizado" : "Registrado";
  return { consultationTitle: r.title, slug: r.slug, date: r.date, situation };
}

/** Histórico do titular (RF014): data, comprovante e situação — NUNCA a opção votada. */
export async function myParticipations(userId: string, db: DbOrTx = getDb()) {
  const rows = await db
    .select({ id: participations.id, date: participations.participatedOn, receiptEnc: participations.receiptEnc, consultationId: consultations.id, title: consultations.title, slug: consultations.slug, status: consultations.status })
    .from(participations)
    .innerJoin(consultations, eq(consultations.id, participations.consultationId))
    .where(eq(participations.citizenId, userId));
  return rows.map(({ receiptEnc, ...r }) => ({ ...r, receipt: formatReceiptCode(decrypt(receiptEnc)) }));
}

export async function participationCount(consultationId: string, db: DbOrTx = getDb()) {
  const [r] = await db.select({ n: count() }).from(participations).where(eq(participations.consultationId, consultationId));
  return r?.n ?? 0;
}
