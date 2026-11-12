-- Registros imutáveis (RN28), resultado imutável (RN29), votos inalteráveis (RN39, RS003)
-- e trilha de auditoria somente de acréscimo (RF057, RS013).
-- Qualquer UPDATE ou DELETE nestas tabelas é recusado pelo próprio banco.
CREATE OR REPLACE FUNCTION ppcm_somente_acrescimo() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabela % é somente de acréscimo: operação % recusada', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_somente_acrescimo BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER consultation_events_somente_acrescimo BEFORE UPDATE OR DELETE ON consultation_events
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER entity_versions_somente_acrescimo BEFORE UPDATE OR DELETE ON entity_versions
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER results_somente_acrescimo BEFORE UPDATE OR DELETE ON results
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER outcome_entries_somente_acrescimo BEFORE UPDATE OR DELETE ON outcome_entries
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER citizen_proposal_events_somente_acrescimo BEFORE UPDATE OR DELETE ON citizen_proposal_events
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER integrity_checks_somente_acrescimo BEFORE UPDATE OR DELETE ON integrity_checks
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER votes_somente_acrescimo BEFORE UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER participations_somente_acrescimo BEFORE UPDATE OR DELETE ON participations
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
CREATE TRIGGER moderation_decisions_somente_acrescimo BEFORE UPDATE OR DELETE ON moderation_decisions
  FOR EACH ROW EXECUTE FUNCTION ppcm_somente_acrescimo();
--> statement-breakpoint
-- Impede TRUNCATE (que não dispara gatilhos de linha) nas tabelas críticas.
CREATE OR REPLACE FUNCTION ppcm_sem_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE recusado em % (registros imutáveis)', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_sem_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();
--> statement-breakpoint
CREATE TRIGGER votes_sem_truncate BEFORE TRUNCATE ON votes FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();
--> statement-breakpoint
CREATE TRIGGER participations_sem_truncate BEFORE TRUNCATE ON participations FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();
--> statement-breakpoint
CREATE TRIGGER results_sem_truncate BEFORE TRUNCATE ON results FOR EACH STATEMENT EXECUTE FUNCTION ppcm_sem_truncate();
