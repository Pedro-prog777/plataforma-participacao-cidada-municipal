/**
 * Canais de aviso e transportes de e-mail (RF052–RF055).
 *
 * Polimorfismo: `notifyUser` percorre os canais e cada um decide se entrega (pela preferência do
 * cidadão) e como entrega. A regra comum — aviso obrigatório sempre chega; o opcional respeita a
 * preferência — fica na classe base `CanalComPreferencia`; cada canal diz qual preferência olha e
 * como grava.
 */
import type { Transporter } from "nodemailer";
import type { DbOrTx } from "../../db/client";
import { emailOutbox, notifications } from "../../db/schema";
import { signPayload } from "../../lib/crypto";
import { env } from "../../lib/env";
import type { Aviso, CanalDeNotificacao, Destinatario, PreferenciaDeCanal, TransporteDeEmail } from "../../domain/interfaces/notificacao";

/** Coloca um e-mail na fila; a rotina automática envia com até 3 tentativas (RF053). */
export async function queueEmail(db: DbOrTx, to: string, subject: string, body: string) {
  await db.insert(emailOutbox).values({ toAddress: to, subject, body });
}

abstract class CanalComPreferencia implements CanalDeNotificacao {
  constructor(protected readonly db: DbOrTx) {}

  abstract readonly nome: string;

  /** Obrigatório chega sempre (RF052); opcional, só se o cidadão manteve este canal ligado. */
  deveEntregar(destinatario: Destinatario, aviso: Aviso): boolean {
    return aviso.obrigatorio || this.preferenciaLigada(destinatario.preferencia);
  }

  protected abstract preferenciaLigada(preferencia: PreferenciaDeCanal): boolean;
  abstract entregar(destinatario: Destinatario, aviso: Aviso): Promise<void>;
}

/** Central de avisos da plataforma (`notifications`). */
export class CanalCentralDeAvisos extends CanalComPreferencia {
  readonly nome = "central de avisos";

  protected preferenciaLigada(preferencia: PreferenciaDeCanal): boolean {
    return preferencia.inApp;
  }

  async entregar(destinatario: Destinatario, aviso: Aviso): Promise<void> {
    await this.db.insert(notifications).values({ userId: destinatario.id, type: aviso.tipo, title: aviso.titulo, body: aviso.corpo, link: aviso.link ?? null, mandatory: aviso.obrigatorio });
  }
}

/** E-mail (fila `email_outbox`), com o link do aviso e, nos opcionais, o descadastro sem login (RF052). */
export class CanalEmail extends CanalComPreferencia {
  readonly nome = "e-mail";

  protected preferenciaLigada(preferencia: PreferenciaDeCanal): boolean {
    return preferencia.email;
  }

  async entregar(destinatario: Destinatario, aviso: Aviso): Promise<void> {
    const link = aviso.link ? `\n\nAcesse: ${env.appUrl}${aviso.link}` : "";
    const descadastro = aviso.obrigatorio
      ? ""
      : `\n\nPara deixar de receber este tipo de aviso, acesse: ${env.appUrl}/avisos/descadastrar?t=${encodeURIComponent(signPayload({ u: destinatario.id, t: aviso.tipo }))}`;
    await queueEmail(this.db, destinatario.email, aviso.assuntoDoEmail ?? aviso.titulo, `${aviso.corpo}${link}${descadastro}\n\n— ${env.municipio} · Plataforma de Participação Cidadã`);
  }
}

/** Canais usados para os avisos, na ordem de entrega: primeiro a central, depois o e-mail. */
export function canaisDeAviso(db: DbOrTx): CanalDeNotificacao[] {
  return [new CanalCentralDeAvisos(db), new CanalEmail(db)];
}

/* --------------------------- transportes da fila --------------------------- */

/** Servidor SMTP real (variável `SMTP_URL`). */
export class TransporteSmtp implements TransporteDeEmail {
  readonly simulado = false;
  readonly #transporte: Transporter;
  readonly #remetente: string;

  private constructor(transporte: Transporter, remetente: string) {
    this.#transporte = transporte;
    this.#remetente = remetente;
  }

  static async conectar(url: string, remetente: string): Promise<TransporteSmtp> {
    const nodemailer = await import("nodemailer");
    return new TransporteSmtp(nodemailer.createTransport(url), remetente);
  }

  async enviar(para: string, assunto: string, corpo: string): Promise<void> {
    await this.#transporte.sendMail({ from: this.#remetente, to: para, subject: assunto, text: corpo });
  }
}

/**
 * Sem SMTP configurado: nenhuma mensagem sai de verdade. O envio é aceito sem fazer nada e a fila
 * marca a mensagem como "simulado" — em DEMO_MODE ela aparece na caixa de e-mail de teste (AGENTS §14).
 */
export class TransporteSimulado implements TransporteDeEmail {
  readonly simulado = true;

  async enviar(): Promise<void> {
    // Intencional: simulação identificada, sem envio (ver `emailIsSimulated`).
  }
}
