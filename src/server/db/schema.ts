/**
 * Modelo de dados da PPCM (PostgreSQL). Documentado em docs/arquitetura/MODELO_DE_DADOS.md.
 *
 * INVARIANTE DE SIGILO (RN07, RS002, RNF07):
 *  - `participations` guarda QUEM participou (cidadão + consulta + DATA, sem hora) e o hash do comprovante.
 *  - `votes` guarda O QUE foi escolhido (consulta + alternativa) SEM cidadão, SEM comprovante e SEM horário.
 *  - Não existe chave, coluna, índice ou sequência que ligue uma participação a um voto.
 *  - `votes.id` é UUID aleatório e `shuffle_key` permite reordenar fisicamente a tabela (CLUSTER).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = () => timestamp({ withTimezone: true, mode: "date" });
const tsRequired = () => timestamp({ withTimezone: true, mode: "date" }).notNull();
const createdAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Enumerações                                                          */
/* ------------------------------------------------------------------ */
export const userKind = pgEnum("user_kind", ["cidadao", "admin"]);
export const accountStatus = pgEnum("account_status", ["pendente", "ativa", "bloqueada", "desativada"]);
export const verificationLevel = pgEnum("verification_level", ["nao_verificado", "em_analise", "verificado", "recusado"]);
export const consultationStatus = pgEnum("consultation_status", [
  "rascunho",
  "em_revisao",
  "em_analise",
  "rejeitada",
  "aprovada",
  "agendada",
  "aberta",
  "suspensa",
  "encerrada",
  "apurada",
  "finalizada",
  "cancelada",
]);
export const consultationRole = pgEnum("consultation_role", [
  "responsavel",
  "elaborador",
  "revisor",
  "aprovador",
  "autorizador_prazo",
  "divulgacao",
  "acompanhamento",
  "publicacao_resultados",
  "encaminhamentos",
]);
export const citizenProposalStatus = pgEnum("citizen_proposal_status", [
  "recebida",
  "em_analise",
  "ajuste_solicitado",
  "respondida",
  "publicada",
  "encerrada",
]);
export const outcomeStatus = pgEnum("outcome_status", ["prevista", "em_andamento", "concluida", "nao_realizada"]);

/* ------------------------------------------------------------------ */
/* Cadastros de apoio                                                  */
/* ------------------------------------------------------------------ */
export const regions = pgTable("regions", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
});

export const districts = pgTable("districts", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  regionId: uuid().notNull().references(() => regions.id),
});

export const themes = pgTable("themes", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
});

export const organs = pgTable("organs", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  acronym: text().notNull(),
});

/** Parâmetros configuráveis sem alterar código (RNF12) e chaves de recursos condicionados (*). */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid(),
  updatedAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Contas, sessões e tokens (RF001–RF011, RF046)                       */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: userKind().notNull(),
    fullName: text().notNull(),
    socialName: text(),
    email: text().notNull(),
    pendingEmail: text(),
    emailVerifiedAt: ts(),
    /** HMAC-SHA256(CPF) com chave fora do banco — unicidade sem CPF puro (RN02, RN33). */
    cpfHmac: text(),
    /** Apenas a forma mascarada é guardada para exibição (RN27). */
    cpfMasked: text(),
    birthDate: date({ mode: "string" }),
    phone: text(),
    cep: text(),
    street: text(),
    number: text(),
    complement: text(),
    districtId: uuid().references(() => districts.id),
    /** Preenchido quando o cidadão declara residir fora do município (RF002). */
    externalCity: text(),
    domicileVerifiedAt: ts(),
    passwordHash: text().notNull(),
    status: accountStatus().notNull().default("pendente"),
    verificationLevel: verificationLevel().notNull().default("nao_verificado"),
    verificationMethod: text(),
    verifiedAt: ts(),
    termsVersion: text(),
    termsAcceptedAt: ts(),
    failedLoginCount: integer().notNull().default(0),
    lockedUntil: ts(),
    // Contas administrativas
    registration: text(),
    organId: uuid().references(() => organs.id),
    mfaSecretEnc: text(),
    mfaEnabledAt: ts(),
    lastLoginAt: ts(),
    deactivatedAt: ts(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_cpf_hmac_uq").on(t.cpfHmac),
    uniqueIndex("users_kind_email_uq").on(t.kind, t.email),
    uniqueIndex("users_registration_uq").on(t.registration),
    check("users_admin_no_cpf", sql`${t.kind} = 'cidadao' OR ${t.cpfHmac} IS NULL`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 do token do cookie — o token em si nunca é gravado. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    mfaVerified: boolean().notNull().default(false),
    createdAt: createdAt(),
    lastActivityAt: createdAt(),
    expiresAt: tsRequired(),
    revokedAt: ts(),
    ipHash: text(),
    userAgent: text(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Tokens de uso único: confirmação de e-mail, recuperação de senha, convite, troca de e-mail. */
export const tokens = pgTable(
  "tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    purpose: text().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: tsRequired(),
    usedAt: ts(),
    meta: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("tokens_user_purpose_idx").on(t.userId, t.purpose)],
);

/** Códigos curtos (6 dígitos) — confirmação de identidade antes do voto (RF011). */
export const oneTimeCodes = pgTable(
  "one_time_codes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    purpose: text().notNull(),
    scope: text(),
    codeHash: text().notNull(),
    channel: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: tsRequired(),
    consumedAt: ts(),
    createdAt: createdAt(),
  },
  // Consultado a cada pedido e confirmação de voto (DT-23: índice para todo filtro).
  (t) => [index("one_time_codes_user_scope_idx").on(t.userId, t.purpose, t.scope)],
);

/** Falhas de autenticação por conta e por IP (RF010, RN24). IP guardado como hash. */
export const authFailures = pgTable(
  "auth_failures",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid(),
    ipHash: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_failures_ip_idx").on(t.ipHash, t.createdAt)],
);

export const roles = pgTable("roles", {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  permissions: text().array().notNull().default(sql`'{}'::text[]`),
  system: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    assignedBy: uuid(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/** Pedidos de verificação de identidade/domicílio (RF004). */
export const identityVerifications = pgTable("identity_verifications", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  method: text().notNull(), // govbr | documental
  status: text().notNull(), // em_analise | aprovada | recusada
  govbrLevel: text(),
  includesAddressProof: boolean().notNull().default(false),
  /** Correção de nome civil / nascimento solicitada com documentos (RF013). */
  requestedChanges: jsonb().$type<{ fullName?: string; birthDate?: string }>(),
  reason: text(),
  reviewerId: uuid().references(() => users.id),
  createdAt: createdAt(),
  decidedAt: ts(),
});

/* ------------------------------------------------------------------ */
/* Propostas municipais e consultas (RF022–RF035, RF061)               */
/* ------------------------------------------------------------------ */
export const municipalProposals = pgTable("municipal_proposals", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  summary: text().notNull().default(""),
  description: text().notNull().default(""),
  justification: text().notNull().default(""),
  objectives: text().notNull().default(""),
  themeId: uuid().references(() => themes.id),
  scope: text().notNull().default(""),
  organId: uuid().references(() => organs.id),
  estimatedCost: numeric({ precision: 14, scale: 2 }),
  fundingSource: text(),
  executionDeadline: text(),
  status: text().notNull().default("rascunho"), // rascunho | em_analise | em_consulta | rejeitada
  originCitizenProposalId: uuid(),
  version: integer().notNull().default(1),
  createdBy: uuid()
    .notNull()
    .references(() => users.id),
  lastEditedBy: uuid().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const consultations = pgTable(
  "consultations",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    municipalProposalId: uuid()
      .notNull()
      .references(() => municipalProposals.id),
    title: text().notNull(),
    summary: text().notNull().default(""),
    themeId: uuid().references(() => themes.id),
    regionId: uuid().references(() => regions.id),
    organId: uuid().references(() => organs.id),
    problem: text().notNull().default(""),
    objective: text().notNull().default(""),
    justification: text().notNull().default(""),
    participationForm: text().notNull().default("votacao"),
    question: text().notNull().default(""),
    guidance: text().notNull().default(""),
    opensAt: ts(),
    closesAt: ts(),
    exceptionalDeadline: boolean().notNull().default(false),
    emergencyJustification: text(),
    deadlineAuthorization: text().notNull().default("nao_aplicavel"), // nao_aplicavel | pendente | autorizada | negada
    deadlineDecisionJustification: text(),
    deadlineAuthorizedBy: uuid().references(() => users.id),
    countingRule: text().notNull().default("maioria_simples"),
    quorumType: text().notNull().default("nenhum"), // nenhum | absoluto | percentual
    quorumValue: numeric({ precision: 10, scale: 2 }),
    allowAbstention: boolean().notNull().default(false),
    nextSteps: text().notNull().default(""),
    ownRite: boolean().notNull().default(false),
    ownRiteConfirmed: boolean().notNull().default(false),
    audienceOpen: boolean().notNull().default(false),
    youthModality: text(), // informativa | educativa | proposta | voto
    youthSafeguards: text(),
    estimatedEligible: integer(),
    status: consultationStatus().notNull().default("rascunho"),
    statusBeforeSuspension: consultationStatus(),
    statusReason: text(),
    reviewObservations: text(),
    version: integer().notNull().default(1),
    frozenVersion: integer(),
    approvedBy: uuid().references(() => users.id),
    approvedAt: ts(),
    publishedAt: ts(),
    openedAt: ts(),
    closedAt: ts(),
    openSnapshot: jsonb().$type<Record<string, unknown>>(),
    commentsEnabled: boolean().notNull().default(false),
    lastShuffledAt: ts(),
    /** Texto normalizado (minúsculas, sem acentos) para busca (RF017). */
    searchText: text().notNull().default(""),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    lastEditedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [
    index("consultations_status_idx").on(t.status, t.closesAt),
    check("consultations_question_len", sql`char_length(${t.question}) <= 300`),
  ],
);

export const alternatives = pgTable(
  "alternatives",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    label: text().notNull(),
    explanation: text().notNull().default(""),
    position: integer().notNull(),
  },
  (t) => [uniqueIndex("alternatives_label_uq").on(t.consultationId, sql`lower(${t.label})`)],
);

/** Limitações de público-alvo (RF027). Sem linhas + audienceOpen=true = aberta ao público em geral. */
export const audienceCriteria = pgTable(
  "audience_criteria",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    type: text().notNull(), // domicilio | territorio | faixa_etaria | outro
    params: jsonb()
      .$type<{ districtIds?: string[]; regionIds?: string[]; minAge?: number; maxAge?: number; description?: string }>()
      .notNull()
      .default({}),
    justification: text().notNull(),
    publicText: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audience_criteria_consultation_idx").on(t.consultationId)],
);

export const consultationAssignments = pgTable(
  "consultation_assignments",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: consultationRole().notNull(),
    active: boolean().notNull().default(true),
    justification: text(),
    assignedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
    endedAt: ts(),
  },
  (t) => [
    uniqueIndex("assignments_active_uq")
      .on(t.consultationId, t.role, t.userId)
      .where(sql`${t.active} = true`),
  ],
);

export const reviewChecklists = pgTable("review_checklists", {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid()
    .notNull()
    .references(() => consultations.id),
  reviewerId: uuid()
    .notNull()
    .references(() => users.id),
  version: integer().notNull(),
  items: jsonb().$type<Record<string, boolean>>().notNull(),
  outcome: text().notNull(), // aprovada | problema
  observations: text(),
  createdAt: createdAt(),
});

/** Versões de propostas e consultas (RF024, RF032). Somente acréscimo. */
export const entityVersions = pgTable(
  "entity_versions",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    version: integer().notNull(),
    data: jsonb().notNull(),
    reason: text(),
    authorId: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("entity_versions_idx").on(t.entityType, t.entityId, t.version)],
);

/** Linha do tempo pública (RF051). Somente acréscimo (gatilho). */
export const consultationEvents = pgTable(
  "consultation_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    type: text().notNull(),
    description: text().notNull(),
    justification: text(),
    unitName: text(),
    details: jsonb().$type<Record<string, unknown>>(),
    occurredAt: createdAt(),
  },
  (t) => [index("consultation_events_idx").on(t.consultationId, t.occurredAt)],
);

/* ------------------------------------------------------------------ */
/* Participação e votos (RF036–RF041) — SEM VÍNCULO ENTRE AS TABELAS   */
/* ------------------------------------------------------------------ */
export const participations = pgTable(
  "participations",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    citizenId: uuid()
      .notNull()
      .references(() => users.id),
    /** Apenas a data (sem hora), para não permitir correlação temporal com o voto. */
    participatedOn: date({ mode: "string" }).notNull(),
    /** SHA-256 do código do comprovante (12 caracteres) — usado na verificação pública (RF041). */
    receiptHash: text().notNull(),
    /** Código cifrado (AES-256-GCM) para o titular rever o comprovante (RF014). Não revela a alternativa. */
    receiptEnc: text().notNull(),
  },
  (t) => [
    // RN05 / RF039 / RS001: unicidade do par cidadão–consulta no banco.
    uniqueIndex("participations_citizen_consultation_uq").on(t.consultationId, t.citizenId),
    uniqueIndex("participations_receipt_uq").on(t.receiptHash),
    // "Minhas participações" e marcação "você já participou" nas listagens.
    index("participations_citizen_idx").on(t.citizenId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    alternativeId: uuid().references(() => alternatives.id),
    abstention: boolean().notNull().default(false),
    shuffleKey: uuid().notNull().defaultRandom(),
  },
  (t) => [
    index("votes_consultation_idx").on(t.consultationId),
    index("votes_shuffle_idx").on(t.shuffleKey),
    check("votes_choice", sql`(${t.abstention} = true AND ${t.alternativeId} IS NULL) OR (${t.abstention} = false AND ${t.alternativeId} IS NOT NULL)`),
  ],
);

/* ------------------------------------------------------------------ */
/* Resultados, integridade e encaminhamentos (RF042–RF045, RF059, RF063)*/
/* ------------------------------------------------------------------ */
export const results = pgTable(
  "results",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    kind: text().notNull(), // preliminar | final | retificacao
    data: jsonb().$type<ResultData>().notNull(),
    hash: text().notNull(),
    baseHash: text().notNull(),
    note: text(),
    justification: text(),
    rectifiesId: uuid(),
    createdBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("results_consultation_idx").on(t.consultationId, t.createdAt)],
);

export type ResultData = {
  countingRule: string;
  alternatives: { id: string; label: string; votes: number; percentage: string }[];
  validVotes: number;
  abstentions: number;
  totalVotes: number;
  participations: number;
  estimatedEligible: number | null;
  participationRate: string | null;
  quorum: { type: string; value: string | null; required: number | null; met: boolean | null };
  winnerId: string | null;
  condition: "vencedora" | "empate" | "sem_votos" | "abaixo_quorum";
  computedAt: string;
};

export const integrityChecks = pgTable("integrity_checks", {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid()
    .notNull()
    .references(() => consultations.id),
  stage: text().notNull(), // encerramento | apuracao | sob_demanda | publicacao
  passed: boolean().notNull(),
  report: jsonb().$type<{ check: string; ok: boolean; detail: string }[]>().notNull(),
  createdAt: createdAt(),
});

export const incidents = pgTable(
  "incidents",
  {
    id: uuid().primaryKey().defaultRandom(),
    severity: text().notNull(), // baixa | media | alta
    type: text().notNull(),
    consultationId: uuid().references(() => consultations.id),
    description: text().notNull(),
    evidence: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: text().notNull().default("aberto"), // aberto | em_analise | encerrado
    suggestion: text(),
    conclusion: text(),
    closedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
    closedAt: ts(),
  },
  (t) => [index("incidents_consultation_idx").on(t.consultationId, t.status)],
);

export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id),
    decision: text().notNull(),
    actions: text().notNull(),
    organId: uuid()
      .notNull()
      .references(() => organs.id),
    createdBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("outcomes_consultation_idx").on(t.consultationId)],
);

/** Cada mudança de situação de um encaminhamento é uma nova linha (somente acréscimo). */
export const outcomeEntries = pgTable(
  "outcome_entries",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    outcomeId: uuid()
      .notNull()
      .references(() => outcomes.id),
    status: outcomeStatus().notNull(),
    justification: text(),
    expectedDate: date({ mode: "string" }),
    createdBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("outcome_entries_outcome_idx").on(t.outcomeId)],
);

/* ------------------------------------------------------------------ */
/* Propostas cidadãs (RF020, RF021, RF067)                             */
/* ------------------------------------------------------------------ */
export const citizenProposals = pgTable(
  "citizen_proposals",
  {
    id: uuid().primaryKey().defaultRandom(),
    protocol: text().notNull().unique(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    title: text().notNull(),
    problem: text().notNull(),
    solution: text().notNull(),
    themeId: uuid()
      .notNull()
      .references(() => themes.id),
    districtId: uuid()
      .notNull()
      .references(() => districts.id),
    authorizePublication: boolean().notNull(),
    status: citizenProposalStatus().notNull().default("recebida"),
    responseType: text(), // convertida | encaminhada | nao_acolhida
    responseText: text(),
    adjustmentGuidance: text(),
    adjustmentDeadline: ts(),
    municipalProposalId: uuid().references(() => municipalProposals.id),
    hidden: boolean().notNull().default(false),
    priority: boolean().notNull().default(false),
    searchText: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: createdAt(),
    publishedAt: ts(),
  },
  (t) => [check("citizen_proposals_title_len", sql`char_length(${t.title}) <= 120`), index("citizen_proposals_status_idx").on(t.status), index("citizen_proposals_author_idx").on(t.authorId)],
);

export const citizenProposalEvents = pgTable("citizen_proposal_events", {
  id: bigserial({ mode: "number" }).primaryKey(),
  proposalId: uuid()
    .notNull()
    .references(() => citizenProposals.id),
  status: citizenProposalStatus().notNull(),
  note: text(),
  actorId: uuid().references(() => users.id),
  createdAt: createdAt(),
});

export const proposalSupports = pgTable(
  "proposal_supports",
  {
    proposalId: uuid()
      .notNull()
      .references(() => citizenProposals.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.userId] })],
);

/* ------------------------------------------------------------------ */
/* Anexos (RF023)                                                      */
/* ------------------------------------------------------------------ */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerType: text().notNull(), // municipal_proposal | consultation | citizen_proposal | identity | event
    ownerId: uuid().notNull(),
    kind: text().notNull(), // arquivo | link
    mediaType: text().notNull(), // documento | imagem | audio | video | link
    title: text().notNull(),
    filename: text(),
    mime: text(),
    sizeBytes: integer(),
    sha256: text(),
    storagePath: text(),
    url: text(),
    altText: text(),
    transcript: text(),
    captionsUrl: text(),
    addedAfterPublication: boolean().notNull().default(false),
    justification: text(),
    linkStatus: text(),
    createdBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_owner_idx").on(t.ownerType, t.ownerId)],
);

/* ------------------------------------------------------------------ */
/* Notificações (RF052–RF055)                                          */
/* ------------------------------------------------------------------ */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    type: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    mandatory: boolean().notNull().default(false),
    readAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    // Contador de avisos não lidos, consultado em toda página de quem está autenticado.
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id),
  types: jsonb().$type<Record<string, { email: boolean; inApp: boolean }>>().notNull().default({}),
  themeIds: text().array().notNull().default(sql`'{}'::text[]`),
  districtIds: text().array().notNull().default(sql`'{}'::text[]`),
  updatedAt: createdAt(),
});

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    toAddress: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().notNull().default("pendente"), // pendente | enviado | simulado (sem SMTP, DT-32) | falhou
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: createdAt(),
    sentAt: ts(),
  },
  // Fila de envio lida pela rotina a cada minuto.
  (t) => [index("email_outbox_pending_idx").on(t.status, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Auditoria (RF057, RF058) — somente acréscimo, encadeada por hash    */
/* ------------------------------------------------------------------ */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    occurredAt: createdAt(),
    actorId: uuid(),
    actorRole: text(),
    action: text().notNull(),
    objectType: text(),
    objectId: text(),
    result: text().notNull(), // sucesso | negado | falha
    justification: text(),
    details: jsonb().$type<Record<string, unknown>>(),
    prevHash: text().notNull(),
    hash: text().notNull(),
  },
  (t) => [
    index("audit_log_action_idx").on(t.action, t.occurredAt),
    index("audit_log_actor_idx").on(t.actorId),
    // Histórico por objeto (usuário, consulta) e tentativas recusadas por consulta no monitoramento.
    index("audit_log_object_idx").on(t.objectId, t.action),
  ],
);

/* ------------------------------------------------------------------ */
/* Divulgação (RF062)                                                  */
/* ------------------------------------------------------------------ */
export const disseminationRecords = pgTable("dissemination_records", {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid()
    .notNull()
    .references(() => consultations.id),
  channel: text().notNull(),
  usedOn: date({ mode: "string" }).notNull(),
  notes: text(),
  createdBy: uuid().references(() => users.id),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Comentários, denúncias e moderação (RF064–RF066)                    */
/* ------------------------------------------------------------------ */
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    targetType: text().notNull(), // consultation | citizen_proposal
    targetId: uuid().notNull(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    displayName: text().notNull(),
    kind: text().notNull(), // comentario | pergunta | resposta_oficial
    parentId: uuid(),
    body: text().notNull(),
    status: text().notNull().default("publicado"), // pendente | publicado | oculto | removido
    flagged: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("comments_target_idx").on(t.targetType, t.targetId), check("comments_len", sql`char_length(${t.body}) <= 1000`)],
);

export const commentHelpful = pgTable(
  "comment_helpful",
  {
    commentId: uuid()
      .notNull()
      .references(() => comments.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    protocol: text().notNull().unique(),
    targetType: text().notNull(), // comment | citizen_proposal
    targetId: uuid().notNull(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id),
    reason: text().notNull(),
    details: text(),
    status: text().notNull().default("pendente"), // pendente | decidida
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("content_reports_once_uq").on(t.targetType, t.targetId, t.reporterId)],
);

export const moderationDecisions = pgTable("moderation_decisions", {
  id: uuid().primaryKey().defaultRandom(),
  targetType: text().notNull(),
  targetId: uuid().notNull(),
  decision: text().notNull(), // manter | ocultar_trecho | remover
  redactedText: text(),
  justification: text().notNull(),
  moderatorId: uuid()
    .notNull()
    .references(() => users.id),
  isReview: boolean().notNull().default(false),
  reviewRequestedAt: ts(),
  reviewRequestReason: text(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Eventos participativos (RF068) — condicionado à validação (*)       */
/* ------------------------------------------------------------------ */
export const participatoryEvents = pgTable("participatory_events", {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid()
    .notNull()
    .references(() => consultations.id),
  kind: text().notNull(), // audiencia | reuniao | debate
  title: text().notNull(),
  agenda: text().notNull(),
  startsAt: tsRequired(),
  location: text().notNull(),
  streamUrl: text(),
  recordingUrl: text(),
  minutes: text(),
  summary: text(),
  status: text().notNull().default("agendado"), // agendado | realizado | transmissao_indisponivel
  createdBy: uuid().references(() => users.id),
  createdAt: createdAt(),
});

export const eventQuestions = pgTable("event_questions", {
  id: uuid().primaryKey().defaultRandom(),
  eventId: uuid()
    .notNull()
    .references(() => participatoryEvents.id),
  authorId: uuid().references(() => users.id),
  channel: text().notNull(), // antecipada | ao_vivo | telefone
  protocol: text().notNull().unique(),
  body: text().notNull(),
  registeredBy: uuid().references(() => users.id),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* LGPD — cópia dos dados (RF015)                                      */
/* ------------------------------------------------------------------ */
export const dataExports = pgTable("data_exports", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  format: text().notNull(),
  content: text().notNull(),
  expiresAt: tsRequired(),
  createdAt: createdAt(),
});
