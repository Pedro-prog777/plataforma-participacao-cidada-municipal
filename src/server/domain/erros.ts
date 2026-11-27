/**
 * Erros do domínio. As mensagens são seguras para mostrar ao cidadão (português simples).
 */
import { DomainError } from "../lib/errors";

/**
 * Recusa de voto (RF039, RF040, RN13). O serviço de votação registra na auditoria só o motivo
 * (`code`) — nunca a alternativa escolhida (RN07).
 */
export class VoteRejected extends DomainError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = "VoteRejected";
  }
}
