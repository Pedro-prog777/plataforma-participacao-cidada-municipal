# Matriz de rastreabilidade — PPCM

## 1. Matriz do documento (dependências entre requisitos)

Transcrita do Documento de Requisitos v6, seção 7 — ver também `docs/requisitos/REQUISITOS_COMPLETOS.md` §7.

| Requisito | D (depende de) | R (relaciona-se com) |
|---|---|---|
| RF001 | RF002, RF003 | RF004, RF007, RF027 |
| RF002 | — | RF001, RF013, RF036 |
| RF003 | — | RF004 |
| RF004 | — | — |
| RF005 | — | RF010 |
| RF006 | — | — |
| RF007 | — | — |
| RF008 | — | RF010 |
| RF009 | RF047 | — |
| RF010 | — | — |
| RF011 | — | — |
| RF012 | RF004, RF008, RF013, RF014, RF015, RF052  — | — |
| RF013 | RF002 | — |
| RF014 | RF020, RF041, RF063 | — |
| RF015 | — | — |
| RF016 | — | RF052 |
| RF017 | — | — |
| RF018 | RF019, RF023, RF036, RF044, RF063 | RF051 |
| RF019 | RF031, RF035 | RF040 |
| RF020 | RF004, RF014, RF021 | RF067 |
| RF021 | RF020, RF022, RF066 | — |
| RF022 | — | RF028 |
| RF023 | RF018, RF028 | RF032 |
| RF024 | — | RF032 |
| RF025 | RF022, RF026, RF027, RF061 | RF029 |
| RF026 | — | — |
| RF027 | RF018, RF025, RF036 | RF028 |
| RF028 | RF025, RF026, RF027, RF029 | — |
| RF029 | RF028, RF030, RF061 | — |
| RF030 | RF053 | — |
| RF031 | RF019, RF053 | — |
| RF032 | RF054 | — |
| RF033 | RF054 | RF034 |
| RF034 | — | RF043 |
| RF035 | RF042, RF055, RF059 | RF060 |
| RF036 | RF004, RF027 | — |
| RF037 | RF011, RF038 | RF060 |
| RF038 | RF014 | — |
| RF039 | — | RF060 |
| RF040 | — | — |
| RF041 | — | — |
| RF042 | RF035, RF043, RF059 | RF060 |
| RF043 | RF042, RF044, RF055, RF063 | — |
| RF044 | RF043, RF045, RF063 | — |
| RF045 | — | — |
| RF046 | — | — |
| RF047 | RF009 | — |
| RF048 | RF019, RF032, RF033, RF059, RF065 | RF060, RF062, RF066 |
| RF049 | — | — |
| RF050 | RF016, RF017, RF018, RF044, RF045, RF056, RF063 | — |
| RF051 | — | — |
| RF052 | — | — |
| RF053 | — | — |
| RF054 | — | — |
| RF055 | — | — |
| RF056 | RF018, RF044, RF051 | — |
| RF057 | — | — |
| RF058 | — | RF060 |
| RF059 | — | RF060 |
| RF060 | — | RF034 |
| RF061 | RF009, RF025, RF026, RF027, RF028, RF029, RF030, RF047 | — |
| RF062 | RF030, RF051, RF053 | — |
| RF063 | RF043, RF044, RF055 | — |
| RF064 | RF065, RF066 | — |
| RF065 | RF066 | — |
| RF066 | RF057, RF065 | — |
| RF067 | RF020, RF021 | — |
| RF068 | RF023, RF064, RF065 | — |

## 2. Rastreabilidade de implementação (requisito → código → teste → situação)

| RF | Telas / rotas | Módulo | Testes | RS | Situação |
|---|---|---|---|---|---|
| RF001 Cadastrar cidadão | /cadastro (só para quem tem 18 anos completos — DT-33) | `modules/auth/auth.service.ts (registerCitizen, adultBirthDateSchema)` | integration/auth.test.ts › Cadastro, só cria conta quem tem 18 anos completos; unit/masks.test.ts; e2e/citizen.spec.ts › cadastro | RS004 | Implementado |
| RF002 Validar dados cadastrais | /cadastro, /conta/perfil/editar | `auth.service.ts (registrationSchema), profile.service.ts` | integration/auth.test.ts › todos os erros por campo; unit/rules.test.ts › CPF | — | Implementado |
| RF003 Confirmar e-mail e ativar conta | /confirmar-email, /reenviar-confirmacao | `auth.service.ts (sendEmailConfirmation, confirmEmail, resendConfirmation)` | integration/auth.test.ts › Confirmação de e-mail | — | Implementado |
| RF004 Verificar identidade e domicílio do cidadão | /conta/verificacao, /demo/provedor-identidade, /admin/verificacoes | `modules/identity/identity.service.ts; lib/identity-provider.ts` | integration/administration.test.ts › Verificação de identidade e domicílio; e2e/citizen.spec.ts › orientação de verificação | RS004 | Implementado com simulação |
| RF005 Realizar login | /entrar, /entrar/segundo-fator | `auth.service.ts (login, verifySecondFactor); session.service.ts` | integration/auth.test.ts › Login; e2e/admin.spec.ts › segundo fator | RS007 | Implementado |
| RF006 Realizar logout | menu Sair, /conta/privacidade (sessões) | `session.service.ts (revokeSession, revokeAllSessions); actions/auth.ts (logoutAction)` | integration/auth.test.ts › sessão expira por inatividade | — | Implementado |
| RF007 Recuperar senha | /recuperar-senha, /redefinir-senha | `auth.service.ts (requestPasswordReset, resetPassword)` | integration/auth.test.ts › Recuperação | RS007 | Implementado |
| RF008 Alterar senha | /conta/senha, /admin/senha | `auth.service.ts (changePassword)` | integration/auth.test.ts › senha atual incorreta conta como falha | — | Implementado |
| RF009 Controlar acesso por perfil, papel e permissão | todas as rotas protegidas | `server/auth/current.ts (requireCitizen/requireAdmin); modules/access/access.service.ts` | integration/auth.test.ts › Controle de acesso; e2e/public.spec.ts › áreas protegidas; e2e/admin.spec.ts | RS006 | Implementado |
| RF010 Controlar tentativas de autenticação | /entrar (CAPTCHA) | `auth.service.ts (recordAuthFailure, requiresCaptcha); lib/captcha.ts` | integration/auth.test.ts › bloqueio 15 min; CAPTCHA por IP | — | Implementado |
| RF011 Confirmar identidade antes do voto | /consultas/[slug]/participar (passo 2; na demonstração o código aparece na tela — DT-32) | `modules/voting/voting.service.ts (requestVoteCode)` | integration/voting.test.ts › código, código anterior válido, código na tela; e2e/citizen.spec.ts | — | Implementado com simulação |
| RF012 Visualizar perfil | /conta | `modules/profile/profile.service.ts (getProfile, eligibilitySummary)` | integration/administration.test.ts › Visualização do perfil | RS005 | Implementado |
| RF013 Atualizar dados do perfil | /conta/perfil/editar | `profile.service.ts (updateProfile); identity.service.ts (correção documental)` | integration/administration.test.ts › Atualização do perfil | — | Implementado |
| RF014 Acompanhar participações e propostas | /conta/participacoes, /conta/participacoes/[id] | `voting.service.ts (myParticipations)` | integration/voting.test.ts › histórico sem a opção votada; e2e/citizen.spec.ts | — | Implementado |
| RF015 Exercer direitos do titular de dados | /conta/privacidade, /api/conta/dados/[id] | `profile.service.ts (requestDataCopy, deactivateAccount)` | integration/participation.test.ts › LGPD; integration/auth.test.ts › desativação | — | Implementado |
| RF016 Listar consultas públicas | /consultas, / | `modules/consultations/queries.service.ts (listPublicConsultations)` | integration/lifecycle.test.ts › não aparece antes de publicada; e2e/public.spec.ts | — | Implementado |
| RF017 Pesquisar e filtrar consultas | /consultas, /consultas/pesquisa | `queries.service.ts (filtros, busca normalizada)` | e2e/public.spec.ts › busca sem acentos | — | Implementado |
| RF018 Visualizar detalhes da consulta | /consultas/[slug] | `queries.service.ts (getPublicConsultation); voting/eligibility.ts` | e2e/public.spec.ts; e2e/citizen.spec.ts | — | Implementado |
| RF019 Determinar a situação da consulta | rotina automática (instrumentation) e /admin/monitoramento | `modules/scheduler/scheduler.service.ts (runSchedulerTick)` | integration/lifecycle.test.ts › ciclo completo; integration/voting.test.ts › encerramento | RS009 | Implementado |
| RF020 Enviar proposta cidadã | /conta/propostas/nova | `modules/proposals/citizen-proposals.service.ts (submitCitizenProposal, findSimilar)` | integration/participation.test.ts › Propostas cidadãs | RS011, RS012 | Implementado |
| RF021 Analisar e responder proposta cidadã | /admin/propostas, /admin/propostas/[id] | `citizen-proposals.service.ts (analyzeProposal); scheduler (prazo de ajuste)` | integration/participation.test.ts › percorre os estados | — | Implementado |
| RF022 Cadastrar proposta municipal | /admin/propostas-municipais | `modules/proposals/municipal-proposals.service.ts` | integration/lifecycle.test.ts | — | Implementado |
| RF023 Anexar documentos e materiais audiovisuais | /admin/consultas/[id]/anexos, /admin/propostas-municipais/[id], /api/anexos/[id] | `modules/attachments/attachments.service.ts; lib/files.ts` | integration/participation.test.ts › Anexos; unit/rules.test.ts › tipo real e EICAR; security/security.test.ts › Links externos e SSRF | RS012 | Implementado |
| RF024 Editar proposta e consulta em elaboração | /admin/consultas/[id]/editar | `lifecycle.service.ts (updateConsultation); common.ts (saveVersion)` | integration/lifecycle.test.ts › edição simultânea | — | Implementado |
| RF025 Cadastrar consulta pública | /admin/consultas/nova | `lifecycle.service.ts (createConsultation)` | integration/lifecycle.test.ts › período mínimo | — | Implementado |
| RF026 Definir alternativas de resposta | /admin/consultas/[id]/alternativas | `lifecycle.service.ts (setAlternatives)` | integration/lifecycle.test.ts › alternativas | — | Implementado |
| RF027 Definir público-alvo e critérios de participação | /admin/consultas/[id]/publico-alvo | `lifecycle.service.ts (setAudience, estimateEligible)` | integration/lifecycle.test.ts › limitação sem justificativa, consulta para crianças e adolescentes só informativa ou educativa (DT-33); unit › elegibilidade | RS010 | Implementado |
| RF028 Revisar e submeter consulta para aprovação | /admin/consultas/[id] (pendências), /admin/consultas/[id]/revisao | `lifecycle.service.ts (consultationPendencies, submitForReview, reviewConsultation)` | integration/lifecycle.test.ts › Segregação | — | Implementado |
| RF029 Aprovar consulta e autorizar prazo excepcional | /admin/consultas/[id]/aprovacao | `lifecycle.service.ts (decideApproval, decideExceptionalDeadline)` | integration/lifecycle.test.ts › ninguém aprova o que elaborou; prazo excepcional; antecedência | RS006 | Implementado |
| RF030 Publicar consulta | /admin/consultas/[id]/conducao | `lifecycle.service.ts (publishConsultation, unscheduleConsultation)` | integration/lifecycle.test.ts › ciclo completo | — | Implementado |
| RF031 Abrir votação | rotina automática | `scheduler.service.ts (openDueConsultations)` | integration/lifecycle.test.ts › abertura | — | Implementado |
| RF032 Alterar consulta publicada | /admin/consultas/[id]/conducao | `lifecycle.service.ts (alterPublished)` | integration/lifecycle.test.ts › alteração e bloqueio de alternativas | — | Implementado |
| RF033 Suspender e retomar consulta | /admin/consultas/[id]/conducao | `lifecycle.service.ts (suspend/resume/closeSuspendedForTally)` | integration/lifecycle.test.ts; integration/voting.test.ts › voto em consulta suspensa | — | Implementado |
| RF034 Cancelar consulta | /admin/consultas/[id]/conducao | `lifecycle.service.ts (cancelConsultation)` | integration/lifecycle.test.ts › cancelamento | — | Implementado |
| RF035 Encerrar votação | rotina automática | `scheduler.service.ts (closeDueConsultations)` | integration/voting.test.ts › encerra no horário; totais divergentes | — | Implementado |
| RF036 Verificar elegibilidade do cidadão | /consultas/[slug], /consultas/[slug]/participar | `modules/voting/eligibility.ts` (18 anos completos — DT-30) | unit/rules.test.ts › Elegibilidade na ordem, só vota quem tem 18 anos; integration/voting.test.ts › Idade mínima para votar | — | Implementado |
| RF037 Registrar voto | /consultas/[slug]/participar | `voting.service.ts (castVote)` | integration/voting.test.ts › Registro, atomicidade, concorrência; e2e/citizen.spec.ts | RS001, RS002 | Implementado |
| RF038 Confirmar voto e emitir comprovante | /conta/participacoes/[id] (código na tela, botão Copiar — DT-32), /api/conta/comprovante/[id] | `voting.service.ts (castVote → comprovante)`, `components/copy-button.tsx` | integration/voting.test.ts; e2e/citizen.spec.ts | — | Implementado |
| RF039 Impedir voto duplicado | — | `voting.service.ts + índice único participations_citizen_consultation_uq` | integration/voting.test.ts › Voto único (3 camadas) | RS001 | Implementado |
| RF040 Rejeitar votos fora do período | — | `voting.service.ts (FOR SHARE + horário do servidor)` | integration/voting.test.ts › horário do servidor | RS009 | Implementado |
| RF041 Verificar comprovante de voto | /comprovante | `voting.service.ts (verifyReceipt); actions/citizen.ts (CAPTCHA por IP)` | integration/voting.test.ts › Comprovante público; e2e/citizen.spec.ts | RS002 | Implementado |
| RF042 Apurar votos | rotina automática; /admin/consultas/[id]/resultado (recontagem) | `modules/results/results.service.ts (tallyConsultation); results/tally.ts` | unit/rules.test.ts › Apuração; integration/voting.test.ts | RS003 | Implementado |
| RF043 Homologar e publicar resultado final | /admin/consultas/[id]/resultado | `results.service.ts (publishFinalResult, publishRectification)` | integration/lifecycle.test.ts › resultado e retificação; e2e/admin.spec.ts | RS003 | Implementado |
| RF044 Visualizar resultado da consulta | /consultas/[slug]/resultado, /resultados | `results.service.ts (publicResults)` | e2e/public.spec.ts › resultado publicado; consulta cancelada | — | Implementado |
| RF045 Exportar resultados em formato aberto | /dados-abertos, /api/dados-abertos/[dataset] | `modules/results/open-data.service.ts` | integration/voting.test.ts › exportação; e2e/public.spec.ts | RS005 | Implementado |
| RF046 Gerenciar usuários | /admin/usuarios, /admin/usuarios/convidar, /convite | `modules/admin/users.service.ts; auth.service.ts (acceptInvite)` | integration/administration.test.ts › Gestão de usuários | — | Implementado |
| RF047 Gerenciar papéis e permissões | /admin/papeis, /admin/usuarios/[id] | `users.service.ts (saveRole, deleteRole, setUserRoles)` | integration/administration.test.ts › Papéis e permissões; e2e/admin.spec.ts › menu por permissão | — | Implementado |
| RF048 Monitorar consultas em andamento | /admin/monitoramento | `modules/admin/monitoring.service.ts (monitoringPanel)` | integration/voting.test.ts › painel sem alternativas; e2e/admin.spec.ts | RS008 | Implementado |
| RF049 Gerar relatórios e estatísticas | /admin/relatorios, /api/admin/relatorio | `monitoring.service.ts (generateReport)` | integration/voting.test.ts › relatório sem alternativas | RS002 | Implementado |
| RF050 Disponibilizar portal público de transparência | /transparencia, /indicadores, /como-funciona, /prefeitura | `queries.service.ts (portalIndicators, municipalOrgansSummary)` | e2e/public.spec.ts; integration/performance.test.ts › A Prefeitura | — | Implementado |
| RF051 Exibir histórico público da consulta | /consultas/[slug]/historico | `consultations/common.ts (recordPublicEvent) + gatilho somente acréscimo` | integration/lifecycle.test.ts › histórico | — | Implementado |
| RF052 Gerenciar preferências de notificação | /conta/notificacoes, /avisos/descadastrar | `modules/notifications/notifications.service.ts` | integration/participation.test.ts › preferências | — | Implementado |
| RF053 Notificar nova consulta e abertura | e-mail e /conta/avisos | `notifications/dispatch.ts (notifyPublished, notifyOpened); processOutbox` | integration/administration.test.ts › Avisos de consulta | — | Implementado |
| RF054 Notificar alterações, suspensão e cancelamento | e-mail e /conta/avisos | `dispatch.ts (notifyChange)` | integration/lifecycle.test.ts | — | Implementado |
| RF055 Notificar lembrete, resultado e encaminhamentos | e-mail e /conta/avisos | `scheduler.service.ts (sendReminders); dispatch.ts (notifyVoters)` | integration/lifecycle.test.ts; integration/administration.test.ts › Avisos de consulta | — | Implementado |
| RF056 Consultar acervo de consultas encerradas | /consultas/encerradas | `queries.service.ts (archive)` | e2e/public.spec.ts › consulta cancelada | — | Implementado |
| RF057 Registrar trilha de auditoria | — | `modules/audit/audit.service.ts + gatilhos` | integration/database.test.ts | RS013 | Implementado |
| RF058 Consultar trilha de auditoria | /admin/auditoria, /api/admin/auditoria | `audit.service.ts (searchAudit, verifyAuditChain)` | integration/database.test.ts › detecta adulteração; e2e/admin.spec.ts | RS013 | Implementado |
| RF059 Verificar integridade da votação e da apuração | /admin/consultas/[id]/resultado | `results.service.ts (verifyIntegrity)` | integration/voting.test.ts › integridade | — | Implementado |
| RF060 Tratar inconsistências e incidentes | /admin/incidentes | `modules/integrity/incidents.service.ts` | integration/voting.test.ts › incidente por divergência e alternativa inexistente | — | Implementado |
| RF061 Definir responsáveis e papéis da consulta | /admin/consultas/[id]/responsaveis | `lifecycle.service.ts (setAssignments); access.service.ts (assertConsultationRole)` | integration/lifecycle.test.ts › combinação vedada | RS006 | Implementado |
| RF062 Divulgar consulta | /admin/consultas/[id]/divulgacao | `modules/dissemination/dissemination.service.ts (QR Code)` | integration/administration.test.ts › Divulgação | — | Implementado |
| RF063 Registrar e publicar encaminhamentos | /admin/consultas/[id]/encaminhamentos, /encaminhamentos | `modules/outcomes/outcomes.service.ts` | integration/lifecycle.test.ts › encaminhamentos | — | Implementado |
| RF064 Publicar comentários e perguntas | /consultas/[slug] e /propostas/[protocolo] (seção Comentários) | `modules/moderation/moderation.service.ts (postComment, officialAnswer)` | integration/participation.test.ts › comentários | RS005, RS010, RS011 | Implementado — condicionado (*), desligado por padrão |
| RF065 Denunciar conteúdo | /propostas/[protocolo], comentários | `moderation.service.ts (reportContent)` | integration/participation.test.ts › denúncias | — | Implementado |
| RF066 Moderar conteúdo e revisar decisões | /admin/moderacao, /conta/avisos (pedido de revisão) | `moderation.service.ts (decideModeration, requestModerationReview)` | integration/participation.test.ts › moderação e revisão | RS003 | Implementado |
| RF067 Apoiar proposta cidadã | /propostas/[protocolo] (Apoiar) | `citizen-proposals.service.ts (supportProposal)` | integration/participation.test.ts › Apoios | — | Implementado — condicionado (*), desligado por padrão |
| RF068 Divulgar evento participativo e receber perguntas | /eventos/[id], /admin/eventos | `modules/events/events.service.ts` | integration/administration.test.ts › Eventos participativos | — | Implementado — condicionado (*), desligado por padrão |

## 3. Requisitos de segurança → controles implementados → testes

| RS | Controles no código | Testes |
|---|---|---|
| RS001 | Índice único `participations(consultation_id, citizen_id)`; verificação na regra e na tela; HMAC do CPF mantido após desativação | voting.test.ts › Voto único, simultâneos; auth.test.ts › desativação |
| RS002 | `votes` sem cidadão/horário/comprovante; sem FK para participações; participação só com data; reembaralhamento da chave (sem ligação por `xmin`) + CLUSTER aleatório (DT-31); relatórios com supressão <10 | voting.test.ts › Sigilo do voto (inclui `xmin`) |
| RS003 | Gatilhos impedem UPDATE/DELETE/TRUNCATE em votos e resultados; resultado só por retificação; hash da base | voting.test.ts › votos não podem ser alterados; database.test.ts |
| RS004 | Verificação de identidade; código antes do voto; incidente de cadastro suspeito | voting.test.ts › código; identity (CPF divergente) |
| RS005 | CPF mascarado; exportações agregadas; auditoria sem campos pessoais | voting.test.ts › exportação; participation.test.ts › exportação |
| RS006 | RBAC no servidor; papéis por consulta; segregação; TOTP obrigatório | lifecycle.test.ts › Segregação; auth.test.ts › segundo fator; e2e/admin |
| RS007 | Bloqueio 15 min após 5 falhas; CAPTCHA por IP; link de 30 min uso único; inatividade; HTTPS/HSTS | auth.test.ts |
| RS008 | Painel e páginas só com nº de participações durante a votação | voting.test.ts › painel; e2e/public › sem parciais |
| RS009 | Período conferido pelo relógio do servidor dentro da transação (FOR SHARE) | voting.test.ts › horário do servidor |
| RS010 | Critério etário justificado; modalidade e salvaguardas obrigatórias para menores | unit › elegibilidade; lifecycle (validação) |
| RS011 | Denúncia com protocolo, ocultação preventiva, moderação com revisão | participation.test.ts › moderação |
| RS012 | Tipo real por assinatura, limite de tamanho, antivírus, SHA-256 | participation.test.ts › Anexos; unit › EICAR |
| RS013 | Log encadeado por hash, somente acréscimo, verificação com alerta | database.test.ts |
