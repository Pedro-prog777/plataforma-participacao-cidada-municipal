/**
 * Contrato do resultado da verificação de elegibilidade (RF036). O formato (`eligible`, `code`,
 * `reason`, `action`) é o que as telas já usam para mostrar o motivo e a ação possível.
 */
export type AcaoSugerida = { label: string; href: string };

export type Inelegibilidade = { eligible: false; code: string; reason: string; action?: AcaoSugerida };

export type ResultadoElegibilidade = { eligible: true } | Inelegibilidade;
