# Especificações — PPCM

Uma especificação por funcionalidade, no mesmo modelo: objetivo, descrição, atores, pré-condições,
fluxo principal, fluxos alternativos, regras de negócio, validações, persistência, critérios de
aceitação e onde está a implementação. Todas correspondem ao que está implementado e testado neste
repositório; os identificadores (RF, RN, RNF) são os do Documento de Requisitos v6
(`docs/requisitos/REQUISITOS_COMPLETOS.md`). Visão do produto: `docs/prd.md`.

| Especificação | Funcionalidade | Requisitos |
|---|---|---|
| [cadastro-cidadao.md](cadastro-cidadao.md) | Cadastro de cidadão e confirmação de e-mail | RF001–RF003 |
| [autenticacao.md](autenticacao.md) | Login, segundo fator, bloqueio por tentativas e sessões | RF005, RF006, RF009, RF010 |
| [recuperacao-senha.md](recuperacao-senha.md) | Recuperação e alteração de senha | RF007, RF008 |
| [verificacao-identidade.md](verificacao-identidade.md) | Verificação de identidade e domicílio | RF004 |
| [consultas.md](consultas.md) | Ciclo de vida da consulta pública | RF024–RF035, RF061 |
| [votacao.md](votacao.md) | Votação em 3 passos com confirmação | RF011, RF036, RF037, RF039, RF040 |
| [comprovantes.md](comprovantes.md) | Comprovante de participação e verificação pública | RF014, RF038, RF041 |
| [apuracao-resultados.md](apuracao-resultados.md) | Integridade, apuração, publicação do resultado e dados abertos | RF042–RF045, RF059 |
| [propostas-cidadas.md](propostas-cidadas.md) | Envio, análise e publicação de propostas cidadãs | RF020, RF021 |
| [busca-filtros.md](busca-filtros.md) | Listagem, busca e filtros de consultas e acervo | RF016, RF017, RF056 |
| [relatorios.md](relatorios.md) | Relatórios agregados e painel de monitoramento | RF048, RF049 |
| [auditoria.md](auditoria.md) | Trilha de auditoria encadeada | RF057, RF058 |
| [gestao-usuarios.md](gestao-usuarios.md) | Usuários administrativos, papéis e permissões | RF046, RF047, RF061 |
| [notificacoes.md](notificacoes.md) | Avisos por e-mail e na plataforma, preferências | RF052–RF055 |
