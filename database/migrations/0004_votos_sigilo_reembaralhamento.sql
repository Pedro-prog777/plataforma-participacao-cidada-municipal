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
--> statement-breakpoint
CREATE OR REPLACE TRIGGER votes_somente_acrescimo BEFORE UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION ppcm_votos_somente_reembaralhar();
