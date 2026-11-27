-- PPCM — DADOS INICIAIS (dados de referência necessários para o sistema funcionar)
-- Gerado por `npm run db:sql` a partir de database/seeds/seed-reference.ts (não edite à mão).
-- Regiões e bairros reais de Maceió/AL; temas, órgãos e papéis administrativos do sistema.
-- Idempotente: pode ser executado mais de uma vez (ON CONFLICT DO NOTHING).
-- Os dados de DEMONSTRAÇÃO (pessoas e consultas fictícias) não entram aqui: dependem das chaves
-- de criptografia do ambiente e são gerados por `npm run db:seed` com DEMO_MODE=true.

-- Regiões administrativas (8)
INSERT INTO regions (name) VALUES ('Região Administrativa 1') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 2') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 3') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 4') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 5') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 6') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 7') ON CONFLICT (name) DO NOTHING;
INSERT INTO regions (name) VALUES ('Região Administrativa 8') ON CONFLICT (name) DO NOTHING;

-- Bairros (50)
INSERT INTO districts (name, region_id) SELECT 'Jaraguá', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Jatiúca', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Mangabeiras', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Pajuçara', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Ponta Verde', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Ponta da Terra', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Poço', id FROM regions WHERE name = 'Região Administrativa 1' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Centro', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Levada', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Ponta Grossa', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Pontal da Barra', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Prado', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Trapiche da Barra', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Vergel do Lago', id FROM regions WHERE name = 'Região Administrativa 2' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Canaã', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Farol', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Gruta de Lourdes', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Jardim Petrópolis', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Ouro Preto', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Pinheiro', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Pitanguinha', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Santo Amaro', id FROM regions WHERE name = 'Região Administrativa 3' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Bebedouro', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Bom Parto', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Chã da Jaqueira', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Chã de Bebedouro', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Fernão Velho', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Mutange', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Petrópolis', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Rio Novo', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Santa Amélia', id FROM regions WHERE name = 'Região Administrativa 4' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Barro Duro', id FROM regions WHERE name = 'Região Administrativa 5' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Feitosa', id FROM regions WHERE name = 'Região Administrativa 5' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Jacintinho', id FROM regions WHERE name = 'Região Administrativa 5' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Serraria', id FROM regions WHERE name = 'Região Administrativa 5' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'São Jorge', id FROM regions WHERE name = 'Região Administrativa 5' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Antares', id FROM regions WHERE name = 'Região Administrativa 6' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Benedito Bentes', id FROM regions WHERE name = 'Região Administrativa 6' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Cidade Universitária', id FROM regions WHERE name = 'Região Administrativa 7' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Clima Bom', id FROM regions WHERE name = 'Região Administrativa 7' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Santa Lúcia', id FROM regions WHERE name = 'Região Administrativa 7' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Santos Dumont', id FROM regions WHERE name = 'Região Administrativa 7' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Tabuleiro do Martins', id FROM regions WHERE name = 'Região Administrativa 7' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Cruz das Almas', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Garça Torta', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Guaxuma', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Ipioca', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Jacarecica', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Pescaria', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;
INSERT INTO districts (name, region_id) SELECT 'Riacho Doce', id FROM regions WHERE name = 'Região Administrativa 8' ON CONFLICT (name) DO NOTHING;

-- Temas (12)
INSERT INTO themes (name) VALUES ('Assistência Social') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Cultura e Lazer') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Desenvolvimento Econômico') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Educação') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Esporte') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Gestão e Finanças') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Infraestrutura e Iluminação') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Meio Ambiente') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Mobilidade e Transporte') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Saúde') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Segurança Pública') ON CONFLICT (name) DO NOTHING;
INSERT INTO themes (name) VALUES ('Urbanismo e Habitação') ON CONFLICT (name) DO NOTHING;

-- Órgãos municipais fictícios (9)
INSERT INTO organs (name, acronym) VALUES ('Ouvidoria-Geral do Município', 'OGM') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Assistência Social', 'SEMAS') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Cultura, Esporte e Lazer', 'SECEL') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Educação', 'SEMED') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Infraestrutura', 'SEINFRA') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Meio Ambiente', 'SEMA') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Mobilidade', 'SEMOB') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Planejamento e Gestão', 'SEPLAG') ON CONFLICT (name) DO NOTHING;
INSERT INTO organs (name, acronym) VALUES ('Secretaria Municipal de Saúde', 'SMS') ON CONFLICT (name) DO NOTHING;

-- Papéis administrativos do sistema (13)
INSERT INTO roles (key, name, description, permissions, system) VALUES ('acompanhamento', 'Acompanhamento', 'Acompanha o painel de consultas em andamento e gera relatórios agregados.', ARRAY['consultas.acompanhar', 'relatorios.gerar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('analise_propostas', 'Análise de propostas', 'Analisa e responde propostas cidadãs.', ARRAY['propostas_cidadas.analisar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('aprovador', 'Aprovador', 'Aprova ou rejeita consultas que não elaborou nem revisou.', ARRAY['consultas.aprovar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('atendimento', 'Atendimento', 'Atendimento assistido, análise documental de identidade e registro de perguntas por telefone.', ARRAY['atendimento.registrar', 'identidade.analisar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('autorizador_prazo', 'Autorizador de prazo excepcional', 'Decide sobre a redução do prazo para 10 dias por emergência.', ARRAY['consultas.autorizar_prazo']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('divulgacao', 'Divulgação', 'Gera material de divulgação e registra os canais usados.', ARRAY['consultas.divulgar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('elaborador', 'Elaborador', 'Cadastra propostas municipais e elabora consultas.', ARRAY['propostas_municipais.gerenciar', 'consultas.elaborar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('encaminhamentos', 'Encaminhamentos', 'Registra e atualiza os encaminhamentos após o resultado.', ARRAY['encaminhamentos.registrar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('gestor_acessos', 'Gestor de acessos', 'Cria contas administrativas, atribui papéis, designa responsáveis por consulta, consulta a auditoria e trata incidentes.', ARRAY['usuarios.gerenciar', 'papeis.gerenciar', 'responsaveis.designar', 'auditoria.consultar', 'incidentes.tratar', 'configuracoes.gerenciar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('moderacao', 'Moderação', 'Decide sobre conteúdos denunciados.', ARRAY['moderacao.moderar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('publicacao_resultados', 'Publicação de resultados', 'Homologa e publica resultados e retificações.', ARRAY['resultados.publicar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('responsavel', 'Responsável pela consulta', 'Conduz a consulta: publica, altera, suspende, retoma, cancela e cadastra eventos.', ARRAY['consultas.conduzir', 'consultas.acompanhar', 'eventos.gerenciar']::text[], true) ON CONFLICT (key) DO NOTHING;
INSERT INTO roles (key, name, description, permissions, system) VALUES ('revisor', 'Revisor', 'Revisa a consulta com a lista de verificação antes da aprovação.', ARRAY['consultas.revisar']::text[], true) ON CONFLICT (key) DO NOTHING;
