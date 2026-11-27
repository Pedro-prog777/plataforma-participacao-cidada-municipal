/**
 * Conta avaliada para participar de uma consulta (RF036): situação da conta, verificação de
 * identidade, idade e endereço. Contas administrativas também passam por aqui — e são recusadas
 * (RN22: contas administrativas não votam).
 *
 * Os dados ficam privados; quem avalia pergunta por meio de métodos (`contaAtivaEm`, `moraEmAlgum`…),
 * sem acesso aos campos. A idade mínima da plataforma (18 anos completos — DT-30, DT-33) é definida
 * aqui, uma única vez.
 */
import { ageOn } from "../../lib/clock";

export type PerfilDoCidadao = {
  id: string;
  tipo: "cidadao" | "admin";
  situacaoDaConta: string;
  bloqueadoAte: Date | null;
  nivelDeVerificacao: string;
  bairroId: string | null;
  regiaoId: string | null;
  domicilioComprovadoEm: Date | null;
  nascimento: string | null;
};

export class Cidadao {
  /** Só quem tem 18 anos completos cria conta de cidadão (DT-33) e vota (RF036, DT-30). */
  static readonly IDADE_MINIMA = 18;

  /** 18 anos completos na data de referência, no fuso de Brasília (17 anos e 364 dias não bastam). */
  static temIdadeMinima(nascimento: string | null, data: Date): boolean {
    return !!nascimento && ageOn(nascimento, data) >= Cidadao.IDADE_MINIMA;
  }

  readonly #perfil: Readonly<PerfilDoCidadao>;

  constructor(perfil: PerfilDoCidadao) {
    this.#perfil = Object.freeze({ ...perfil });
  }

  get id(): string {
    return this.#perfil.id;
  }

  /** Conta administrativa (RN22) — não vota. */
  get ehContaAdministrativa(): boolean {
    return this.#perfil.tipo !== "cidadao";
  }

  /** Situação "ativa", sem olhar bloqueio temporário (usada na estimativa de elegíveis). */
  get contaAtiva(): boolean {
    return this.#perfil.situacaoDaConta === "ativa";
  }

  /** Ativa e sem bloqueio temporário por excesso de tentativas no momento informado (RN03, RN24). */
  contaAtivaEm(agora: Date): boolean {
    const bloqueio = this.#perfil.bloqueadoAte;
    return this.contaAtiva && !(bloqueio && bloqueio > agora);
  }

  get identidadeVerificada(): boolean {
    return this.#perfil.nivelDeVerificacao === "verificado";
  }

  get informouNascimento(): boolean {
    return !!this.#perfil.nascimento;
  }

  temIdadeMinimaEm(agora: Date): boolean {
    return Cidadao.temIdadeMinima(this.#perfil.nascimento, agora);
  }

  /** Idade completa na data, ou null se a data de nascimento não foi informada. */
  idadeEm(agora: Date): number | null {
    return this.#perfil.nascimento ? ageOn(this.#perfil.nascimento, agora) : null;
  }

  get informouEndereco(): boolean {
    return !!this.#perfil.bairroId;
  }

  get domicilioComprovado(): boolean {
    return !!this.#perfil.domicilioComprovadoEm;
  }

  /** Mora em um dos bairros ou em uma das regiões informados (critério territorial, RF027). */
  moraEmAlgum(bairros: readonly string[], regioes: readonly string[]): boolean {
    const { bairroId, regiaoId } = this.#perfil;
    return (!!bairroId && bairros.includes(bairroId)) || (!!regiaoId && regioes.includes(regiaoId));
  }

  /**
   * Cópia com o domicílio tratado como comprovado: na estimativa de elegíveis e nos avisos de
   * abertura, quem ainda vai comprovar o endereço também conta (RF027, RF053).
   */
  comDomicilioPresumido(agora: Date): Cidadao {
    return new Cidadao({ ...this.#perfil, domicilioComprovadoEm: this.#perfil.domicilioComprovadoEm ?? agora });
  }
}
