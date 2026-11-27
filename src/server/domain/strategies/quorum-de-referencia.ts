/**
 * Quórum de referência da consulta (RN17, RF042), adotado ou não na criação da consulta (RF025).
 * Comparecimento (participações) frente a um número absoluto ou a um percentual dos elegíveis
 * estimados no retrato da abertura. É indicador descritivo: não muda a natureza consultiva (RN34).
 *
 * Polimorfismo: a apuração pergunta "quantas participações eram necessárias?" e "foi atingido?"
 * sem saber qual quórum a consulta adotou; cada subclasse responde do seu jeito.
 */
export abstract class QuorumDeReferencia {
  protected constructor(
    readonly tipo: string,
    readonly valor: string | null,
  ) {}

  /** Fábrica a partir do que está gravado na consulta (`quorum_type`, `quorum_value`). */
  static criar(tipo: string, valor: string | null): QuorumDeReferencia {
    switch (tipo) {
      case "absoluto":
        return new QuorumAbsoluto(valor);
      case "percentual":
        return new QuorumPercentual(valor);
      default:
        return new SemQuorum(tipo, valor);
    }
  }

  /** Participações necessárias; null quando não há quórum ou não é possível calcular. */
  abstract participacoesNecessarias(elegiveisEstimados: number | null): number | null;

  /** true/false conforme o comparecimento; null quando não se aplica ou não é possível calcular. */
  foiAtingido(participacoes: number, elegiveisEstimados: number | null): boolean | null {
    const necessarias = this.participacoesNecessarias(elegiveisEstimados);
    return necessarias === null ? null : participacoes >= necessarias;
  }
}

/** Consulta sem quórum de referência (padrão). */
export class SemQuorum extends QuorumDeReferencia {
  constructor(tipo = "nenhum", valor: string | null = null) {
    super(tipo, valor);
  }

  participacoesNecessarias(): number | null {
    return null;
  }

  foiAtingido(): boolean | null {
    return null;
  }
}

/** Número mínimo de participações (ex.: 500). */
export class QuorumAbsoluto extends QuorumDeReferencia {
  constructor(valor: string | null) {
    super("absoluto", valor);
  }

  participacoesNecessarias(): number | null {
    return this.valor ? Math.ceil(Number(this.valor)) : null;
  }
}

/** Percentual dos elegíveis estimados na abertura (ex.: 10%). Sem a estimativa, não há como calcular. */
export class QuorumPercentual extends QuorumDeReferencia {
  constructor(valor: string | null) {
    super("percentual", valor);
  }

  participacoesNecessarias(elegiveisEstimados: number | null): number | null {
    return this.valor && elegiveisEstimados ? Math.ceil((Number(this.valor) / 100) * elegiveisEstimados) : null;
  }
}
