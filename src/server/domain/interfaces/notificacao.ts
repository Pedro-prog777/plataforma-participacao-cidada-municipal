/**
 * Contratos das notificações (RF052–RF055). O domínio define o que é um aviso e o que um canal ou
 * um transporte de e-mail precisa fazer; as implementações (banco, SMTP) ficam em
 * `modules/notifications`.
 */

/** Preferência do cidadão para um tipo de aviso (RF052). */
export type PreferenciaDeCanal = { email: boolean; inApp: boolean };

export type Aviso = {
  tipo: string;
  titulo: string;
  corpo: string;
  link?: string;
  assuntoDoEmail?: string;
  /** Avisos obrigatórios (conta, comprovante, voto afetado, moderação) não podem ser desligados. */
  obrigatorio: boolean;
};

export type Destinatario = { id: string; email: string; preferencia: PreferenciaDeCanal };

/** Canal por onde o aviso chega ao cidadão: central de avisos da plataforma ou e-mail. */
export interface CanalDeNotificacao {
  readonly nome: string;
  deveEntregar(destinatario: Destinatario, aviso: Aviso): boolean;
  entregar(destinatario: Destinatario, aviso: Aviso): Promise<void>;
}

/** Envio efetivo dos e-mails da fila (`email_outbox`): servidor SMTP ou simulação sem envio. */
export interface TransporteDeEmail {
  /** Sem SMTP configurado nada sai de verdade, e a fila registra "simulado", não "enviado". */
  readonly simulado: boolean;
  enviar(para: string, assunto: string, corpo: string): Promise<void>;
}
