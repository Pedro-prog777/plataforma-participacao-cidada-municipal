/** Rótulos em linguagem simples (RNF02) compartilhados entre servidor e interface. */

export const CONSULTATION_STATUS = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_revisao: { label: "Aguardando revisão", tone: "info" },
  em_analise: { label: "Em análise", tone: "info" },
  rejeitada: { label: "Rejeitada", tone: "danger" },
  aprovada: { label: "Aprovada — aguardando publicação", tone: "info" },
  agendada: { label: "Agendada", tone: "info" },
  aberta: { label: "Aberta", tone: "success" },
  suspensa: { label: "Suspensa", tone: "warning" },
  encerrada: { label: "Encerrada — contando os votos", tone: "neutral" },
  apurada: { label: "Votos contados — resultado em conferência", tone: "neutral" },
  finalizada: { label: "Resultado publicado", tone: "primary" },
  cancelada: { label: "Cancelada", tone: "danger" },
} as const;
export type ConsultationStatus = keyof typeof CONSULTATION_STATUS;

/** Situações visíveis ao público (RF016: Rascunho, Em análise e Rejeitada nunca aparecem). */
export const PUBLIC_STATUSES: ConsultationStatus[] = ["agendada", "aberta", "suspensa", "encerrada", "apurada", "finalizada", "cancelada"];
export const ARCHIVE_STATUSES: ConsultationStatus[] = ["finalizada", "cancelada"];

export const CITIZEN_PROPOSAL_STATUS = {
  recebida: { label: "Recebida", tone: "info" },
  em_analise: { label: "Em análise", tone: "info" },
  ajuste_solicitado: { label: "Ajuste solicitado", tone: "warning" },
  respondida: { label: "Respondida", tone: "primary" },
  publicada: { label: "Publicada", tone: "success" },
  encerrada: { label: "Encerrada", tone: "neutral" },
} as const;

export const PROPOSAL_RESPONSE = {
  convertida: "Convertida em proposta municipal",
  encaminhada: "Encaminhada a outro órgão",
  nao_acolhida: "Não acolhida",
} as const;

export const OUTCOME_STATUS = {
  prevista: { label: "Prevista", tone: "info" },
  em_andamento: { label: "Em andamento", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  nao_realizada: { label: "Não realizada", tone: "danger" },
} as const;

export const VERIFICATION_LEVEL = {
  nao_verificado: { label: "Não verificado", tone: "warning" },
  em_analise: { label: "Em análise", tone: "info" },
  verificado: { label: "Verificado", tone: "success" },
  recusado: { label: "Verificação recusada", tone: "danger" },
} as const;

export const ACCOUNT_STATUS = {
  pendente: { label: "Pendente de confirmação", tone: "warning" },
  ativa: { label: "Ativa", tone: "success" },
  bloqueada: { label: "Bloqueada", tone: "danger" },
  desativada: { label: "Desativada", tone: "neutral" },
} as const;

export const REPORT_REASONS = {
  conteudo_ilegal: "Conteúdo ilegal",
  discurso_odio: "Discurso de ódio",
  dados_pessoais: "Dados pessoais expostos",
  ofensa: "Ofensa",
  propaganda: "Propaganda",
  outro: "Outro",
} as const;
/** Prioridade da fila de moderação por motivo (RF066). */
export const REPORT_PRIORITY: Record<string, number> = { conteudo_ilegal: 1, discurso_odio: 2, dados_pessoais: 3, ofensa: 4, propaganda: 5, outro: 6 };

export const PARTICIPATION_FORMS = {
  votacao: "Votação consultiva",
} as const;

export const YOUTH_MODALITIES = {
  informativa: "Informativa",
  educativa: "Educativa",
  proposta: "Envio de propostas",
  // Mantido só para exibir registros antigos: só vota quem tem 18 anos completos (RF036, DT-30).
  voto: "Voto (somente para quem tem 18 anos completos)",
} as const;

/** Modalidades que podem ser escolhidas para crianças e adolescentes (RN40); "voto" não, pelo RF036 (DT-30). */
export const YOUTH_MODALITIES_PERMITIDAS = ["informativa", "educativa", "proposta"] as const;

export const AUDIENCE_TYPES = {
  domicilio: "Domicílio no município",
  territorio: "Território (bairros ou regiões)",
  faixa_etaria: "Faixa etária",
  outro: "Outro critério (informativo)",
} as const;

export const DISSEMINATION_CHANNELS = {
  portal: "Portal institucional",
  redes: "Redes sociais oficiais",
  impresso: "Avisos impressos",
  radio: "Rádio",
  outro: "Outro",
} as const;

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00-03:00`) : new Date(d);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(date);
}

export function fmtLongDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
}

/** Converte valor de <input type="datetime-local"> (horário de Brasília) para Date. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → valor para <input type="datetime-local"> em horário de Brasília. */
export function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const s = new Date(d.getTime() - 3 * 3600_000).toISOString();
  return s.slice(0, 16);
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}
