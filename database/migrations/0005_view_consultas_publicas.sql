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
