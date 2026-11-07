/**
 * Catálogo de permissões e papéis (RF009, RF047, RF061). Compartilhado com a interface
 * apenas para rótulos — a verificação SEMPRE acontece no servidor.
 */
export const PERMISSIONS = {
  "usuarios.gerenciar": "Gerenciar usuários e contas administrativas",
  "papeis.gerenciar": "Gerenciar papéis e permissões",
  "responsaveis.designar": "Designar responsáveis por consulta",
  "auditoria.consultar": "Consultar e verificar a trilha de auditoria",
  "incidentes.tratar": "Tratar inconsistências e incidentes",
  "configuracoes.gerenciar": "Alterar parâmetros do sistema",
  "propostas_municipais.gerenciar": "Cadastrar e editar propostas municipais",
  "consultas.elaborar": "Elaborar consultas",
  "consultas.revisar": "Revisar consultas",
  "consultas.aprovar": "Aprovar ou rejeitar consultas",
  "consultas.autorizar_prazo": "Autorizar prazo excepcional",
  "consultas.conduzir": "Conduzir consultas (publicar, alterar, suspender, cancelar)",
  "consultas.divulgar": "Divulgar consultas",
  "consultas.acompanhar": "Acompanhar consultas em andamento",
  "resultados.publicar": "Homologar e publicar resultados",
  "encaminhamentos.registrar": "Registrar encaminhamentos",
  "propostas_cidadas.analisar": "Analisar e responder propostas cidadãs",
  "moderacao.moderar": "Moderar conteúdo denunciado",
  "identidade.analisar": "Analisar documentos de verificação de identidade",
  "atendimento.registrar": "Atendimento assistido (perguntas por telefone)",
  "relatorios.gerar": "Gerar relatórios e estatísticas",
  "eventos.gerenciar": "Gerenciar eventos participativos",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Combinações vedadas dentro de um mesmo papel (RN20 — segregação de funções). */
export const FORBIDDEN_COMBINATIONS: [Permission, Permission, string][] = [
  ["consultas.elaborar", "consultas.aprovar", "quem elabora não aprova"],
  ["consultas.revisar", "consultas.aprovar", "quem revisa não aprova"],
];

export const CONSULTATION_ROLES = {
  responsavel: { label: "Responsável pela condução", permission: "consultas.conduzir", required: true },
  elaborador: { label: "Elaboração", permission: "consultas.elaborar", required: true },
  revisor: { label: "Revisão", permission: "consultas.revisar", required: true },
  aprovador: { label: "Aprovação", permission: "consultas.aprovar", required: true },
  autorizador_prazo: { label: "Autorização de prazo excepcional", permission: "consultas.autorizar_prazo", required: false },
  divulgacao: { label: "Divulgação", permission: "consultas.divulgar", required: false },
  acompanhamento: { label: "Acompanhamento", permission: "consultas.acompanhar", required: false },
  publicacao_resultados: { label: "Publicação de resultados", permission: "resultados.publicar", required: false },
  encaminhamentos: { label: "Encaminhamentos", permission: "encaminhamentos.registrar", required: false },
} as const satisfies Record<string, { label: string; permission: Permission; required: boolean }>;

export type ConsultationRole = keyof typeof CONSULTATION_ROLES;
export const CONSULTATION_ROLE_KEYS = Object.keys(CONSULTATION_ROLES) as ConsultationRole[];

/** Papéis por consulta que não podem ser acumulados com "aprovador" pela mesma conta (RF061, RN20). */
export const CONFLICTS_WITH_APPROVER: ConsultationRole[] = ["elaborador", "revisor"];
