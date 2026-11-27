-- PPCM — Plataforma de Participação Cidadã Municipal — ESTRUTURA DO BANCO (PostgreSQL 16)
-- Gerado por `npm run db:sql` a partir de database/migrations (não edite à mão).
-- Inclui: tipos ENUM, 44 tabelas com chaves primárias, estrangeiras, UNIQUE e CHECK, índices,
-- funções e gatilhos (registros somente de acréscimo, updated_at), a view vw_consultas_publicas
-- e as contas ppcm_app, ppcm_relatorios e ppcm_auditoria com GRANT/REVOKE.
--
-- Uso (banco vazio): psql -d ppcm --single-transaction -f database/schema.sql
--                    psql -d ppcm -f database/seed-referencia.sql
-- A criação de contas exige usuário com permissão CREATEROLE (o dono padrão do PostgreSQL tem).
-- As contas nascem sem senha; defina-a na implantação: ALTER ROLE ppcm_relatorios PASSWORD '...';
-- A aplicação usa as migrations (npm run db:migrate), que produzem exatamente esta estrutura.

-- ============================================================================
-- 0000_inicial.sql
-- ============================================================================
CREATE TYPE "public"."account_status" AS ENUM('pendente', 'ativa', 'bloqueada', 'desativada');
CREATE TYPE "public"."citizen_proposal_status" AS ENUM('recebida', 'em_analise', 'ajuste_solicitado', 'respondida', 'publicada', 'encerrada');
CREATE TYPE "public"."consultation_role" AS ENUM('responsavel', 'elaborador', 'revisor', 'aprovador', 'autorizador_prazo', 'divulgacao', 'acompanhamento', 'publicacao_resultados', 'encaminhamentos');
CREATE TYPE "public"."consultation_status" AS ENUM('rascunho', 'em_revisao', 'em_analise', 'rejeitada', 'aprovada', 'agendada', 'aberta', 'suspensa', 'encerrada', 'apurada', 'finalizada', 'cancelada');
CREATE TYPE "public"."outcome_status" AS ENUM('prevista', 'em_andamento', 'concluida', 'nao_realizada');
CREATE TYPE "public"."user_kind" AS ENUM('cidadao', 'admin');
CREATE TYPE "public"."verification_level" AS ENUM('nao_verificado', 'em_analise', 'verificado', 'recusado');
CREATE TABLE "alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"label" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL
);

CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"media_type" text NOT NULL,
	"title" text NOT NULL,
	"filename" text,
	"mime" text,
	"size_bytes" integer,
	"sha256" text,
	"storage_path" text,
	"url" text,
	"alt_text" text,
	"transcript" text,
	"captions_url" text,
	"added_after_publication" boolean DEFAULT false NOT NULL,
	"justification" text,
	"link_status" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audience_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"justification" text NOT NULL,
	"public_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"object_type" text,
	"object_id" text,
	"result" text NOT NULL,
	"justification" text,
	"details" jsonb,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);

CREATE TABLE "auth_failures" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "citizen_proposal_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"proposal_id" uuid NOT NULL,
	"status" "citizen_proposal_status" NOT NULL,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "citizen_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" text NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"problem" text NOT NULL,
	"solution" text NOT NULL,
	"theme_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"authorize_publication" boolean NOT NULL,
	"status" "citizen_proposal_status" DEFAULT 'recebida' NOT NULL,
	"response_type" text,
	"response_text" text,
	"adjustment_guidance" text,
	"adjustment_deadline" timestamp with time zone,
	"municipal_proposal_id" uuid,
	"hidden" boolean DEFAULT false NOT NULL,
	"priority" boolean DEFAULT false NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "citizen_proposals_protocol_unique" UNIQUE("protocol"),
	CONSTRAINT "citizen_proposals_title_len" CHECK (char_length("citizen_proposals"."title") <= 120)
);

CREATE TABLE "comment_helpful" (
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "comment_helpful_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);

CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"status" text DEFAULT 'publicado' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_len" CHECK (char_length("comments"."body") <= 1000)
);

CREATE TABLE "consultation_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "consultation_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"justification" text,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);

CREATE TABLE "consultation_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"consultation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"justification" text,
	"unit_name" text,
	"details" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"municipal_proposal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"theme_id" uuid,
	"region_id" uuid,
	"organ_id" uuid,
	"problem" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"participation_form" text DEFAULT 'votacao' NOT NULL,
	"question" text DEFAULT '' NOT NULL,
	"guidance" text DEFAULT '' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"exceptional_deadline" boolean DEFAULT false NOT NULL,
	"emergency_justification" text,
	"deadline_authorization" text DEFAULT 'nao_aplicavel' NOT NULL,
	"deadline_decision_justification" text,
	"deadline_authorized_by" uuid,
	"counting_rule" text DEFAULT 'maioria_simples' NOT NULL,
	"quorum_type" text DEFAULT 'nenhum' NOT NULL,
	"quorum_value" numeric(10, 2),
	"allow_abstention" boolean DEFAULT false NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"own_rite" boolean DEFAULT false NOT NULL,
	"own_rite_confirmed" boolean DEFAULT false NOT NULL,
	"audience_open" boolean DEFAULT false NOT NULL,
	"youth_modality" text,
	"youth_safeguards" text,
	"estimated_eligible" integer,
	"status" "consultation_status" DEFAULT 'rascunho' NOT NULL,
	"status_before_suspension" "consultation_status",
	"status_reason" text,
	"review_observations" text,
	"version" integer DEFAULT 1 NOT NULL,
	"frozen_version" integer,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"open_snapshot" jsonb,
	"comments_enabled" boolean DEFAULT false NOT NULL,
	"last_shuffled_at" timestamp with time zone,
	"search_text" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"last_edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "consultations_question_len" CHECK (char_length("consultations"."question") <= 300)
);

CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_reports_protocol_unique" UNIQUE("protocol")
);

CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"format" text NOT NULL,
	"content" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "dissemination_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"used_on" date NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region_id" uuid NOT NULL,
	CONSTRAINT "districts_name_unique" UNIQUE("name")
);

CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);

CREATE TABLE "entity_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"reason" text,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "event_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"author_id" uuid,
	"channel" text NOT NULL,
	"protocol" text NOT NULL,
	"body" text NOT NULL,
	"registered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_questions_protocol_unique" UNIQUE("protocol")
);

CREATE TABLE "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"govbr_level" text,
	"includes_address_proof" boolean DEFAULT false NOT NULL,
	"requested_changes" jsonb,
	"reason" text,
	"reviewer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);

CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" text NOT NULL,
	"type" text NOT NULL,
	"consultation_id" uuid,
	"description" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"suggestion" text,
	"conclusion" text,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);

CREATE TABLE "integrity_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"passed" boolean NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"redacted_text" text,
	"justification" text NOT NULL,
	"moderator_id" uuid NOT NULL,
	"is_review" boolean DEFAULT false NOT NULL,
	"review_requested_at" timestamp with time zone,
	"review_request_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "municipal_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"theme_id" uuid,
	"scope" text DEFAULT '' NOT NULL,
	"organ_id" uuid,
	"estimated_cost" numeric(14, 2),
	"funding_source" text,
	"execution_deadline" text,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"origin_citizen_proposal_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"last_edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"types" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"district_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"mandatory" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "one_time_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"scope" text,
	"code_hash" text NOT NULL,
	"channel" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "organs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"acronym" text NOT NULL,
	CONSTRAINT "organs_name_unique" UNIQUE("name")
);

CREATE TABLE "outcome_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"outcome_id" uuid NOT NULL,
	"status" "outcome_status" NOT NULL,
	"justification" text,
	"expected_date" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"actions" text NOT NULL,
	"organ_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"citizen_id" uuid NOT NULL,
	"participated_on" date NOT NULL,
	"receipt_hash" text NOT NULL,
	"receipt_enc" text NOT NULL
);

CREATE TABLE "participatory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"agenda" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"stream_url" text,
	"recording_url" text,
	"minutes" text,
	"summary" text,
	"status" text DEFAULT 'agendado' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "proposal_supports" (
	"proposal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_supports_proposal_id_user_id_pk" PRIMARY KEY("proposal_id","user_id")
);

CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "regions_name_unique" UNIQUE("name")
);

CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"hash" text NOT NULL,
	"base_hash" text NOT NULL,
	"note" text,
	"justification" text,
	"rectifies_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "review_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"items" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "themes_name_unique" UNIQUE("name")
);

CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_tokenHash_unique" UNIQUE("token_hash")
);

CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "user_kind" NOT NULL,
	"full_name" text NOT NULL,
	"social_name" text,
	"email" text NOT NULL,
	"pending_email" text,
	"email_verified_at" timestamp with time zone,
	"cpf_hmac" text,
	"cpf_masked" text,
	"birth_date" date,
	"phone" text,
	"cep" text,
	"street" text,
	"number" text,
	"complement" text,
	"district_id" uuid,
	"external_city" text,
	"domicile_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"status" "account_status" DEFAULT 'pendente' NOT NULL,
	"verification_level" "verification_level" DEFAULT 'nao_verificado' NOT NULL,
	"verification_method" text,
	"verified_at" timestamp with time zone,
	"terms_version" text,
	"terms_accepted_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"registration" text,
	"organ_id" uuid,
	"mfa_secret_enc" text,
	"mfa_enabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_admin_no_cpf" CHECK ("users"."kind" = 'cidadao' OR "users"."cpf_hmac" IS NULL)
);

CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"alternative_id" uuid,
	"abstention" boolean DEFAULT false NOT NULL,
	"shuffle_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	CONSTRAINT "votes_choice" CHECK (("votes"."abstention" = true AND "votes"."alternative_id" IS NULL) OR ("votes"."abstention" = false AND "votes"."alternative_id" IS NOT NULL))
);

ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "audience_criteria" ADD CONSTRAINT "audience_criteria_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposal_events" ADD CONSTRAINT "citizen_proposal_events_proposal_id_citizen_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."citizen_proposals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposal_events" ADD CONSTRAINT "citizen_proposal_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposals" ADD CONSTRAINT "citizen_proposals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposals" ADD CONSTRAINT "citizen_proposals_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposals" ADD CONSTRAINT "citizen_proposals_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "citizen_proposals" ADD CONSTRAINT "citizen_proposals_municipal_proposal_id_municipal_proposals_id_fk" FOREIGN KEY ("municipal_proposal_id") REFERENCES "public"."municipal_proposals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comment_helpful" ADD CONSTRAINT "comment_helpful_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comment_helpful" ADD CONSTRAINT "comment_helpful_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultation_assignments" ADD CONSTRAINT "consultation_assignments_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultation_assignments" ADD CONSTRAINT "consultation_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultation_assignments" ADD CONSTRAINT "consultation_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultation_events" ADD CONSTRAINT "consultation_events_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_municipal_proposal_id_municipal_proposals_id_fk" FOREIGN KEY ("municipal_proposal_id") REFERENCES "public"."municipal_proposals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_deadline_authorized_by_users_id_fk" FOREIGN KEY ("deadline_authorized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "dissemination_records" ADD CONSTRAINT "dissemination_records_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "dissemination_records" ADD CONSTRAINT "dissemination_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "districts" ADD CONSTRAINT "districts_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_event_id_participatory_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."participatory_events"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "integrity_checks" ADD CONSTRAINT "integrity_checks_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "municipal_proposals" ADD CONSTRAINT "municipal_proposals_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "municipal_proposals" ADD CONSTRAINT "municipal_proposals_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "municipal_proposals" ADD CONSTRAINT "municipal_proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "municipal_proposals" ADD CONSTRAINT "municipal_proposals_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "one_time_codes" ADD CONSTRAINT "one_time_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "outcome_entries" ADD CONSTRAINT "outcome_entries_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "outcome_entries" ADD CONSTRAINT "outcome_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "participations" ADD CONSTRAINT "participations_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "participations" ADD CONSTRAINT "participations_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "participatory_events" ADD CONSTRAINT "participatory_events_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "participatory_events" ADD CONSTRAINT "participatory_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "proposal_supports" ADD CONSTRAINT "proposal_supports_proposal_id_citizen_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."citizen_proposals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "proposal_supports" ADD CONSTRAINT "proposal_supports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "results" ADD CONSTRAINT "results_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "results" ADD CONSTRAINT "results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "review_checklists" ADD CONSTRAINT "review_checklists_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "review_checklists" ADD CONSTRAINT "review_checklists_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "votes" ADD CONSTRAINT "votes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "votes" ADD CONSTRAINT "votes_alternative_id_alternatives_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."alternatives"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "alternatives_label_uq" ON "alternatives" USING btree ("consultation_id",lower("label"));
CREATE INDEX "attachments_owner_idx" ON "attachments" USING btree ("owner_type","owner_id");
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","occurred_at");
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
CREATE INDEX "auth_failures_ip_idx" ON "auth_failures" USING btree ("ip_hash","created_at");
CREATE INDEX "citizen_proposals_status_idx" ON "citizen_proposals" USING btree ("status");
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target_type","target_id");
CREATE UNIQUE INDEX "assignments_active_uq" ON "consultation_assignments" USING btree ("consultation_id","role","user_id") WHERE "consultation_assignments"."active" = true;
CREATE INDEX "consultation_events_idx" ON "consultation_events" USING btree ("consultation_id","occurred_at");
CREATE INDEX "consultations_status_idx" ON "consultations" USING btree ("status","closes_at");
CREATE UNIQUE INDEX "content_reports_once_uq" ON "content_reports" USING btree ("target_type","target_id","reporter_id");
CREATE INDEX "entity_versions_idx" ON "entity_versions" USING btree ("entity_type","entity_id","version");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "participations_citizen_consultation_uq" ON "participations" USING btree ("consultation_id","citizen_id");
CREATE UNIQUE INDEX "participations_receipt_uq" ON "participations" USING btree ("receipt_hash");
CREATE INDEX "results_consultation_idx" ON "results" USING btree ("consultation_id","created_at");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "tokens_user_purpose_idx" ON "tokens" USING btree ("user_id","purpose");
CREATE UNIQUE INDEX "users_cpf_hmac_uq" ON "users" USING btree ("cpf_hmac");
CREATE UNIQUE INDEX "users_kind_email_uq" ON "users" USING btree ("kind","email");
CREATE UNIQUE INDEX "users_registration_uq" ON "users" USING btree ("registration");
CREATE INDEX "votes_consultation_idx" ON "votes" USING btree ("consultation_id");
CREATE INDEX "votes_shuffle_idx" ON "votes" USING btree ("shuffle_key");

-- ============================================================================
-- 0001_gatilhos_somente_acrescimo.sql
-- ============================================================================
-- Registros imutáveis (RN28), resultado imutável (RN29), votos inalteráveis (RN39, RS003)
-- e trilha de auditoria somente de acréscimo (RF057, RS013).
-- Qualquer UPDATE ou DELETE nestas tabelas é recusado pelo próprio banco.
CREATE OR REPLACE FUNCTION ppcm_somente_acrescimo() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabela % é somente de acréscimo: operação % recusada', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_somente_acrescimo BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER consultation_events_somente_acrescimo BEFORE UPDATE OR DELETE ON consultation_events
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER entity_versions_somente_acrescimo BEFORE UPDATE OR DELETE ON entity_versions
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER results_somente_acrescimo BEFORE UPDATE OR DELETE ON results
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER outcome_entries_somente_acrescimo BEFORE UPDATE OR DELETE ON outcome_entries
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER citizen_proposal_events_somente_acrescimo BEFORE UPDATE OR DELETE ON citizen_proposal_events
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER integrity_checks_somente_acrescimo BEFORE UPDATE OR DELETE ON integrity_checks
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER votes_somente_acrescimo BEFORE UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER participations_somente_acrescimo BEFORE UPDATE OR DELETE ON participations
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

CREATE TRIGGER moderation_decisions_somente_acrescimo BEFORE UPDATE OR DELETE ON moderation_decisions
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();

-- Impede TRUNCATE (que não dispara gatilhos de linha) nas tabelas críticas.
CREATE OR REPLACE FUNCTION ppcm_sem_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE recusado em % (registros imutáveis)', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_sem_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();

CREATE TRIGGER votes_sem_truncate BEFORE TRUNCATE ON votes FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();

CREATE TRIGGER participations_sem_truncate BEFORE TRUNCATE ON participations FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();

CREATE TRIGGER results_sem_truncate BEFORE TRUNCATE ON results FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();

-- ============================================================================
-- 0002_indices_de_desempenho.sql
-- ============================================================================
CREATE INDEX "audience_criteria_consultation_idx" ON "audience_criteria" USING btree ("consultation_id");
CREATE INDEX "audit_log_object_idx" ON "audit_log" USING btree ("object_id","action");
CREATE INDEX "citizen_proposals_author_idx" ON "citizen_proposals" USING btree ("author_id");
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("status","created_at");
CREATE INDEX "incidents_consultation_idx" ON "incidents" USING btree ("consultation_id","status");
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;
CREATE INDEX "outcome_entries_outcome_idx" ON "outcome_entries" USING btree ("outcome_id");
CREATE INDEX "outcomes_consultation_idx" ON "outcomes" USING btree ("consultation_id");
CREATE INDEX "participations_citizen_idx" ON "participations" USING btree ("citizen_id");

-- ============================================================================
-- 0003_indice_codigos_de_confirmacao.sql
-- ============================================================================
CREATE INDEX "one_time_codes_user_scope_idx" ON "one_time_codes" USING btree ("user_id","purpose","scope");

-- ============================================================================
-- 0004_votos_sigilo_reembaralhamento.sql
-- ============================================================================
-- Sigilo do voto contra quem acessa o banco diretamente (RN07, RS002, DT-31).
-- Participação e voto são gravados na MESMA transação (atomicidade, RF037) e por isso nascem com o
-- mesmo identificador de transação na coluna de sistema `xmin` — um JOIN por `xmin` ligaria cada voto
-- ao eleitor, mesmo depois do CLUSTER (que preserva `xmin`). A rotina de reembaralhamento troca a
-- chave aleatória `shuffle_key` de todos os votos da consulta numa única transação, dando a todos o
-- mesmo `xmin` novo. Para isso, o gatilho de `votes` passa a admitir SOMENTE essa troca: o conteúdo do
-- voto (id, consulta, alternativa, abstenção) continua inalterável e DELETE/TRUNCATE continuam recusados.
CREATE OR REPLACE FUNCTION ppcm_votos_somente_reembaralhar() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.id = OLD.id
     AND NEW.consultation_id = OLD.consultation_id
     AND NEW.alternative_id IS NOT DISTINCT FROM OLD.alternative_id
     AND NEW.abstention = OLD.abstention THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Tabela % é somente de acréscimo: operação % recusada', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER votes_somente_acrescimo BEFORE UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION ppcm_votos_somente_reembaralhar();

-- ============================================================================
-- 0005_view_consultas_publicas.sql
-- ============================================================================
-- View: consultas públicas com o total de participações (RF016, RF050; DT-34).
-- Mostra só o que já é público no portal: consultas em situação pública, com tema, região, órgão
-- e o NÚMERO de participações. Não traz dados pessoais (RN27) nem votos ou contagem por
-- alternativa (RN07, RN16) — por isso pode ser liberada à conta de relatórios (0007).
CREATE OR REPLACE VIEW vw_consultas_publicas AS
SELECT
  c.id,
  c.slug,
  c.title AS titulo,
  c.status AS situacao,
  c.opens_at AS abertura,
  c.closes_at AS encerramento,
  t.name AS tema,
  r.name AS regiao,
  o.name AS orgao,
  count(p.id)::int AS participacoes
FROM consultations c
LEFT JOIN themes t ON t.id = c.theme_id
LEFT JOIN regions r ON r.id = c.region_id
LEFT JOIN organs o ON o.id = c.organ_id
LEFT JOIN participations p ON p.consultation_id = c.id
WHERE c.status IN ('agendada', 'aberta', 'suspensa', 'encerrada', 'apurada', 'finalizada', 'cancelada')
GROUP BY c.id, t.name, r.name, o.name;

-- ============================================================================
-- 0006_reforco_integridade.sql
-- ============================================================================
-- Reforço de integridade (DT-34).
--
-- 1) Integridade definida pelo usuário: o encerramento da consulta vem depois da abertura (RN14).
--    O serviço já valida isso; a restrição garante a regra também para quem grava direto no banco.
--    Rascunhos podem ainda não ter datas (NULL).
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_periodo_valido"
  CHECK ("opens_at" IS NULL OR "closes_at" IS NULL OR "closes_at" > "opens_at");


-- 2) Gatilho que executa uma ação: mantém "updated_at" quando a atualização não o informa.
--    A aplicação grava "updated_at" com o horário do servidor (RN08) na maioria das alterações; quando
--    uma alteração não o informa (ex.: mudança de situação), o próprio banco registra o momento.
--    Se a alteração já trouxer um novo "updated_at", o valor informado é mantido.
CREATE OR REPLACE FUNCTION ppcm_preenche_updated_at() RETURNS trigger AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_preenche_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

CREATE TRIGGER consultations_preenche_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

CREATE TRIGGER municipal_proposals_preenche_updated_at BEFORE UPDATE ON municipal_proposals
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

CREATE TRIGGER citizen_proposals_preenche_updated_at BEFORE UPDATE ON citizen_proposals
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

CREATE TRIGGER notification_preferences_preenche_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

CREATE TRIGGER settings_preenche_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();

-- ============================================================================
-- 0007_papeis_e_permissoes.sql
-- ============================================================================
-- Contas e permissões no banco de dados (DT-34). Três perfis, cada um com o mínimo necessário:
--
--   ppcm_app        aplicação: lê e grava os dados do sistema, mas NÃO altera nem apaga os registros
--                   imutáveis (votos, participações, auditoria, resultados…) — reforça os gatilhos da 0001.
--   ppcm_relatorios relatórios e painéis externos: só a view pública agregada e as tabelas de referência,
--                   sem acesso a dados pessoais nem a votos.
--   ppcm_auditoria  auditoria/controle: só leitura da trilha de auditoria, do histórico público, das
--                   verificações de integridade e dos incidentes.
--
-- Senhas NÃO ficam no Git: as contas nascem sem senha (não conseguem entrar) e a senha é definida na
-- implantação, ex.: ALTER ROLE ppcm_relatorios PASSWORD '...';
-- Papéis valem para o servidor PostgreSQL inteiro; por isso só são criados se ainda não existirem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ppcm_app') THEN
    CREATE ROLE ppcm_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ppcm_relatorios') THEN
    CREATE ROLE ppcm_relatorios LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ppcm_auditoria') THEN
    CREATE ROLE ppcm_auditoria LOGIN;
  END IF;
END
$$;


-- Ninguém além do dono e dos papéis abaixo acessa ou cria objetos no esquema.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO ppcm_app, ppcm_relatorios, ppcm_auditoria;


-- ppcm_app: leitura e escrita nas tabelas e uso das sequências (colunas bigserial)…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ppcm_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ppcm_app;

-- …exceto alterar ou apagar registros somente de acréscimo (RN28, RN29, RN39).
REVOKE UPDATE, DELETE, TRUNCATE ON votes, participations, audit_log, results, consultation_events,
  entity_versions, outcome_entries, citizen_proposal_events, integrity_checks, moderation_decisions
  FROM ppcm_app;

-- Única alteração permitida em votos: a troca da chave de embaralhamento (sigilo, DT-31).
GRANT UPDATE (shuffle_key) ON votes TO ppcm_app;

-- Tabelas criadas no futuro pelo dono já nascem acessíveis à aplicação.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ppcm_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ppcm_app;


-- ppcm_relatorios: só a view pública (sem dados pessoais nem votos) e as tabelas de referência.
GRANT SELECT ON vw_consultas_publicas, themes, regions, districts, organs TO ppcm_relatorios;


-- ppcm_auditoria: só leitura da trilha e dos controles de integridade.
GRANT SELECT ON audit_log, consultation_events, integrity_checks, incidents, vw_consultas_publicas TO ppcm_auditoria;
