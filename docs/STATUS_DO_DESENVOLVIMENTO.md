# Status do desenvolvimento — PPCM

Atualizado em 12/11/2026. Estados: Não iniciado · Em desenvolvimento · Implementado (código e tela prontos, verificação manual) · Testado (coberto por teste automatizado aprovado) · Pendente · Bloqueado.

## Resumo

- **Requisitos funcionais:** 68 implementados e cobertos por teste automatizado (68 no total); RF004, RF005 e RF011 com provedor de identidade/SMS simulados. RF064, RF067 e RF068 existem, mas ficam desligados até a validação do cliente.
- **Testes:** 114/114 unitários, de integração e de segurança; 32/32 E2E (com acessibilidade axe e 320 px); tipos e lint limpos; `npm audit` de produção sem vulnerabilidades.
- **Telas:** 60+ rotas reais e navegáveis; capturas reais em `screenshots/` (`area-publica`, `cidadao`, `administrador`, `celular`).
- **Trello:** quadro criado pela equipe — <https://trello.com/invite/b/6af5eab7a85ea3fed1422ceb/ATTI524f049c496b020899b71b8eee407bf74ACB1531/plataforma-de-participacao-cidada-municipal-ppcm> (link de convite). A organização do quadro está em `docs/trello/quadro.json` (10 listas, 41 cartões, 57 capturas) e é aplicada por `npm run trello:sync`, que exige chave e token do Trello da equipe; sem essas credenciais os cartões ainda não foram lançados.
- **GitHub:** repositório público, autorizado pela equipe em 12/11/2026: <https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal>.

## O que funciona (verificado)
Cadastro, confirmação de e-mail, login com bloqueio e 2º fator, recuperação de senha, verificação de identidade (provedor simulado e documental), perfil e LGPD, ciclo completo da consulta com segregação de funções, abertura/encerramento automáticos, votação em 3 passos com sigilo estrutural e voto único, comprovante e verificação pública, integridade, apuração, homologação, retificação, dados abertos, encaminhamentos, propostas cidadãs, denúncia e moderação, notificações, auditoria encadeada, incidentes, monitoramento, relatórios, usuários, papéis e parâmetros.

## Parcial, simulado ou não medido
| Item | Estado | Observação |
|---|---|---|
| Integração gov.br (RF004/RF005/RF011) | Bloqueado | Exige credenciamento oficial; adaptador simulado identificado como demonstração |
| SMS do código de voto (RF011) | Pendente | Sem provedor definido; SMS simulado, e-mail real |
| Envio real de e-mail | Implementado | Funciona com `SMTP_URL`; não testado contra servidor SMTP real |
| Antivírus ClamAV (RF023) | Implementado | Cliente clamd não testado contra servidor real; verificação embutida testada |
| Testes em PostgreSQL servidor | Testado | CI no GitHub Actions com PostgreSQL 16: 114/114 e E2E 32/32 em 12/11/2026 ([execução](https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal/actions/runs/43258424027)) |
| Docker/Compose | Implementado | Arquivos criados; **não executados** (sem Docker no ambiente) |
| RNF04, RNF09, RNF10 (desempenho/disponibilidade) | Pendente | Sem medição sob carga |
| RNF01/RNF11 com NVDA, TalkBack e outros navegadores | Pendente | Só axe-core em Chromium |
| RNF14 backup e restauração | Pendente | Estratégia documentada, não exercitada |
| RNF06 relatório de impacto (RIPD) | Não iniciado | Documento jurídico, fora do código |
| RS010 consentimento parental | Pendente | Depende de análise jurídica (*) |
| Verificação periódica de links externos (RF023) | Testado | Diária, na rotina automática; só `HEAD`, sem seguir redirecionamentos (DT-19) |

## Requisitos funcionais

| RF | Requisito | Estado | Observação |
|---|---|---|---|
| RF001 | Cadastrar cidadão | Testado | CPF guardado como HMAC + forma mascarada (DT-06). |
| RF002 | Validar dados cadastrais | Testado | — |
| RF003 | Confirmar e-mail e ativar conta | Testado | Confirmação por clique (POST) para que pré-visualizadores de link não consumam o token. |
| RF004 | Verificar identidade e domicílio do cidadão | Testado (com simulação) | Provedor gov.br SIMULADO (DT-09); análise documental real. |
| RF005 | Realizar login | Testado | TOTP obrigatório para contas administrativas. |
| RF006 | Realizar logout | Testado | — |
| RF007 | Recuperar senha | Testado | — |
| RF008 | Alterar senha | Testado | — |
| RF009 | Controlar acesso por perfil, papel e permissão | Testado | Verificação no servidor em toda página/ação e repetida nos serviços. |
| RF010 | Controlar tentativas de autenticação | Testado | CAPTCHA aritmético próprio (DT-12). |
| RF011 | Confirmar identidade antes do voto | Testado (com simulação) | E-mail real via fila; SMS simulado (sem provedor de SMS no documento). |
| RF012 | Visualizar perfil | Testado | — |
| RF013 | Atualizar dados do perfil | Testado | Nome civil/nascimento só por verificação documental. |
| RF014 | Acompanhar participações e propostas | Testado | Proposta da equipe (*) — mantida ativa por ser essencial ao comprovante. |
| RF015 | Exercer direitos do titular de dados (LGPD) | Testado | — |
| RF016 | Listar consultas públicas | Testado | — |
| RF017 | Pesquisar e filtrar consultas | Testado | — |
| RF018 | Visualizar detalhes da consulta | Testado | — |
| RF019 | Determinar a situação da consulta | Testado | Executa a cada minuto no processo do servidor. |
| RF020 | Enviar proposta cidadã | Testado | — |
| RF021 | Analisar e responder proposta cidadã | Testado | Prazo de ajuste parametrizável (pendente *). |
| RF022 | Cadastrar proposta municipal | Testado | — |
| RF023 | Anexar documentos e materiais audiovisuais | Testado | Antivírus: ClamAV quando configurado; verificação embutida na demonstração (DT-11). |
| RF024 | Editar proposta e consulta em elaboração | Testado | — |
| RF025 | Cadastrar consulta pública | Testado | — |
| RF026 | Definir alternativas de resposta | Testado | — |
| RF027 | Definir público-alvo e critérios de participação | Testado | Critério 'outro' é informativo (pendência). |
| RF028 | Revisar e submeter consulta para aprovação | Testado | Estado intermediário 'Aguardando revisão' (DT-15). |
| RF029 | Aprovar consulta e autorizar prazo excepcional | Testado | — |
| RF030 | Publicar consulta | Testado | — |
| RF031 | Abrir votação | Testado | Retrato dos parâmetros em consultations.open_snapshot. |
| RF032 | Alterar consulta publicada | Testado | — |
| RF033 | Suspender e retomar consulta | Testado | — |
| RF034 | Cancelar consulta | Testado | — |
| RF035 | Encerrar votação | Testado | — |
| RF036 | Verificar elegibilidade do cidadão | Testado | — |
| RF037 | Registrar voto | Testado | — |
| RF038 | Confirmar voto e emitir comprovante | Testado | — |
| RF039 | Impedir voto duplicado | Testado | — |
| RF040 | Rejeitar votos fora do período | Testado | — |
| RF041 | Verificar comprovante de voto | Testado | — |
| RF042 | Apurar votos | Testado | — |
| RF043 | Homologar e publicar resultado final | Testado | Publicação do preliminar parametrizável (pendente *), desligada. |
| RF044 | Visualizar resultado da consulta | Testado | — |
| RF045 | Exportar resultados em formato aberto | Testado | — |
| RF046 | Gerenciar usuários | Testado | — |
| RF047 | Gerenciar papéis e permissões | Testado | — |
| RF048 | Monitorar consultas em andamento | Testado | — |
| RF049 | Gerar relatórios e estatísticas | Testado | — |
| RF050 | Disponibilizar portal público de transparência | Testado | — |
| RF051 | Exibir histórico público da consulta | Testado | — |
| RF052 | Gerenciar preferências de notificação | Testado | — |
| RF053 | Notificar nova consulta e abertura | Testado | SMTP real se SMTP_URL; senão caixa simulada. |
| RF054 | Notificar alterações, suspensão e cancelamento | Testado | — |
| RF055 | Notificar lembrete, resultado e encaminhamentos | Testado | — |
| RF056 | Consultar acervo de consultas encerradas | Testado | — |
| RF057 | Registrar trilha de auditoria | Testado | — |
| RF058 | Consultar trilha de auditoria | Testado | — |
| RF059 | Verificar integridade da votação e da apuração | Testado | — |
| RF060 | Tratar inconsistências e incidentes | Testado | — |
| RF061 | Definir responsáveis e papéis da consulta | Testado | — |
| RF062 | Divulgar consulta | Testado | Publicação externa manual, como prevê o documento. |
| RF063 | Registrar e publicar encaminhamentos | Testado | — |
| RF064 | Publicar comentários e perguntas | Testado (desligado por padrão *) | Chave recursos.comentarios. |
| RF065 | Denunciar conteúdo | Testado | — |
| RF066 | Moderar conteúdo e revisar decisões | Testado | — |
| RF067 | Apoiar proposta cidadã | Testado (desligado por padrão *) | Meta e prazo sem valor padrão (20 mil/4 meses não adotados). |
| RF068 | Divulgar evento participativo e receber perguntas | Testado (desligado por padrão *) | Chave recursos.eventos. Sem transmissão de vídeo. |

## Requisitos não funcionais

| RNF | Estado | Evidência / pendência |
|---|---|---|
| RNF01 Acessibilidade | Testado (parcial) | axe WCAG 2.2 AA em 11 páginas; falta leitor de tela |
| RNF02 Linguagem simples / 3 passos | Testado | Votação em 3 passos (E2E); item na lista de revisão |
| RNF03 Celular 320 px | Testado | E2E sem rolagem horizontal |
| RNF04 Internet fraca | Implementado | Sem vídeo obrigatório, imagens sob demanda; peso não medido |
| RNF05 Segurança da comunicação e acesso | Testado (parcial) | Argon2id, guardas, cabeçalhos; TLS depende da implantação |
| RNF06 LGPD | Implementado | Minimização e exportações agregadas testadas; RIPD não iniciado |
| RNF07 Integridade do voto | Testado | Transação única, sem vínculo, concorrência, hash da base |
| RNF08 Registro de atos | Testado | Auditoria encadeada; valores pessoais não gravados (pendência 17) |
| RNF09 Tempo de resposta | Pendente | Não medido |
| RNF10 Disponibilidade | Pendente | `/api/saude` pronto; sem medição |
| RNF11 Navegadores | Pendente | Só Chromium |
| RNF12 Parâmetros | Testado | `/admin/configuracoes`; regras RN05–RN08, RN14, RN18 testadas |
| RNF13 Dados abertos | Testado | CSV/JSON/PDF com dicionário |
| RNF14 Voto sem perda | Testado (parcial) | Atomicidade testada; backup não exercitado |
| RNF15 Inclusão digital | Implementado | Atendimento registra perguntas por telefone; nunca vota pelo cidadão |

## Requisitos de segurança
Todos os RS001–RS013 têm controles implementados; evidências e riscos residuais em `docs/seguranca/MATRIZ_DE_RISCOS.md`. RS004 depende do provedor simulado; RS010 tem pendência jurídica.

## Erros encontrados e corrigidos
- Auditoria de acesso negado por segregação era desfeita junto com a transação → movida para fora.
- `instrumentation.ts` empacotado para o runtime Edge → import condicional.
- Banco PGlite corrompido ao encerrar o servidor à força → fechamento gracioso; `npm run db:reset`.
- Contraste insuficiente (botão de destaque e contador de avisos) apontado pelo axe → cores ajustadas.
- Vulnerabilidades em nodemailer 7 e postcss embutido → atualização e `overrides`.
- Roteiro de capturas falhava em dois blocos (cidadã que já tinha votado; sessão administrativa não encerrada entre logins) e o botão de download disparava pré-carregamento de rotas `/api` → roteiro e componente corrigidos.
- Primeira execução do CI falhou no `npm ci`: `package-lock.json` fora de sincronia para o npm 10 (faltava `esbuild` 0.28 exigido pelo `vite`) → lock regenerado; segunda execução aprovada.
- Bloqueios de arquivo `EBUSY` causados pelo OneDrive durante builds → recomenda-se mover o projeto para fora do OneDrive.

## Próxima etapa recomendada
1. Gerar a chave e o token do Trello e executar `npm run trello:sync` (passos em `docs/trello/PLANO_TRELLO.md`).
2. Levar `docs/requisitos/PENDENCIAS_CLIENTE.md` ao cliente e ajustar parâmetros.
3. Executar o `docker compose` e exercitar backup e restauração (RNF14).
4. Inspeção de acessibilidade com NVDA/TalkBack e medição de desempenho.
