/**
 * Proposta cidadã e os seus estados (RN30; RF020, RF021).
 *
 *  recebida ─iniciarAnalise─▶ em_analise ─solicitarAjuste─▶ ajuste_solicitado ─reenviarComAjustes─▶ em_analise
 *      └──────────responder──────────┴──▶ respondida ─publicar─▶ publicada
 *  encerrar: com justificativa, a partir de qualquer estado; o ajuste vencido é encerrado pela rotina.
 *
 * Como a consulta, herda de EntidadeComCicloDeVida: a situação é privada e só muda pelos métodos de
 * negócio. Quem chama (`modules/proposals/citizen-proposals.service.ts`) cuida de permissão,
 * histórico, avisos ao autor e persistência.
 */
import { DomainError, ValidationError } from "../../lib/errors";
import { DAY } from "../../lib/clock";
import { normalizeSearch } from "@/lib/text";
import { PROPOSAL_RESPONSE } from "@/lib/labels";
import { EntidadeComCicloDeVida } from "./entidade-com-ciclo-de-vida";

export type SituacaoProposta = "recebida" | "em_analise" | "ajuste_solicitado" | "respondida" | "publicada" | "encerrada";
export type TipoDeResposta = keyof typeof PROPOSAL_RESPONSE;

export type PropriedadesProposta = {
  id: string;
  protocolo: string;
  autorId: string;
  situacao: SituacaoProposta;
  titulo: string;
  problema: string;
  solucao: string;
  temaId: string;
  bairroId: string;
  autorizaPublicacao: boolean;
  textoDeBusca: string;
  tipoDeResposta: string | null;
  textoDaResposta: string | null;
  orientacaoDoAjuste: string | null;
  prazoDoAjuste: Date | null;
  propostaMunicipalId: string | null;
  publicadaEm: Date | null;
  atualizadaEm: Date;
};

export type ConteudoDaProposta = { titulo: string; problema: string; solucao: string; temaId: string; bairroId: string; autorizaPublicacao: boolean };

const TODAS: readonly SituacaoProposta[] = ["recebida", "em_analise", "ajuste_solicitado", "respondida", "publicada", "encerrada"];

export class PropostaCidada extends EntidadeComCicloDeVida<SituacaoProposta, PropriedadesProposta> {
  private constructor(propriedades: PropriedadesProposta) {
    super(propriedades);
  }

  static reconstituir(propriedades: PropriedadesProposta): PropostaCidada {
    return new PropostaCidada(propriedades);
  }

  get descricao(): string {
    return "Proposta cidadã";
  }

  get id() {
    return this.dados.id;
  }
  get protocolo() {
    return this.dados.protocolo;
  }
  get autorId() {
    return this.dados.autorId;
  }
  get titulo() {
    return this.dados.titulo;
  }
  get problema() {
    return this.dados.problema;
  }
  get solucao() {
    return this.dados.solucao;
  }
  get temaId() {
    return this.dados.temaId;
  }

  /** Quem analisa não pode ser o autor (RF021). */
  garantirAnalistaDiferenteDoAutor(analistaId: string): void {
    if (this.dados.autorId === analistaId) throw new DomainError("Não é permitido analisar a própria proposta.");
  }

  iniciarAnalise(agora: Date): void {
    this.transicionar("em_analise", ["recebida"], "Somente propostas Recebidas podem entrar em análise.", { atualizadaEm: agora });
  }

  solicitarAjuste(orientacao: string, prazoDias: number, agora: Date): void {
    this.garantirSituacao(["em_analise"], "Ajuste só pode ser solicitado durante a análise.");
    if (!orientacao) throw new ValidationError({ guidance: ["Oriente o autor sobre o ajuste necessário."] });
    this.transicionar("ajuste_solicitado", ["em_analise"], "Ajuste só pode ser solicitado durante a análise.", {
      orientacaoDoAjuste: orientacao,
      prazoDoAjuste: new Date(agora.getTime() + prazoDias * DAY),
      atualizadaEm: agora,
    });
  }

  /** Resposta justificada (RN11): convertida em proposta municipal, encaminhada ou não acolhida. */
  responder(tipo: string, texto: string, agora: Date): void {
    this.garantirSituacao(["em_analise", "recebida"], "A proposta precisa estar em análise para ser respondida.");
    if (!texto) throw new ValidationError({ responseText: ["A resposta deve ser justificada (RN11)."] });
    if (!(tipo in PROPOSAL_RESPONSE)) throw new ValidationError({ responseType: ["Selecione o tipo de resposta."] });
    this.transicionar("respondida", ["em_analise", "recebida"], "A proposta precisa estar em análise para ser respondida.", { tipoDeResposta: tipo, textoDaResposta: texto, atualizadaEm: agora });
  }

  /** Proposta aceita gera uma proposta municipal vinculada (RF022). */
  vincularPropostaMunicipal(propostaMunicipalId: string): void {
    this.alterar({ propostaMunicipalId });
  }

  /** Publica o texto, sem dados do autor, só se ele autorizou (RF020). */
  publicar(agora: Date): void {
    this.garantirSituacao(["respondida"], "Só propostas respondidas podem ser publicadas.");
    if (!this.dados.autorizaPublicacao) throw new DomainError("O autor não autorizou a publicação do texto.");
    this.transicionar("publicada", ["respondida"], "Só propostas respondidas podem ser publicadas.", { publicadaEm: agora, atualizadaEm: agora });
  }

  encerrar(justificativa: string, agora: Date): void {
    if (!justificativa) throw new ValidationError({ justification: ["Justifique o encerramento."] });
    this.transicionar("encerrada", TODAS, "Esta proposta não pode ser encerrada.", { atualizadaEm: agora });
  }

  /** Rotina automática: ajuste não atendido no prazo encerra a proposta (RF021). */
  encerrarPorAjusteVencido(agora: Date): void {
    this.transicionar("encerrada", ["ajuste_solicitado"], "A proposta não está aguardando ajuste.", { atualizadaEm: agora });
  }

  /** O autor reenvia o conteúdo ajustado e a proposta volta para análise. */
  reenviarComAjustes(conteudo: ConteudoDaProposta, agora: Date): void {
    this.transicionar("em_analise", ["ajuste_solicitado"], "A proposta não está aguardando ajuste.", {
      ...conteudo,
      textoDeBusca: normalizeSearch(`${conteudo.titulo} ${conteudo.problema} ${conteudo.solucao}`),
      atualizadaEm: agora,
    });
  }
}
