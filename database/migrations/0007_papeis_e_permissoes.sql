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
--> statement-breakpoint

-- Ninguém além do dono e dos papéis abaixo acessa ou cria objetos no esquema.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO ppcm_app, ppcm_relatorios, ppcm_auditoria;
--> statement-breakpoint

-- ppcm_app: leitura e escrita nas tabelas e uso das sequências (colunas bigserial)…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ppcm_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ppcm_app;
--> statement-breakpoint
-- …exceto alterar ou apagar registros somente de acréscimo (RN28, RN29, RN39).
REVOKE UPDATE, DELETE, TRUNCATE ON votes, participations, audit_log, results, consultation_events,
  entity_versions, outcome_entries, citizen_proposal_events, integrity_checks, moderation_decisions
  FROM ppcm_app;
--> statement-breakpoint
-- Única alteração permitida em votos: a troca da chave de embaralhamento (sigilo, DT-31).
GRANT UPDATE (shuffle_key) ON votes TO ppcm_app;
--> statement-breakpoint
-- Tabelas criadas no futuro pelo dono já nascem acessíveis à aplicação.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ppcm_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ppcm_app;
--> statement-breakpoint

-- ppcm_relatorios: só a view pública (sem dados pessoais nem votos) e as tabelas de referência.
GRANT SELECT ON vw_consultas_publicas, themes, regions, districts, organs TO ppcm_relatorios;
--> statement-breakpoint

-- ppcm_auditoria: só leitura da trilha e dos controles de integridade.
GRANT SELECT ON audit_log, consultation_events, integrity_checks, incidents, vw_consultas_publicas TO ppcm_auditoria;
