/**
 * Consulta pública e o seu ciclo de vida (Documento v6, seção 6.1; RF019, RF024–RF035, RF042, RF043).
 *
 *  rascunho ─enviarParaRevisao─▶ em_revisao ─concluirRevisao(ok)─▶ em_analise ─aprovar─▶ aprovada ─publicar─▶ agendada
 *     ▲  ▲                          │ problema                        │ rejeitar / prazo negado             │ abrir (rotina)
 *     │  └──────────────────────────┘                                 ▼                                     ▼
 *     └──────── editar ◀────────────────────────────────────────── rejeitada        suspensa ◀──▶ aberta ─encerrar─▶ encerrada ─▶ apurada ─▶ finalizada
 *  cancelada: a partir de aprovada/agendada/aberta/suspensa/encerrada (irreversível, RN32).
 *
 * A situação e os campos que a acompanham são privados: só mudam pelos métodos abaixo, que recusam
 * transições inválidas com as mesmas mensagens que o sistema já mostrava. Os serviços
 * (`modules/consultations/lifecycle.service.ts`, agendador e resultados) cuidam de permissões,
 * auditoria, avisos e persistência; a regra do ciclo de vida fica aqui.
 */
import { DomainError, ForbiddenError, ValidationError } from "../../lib/errors";
import { DAY, HOUR } from "../../lib/clock";
import { PUBLIC_STATUSES, type ConsultationStatus } from "@/lib/labels";
import { EntidadeComCicloDeVida } from "./entidade-com-ciclo-de-vida";

export type SituacaoConsulta = ConsultationStatus;
export type AutorizacaoDoPrazo = "nao_aplicavel" | "pendente" | "autorizada" | "negada";

export type PropriedadesConsulta = {
  id: string;
  titulo: string;
  slug: string;
  propostaMunicipalId: string;
  situacao: SituacaoConsulta;
  situacaoAntesDaSuspensao: SituacaoConsulta | null;
  motivoDaSituacao: string | null;
  abertura: Date | null;
  encerramento: Date | null;
  abertaEm: Date | null;
  encerradaEm: Date | null;
  prazoExcepcional: boolean;
  autorizacaoDoPrazo: string;
  justificativaDoPrazo: string | null;
  prazoDecididoPor: string | null;
  versao: number;
  versaoCongelada: number | null;
  criadaPor: string;
  editadaPorUltimo: string | null;
  aprovadaPor: string | null;
  aprovadaEm: Date | null;
  publicadaEm: Date | null;
  observacoesDaRevisao: string | null;
  retratoDaAbertura: Record<string, unknown> | null;
  elegiveisEstimados: number | null;
  atualizadaEm: Date;
};

const EDITAVEIS: readonly SituacaoConsulta[] = ["rascunho", "rejeitada"];
const ALTERAVEIS_APOS_PUBLICAR: readonly SituacaoConsulta[] = ["agendada", "aberta", "suspensa"];
const CANCELAVEIS: readonly SituacaoConsulta[] = ["aprovada", "agendada", "aberta", "suspensa", "encerrada"];

export class Consulta extends EntidadeComCicloDeVida<SituacaoConsulta, PropriedadesConsulta> {
  private constructor(propriedades: PropriedadesConsulta) {
    super(propriedades);
  }

  /** Reconstrói a consulta lida do banco (o repositório é quem chama). */
  static reconstituir(propriedades: PropriedadesConsulta): Consulta {
    return new Consulta(propriedades);
  }

  get descricao(): string {
    return "Consulta";
  }

  /* ---------------------------- leitura ---------------------------- */
  get id() {
    return this.dados.id;
  }
  get titulo() {
    return this.dados.titulo;
  }
  get slug() {
    return this.dados.slug;
  }
  get propostaMunicipalId() {
    return this.dados.propostaMunicipalId;
  }
  get abertura() {
    return this.dados.abertura;
  }
  get encerramento() {
    return this.dados.encerramento;
  }
  get prazoExcepcional() {
    return this.dados.prazoExcepcional;
  }
  get justificativaDoPrazo() {
    return this.dados.justificativaDoPrazo;
  }
  get versao() {
    return this.dados.versao;
  }
  get versaoCongelada() {
    return this.dados.versaoCongelada;
  }

  /** Situação em que o público vê a consulta (RF016): nunca rascunho, revisão, análise, aprovada ou rejeitada. */
  get estaPublica(): boolean {
    return this.estaEm(...PUBLIC_STATUSES);
  }

  /* ----------------------- elaboração (RF024, RF028) ----------------------- */
  /** Edição só em Rascunho ou Rejeitada (RF024); publicada segue o RF032. */
  garantirEdicao(): void {
    if (this.estaEm(...EDITAVEIS)) return;
    throw new DomainError(
      this.estaEm("em_analise", "em_revisao") ? "A consulta está em revisão/análise e não pode ser editada." : 'Consulta publicada: use "Alterar consulta publicada" (RF032).',
      "edicao_bloqueada",
    );
  }

  enviarParaRevisao(agora: Date): void {
    this.garantirEdicao();
    this.transicionar("em_revisao", EDITAVEIS, "A consulta não pode ser enviada para revisão nesta situação.", { observacoesDaRevisao: null, atualizadaEm: agora });
  }

  garantirAguardandoRevisao(): void {
    this.garantirSituacao(["em_revisao"], "A consulta não está aguardando revisão.");
  }

  /** Revisor diferente de quem elaborou ou editou por último (RN36). */
  garantirRevisorIndependente(revisorId: string, papeisDoRevisor: readonly string[]): void {
    if (papeisDoRevisor.includes("elaborador") || this.dados.criadaPor === revisorId || this.dados.editadaPorUltimo === revisorId) {
      throw new ForbiddenError("O revisor deve ser diferente de quem elaborou ou editou a consulta.");
    }
  }

  /** Revisão aprovada congela a versão e segue para análise; com problema, volta a Rascunho (RF028). */
  concluirRevisao(aprovada: boolean, observacoes: string | null, agora: Date): void {
    if (aprovada) {
      this.transicionar("em_analise", ["em_revisao"], "A consulta não está aguardando revisão.", { versaoCongelada: this.dados.versao, atualizadaEm: agora });
    } else {
      this.transicionar("rascunho", ["em_revisao"], "A consulta não está aguardando revisão.", { observacoesDaRevisao: observacoes, atualizadaEm: agora });
    }
  }

  /* ------------------- prazo excepcional e aprovação (RF029) ------------------- */
  decidirPrazoExcepcional(decisorId: string, autorizar: boolean, justificativa: string, prazoPadraoDias: number): void {
    const d = this.dados;
    if (!this.estaEm("em_analise") || !d.prazoExcepcional || d.autorizacaoDoPrazo !== "pendente") throw new DomainError("Não há pedido de prazo excepcional pendente.");
    if (d.criadaPor === decisorId || d.editadaPorUltimo === decisorId) throw new ForbiddenError("Quem elaborou a consulta não decide sobre o próprio pedido de prazo.");
    if (autorizar) {
      this.alterar({ autorizacaoDoPrazo: "autorizada", justificativaDoPrazo: justificativa, prazoDecididoPor: decisorId });
      return;
    }
    // Redução negada: volta a Rascunho com o prazo padrão sugerido a partir da abertura.
    this.transicionar("rascunho", ["em_analise"], "Não há pedido de prazo excepcional pendente.", {
      autorizacaoDoPrazo: "negada",
      justificativaDoPrazo: justificativa,
      prazoDecididoPor: decisorId,
      prazoExcepcional: false,
      encerramento: d.abertura ? new Date(d.abertura.getTime() + prazoPadraoDias * DAY) : d.encerramento,
      observacoesDaRevisao: `Prazo excepcional negado: ${justificativa}. Encerramento sugerido para ${prazoPadraoDias} dias após a abertura.`,
    });
  }

  /**
   * Segregação de funções (RN20, RN36): ninguém aprova a consulta que elaborou, editou por último ou
   * revisou, nem quem tem nela o papel de elaborador ou revisor.
   */
  temConflitoDeAprovacao(atorId: string, contexto: { revisores: readonly string[]; papeisDoAtor: readonly string[] }): boolean {
    const d = this.dados;
    return d.criadaPor === atorId || d.editadaPorUltimo === atorId || contexto.revisores.includes(atorId) || contexto.papeisDoAtor.includes("elaborador") || contexto.papeisDoAtor.includes("revisor");
  }

  aprovar(aprovadorId: string, agora: Date, antecedenciaMinimaHoras: number): void {
    this.garantirDecisaoDoAprovador(aprovadorId);
    if (this.dados.prazoExcepcional && this.dados.autorizacaoDoPrazo !== "autorizada") throw new DomainError("O pedido de prazo excepcional ainda não foi autorizado.", "prazo_pendente");
    this.garantirAntecedencia(agora, antecedenciaMinimaHoras);
    this.transicionar("aprovada", ["em_analise"], "A consulta não está Em análise.", { aprovadaPor: aprovadorId, aprovadaEm: agora });
  }

  rejeitar(aprovadorId: string, justificativa: string): void {
    this.garantirDecisaoDoAprovador(aprovadorId);
    this.transicionar("rejeitada", ["em_analise"], "A consulta não está Em análise.", { observacoesDaRevisao: `Rejeitada pelo aprovador: ${justificativa}` });
  }

  private garantirDecisaoDoAprovador(aprovadorId: string): void {
    this.garantirSituacao(["em_analise"], "A consulta não está Em análise.");
    if (this.dados.editadaPorUltimo === aprovadorId || this.dados.criadaPor === aprovadorId) throw new ForbiddenError("Segregação de funções (RN20).");
  }

  /** Antecedência mínima entre a aprovação/publicação e a abertura (RN15). */
  private garantirAntecedencia(agora: Date, horas: number): void {
    const abertura = this.dados.abertura;
    if (!abertura || abertura.getTime() - agora.getTime() < horas * HOUR) {
      throw new DomainError(`Antecedência insuficiente: a abertura precisa ocorrer pelo menos ${horas} horas após a ${this.estaEm("em_analise") ? "aprovação" : "publicação"} (RN15). Ajuste as datas.`, "antecedencia");
    }
  }

  /* --------------------------- publicação (RF030) --------------------------- */
  publicar(agora: Date, antecedenciaMinimaHoras: number): void {
    this.garantirSituacao(["aprovada"], "Somente consultas aprovadas podem ser publicadas.");
    this.garantirAntecedencia(agora, antecedenciaMinimaHoras);
    this.transicionar("agendada", ["aprovada"], "Somente consultas aprovadas podem ser publicadas.", { publicadaEm: agora });
  }

  desfazerAgendamento(agora: Date): void {
    const abertura = this.dados.abertura;
    if (!this.estaEm("agendada") || (abertura && abertura <= agora)) throw new DomainError("Só é possível desfazer o agendamento antes da data de abertura.");
    this.transicionar("em_analise", ["agendada"], "Só é possível desfazer o agendamento antes da data de abertura.", { publicadaEm: null, aprovadaEm: null, aprovadaPor: null });
  }

  /* ------------------- abertura e encerramento automáticos (RF031, RF035) ------------------- */
  /** Abertura no horário: guarda o retrato dos parâmetros vigentes e os elegíveis estimados (RF031). */
  abrir(agora: Date, retrato: Record<string, unknown>, elegiveisEstimados: number): void {
    this.transicionar("aberta", ["agendada"], "Só consultas Agendadas são abertas no horário programado.", { abertaEm: agora, retratoDaAbertura: retrato, elegiveisEstimados });
  }

  encerrarNoHorario(agora: Date): void {
    this.transicionar("encerrada", ["aberta"], "Só consultas Abertas são encerradas no horário divulgado.", { encerradaEm: agora });
  }

  /* --------------------- alteração após publicar (RF032) --------------------- */
  garantirAlteracaoPublicada(): void {
    this.garantirSituacao(ALTERAVEIS_APOS_PUBLICAR, "Alteração proibida nesta situação (RN12/RN32). Para mudanças de fundo, cancele e crie nova consulta.", "alteracao_proibida");
  }

  /** A data de abertura só muda enquanto a consulta ainda está Agendada (RF032). */
  garantirAberturaAjustavel(): void {
    this.garantirSituacao(["agendada"], "A abertura só pode ser ajustada enquanto a consulta está Agendada.", "alteracao_proibida");
  }

  /* -------------------- suspensão e retomada (RF033) -------------------- */
  suspender(justificativa: string): void {
    const antes = this.situacao;
    this.transicionar("suspensa", ["agendada", "aberta"], "Só é possível suspender consultas Agendadas ou Abertas.", { situacaoAntesDaSuspensao: antes, motivoDaSituacao: justificativa });
  }

  /**
   * Retomada: volta a Agendada se foi suspensa antes de abrir e a abertura ainda não chegou; senão,
   * Aberta. Prorrogação opcional, sempre posterior ao encerramento atual.
   */
  retomar(agora: Date, novoEncerramento: Date | null): void {
    this.garantirSituacao(["suspensa"], "A consulta não está suspensa.");
    const d = this.dados;
    if (novoEncerramento && d.encerramento && novoEncerramento <= d.encerramento) throw new ValidationError({ newClosesAt: ["A prorrogação deve ser posterior ao encerramento atual."] });
    const encerramento = novoEncerramento ?? d.encerramento;
    if (encerramento && encerramento <= agora) {
      throw new DomainError("O prazo terminou durante a suspensão. Decida, com justificativa, entre apurar ou cancelar a consulta.", "encerrada_durante_suspensao");
    }
    const destino: SituacaoConsulta = d.situacaoAntesDaSuspensao === "agendada" && d.abertura && d.abertura > agora ? "agendada" : "aberta";
    this.transicionar(destino, ["suspensa"], "A consulta não está suspensa.", {
      situacaoAntesDaSuspensao: null,
      motivoDaSituacao: null,
      encerramento,
      abertaEm: destino === "aberta" ? (d.abertaEm ?? agora) : d.abertaEm,
    });
  }

  /** Prazo terminou durante a suspensão e decidiu-se contar os votos (RF033). */
  encerrarAposSuspensao(agora: Date): void {
    const encerramento = this.dados.encerramento;
    if (!this.estaEm("suspensa") || !encerramento || encerramento > agora) throw new DomainError("Disponível apenas para consulta suspensa cujo prazo já terminou.");
    this.transicionar("encerrada", ["suspensa"], "Disponível apenas para consulta suspensa cujo prazo já terminou.", { encerradaEm: agora, situacaoAntesDaSuspensao: null });
  }

  /* --------------------------- cancelamento (RF034) --------------------------- */
  cancelar(justificativa: string, tituloDigitado: string, agora: Date): void {
    if (this.estaEm("apurada", "finalizada")) throw new DomainError("Consulta já apurada não pode ser cancelada; cabe retificação do resultado (RF043).", "ja_apurada");
    this.garantirSituacao(CANCELAVEIS, "Esta consulta não pode ser cancelada nesta situação.");
    if ((tituloDigitado ?? "").trim() !== this.dados.titulo.trim()) throw new ValidationError({ confirmTitle: ["Digite o título exatamente como aparece para confirmar."] });
    this.transicionar("cancelada", CANCELAVEIS, "Esta consulta não pode ser cancelada nesta situação.", { motivoDaSituacao: justificativa, encerradaEm: this.dados.encerradaEm ?? agora });
  }

  /* ----------------------- apuração e resultado (RF042, RF043) ----------------------- */
  /** Apuração exige consulta Encerrada; a recontagem, consulta Apurada e ainda não publicada. */
  garantirApuracaoPermitida(recontagem: boolean): void {
    if (recontagem) this.garantirSituacao(["apurada"], "Recontagem só é possível antes da publicação.");
    else this.garantirSituacao(["encerrada"], "A apuração exige consulta Encerrada.");
  }

  registrarApuracao(): void {
    this.transicionar("apurada", ["encerrada"], "A apuração exige consulta Encerrada.");
  }

  homologarResultado(): void {
    this.transicionar("finalizada", ["apurada"], "Só é possível homologar consultas Apuradas.");
  }

  /** Retificação só depois do resultado final publicado; o original continua visível (RF043, RN29). */
  garantirResultadoPublicado(): void {
    this.garantirSituacao(["finalizada"], "Retificação só se aplica a resultado já publicado.");
  }
}
