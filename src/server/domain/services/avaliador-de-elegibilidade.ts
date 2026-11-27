/**
 * Verificação de elegibilidade (RF036), avaliada NA ORDEM do documento:
 *  1) conta ativa e desbloqueada; 2) identidade verificada; 3) perfil Cidadão (RN22) com 18 anos
 *  completos (DT-30); 4) enquadramento no público-alvo; 5) consulta Aberta e no período, pelo horário
 *  do servidor (RN08); 6) ausência de participação anterior (RN05).
 *
 * Serviço de domínio puro: recebe o cidadão, o público-alvo e a janela de votação e devolve o
 * primeiro motivo de recusa. Não acessa banco nem relógio — quem chama informa `agora`.
 */
import type { Cidadao } from "../entities/cidadao";
import type { PublicoAlvo } from "../entities/publico-alvo";
import type { ResultadoElegibilidade } from "../interfaces/elegibilidade";

export type JanelaDeVotacao = { situacao: string; abertura: Date | null; encerramento: Date | null };

export class AvaliadorDeElegibilidade {
  readonly #janela: Readonly<JanelaDeVotacao>;
  readonly #publico: PublicoAlvo;

  constructor(janela: JanelaDeVotacao, publico: PublicoAlvo) {
    this.#janela = Object.freeze({ ...janela });
    this.#publico = publico;
  }

  avaliar(cidadao: Cidadao, jaParticipou: boolean, agora: Date): ResultadoElegibilidade {
    if (!cidadao.contaAtivaEm(agora)) {
      return { eligible: false, code: "conta_inativa", reason: "Sua conta não está ativa no momento.", action: { label: "Ver meu perfil", href: "/conta" } };
    }
    if (!cidadao.ehContaAdministrativa && !cidadao.identidadeVerificada) {
      return { eligible: false, code: "identidade_nao_verificada", reason: "Para participar, é preciso verificar sua identidade.", action: { label: "Verificar identidade", href: "/conta/verificacao" } };
    }
    if (cidadao.ehContaAdministrativa) {
      // RN22: contas administrativas não votam.
      return { eligible: false, code: "conta_administrativa", reason: "Contas administrativas não participam das votações." };
    }
    if (!cidadao.temIdadeMinimaEm(agora)) {
      return cidadao.informouNascimento
        ? { eligible: false, code: "menor_de_18", reason: "Para votar é preciso ter 18 anos completos." }
        : { eligible: false, code: "menor_de_18", reason: "Não foi possível conferir sua idade. Para votar é preciso ter 18 anos completos.", action: { label: "Ver meu perfil", href: "/conta" } };
    }
    const restricao = this.#publico.restricaoPara(cidadao, agora);
    if (restricao) return restricao;
    if (!this.votacaoAbertaEm(agora)) {
      return {
        eligible: false,
        code: "fora_do_periodo",
        reason: this.#janela.situacao === "suspensa" ? "A consulta está suspensa. Nenhum voto é aceito durante a suspensão." : "A consulta não está aberta para participação neste momento.",
      };
    }
    if (jaParticipou) return { eligible: false, code: "ja_participou", reason: "Você já participou desta consulta.", action: { label: "Ver meu comprovante", href: "/conta/participacoes" } };
    return { eligible: true };
  }

  /** Consulta Aberta e dentro do período, pelo horário do servidor (RN08, RS009). */
  votacaoAbertaEm(agora: Date): boolean {
    const { situacao, abertura, encerramento } = this.#janela;
    return situacao === "aberta" && !!abertura && !!encerramento && agora >= abertura && agora < encerramento;
  }

  /**
   * Quem pode votar quanto ao perfil e ao público-alvo, sem período nem participação — usado na
   * estimativa de elegíveis (RF027) e nos avisos de abertura (RF053).
   */
  static enquadraNoPublico(cidadao: Cidadao, publico: PublicoAlvo, agora: Date): boolean {
    if (cidadao.ehContaAdministrativa || !cidadao.contaAtiva) return false;
    if (!cidadao.temIdadeMinimaEm(agora)) return false;
    return publico.enquadra(cidadao, agora);
  }
}

