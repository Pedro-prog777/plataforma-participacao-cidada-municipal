/**
 * Critérios de público-alvo de uma consulta (RF027, RF036; RN35, RN40).
 *
 * Herança e polimorfismo: todo critério é um `CriterioPublicoAlvo` e responde a `avaliar()`, mas cada
 * tipo avalia de um jeito. Quem verifica a elegibilidade percorre a lista de critérios sem saber de
 * qual tipo é cada um — antes, um `switch` em `voting/eligibility.ts` decidia isso.
 *
 *   CriterioPublicoAlvo (abstrata)
 *     ├── CriterioDeEndereco (abstrata: exige domicílio comprovado depois de conferir o endereço)
 *     │     ├── CriterioDomicilio   — mora no município
 *     │     └── CriterioTerritorio  — mora em bairros ou regiões definidos
 *     ├── CriterioFaixaEtaria       — idade mínima e/ou máxima justificada pela consulta
 *     └── CriterioInformativo       — "outro": texto publicado, não verificado automaticamente
 */
import type { Cidadao } from "../entities/cidadao";
import type { AcaoSugerida, Inelegibilidade } from "../interfaces/elegibilidade";

export type ParametrosDoCriterio = { districtIds?: string[]; regionIds?: string[]; minAge?: number; maxAge?: number };

export abstract class CriterioPublicoAlvo {
  protected constructor(readonly tipo: string) {}

  /** Fábrica: cria o critério certo a partir do que está gravado em `audience_criteria`. */
  static criar(tipo: string, parametros: ParametrosDoCriterio = {}): CriterioPublicoAlvo {
    switch (tipo) {
      case "domicilio":
        return new CriterioDomicilio();
      case "territorio":
        return new CriterioTerritorio(parametros.districtIds ?? [], parametros.regionIds ?? []);
      case "faixa_etaria":
        return new CriterioFaixaEtaria(parametros.minAge, parametros.maxAge);
      default:
        return new CriterioInformativo(tipo);
    }
  }

  /** null quando o cidadão se enquadra; senão, o motivo em linguagem simples e a ação possível (RF036). */
  abstract avaliar(cidadao: Cidadao, agora: Date): Inelegibilidade | null;

  /**
   * Enquadramento para a estimativa de elegíveis e para os avisos de abertura: quem ainda vai
   * comprovar o domicílio também conta (RF027, RF053).
   */
  enquadra(cidadao: Cidadao, agora: Date): boolean {
    return this.avaliar(cidadao.comDomicilioPresumido(agora), agora) === null;
  }

  protected recusar(code: string, reason: string, action?: AcaoSugerida): Inelegibilidade {
    return action ? { eligible: false, code, reason, action } : { eligible: false, code, reason };
  }
}

/** Critérios ligados ao endereço: conferem onde a pessoa mora e exigem o domicílio comprovado. */
export abstract class CriterioDeEndereco extends CriterioPublicoAlvo {
  static readonly COMPROVAR_DOMICILIO: AcaoSugerida = { label: "Atualizar endereço e comprovar domicílio", href: "/conta/verificacao" };

  /** Método-modelo: a ordem (endereço, depois comprovação) é a mesma; cada subclasse define as partes. */
  avaliar(cidadao: Cidadao): Inelegibilidade | null {
    const foraDoEndereco = this.conferirEndereco(cidadao);
    if (foraDoEndereco) return foraDoEndereco;
    if (!cidadao.domicilioComprovado) return this.recusar("domicilio_nao_comprovado", this.exigenciaDeComprovacao, CriterioDeEndereco.COMPROVAR_DOMICILIO);
    return null;
  }

  protected abstract conferirEndereco(cidadao: Cidadao): Inelegibilidade | null;
  protected abstract get exigenciaDeComprovacao(): string;
}

export class CriterioDomicilio extends CriterioDeEndereco {
  constructor() {
    super("domicilio");
  }

  protected conferirEndereco(cidadao: Cidadao): Inelegibilidade | null {
    return cidadao.informouEndereco ? null : this.recusar("fora_do_publico", "Esta consulta é destinada a quem mora no município.", { label: "Atualizar endereço", href: "/conta/perfil/editar" });
  }

  protected get exigenciaDeComprovacao(): string {
    return "Esta consulta exige comprovação de domicílio no município.";
  }
}

export class CriterioTerritorio extends CriterioDeEndereco {
  readonly #bairros: readonly string[];
  readonly #regioes: readonly string[];

  constructor(bairros: readonly string[], regioes: readonly string[]) {
    super("territorio");
    this.#bairros = [...bairros];
    this.#regioes = [...regioes];
  }

  protected conferirEndereco(cidadao: Cidadao): Inelegibilidade | null {
    return cidadao.moraEmAlgum(this.#bairros, this.#regioes)
      ? null
      : this.recusar("fora_do_publico", "Esta consulta é destinada a moradores de bairros ou regiões específicos, e seu endereço não está entre eles.");
  }

  protected get exigenciaDeComprovacao(): string {
    return "Esta consulta exige comprovação de domicílio no território.";
  }
}

/** Faixa etária justificada pela consulta (RN40). Só restringe mais: os 18 anos da plataforma valem sempre. */
export class CriterioFaixaEtaria extends CriterioPublicoAlvo {
  readonly #idadeMinima: number | undefined;
  readonly #idadeMaxima: number | undefined;

  constructor(idadeMinima?: number, idadeMaxima?: number) {
    super("faixa_etaria");
    this.#idadeMinima = idadeMinima;
    this.#idadeMaxima = idadeMaxima;
  }

  avaliar(cidadao: Cidadao, agora: Date): Inelegibilidade | null {
    const idade = cidadao.idadeEm(agora);
    if (idade === null) return this.recusar("fora_do_publico", "Não foi possível conferir sua idade.");
    if ((this.#idadeMinima !== undefined && idade < this.#idadeMinima) || (this.#idadeMaxima !== undefined && idade > this.#idadeMaxima)) {
      return this.recusar("fora_do_publico", "Esta consulta é destinada a uma faixa etária específica, e você não se enquadra nela.");
    }
    return null;
  }
}

/** Critério "outro": descrição publicada com a consulta, não verificada automaticamente (PENDENCIAS_CLIENTE). */
export class CriterioInformativo extends CriterioPublicoAlvo {
  constructor(tipo = "outro") {
    super(tipo);
  }

  avaliar(): Inelegibilidade | null {
    return null;
  }
}
