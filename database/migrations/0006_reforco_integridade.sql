-- Reforço de integridade (DT-34).
--
-- 1) Integridade definida pelo usuário: o encerramento da consulta vem depois da abertura (RN14).
--    O serviço já valida isso; a restrição garante a regra também para quem grava direto no banco.
--    Rascunhos podem ainda não ter datas (NULL).
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_periodo_valido"
  CHECK ("opens_at" IS NULL OR "closes_at" IS NULL OR "closes_at" > "opens_at");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE TRIGGER users_preenche_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
--> statement-breakpoint
CREATE TRIGGER consultations_preenche_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
--> statement-breakpoint
CREATE TRIGGER municipal_proposals_preenche_updated_at BEFORE UPDATE ON municipal_proposals
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
--> statement-breakpoint
CREATE TRIGGER citizen_proposals_preenche_updated_at BEFORE UPDATE ON citizen_proposals
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
--> statement-breakpoint
CREATE TRIGGER notification_preferences_preenche_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
--> statement-breakpoint
CREATE TRIGGER settings_preenche_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION ppcm_preenche_updated_at();
