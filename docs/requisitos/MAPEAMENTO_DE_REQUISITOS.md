# Mapeamento de requisitos — PPCM

> Gerado a partir da transcrição do Documento de Requisitos v6 (`docs/requisitos/REQUISITOS_COMPLETOS.md`) e da tabela de implementação mantida pela equipe.
> **Critérios de aceitação** = fluxos alternativos e resultados descritos no próprio documento. **Situação** reflete o código desta versão.
> Legenda: (*) item ainda a validar com o cliente — ver `docs/requisitos/PENDENCIAS_CLIENTE.md`.
> Caminhos de código relativos a `src/server/`; serviços de domínio ficam em `src/server/modules/<módulo>/` e as telas em `src/app/`.

## Resumo

| Situação | Quantidade |
|---|---:|
| Implementado | 63 |
| Implementado com simulação | 2 |
| Implementado — condicionado (*), desligado por padrão | 3 |

## Tabela geral

| RF | Requisito | Telas / rotas | Situação |
|---|---|---|---|
| RF001 | Cadastrar cidadão | /cadastro | Implementado |
| RF002 | Validar dados cadastrais | /cadastro, /conta/perfil/editar | Implementado |
| RF003 | Confirmar e-mail e ativar conta | /confirmar-email, /reenviar-confirmacao | Implementado |
| RF004 | Verificar identidade e domicílio do cidadão | /conta/verificacao, /demo/provedor-identidade, /admin/verificacoes | Implementado com simulação |
| RF005 | Realizar login | /entrar, /entrar/segundo-fator | Implementado |
| RF006 | Realizar logout | menu Sair, /conta/privacidade (sessões) | Implementado |
| RF007 | Recuperar senha | /recuperar-senha, /redefinir-senha | Implementado |
| RF008 | Alterar senha | /conta/senha, /admin/senha | Implementado |
| RF009 | Controlar acesso por perfil, papel e permissão | todas as rotas protegidas | Implementado |
| RF010 | Controlar tentativas de autenticação | /entrar (CAPTCHA) | Implementado |
| RF011 | Confirmar identidade antes do voto | /consultas/[slug]/participar (passo 2) | Implementado com simulação |
| RF012 | Visualizar perfil | /conta | Implementado |
| RF013 | Atualizar dados do perfil | /conta/perfil/editar | Implementado |
| RF014 | Acompanhar participações e propostas | /conta/participacoes, /conta/participacoes/[id] | Implementado |
| RF015 | Exercer direitos do titular de dados (LGPD) | /conta/privacidade, /api/conta/dados/[id] | Implementado |
| RF016 | Listar consultas públicas | /consultas, / | Implementado |
| RF017 | Pesquisar e filtrar consultas | /consultas, /consultas/pesquisa | Implementado |
| RF018 | Visualizar detalhes da consulta | /consultas/[slug] | Implementado |
| RF019 | Determinar a situação da consulta | rotina automática (instrumentation) e /admin/monitoramento | Implementado |
| RF020 | Enviar proposta cidadã | /conta/propostas/nova | Implementado |
| RF021 | Analisar e responder proposta cidadã | /admin/propostas, /admin/propostas/[id] | Implementado |
| RF022 | Cadastrar proposta municipal | /admin/propostas-municipais | Implementado |
| RF023 | Anexar documentos e materiais audiovisuais | /admin/consultas/[id]/anexos, /admin/propostas-municipais/[id], /api/anexos/[id] | Implementado |
| RF024 | Editar proposta e consulta em elaboração | /admin/consultas/[id]/editar | Implementado |
| RF025 | Cadastrar consulta pública | /admin/consultas/nova | Implementado |
| RF026 | Definir alternativas de resposta | /admin/consultas/[id]/alternativas | Implementado |
| RF027 | Definir público-alvo e critérios de participação | /admin/consultas/[id]/publico-alvo | Implementado |
| RF028 | Revisar e submeter consulta para aprovação | /admin/consultas/[id] (pendências), /admin/consultas/[id]/revisao | Implementado |
| RF029 | Aprovar consulta e autorizar prazo excepcional | /admin/consultas/[id]/aprovacao | Implementado |
| RF030 | Publicar consulta | /admin/consultas/[id]/conducao | Implementado |
| RF031 | Abrir votação | rotina automática | Implementado |
| RF032 | Alterar consulta publicada | /admin/consultas/[id]/conducao | Implementado |
| RF033 | Suspender e retomar consulta | /admin/consultas/[id]/conducao | Implementado |
| RF034 | Cancelar consulta | /admin/consultas/[id]/conducao | Implementado |
| RF035 | Encerrar votação | rotina automática | Implementado |
| RF036 | Verificar elegibilidade do cidadão | /consultas/[slug], /consultas/[slug]/participar | Implementado |
| RF037 | Registrar voto | /consultas/[slug]/participar | Implementado |
| RF038 | Confirmar voto e emitir comprovante | /conta/participacoes/[id], /api/conta/comprovante/[id] | Implementado |
| RF039 | Impedir voto duplicado | — | Implementado |
| RF040 | Rejeitar votos fora do período | — | Implementado |
| RF041 | Verificar comprovante de voto | /comprovante | Implementado |
| RF042 | Apurar votos | rotina automática; /admin/consultas/[id]/resultado (recontagem) | Implementado |
| RF043 | Homologar e publicar resultado final | /admin/consultas/[id]/resultado | Implementado |
| RF044 | Visualizar resultado da consulta | /consultas/[slug]/resultado, /resultados | Implementado |
| RF045 | Exportar resultados em formato aberto | /dados-abertos, /api/dados-abertos/[dataset] | Implementado |
| RF046 | Gerenciar usuários | /admin/usuarios, /admin/usuarios/convidar, /convite | Implementado |
| RF047 | Gerenciar papéis e permissões | /admin/papeis, /admin/usuarios/[id] | Implementado |
| RF048 | Monitorar consultas em andamento | /admin/monitoramento | Implementado |
| RF049 | Gerar relatórios e estatísticas | /admin/relatorios, /api/admin/relatorio | Implementado |
| RF050 | Disponibilizar portal público de transparência | /transparencia, /indicadores, /como-funciona | Implementado |
| RF051 | Exibir histórico público da consulta | /consultas/[slug]/historico | Implementado |
| RF052 | Gerenciar preferências de notificação | /conta/notificacoes, /avisos/descadastrar | Implementado |
| RF053 | Notificar nova consulta e abertura | e-mail e /conta/avisos | Implementado |
| RF054 | Notificar alterações, suspensão e cancelamento | e-mail e /conta/avisos | Implementado |
| RF055 | Notificar lembrete, resultado e encaminhamentos | e-mail e /conta/avisos | Implementado |
| RF056 | Consultar acervo de consultas encerradas | /consultas/encerradas | Implementado |
| RF057 | Registrar trilha de auditoria | — | Implementado |
| RF058 | Consultar trilha de auditoria | /admin/auditoria, /api/admin/auditoria | Implementado |
| RF059 | Verificar integridade da votação e da apuração | /admin/consultas/[id]/resultado | Implementado |
| RF060 | Tratar inconsistências e incidentes | /admin/incidentes | Implementado |
| RF061 | Definir responsáveis e papéis da consulta | /admin/consultas/[id]/responsaveis | Implementado |
| RF062 | Divulgar consulta | /admin/consultas/[id]/divulgacao | Implementado |
| RF063 | Registrar e publicar encaminhamentos | /admin/consultas/[id]/encaminhamentos, /encaminhamentos | Implementado |
| RF064 | Publicar comentários e perguntas | /consultas/[slug] e /propostas/[protocolo] (seção Comentários) | Implementado — condicionado (*), desligado por padrão |
| RF065 | Denunciar conteúdo | /propostas/[protocolo], comentários | Implementado |
| RF066 | Moderar conteúdo e revisar decisões | /admin/moderacao, /conta/avisos (pedido de revisão) | Implementado |
| RF067 | Apoiar proposta cidadã | /propostas/[protocolo] (Apoiar) | Implementado — condicionado (*), desligado por padrão |
| RF068 | Divulgar evento participativo e receber perguntas | /eventos/[id], /admin/eventos | Implementado — condicionado (*), desligado por padrão |

## Detalhamento por requisito

### RF001 — Cadastrar cidadão

- **Objetivo:** O sistema deve permitir que uma pessoa física crie conta de cidadão com nome completo, CPF, data de nascimento, e-mail, endereço no município, senha e aceite dos Termos de Uso e da Política de Privacidade; o celular é opcional. Cada dado tem finalidade declarada: o CPF garante uma conta por pessoa (RN02) e a verificação de identidade (RF004), nunca é exibido e pode vir do provedor de identidade; a data de nascimento só é usada em consulta com critério etário justificado (RN35, RN40); o endereço apoia consultas territoriais (RF027).
- **Funcionalidade implementada:** /cadastro
- **Código:** modules/auth/auth.service.ts (registerCitizen)
- **Regras de negócio:** CPF único (RN02); Política de senha (RN23); Proteção de dados (RN27); Dados de elegibilidade (RN31); Crianças e adolescentes (RN40).
- **Dependências (matriz do documento):** depende de RF002, RF003; relaciona-se com RF004, RF007, RF027
- **Requisitos de segurança relacionados:** RS004
- **Critérios de aceitação:**
  - Dados inválidos: Campos com erro destacados; nada é gravado.
  - CPF ou e-mail já cadastrado: Oferece recuperação de acesso (RF007), sem revelar a conta.
  - Resultado esperado: Conta pendente; ainda não vota.
- **Casos de teste:** integration/auth.test.ts › Cadastro; e2e/citizen.spec.ts › cadastro
- **Situação:** Implementado — CPF guardado como HMAC + forma mascarada (DT-06).
- **Pendência com o cliente (*):** Dados exigidos no cadastro e obrigatoriedade do CPF.

### RF002 — Validar dados cadastrais

- **Objetivo:** O sistema deve validar no servidor, antes de gravar, os dados de RF001 e RF013 quanto a obrigatoriedade, formato, consistência e unicidade, mesmo que a interface também valide.
- **Funcionalidade implementada:** /cadastro, /conta/perfil/editar
- **Código:** auth.service.ts (registrationSchema), profile.service.ts
- **Regras de negócio:** Elegibilidade (RN01); CPF único (RN02); Política de senha (RN23); Proteção de dados (RN27).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF001, RF013, RF036
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Endereço fora do município: Cadastro aceito; a elegibilidade é verificada por consulta (RF036).
  - Resultado esperado: Nenhum dado inválido persistido.
- **Casos de teste:** integration/auth.test.ts › todos os erros por campo; unit/rules.test.ts › CPF
- **Situação:** Implementado

### RF003 — Confirmar e-mail e ativar conta

- **Objetivo:** O sistema deve confirmar a posse do e-mail por link com token aleatório, de uso único e válido por 24 horas, mudando a conta para "Ativa".
- **Funcionalidade implementada:** /confirmar-email, /reenviar-confirmacao
- **Código:** auth.service.ts (sendEmailConfirmation, confirmEmail, resendConfirmation)
- **Regras de negócio:** Conta ativa (RN03).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF004
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Link expirado ou inválido: Reenvio limitado a 3 por hora, sem revelar se o e-mail existe.
  - Resultado esperado: Conta ativa; a verificação (RF004) ainda é necessária para votar.
- **Casos de teste:** integration/auth.test.ts › Confirmação de e-mail
- **Situação:** Implementado — Confirmação por clique (POST) para que pré-visualizadores de link não consumam o token.

### RF004 — Verificar identidade e domicílio do cidadão

- **Objetivo:** O sistema deve permitir que o cidadão comprove ser titular do CPF e, quando exigido, morador do município, pelo login gov.br (nível prata ou superior) ou por análise de documentos por um administrador.
- **Funcionalidade implementada:** /conta/verificacao, /demo/provedor-identidade, /admin/verificacoes
- **Código:** modules/identity/identity.service.ts; lib/identity-provider.ts
- **Regras de negócio:** Elegibilidade (RN01); CPF único (RN02); Identidade verificada (RN04); Proteção de dados (RN27); Dados de elegibilidade (RN31).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS004
- **Critérios de aceitação:**
  - Verificação documental: Documentos (até 5 MB) ficam "Em análise" até aprovação ou recusa motivada.
  - CPF divergente: Recusa registrada na auditoria.
  - Resultado esperado: Conta verificada ou recusa motivada; documentos com acesso restrito.
- **Casos de teste:** integration/administration.test.ts › Verificação de identidade e domicílio; e2e/citizen.spec.ts › orientação de verificação
- **Situação:** Implementado com simulação — Provedor gov.br SIMULADO (DT-09); análise documental real.

### RF005 — Realizar login

- **Objetivo:** O sistema deve autenticar contas ativas por CPF ou e-mail e senha, ou pelo gov.br, criando sessão segura; contas administrativas exigem segundo fator.
- **Funcionalidade implementada:** /entrar, /entrar/segundo-fator
- **Código:** auth.service.ts (login, verifySecondFactor); session.service.ts
- **Regras de negócio:** Conta ativa (RN03); Tentativas de login (RN24); Expiração da sessão (RN26).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF010
- **Requisitos de segurança relacionados:** RS007
- **Critérios de aceitação:**
  - Credenciais inválidas: Mensagem genérica e contagem de falha (RF010).
  - Conta pendente ou bloqueada: Informa a situação e a ação possível.
- **Casos de teste:** integration/auth.test.ts › Login; e2e/admin.spec.ts › segundo fator
- **Situação:** Implementado — TOTP obrigatório para contas administrativas.

### RF006 — Realizar logout

- **Objetivo:** O sistema deve encerrar a sessão no servidor quando o usuário pedir, encerrar automaticamente sessões inativas e permitir encerrar as sessões de outros dispositivos.
- **Funcionalidade implementada:** menu Sair, /conta/privacidade (sessões)
- **Código:** session.service.ts (revokeSession, revokeAllSessions); actions/auth.ts (logoutAction)
- **Regras de negócio:** Expiração da sessão (RN26).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Sessão expirada: Pede novo login e descarta operações não concluídas, inclusive voto não confirmado.
- **Casos de teste:** integration/auth.test.ts › sessão expira por inatividade
- **Situação:** Implementado

### RF007 — Recuperar senha

- **Objetivo:** O sistema deve permitir redefinir a senha por link enviado ao e-mail cadastrado, sem revelar se o CPF ou e-mail possui conta.
- **Funcionalidade implementada:** /recuperar-senha, /redefinir-senha
- **Código:** auth.service.ts (requestPasswordReset, resetPassword)
- **Regras de negócio:** Política de senha (RN23); Link de recuperação (RN25).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS007
- **Critérios de aceitação:**
  - Link expirado ou usado: Nova solicitação, até 3 por hora.
- **Casos de teste:** integration/auth.test.ts › Recuperação
- **Situação:** Implementado

### RF008 — Alterar senha

- **Objetivo:** O sistema deve permitir que o usuário autenticado altere a senha informando a atual, a nova e a confirmação.
- **Funcionalidade implementada:** /conta/senha, /admin/senha
- **Código:** auth.service.ts (changePassword)
- **Regras de negócio:** Política de senha (RN23).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF010
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Senha atual incorreta: Recusa contada como falha (RF010).
- **Casos de teste:** integration/auth.test.ts › senha atual incorreta conta como falha
- **Situação:** Implementado

### RF009 — Controlar acesso por perfil, papel e permissão

- **Objetivo:** O sistema deve verificar em toda requisição a autenticação, o perfil, o papel e a posse do recurso; o cidadão acessa apenas os próprios dados.
- **Funcionalidade implementada:** todas as rotas protegidas
- **Código:** server/auth/current.ts (requireCitizen/requireAdmin); modules/access/access.service.ts
- **Regras de negócio:** Segregação de funções (RN20); Gestão de acessos (RN21); Contas administrativas não votam (RN22); Responsabilidades (RN36).
- **Dependências (matriz do documento):** depende de RF047; relaciona-se com —
- **Requisitos de segurança relacionados:** RS006
- **Critérios de aceitação:**
  - Não autenticado: Redireciona ao login.
  - Sem permissão ou recurso alheio: Acesso negado, nada é alterado e a tentativa é auditada.
- **Casos de teste:** integration/auth.test.ts › Controle de acesso; e2e/public.spec.ts › áreas protegidas; e2e/admin.spec.ts
- **Situação:** Implementado — Verificação no servidor em toda página/ação e repetida nos serviços.

### RF010 — Controlar tentativas de autenticação

- **Objetivo:** O sistema deve contar falhas por conta e por IP e bloquear temporariamente a conta no limite (RN24), contra força bruta.
- **Funcionalidade implementada:** /entrar (CAPTCHA)
- **Código:** auth.service.ts (recordAuthFailure, requiresCaptcha); lib/captcha.ts
- **Regras de negócio:** Tentativas de login (RN24).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Muitas falhas do mesmo IP: Exige CAPTCHA desse IP.
- **Casos de teste:** integration/auth.test.ts › bloqueio 15 min; CAPTCHA por IP
- **Situação:** Implementado — CAPTCHA aritmético próprio (DT-12).

### RF011 — Confirmar identidade antes do voto

- **Objetivo:** Antes de gravar o voto, o sistema deve exigir confirmação adicional por código de 6 dígitos (válido por 5 minutos) enviado ao e-mail ou celular, ou por reautenticação no gov.br.
- **Funcionalidade implementada:** /consultas/[slug]/participar (passo 2)
- **Código:** modules/voting/voting.service.ts (requestVoteCode)
- **Regras de negócio:** Identidade verificada (RN04); Período de votação (RN08).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Código incorreto ou expirado: Após 3 erros, a votação é interrompida.
- **Casos de teste:** integration/voting.test.ts › código; e2e/citizen.spec.ts
- **Situação:** Implementado com simulação — E-mail real via fila; SMS simulado (sem provedor de SMS no documento).

### RF012 — Visualizar perfil

- **Objetivo:** O sistema deve exibir ao cidadão os dados da própria conta (CPF mascarado), a situação da verificação e um resumo de elegibilidade com o motivo e a ação necessária quando houver impedimento.
- **Funcionalidade implementada:** /conta
- **Código:** modules/profile/profile.service.ts (getProfile, eligibilitySummary)
- **Regras de negócio:** Proteção de dados (RN27).
- **Dependências (matriz do documento):** depende de RF004, RF008, RF013, RF014, RF015, RF052  —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS005
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** integration/administration.test.ts › Visualização do perfil
- **Situação:** Implementado

### RF013 — Atualizar dados do perfil

- **Objetivo:** O sistema deve permitir alterar nome social, e-mail, celular e endereço; o CPF é imutável e nome civil e nascimento só mudam após verificação documental.
- **Funcionalidade implementada:** /conta/perfil/editar
- **Código:** profile.service.ts (updateProfile); identity.service.ts (correção documental)
- **Regras de negócio:** Elegibilidade (RN01); CPF único (RN02); Proteção de dados (RN27); Dados de elegibilidade (RN31).
- **Dependências (matriz do documento):** depende de RF002; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Novo e-mail: Vale após confirmação; o anterior é avisado.
  - Novo endereço: Exige nova comprovação; votos registrados não são afetados.
- **Casos de teste:** integration/administration.test.ts › Atualização do perfil
- **Situação:** Implementado — Nome civil/nascimento só por verificação documental.

### RF014 — Acompanhar participações e propostas

- **Objetivo:** O sistema deve listar as consultas em que o cidadão votou (data, comprovante, situação, resultado e encaminhamentos) e as propostas que enviou, com estado e respostas (RN30), sem nunca exibir a opção votada (RN07).
- **Funcionalidade implementada:** /conta/participacoes, /conta/participacoes/[id]
- **Código:** voting.service.ts (myParticipations)
- **Regras de negócio:** Sigilo do voto (RN07); Consulta cancelada (RN10); Propostas cidadãs (RN30); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF020, RF041, RF063; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Consulta cancelada: Indica que os votos não foram apurados.
- **Casos de teste:** integration/voting.test.ts › histórico sem a opção votada; e2e/citizen.spec.ts
- **Situação:** Implementado — Proposta da equipe (*) — mantida ativa por ser essencial ao comprovante.
- **Pendência com o cliente (*):** funcionalidade proposta pela equipe; precisa do aceite do cliente.

### RF015 — Exercer direitos do titular de dados (LGPD)

- **Objetivo:** O sistema deve permitir obter cópia dos dados pessoais em formato estruturado e desativar a conta com anonimização, sem alterar votos nem resultados e mantendo o hash do CPF para impedir novo voto.
- **Funcionalidade implementada:** /conta/privacidade, /api/conta/dados/[id]
- **Código:** profile.service.ts (requestDataCopy, deactivateAccount)
- **Regras de negócio:** Voto único (RN05); Proteção de dados (RN27); Participação após desativação (RN33).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Desativação: Encerra sessões e anonimiza nome, e-mail, celular e endereço.
- **Casos de teste:** integration/participation.test.ts › LGPD; integration/auth.test.ts › desativação
- **Situação:** Implementado

### RF016 — Listar consultas públicas

- **Objetivo:** O sistema deve exibir a todos as consultas publicadas (título, resumo, tema, região, situação, período e participações), com as abertas primeiro, pelo encerramento mais próximo; Rascunho, Em análise e Rejeitada nunca aparecem.
- **Funcionalidade implementada:** /consultas, /
- **Código:** modules/consultations/queries.service.ts (listPublicConsultations)
- **Regras de negócio:** Prazo de participação (RN14); Sigilo das parciais (RN16).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF052
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Nenhuma consulta: Oferece inscrição em avisos (RF052).
- **Casos de teste:** integration/lifecycle.test.ts › não aparece antes de publicada; e2e/public.spec.ts
- **Situação:** Implementado

### RF017 — Pesquisar e filtrar consultas

- **Objetivo:** O sistema deve buscar consultas por palavras-chave, sem diferenciar maiúsculas e acentos, com filtros de situação, tema, região e período e, para o cidadão, "ainda não participei" e "posso participar".
- **Funcionalidade implementada:** /consultas, /consultas/pesquisa
- **Código:** queries.service.ts (filtros, busca normalizada)
- **Regras de negócio:** —
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Nenhum resultado: Sugere remover filtros.
- **Casos de teste:** e2e/public.spec.ts › busca sem acentos
- **Situação:** Implementado

### RF018 — Visualizar detalhes da consulta

- **Objetivo:** O sistema deve exibir: título, tema, problema, objetivo, justificativa, pergunta e alternativas explicadas, orientações, público-alvo (ou "aberta ao público em geral"), abertura e encerramento com dias restantes, justificativa de prazo reduzido (RN14), natureza consultiva e o que acontece depois (RN34, RN42), unidade responsável, documentos e mídias com alternativa textual (RF023), histórico (RF051), participações e, depois, resultado (RF044) e encaminhamentos (RF063). Vídeos nunca são condição para participar (RN37).
- **Funcionalidade implementada:** /consultas/[slug]
- **Código:** queries.service.ts (getPublicConsultation); voting/eligibility.ts
- **Regras de negócio:** Voto único (RN05); Voto irretratável (RN06); Prazo de participação (RN14); Sigilo das parciais (RN16); Natureza consultiva (RN34); Público-alvo (RN35); Conteúdo mínimo (RN37); Resultados (RN41); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF019, RF023, RF036, RF044, RF063; relaciona-se com RF051
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Suspensa ou cancelada: Aviso e justificativa; voto desabilitado.
  - Prazo reduzido: Selo "Prazo excepcional de 10 dias".
  - Mídia indisponível: Exibe a alternativa textual.
- **Casos de teste:** e2e/public.spec.ts; e2e/citizen.spec.ts
- **Situação:** Implementado
- **Pendência com o cliente (*):** Caráter sempre consultivo da votação; nível de acessibilidade exigido.

### RF019 — Determinar a situação da consulta

- **Objetivo:** O sistema deve manter a situação de cada consulta conforme o ciclo de vida (seção 6.1), abrindo e encerrando automaticamente nas datas definidas e aplicando só as transições permitidas.
- **Funcionalidade implementada:** rotina automática (instrumentation) e /admin/monitoramento
- **Código:** modules/scheduler/scheduler.service.ts (runSchedulerTick)
- **Regras de negócio:** Período de votação (RN08); Consulta suspensa (RN09); Consulta cancelada (RN10); Encerramento irreversível (RN32).
- **Dependências (matriz do documento):** depende de RF031, RF035; relaciona-se com RF040
- **Requisitos de segurança relacionados:** RS009
- **Critérios de aceitação:**
  - Transição inválida ou rotina atrasada: Recusada e registrada; nenhum voto é aceito fora do período (RF040).
- **Casos de teste:** integration/lifecycle.test.ts › ciclo completo; integration/voting.test.ts › encerramento
- **Situação:** Implementado — Executa a cada minuto no processo do servidor.

### RF020 — Enviar proposta cidadã

- **Objetivo:** O sistema deve permitir que o cidadão envie proposta de competência municipal com título (até 120 caracteres), problema, solução sugerida, tema, região, até 3 anexos e a indicação de que autoriza ou não a publicação do texto, sempre sem seus dados pessoais. Antes do envio, mostra propostas semelhantes. A proposta não gera votação automática e segue os estados da RN30.
- **Funcionalidade implementada:** /conta/propostas/nova
- **Código:** modules/proposals/citizen-proposals.service.ts (submitCitizenProposal, findSimilar)
- **Regras de negócio:** Identidade verificada (RN04); Proteção de dados (RN27); Propostas cidadãs (RN30); Manifestação não é voto (RN38).
- **Dependências (matriz do documento):** depende de RF004, RF014, RF021; relaciona-se com RF067
- **Requisitos de segurança relacionados:** RS011, RS012
- **Critérios de aceitação:**
  - Proposta semelhante: Pode apoiar a existente (RF067, se adotado) ou prosseguir.
  - Limite atingido ou identidade não verificada: Envio bloqueado com orientação.
  - Resultado esperado: Proposta visível ao autor (RF014).
- **Casos de teste:** integration/participation.test.ts › Propostas cidadãs
- **Situação:** Implementado
- **Pendência com o cliente (*):** Limite, apoios e metas das propostas cidadãs.

### RF021 — Analisar e responder proposta cidadã

- **Objetivo:** O sistema deve permitir que o administrador com papel de análise conduza a proposta pelos estados da RN30: Em análise; Ajuste solicitado, com orientação ao autor; Respondida, com resposta justificada (convertida em proposta municipal, encaminhada a outro órgão ou não acolhida); Publicada, se autorizada; e Encerrada. Cada mudança notifica o autor e fica no histórico.
- **Funcionalidade implementada:** /admin/propostas, /admin/propostas/[id]
- **Código:** citizen-proposals.service.ts (analyzeProposal); scheduler (prazo de ajuste)
- **Regras de negócio:** Justificativa obrigatória (RN11); Propostas cidadãs (RN30); Limites administrativos (RN39); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF020, RF022, RF066; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Ajuste sem retorno no prazo (parâmetro pendente): Encerrada com justificativa.
  - Conteúdo impróprio: Segue a moderação (RF066).
- **Casos de teste:** integration/participation.test.ts › percorre os estados
- **Situação:** Implementado — Prazo de ajuste parametrizável (pendente *).
- **Pendência com o cliente (*):** Limite, apoios e metas das propostas cidadãs; prazos de resposta da administração e de guarda dos registros.

### RF022 — Cadastrar proposta municipal

- **Objetivo:** O sistema deve permitir cadastrar a proposta oficial objeto de consulta, com título, resumo, descrição, justificativa, objetivos, tema, abrangência e órgão responsável; custo, fonte de recursos e prazo de execução são opcionais.
- **Funcionalidade implementada:** /admin/propostas-municipais
- **Código:** modules/proposals/municipal-proposals.service.ts
- **Regras de negócio:** Segregação de funções (RN20).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF028
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Rascunho incompleto: Pode ser salvo; a validação completa ocorre na submissão (RF028).
- **Casos de teste:** integration/lifecycle.test.ts
- **Situação:** Implementado

### RF023 — Anexar documentos e materiais audiovisuais

- **Objetivo:** O sistema deve permitir anexar documentos (PDF, ODS, XLSX, CSV), imagens, áudios, vídeos gravados e links de transmissão ou gravação em serviço externo, além de links oficiais. Imagens exigem texto alternativo; vídeo e áudio exigem transcrição ou resumo e, havendo fala, legenda. Limites: 20 MB por arquivo e 10 anexos. Mídias são opcionais e nunca condição para votar (RN37).
- **Funcionalidade implementada:** /admin/consultas/[id]/anexos, /admin/propostas-municipais/[id], /api/anexos/[id]
- **Código:** modules/attachments/attachments.service.ts; lib/files.ts
- **Regras de negócio:** Justificativa obrigatória (RN11); Imutabilidade após publicação (RN12); Conteúdo mínimo (RN37).
- **Dependências (matriz do documento):** depende de RF018, RF028; relaciona-se com RF032
- **Requisitos de segurança relacionados:** RS012
- **Critérios de aceitação:**
  - Consulta publicada: Só acréscimo justificado (RF032).
  - Arquivo inválido ou sem alternativa: Recusado e registrado.
  - Link indisponível: Alerta o responsável e mostra a alternativa textual.
- **Casos de teste:** integration/participation.test.ts › Anexos; unit/rules.test.ts › tipo real e EICAR; security/security.test.ts › Links externos e SSRF
- **Situação:** Implementado — Antivírus: ClamAV quando configurado; verificação embutida na demonstração (DT-11).
- **Pendência com o cliente (*):** Quais formas de participação entram nesta versão.

### RF024 — Editar proposta e consulta em elaboração

- **Objetivo:** O sistema deve permitir editar propostas e consultas em Rascunho ou Rejeitada, mantendo as versões anteriores; Em análise, a edição é bloqueada.
- **Funcionalidade implementada:** /admin/consultas/[id]/editar
- **Código:** lifecycle.service.ts (updateConsultation); common.ts (saveVersion)
- **Regras de negócio:** Imutabilidade após publicação (RN12); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF032
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Item Em análise ou publicado: Bloqueado (publicados seguem RF032).
  - Edição simultânea: Mostra as diferenças, sem sobrescrever.
- **Casos de teste:** integration/lifecycle.test.ts › edição simultânea
- **Situação:** Implementado

### RF025 — Cadastrar consulta pública

- **Objetivo:** O sistema deve permitir criar a consulta de uma proposta com tema, problema, objetivo, justificativa, forma de participação, pergunta clara e neutra (até 300 caracteres), alternativas (RF026), público-alvo (RF027), orientações, abertura e encerramento, regra de apuração (RN18), quórum de referência se adotado (RN17) e o que ocorrerá após o encerramento. O período padrão é de 20 dias; a redução para 10 exige emergência justificada e autorizada (RF029). A natureza é sempre consultiva (RN34); a opção "vinculante" da versão anterior foi removida.
- **Funcionalidade implementada:** /admin/consultas/nova
- **Código:** lifecycle.service.ts (createConsultation)
- **Regras de negócio:** Alternativas de voto (RN13); Prazo de participação (RN14); Antecedência da publicação (RN15); Quórum de referência (RN17); Regra de apuração (RN18); Natureza consultiva (RN34); Público-alvo (RN35); Responsabilidades (RN36); Conteúdo mínimo (RN37).
- **Dependências (matriz do documento):** depende de RF022, RF026, RF027, RF061; relaciona-se com RF029
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Prazo reduzido: Marca "emergência" e justifica; aguarda autorização.
  - Tema com rito próprio (Plano Diretor ou outro): Exige confirmar que a norma aplicável foi verificada.
  - Período fora da regra ou datas inválidas: Não grava.
- **Casos de teste:** integration/lifecycle.test.ts › período mínimo
- **Situação:** Implementado
- **Pendência com o cliente (*):** Prazo padrão de 20 dias; redução para 10 dias e o que conta como emergência; quem autoriza a redução do prazo.

### RF026 — Definir alternativas de resposta

- **Objetivo:** O sistema deve permitir definir de 2 a 10 alternativas, com rótulo, explicação e ordem, com modelos como "Sim/Não" e "Concordo/Discordo" para quando forem adequados; a abstenção, se habilitada, não é voto válido.
- **Funcionalidade implementada:** /admin/consultas/[id]/alternativas
- **Código:** lifecycle.service.ts (setAlternatives)
- **Regras de negócio:** Imutabilidade após publicação (RN12); Alternativas de voto (RN13).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Quantidade inválida ou rótulos repetidos: Bloqueado.
- **Casos de teste:** integration/lifecycle.test.ts › alternativas
- **Situação:** Implementado

### RF027 — Definir público-alvo e critérios de participação

- **Objetivo:** O sistema deve permitir definir o público-alvo de cada consulta: "aberta ao público em geral" ou com limitações justificadas por território, domicílio, faixa etária ou outro critério, publicadas em linguagem simples. Não há idade mínima geral; critério etário só por consulta, justificado e conforme a RN40. Até a resposta do cliente (*), o padrão herdado da versão anterior é o domicílio no município.
- **Funcionalidade implementada:** /admin/consultas/[id]/publico-alvo
- **Código:** lifecycle.service.ts (setAudience, estimateEligible)
- **Regras de negócio:** Elegibilidade (RN01); Imutabilidade após publicação (RN12); Público-alvo (RN35); Crianças e adolescentes (RN40).
- **Dependências (matriz do documento):** depende de RF018, RF025, RF036; relaciona-se com RF028
- **Requisitos de segurança relacionados:** RS010
- **Critérios de aceitação:**
  - Consulta voltada a crianças e adolescentes: Exige a modalidade (informativa, educativa, proposta ou voto) e as salvaguardas da RN40, com revisão (RF028).
  - Limitação sem justificativa: Bloqueada.
- **Casos de teste:** integration/lifecycle.test.ts › limitação sem justificativa; unit › elegibilidade
- **Situação:** Implementado — Critério 'outro' é informativo (pendência).
- **Pendência com o cliente (*):** Público-alvo padrão das consultas; participação de crianças e adolescentes.

### RF028 — Revisar e submeter consulta para aprovação

- **Objetivo:** O sistema deve exigir, antes da aprovação, validação completa e revisão por pessoa diferente do elaborador (RN36), com lista de verificação registrada: conteúdo mínimo (RN37); pergunta clara e neutra; alternativas equilibradas e mutuamente exclusivas; contexto suficiente; público-alvo justificado; período conforme a RN14; materiais com alternativa textual; linguagem simples.
- **Funcionalidade implementada:** /admin/consultas/[id] (pendências), /admin/consultas/[id]/revisao
- **Código:** lifecycle.service.ts (consultationPendencies, submitForReview, reviewConsultation)
- **Regras de negócio:** Prazo de participação (RN14); Antecedência da publicação (RN15); Segregação de funções (RN20); Responsabilidades (RN36); Conteúdo mínimo (RN37).
- **Dependências (matriz do documento):** depende de RF025, RF026, RF027, RF029; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Problema apontado: Volta a Rascunho com observações.
  - Pendências: Listadas com link para o campo.
- **Casos de teste:** integration/lifecycle.test.ts › Segregação
- **Situação:** Implementado — Estado intermediário 'Aguardando revisão' (DT-15).
- **Pendência com o cliente (*):** Divisão do Administrador em papéis.

### RF029 — Aprovar consulta e autorizar prazo excepcional

- **Objetivo:** O sistema deve permitir que aprovador diferente do elaborador, do último editor e do revisor aprove ou rejeite a consulta e, havendo pedido de redução para 10 dias, que quem tem o papel "autorizar prazo excepcional" decida sobre a emergência, com justificativa publicada. Quem pode exercer esse papel é decisão pendente (*).
- **Funcionalidade implementada:** /admin/consultas/[id]/aprovacao
- **Código:** lifecycle.service.ts (decideApproval, decideExceptionalDeadline)
- **Regras de negócio:** Justificativa obrigatória (RN11); Prazo de participação (RN14); Antecedência da publicação (RN15); Segregação de funções (RN20); Responsabilidades (RN36).
- **Dependências (matriz do documento):** depende de RF028, RF030, RF061; relaciona-se com —
- **Requisitos de segurança relacionados:** RS006
- **Critérios de aceitação:**
  - Redução negada: Volta a Rascunho com 20 dias sugeridos.
  - Antecedência insuficiente: Aprovação bloqueada.
- **Casos de teste:** integration/lifecycle.test.ts › ninguém aprova o que elaborou; prazo excepcional; antecedência
- **Situação:** Implementado
- **Pendência com o cliente (*):** Redução para 10 dias e o que conta como emergência; quem autoriza a redução do prazo.

### RF030 — Publicar consulta

- **Objetivo:** O sistema deve tornar pública a consulta aprovada, mudando-a para Agendada, com endereço permanente e contagem regressiva para a abertura.
- **Funcionalidade implementada:** /admin/consultas/[id]/conducao
- **Código:** lifecycle.service.ts (publishConsultation, unscheduleConsultation)
- **Regras de negócio:** Imutabilidade após publicação (RN12); Antecedência da publicação (RN15).
- **Dependências (matriz do documento):** depende de RF053; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Agendamento desfeito antes da data: Volta a Em análise.
- **Casos de teste:** integration/lifecycle.test.ts › ciclo completo
- **Situação:** Implementado

### RF031 — Abrir votação

- **Objetivo:** O sistema deve abrir automaticamente a votação no horário de abertura, mudando para Aberta e registrando um retrato dos parâmetros vigentes (alternativas, público-alvo, quórum e elegíveis estimados).
- **Funcionalidade implementada:** rotina automática
- **Código:** scheduler.service.ts (openDueConsultations)
- **Regras de negócio:** Período de votação (RN08); Imutabilidade após publicação (RN12).
- **Dependências (matriz do documento):** depende de RF019, RF053; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Suspensa antes da abertura: Aguarda a retomada.
- **Casos de teste:** integration/lifecycle.test.ts › abertura
- **Situação:** Implementado — Retrato dos parâmetros em consultations.open_snapshot.

### RF032 — Alterar consulta publicada

- **Objetivo:** O sistema deve permitir, com justificativa e registro público, apenas correção textual que não mude o sentido, inclusão de anexos, prorrogação antes do encerramento e ajuste da abertura enquanto Agendada.
- **Funcionalidade implementada:** /admin/consultas/[id]/conducao
- **Código:** lifecycle.service.ts (alterPublished)
- **Regras de negócio:** Voto irretratável (RN06); Justificativa obrigatória (RN11); Imutabilidade após publicação (RN12); Encerramento irreversível (RN32).
- **Dependências (matriz do documento):** depende de RF054; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Alteração proibida: Recusada; orienta cancelar e criar nova consulta.
  - Correção que muda o sentido: Exige o aprovador.
- **Casos de teste:** integration/lifecycle.test.ts › alteração e bloqueio de alternativas
- **Situação:** Implementado

### RF033 — Suspender e retomar consulta

- **Objetivo:** O sistema deve permitir suspender consulta Agendada ou Aberta, com justificativa pública; durante a suspensão nenhum voto é aceito e os registrados são preservados.
- **Funcionalidade implementada:** /admin/consultas/[id]/conducao
- **Código:** lifecycle.service.ts (suspend/resume/closeSuspendedForTally)
- **Regras de negócio:** Consulta suspensa (RN09); Justificativa obrigatória (RN11).
- **Dependências (matriz do documento):** depende de RF054; relaciona-se com RF034
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Encerramento durante a suspensão: Decide-se, com justificativa, entre apurar e cancelar (RF034).
- **Casos de teste:** integration/lifecycle.test.ts; integration/voting.test.ts › voto em consulta suspensa
- **Situação:** Implementado

### RF034 — Cancelar consulta

- **Objetivo:** O sistema deve permitir cancelar, de forma irreversível, consulta ainda não apurada; os votos não são apurados e a consulta permanece visível como Cancelada, com justificativa.
- **Funcionalidade implementada:** /admin/consultas/[id]/conducao
- **Código:** lifecycle.service.ts (cancelConsultation)
- **Regras de negócio:** Consulta cancelada (RN10); Justificativa obrigatória (RN11); Encerramento irreversível (RN32).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF043
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Consulta já apurada: Recusado; cabe retificação (RF043).
- **Casos de teste:** integration/lifecycle.test.ts › cancelamento
- **Situação:** Implementado

### RF035 — Encerrar votação

- **Objetivo:** O sistema deve encerrar automaticamente a votação no horário divulgado, sem encerramento antecipado manual; a interrupção excepcional ocorre por suspensão ou cancelamento.
- **Funcionalidade implementada:** rotina automática
- **Código:** scheduler.service.ts (closeDueConsultations)
- **Regras de negócio:** Período de votação (RN08); Imutabilidade após publicação (RN12); Encerramento irreversível (RN32).
- **Dependências (matriz do documento):** depende de RF042, RF055, RF059; relaciona-se com RF060
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Totais divergentes: Apuração bloqueada e incidente aberto (RF060).
- **Casos de teste:** integration/voting.test.ts › encerra no horário; totais divergentes
- **Situação:** Implementado

### RF036 — Verificar elegibilidade do cidadão

- **Objetivo:** O sistema deve verificar, em ordem: conta ativa e desbloqueada; identidade verificada; perfil Cidadão; enquadramento no público-alvo da consulta (RF027), inclusive domicílio, território e eventual critério etário justificado; consulta Aberta e no período; e ausência de participação anterior. Nenhuma idade mínima geral é aplicada, e a verificação é repetida no servidor no momento do voto.
- **Funcionalidade implementada:** /consultas/[slug], /consultas/[slug]/participar
- **Código:** modules/voting/eligibility.ts
- **Regras de negócio:** Elegibilidade (RN01); Conta ativa (RN03); Identidade verificada (RN04); Voto único (RN05); Período de votação (RN08); Contas administrativas não votam (RN22); Público-alvo (RN35); Crianças e adolescentes (RN40).
- **Dependências (matriz do documento):** depende de RF004, RF027; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Condição não atendida: Informa, em linguagem simples, o primeiro motivo e a ação possível.
- **Casos de teste:** unit/rules.test.ts › Elegibilidade na ordem; integration/voting.test.ts
- **Situação:** Implementado
- **Pendência com o cliente (*):** Público-alvo padrão das consultas; participação de crianças e adolescentes; forma de identificação e voto único e irretratável.

### RF037 — Registrar voto

- **Objetivo:** O sistema deve registrar o voto do cidadão elegível em consulta Aberta, com exatamente uma alternativa, garantindo: voto único, pela unicidade do par cidadão– consulta no banco; sigilo, pois o voto é gravado sem identificador do cidadão, sem comprovante e sem horário exato; e atomicidade, pois participação e voto são gravados na mesma transação. O voto é irretratável após a confirmação.
- **Funcionalidade implementada:** /consultas/[slug]/participar
- **Código:** voting.service.ts (castVote)
- **Regras de negócio:** Voto único (RN05); Voto irretratável (RN06); Sigilo do voto (RN07); Período de votação (RN08); Consulta suspensa (RN09); Alternativas de voto (RN13).
- **Dependências (matriz do documento):** depende de RF011, RF038; relaciona-se com RF060
- **Requisitos de segurança relacionados:** RS001, RS002
- **Critérios de aceitação:**
  - Falha na gravação: Transação desfeita por completo; nova tentativa permitida.
  - Alternativa inexistente: Recusada e registrada (RF060).
- **Casos de teste:** integration/voting.test.ts › Registro, atomicidade, concorrência; e2e/citizen.spec.ts
- **Situação:** Implementado

### RF038 — Confirmar voto e emitir comprovante

- **Objetivo:** O sistema deve confirmar o registro e entregar comprovante com título, data e código aleatório de 12 caracteres, que prova a participação sem informar a alternativa.
- **Funcionalidade implementada:** /conta/participacoes/[id], /api/conta/comprovante/[id]
- **Código:** voting.service.ts (castVote → comprovante)
- **Regras de negócio:** Voto irretratável (RN06); Sigilo do voto (RN07).
- **Dependências (matriz do documento):** depende de RF014; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Falha no e-mail: O comprovante permanece no histórico.
- **Casos de teste:** integration/voting.test.ts; e2e/citizen.spec.ts
- **Situação:** Implementado

### RF039 — Impedir voto duplicado

- **Objetivo:** O sistema deve impedir segundo voto do mesmo cidadão na consulta em qualquer circunstância (outro dispositivo, requisições simultâneas, duplo clique ou nova conta com o mesmo CPF), em três camadas: interface, regra de negócio e restrição de unicidade no banco.
- **Funcionalidade implementada:** —
- **Código:** voting.service.ts + índice único participations_citizen_consultation_uq
- **Regras de negócio:** CPF único (RN02); Voto único (RN05); Participação após desativação (RN33).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF060
- **Requisitos de segurança relacionados:** RS001
- **Critérios de aceitação:**
  - Mais de 5 tentativas por minuto: Limita e alerta (RF060).
- **Casos de teste:** integration/voting.test.ts › Voto único (3 camadas)
- **Situação:** Implementado

### RF040 — Rejeitar votos fora do período

- **Objetivo:** O sistema deve recusar voto em consulta que não esteja Aberta ou fora do período, conferido sempre pelo horário do servidor, inclusive em cédulas abertas antes da mudança de situação.
- **Funcionalidade implementada:** —
- **Código:** voting.service.ts (FOR SHARE + horário do servidor)
- **Regras de negócio:** Período de votação (RN08); Consulta suspensa (RN09); Consulta cancelada (RN10); Encerramento irreversível (RN32).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS009
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** integration/voting.test.ts › horário do servidor
- **Situação:** Implementado

### RF041 — Verificar comprovante de voto

- **Objetivo:** O sistema deve oferecer página pública em que, pelo código do comprovante, se confirme que a participação consta e foi contabilizada, sem revelar alternativa nem eleitor.
- **Funcionalidade implementada:** /comprovante
- **Código:** voting.service.ts (verifyReceipt); actions/citizen.ts (CAPTCHA por IP)
- **Regras de negócio:** Sigilo do voto (RN07); Consulta cancelada (RN10).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS002
- **Critérios de aceitação:**
  - Código inexistente ou excesso de consultas do mesmo IP: Informa ou exige CAPTCHA.
- **Casos de teste:** integration/voting.test.ts › Comprovante público; e2e/citizen.spec.ts
- **Situação:** Implementado

### RF042 — Apurar votos

- **Objetivo:** O sistema deve apurar a consulta Encerrada pela regra publicada antes da abertura (RN18), sem presumir o formato "Sim/Não": votos por alternativa, válidos, abstenções e total; percentuais sobre os válidos; participação sobre os elegíveis estimados, como indicador descritivo (RN41); quórum de referência, se adotado; e desempate. A apuração é determinística e gera resultado preliminar.
- **Funcionalidade implementada:** rotina automática; /admin/consultas/[id]/resultado (recontagem)
- **Código:** modules/results/results.service.ts (tallyConsultation); results/tally.ts
- **Regras de negócio:** Consulta cancelada (RN10); Sigilo das parciais (RN16); Quórum de referência (RN17); Regra de apuração (RN18); Percentuais (RN19); Limites administrativos (RN39); Resultados (RN41).
- **Dependências (matriz do documento):** depende de RF035, RF043, RF059; relaciona-se com RF060
- **Requisitos de segurança relacionados:** RS003
- **Critérios de aceitação:**
  - Abaixo do quórum, empate sem regra ou nenhum voto: Registra a condição, sem vencedora.
  - Recontagem: Antes da publicação, comparada à anterior.
  - Ocorrência de integridade: Apuração suspensa (RF060).
- **Casos de teste:** unit/rules.test.ts › Apuração; integration/voting.test.ts
- **Situação:** Implementado
- **Pendência com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF043 — Homologar e publicar resultado final

- **Objetivo:** O sistema deve permitir que o administrador com papel de publicação revise o preliminar, a metodologia e as ocorrências e publique o resultado final, com nota obrigatória sobre a natureza consultiva e os próximos passos. A publicação torna o resultado imutável. Publicar o preliminar antes da homologação depende de decisão (*) e exige o rótulo "Preliminar".
- **Funcionalidade implementada:** /admin/consultas/[id]/resultado
- **Código:** results.service.ts (publishFinalResult, publishRectification)
- **Regras de negócio:** Justificativa obrigatória (RN11); Resultado imutável (RN29); Natureza consultiva (RN34); Resultados (RN41); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF042, RF044, RF055, RF063; relaciona-se com —
- **Requisitos de segurança relacionados:** RS003
- **Critérios de aceitação:**
  - Retificação: Comprovado erro, publica-se retificação justificada; o original permanece visível.
- **Casos de teste:** integration/lifecycle.test.ts › resultado e retificação; e2e/admin.spec.ts
- **Situação:** Implementado — Publicação do preliminar parametrizável (pendente *), desligada.
- **Pendência com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF044 — Visualizar resultado da consulta

- **Objetivo:** O sistema deve exibir publicamente tema, objetivo, período (e justificativa, se reduzido), participações, votos e percentual por alternativa, abstenções, forma de contabilização, metodologia, quórum de referência, rótulo "Preliminar" ou "Final" com datas, nota oficial, ocorrências, hash e o aviso "Resultado de participação voluntária; não representa estatisticamente toda a população do município", além dos encaminhamentos (RF063), em gráfico com tabela.
- **Funcionalidade implementada:** /consultas/[slug]/resultado, /resultados
- **Código:** results.service.ts (publicResults)
- **Regras de negócio:** Sigilo das parciais (RN16); Quórum de referência (RN17); Percentuais (RN19); Resultado imutável (RN29); Resultados (RN41); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF043, RF045, RF063; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Resultado não publicado ou consulta cancelada: Exibe a situação, sem números por alternativa.
- **Casos de teste:** e2e/public.spec.ts › resultado publicado; consulta cancelada
- **Situação:** Implementado
- **Pendência com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF045 — Exportar resultados em formato aberto

- **Objetivo:** O sistema deve permitir baixar resultados publicados e dados agregados em CSV, JSON e PDF, sem dados pessoais nem votos individuais, em atenção à LAI.
- **Funcionalidade implementada:** /dados-abertos, /api/dados-abertos/[dataset]
- **Código:** modules/results/open-data.service.ts
- **Regras de negócio:** Sigilo do voto (RN07); Proteção de dados (RN27).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS005
- **Critérios de aceitação:**
  - Sem dados no período: Informa.
- **Casos de teste:** integration/voting.test.ts › exportação; e2e/public.spec.ts
- **Situação:** Implementado

### RF046 — Gerenciar usuários

- **Objetivo:** O sistema deve permitir que o gestor de acessos pesquise contas, crie contas administrativas por convite válido por 72 horas e bloqueie, desbloqueie ou desative contas com justificativa, sem ver senhas nem votos.
- **Funcionalidade implementada:** /admin/usuarios, /admin/usuarios/convidar, /convite
- **Código:** modules/admin/users.service.ts; auth.service.ts (acceptInvite)
- **Regras de negócio:** Gestão de acessos (RN21); Contas administrativas não votam (RN22); Proteção de dados (RN27); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Bloqueio: Encerra sessões; atos anteriores permanecem válidos.
  - Remover o último gestor ou bloquear a si mesmo: Recusado.
- **Casos de teste:** integration/administration.test.ts › Gestão de usuários
- **Situação:** Implementado

### RF047 — Gerenciar papéis e permissões

- **Objetivo:** O sistema deve permitir manter os papéis administrativos (seção 4) como conjuntos de permissões e atribuí-los às contas, impedindo combinações vedadas.
- **Funcionalidade implementada:** /admin/papeis, /admin/usuarios/[id]
- **Código:** users.service.ts (saveRole, deleteRole, setUserRoles)
- **Regras de negócio:** Segregação de funções (RN20); Gestão de acessos (RN21); Responsabilidades (RN36).
- **Dependências (matriz do documento):** depende de RF009; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Exclusão de papel em uso: Recusada até a migração das contas.
- **Casos de teste:** integration/administration.test.ts › Papéis e permissões; e2e/admin.spec.ts › menu por permissão
- **Situação:** Implementado

### RF048 — Monitorar consultas em andamento

- **Objetivo:** O sistema deve oferecer painel interno com situação, participações, evolução diária, pendências administrativas, ocorrências (denúncias, alertas de integridade), tempo até o encerramento e tentativas recusadas por motivo, sem contagem por alternativa para nenhum perfil (RN16). Nenhuma ação do painel altera votos (RN39); parciais públicas não foram adotadas (*).
- **Funcionalidade implementada:** /admin/monitoramento
- **Código:** modules/admin/monitoring.service.ts (monitoringPanel)
- **Regras de negócio:** Sigilo das parciais (RN16); Quórum de referência (RN17); Limites administrativos (RN39).
- **Dependências (matriz do documento):** depende de RF019, RF032, RF033, RF059, RF065; relaciona-se com RF060, RF062, RF066
- **Requisitos de segurança relacionados:** RS008
- **Critérios de aceitação:**
  - Baixa participação, denúncia ou alerta: Destaca a consulta, com link para RF062, RF066 ou RF060.
- **Casos de teste:** integration/voting.test.ts › painel sem alternativas; e2e/admin.spec.ts
- **Situação:** Implementado
- **Pendência com o cliente (*):** Exibição de resultados parciais.

### RF049 — Gerar relatórios e estatísticas

- **Objetivo:** O sistema deve gerar relatórios agregados por período, tema, região e situação (consultas, participação, cadastros, propostas e tempo de tramitação), suprimindo grupos com menos de 10 pessoas, exportáveis em PDF e CSV.
- **Funcionalidade implementada:** /admin/relatorios, /api/admin/relatorio
- **Código:** monitoring.service.ts (generateReport)
- **Regras de negócio:** Sigilo do voto (RN07); Sigilo das parciais (RN16); Proteção de dados (RN27).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS002
- **Critérios de aceitação:**
  - Grupo com menos de 10 pessoas: Exibido como "menos de 10".
- **Casos de teste:** integration/voting.test.ts › relatório sem alternativas
- **Situação:** Implementado

### RF050 — Disponibilizar portal público de transparência

- **Objetivo:** O sistema deve oferecer, sem login, portal com consultas, propostas publicadas, resultados, encaminhamentos, histórico e indicadores gerais, e a página "Como funciona", que explica a natureza consultiva, o sigilo, o voto único, a apuração e a verificação de comprovantes.
- **Funcionalidade implementada:** /transparencia, /indicadores, /como-funciona
- **Código:** queries.service.ts (portalIndicators)
- **Regras de negócio:** Sigilo do voto (RN07); Sigilo das parciais (RN16); Proteção de dados (RN27); Natureza consultiva (RN34).
- **Dependências (matriz do documento):** depende de RF016, RF017, RF018, RF044, RF045, RF056, RF063; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** e2e/public.spec.ts
- **Situação:** Implementado

### RF051 — Exibir histórico público da consulta

- **Objetivo:** O sistema deve exibir, em cada consulta publicada, linha do tempo com publicação, divulgação, abertura, alterações, suspensões, cancelamento, encerramento, apuração, resultados, retificações e encaminhamentos, com data, hora, justificativa e unidade responsável.
- **Funcionalidade implementada:** /consultas/[slug]/historico
- **Código:** consultations/common.ts (recordPublicEvent) + gatilho somente acréscimo
- **Regras de negócio:** Justificativa obrigatória (RN11); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** integration/lifecycle.test.ts › histórico
- **Situação:** Implementado

### RF052 — Gerenciar preferências de notificação

- **Objetivo:** O sistema deve permitir escolher avisos por tipo (novas consultas, abertura, alterações, lembretes, resultados, encaminhamentos e respostas a propostas), tema e bairro, por e-mail e central de avisos; avisos obrigatórios não podem ser desligados.
- **Funcionalidade implementada:** /conta/notificacoes, /avisos/descadastrar
- **Código:** modules/notifications/notifications.service.ts
- **Regras de negócio:** Proteção de dados (RN27).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Descadastro pelo e-mail: Link desativa o tipo de aviso sem login.
- **Casos de teste:** integration/participation.test.ts › preferências
- **Situação:** Implementado

### RF053 — Notificar nova consulta e abertura

- **Objetivo:** O sistema deve avisar os interessados quando uma consulta for publicada e, na abertura, quem se enquadra no público-alvo, com título, resumo, período e link.
- **Funcionalidade implementada:** e-mail e /conta/avisos
- **Código:** notifications/dispatch.ts (notifyPublished, notifyOpened); processOutbox
- **Regras de negócio:** Elegibilidade (RN01); Público-alvo (RN35).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Falha de envio: Até 3 tentativas; o aviso permanece na central.
- **Casos de teste:** integration/administration.test.ts › Avisos de consulta
- **Situação:** Implementado — SMTP real se SMTP_URL; senão caixa simulada.

### RF054 — Notificar alterações, suspensão e cancelamento

- **Objetivo:** O sistema deve notificar alterações, suspensões, retomadas e cancelamentos, informando o que mudou, a justificativa e o efeito sobre os votos; quem votou é sempre avisado.
- **Funcionalidade implementada:** e-mail e /conta/avisos
- **Código:** dispatch.ts (notifyChange)
- **Regras de negócio:** Consulta suspensa (RN09); Consulta cancelada (RN10); Justificativa obrigatória (RN11).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** integration/lifecycle.test.ts
- **Situação:** Implementado

### RF055 — Notificar lembrete, resultado e encaminhamentos

- **Objetivo:** O sistema deve enviar lembrete a quem se enquadra e ainda não participou, 48 horas antes do encerramento; aviso de encerramento; aviso de resultado a quem votou; e aviso de novos encaminhamentos a quem optou por recebê-los.
- **Funcionalidade implementada:** e-mail e /conta/avisos
- **Código:** scheduler.service.ts (sendReminders); dispatch.ts (notifyVoters)
- **Regras de negócio:** Voto único (RN05); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Consulta suspensa no horário do lembrete: Adiado para após a retomada.
- **Casos de teste:** integration/lifecycle.test.ts; integration/administration.test.ts › Avisos de consulta
- **Situação:** Implementado

### RF056 — Consultar acervo de consultas encerradas

- **Objetivo:** O sistema deve manter acervo público permanente das consultas finalizadas e canceladas, com dados, anexos, histórico, resultados e encaminhamentos, pesquisável por ano, tema, região e resultado.
- **Funcionalidade implementada:** /consultas/encerradas
- **Código:** queries.service.ts (archive)
- **Regras de negócio:** Registros imutáveis (RN28); Resultado imutável (RN29).
- **Dependências (matriz do documento):** depende de RF018, RF044, RF051; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Conforme o fluxo principal.
- **Casos de teste:** e2e/public.spec.ts › consulta cancelada
- **Situação:** Implementado

### RF057 — Registrar trilha de auditoria

- **Objetivo:** O sistema deve registrar, em log somente de acréscimo e encadeado por hash, logins e falhas, bloqueios, alterações cadastrais (sem valores), atos sobre propostas e consultas, designação de papéis, autorizações de prazo, moderação, apurações, publicações, encaminhamentos, mudanças de permissão e acessos negados, com data e hora do servidor, autor, papel, ação, objeto, resultado e justificativa.
- **Funcionalidade implementada:** —
- **Código:** modules/audit/audit.service.ts + gatilhos
- **Regras de negócio:** Sigilo do voto (RN07); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com —
- **Requisitos de segurança relacionados:** RS013
- **Critérios de aceitação:**
  - Falha ao auditar ato administrativo: O ato é desfeito.
- **Casos de teste:** integration/database.test.ts
- **Situação:** Implementado

### RF058 — Consultar trilha de auditoria

- **Objetivo:** O sistema deve permitir ao gestor de acessos filtrar o log por período, usuário, ação e objeto, exportar em CSV e verificar o encadeamento.
- **Funcionalidade implementada:** /admin/auditoria, /api/admin/auditoria
- **Código:** audit.service.ts (searchAudit, verifyAuditChain)
- **Regras de negócio:** Gestão de acessos (RN21); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF060
- **Requisitos de segurança relacionados:** RS013
- **Critérios de aceitação:**
  - Encadeamento quebrado: Indica o primeiro registro inconsistente e alerta (RF060).
- **Casos de teste:** integration/database.test.ts › detecta adulteração; e2e/admin.spec.ts
- **Situação:** Implementado

### RF059 — Verificar integridade da votação e da apuração

- **Objetivo:** O sistema deve verificar, no encerramento, antes da apuração e sob demanda: votos iguais a participações; votos só em alternativas válidas; nenhuma participação duplicada ou fora do período; soma por alternativa igual ao total; percentuais somando 100% (tolerância de 0,01 ponto); e nova apuração com mesmo resultado e hash.
- **Funcionalidade implementada:** /admin/consultas/[id]/resultado
- **Código:** results.service.ts (verifyIntegrity)
- **Regras de negócio:** Voto único (RN05); Período de votação (RN08); Consulta suspensa (RN09); Percentuais (RN19).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF060
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Falha: Bloqueia apuração ou publicação e aciona RF060.
- **Casos de teste:** integration/voting.test.ts › integridade
- **Situação:** Implementado

### RF060 — Tratar inconsistências e incidentes

- **Objetivo:** O sistema deve registrar como incidentes, com severidade, falhas de integridade, votos com dados adulterados, excesso de tentativas, cadastros suspeitos e quebra da auditoria, para análise e encerramento justificado por administrador.
- **Funcionalidade implementada:** /admin/incidentes
- **Código:** modules/integrity/incidents.service.ts
- **Regras de negócio:** Sigilo do voto (RN07); Consulta cancelada (RN10); Justificativa obrigatória (RN11); Registros imutáveis (RN28).
- **Dependências (matriz do documento):** depende de —; relaciona-se com RF034
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Contas fraudulentas que já votaram: Como os votos não são vinculados, decide-se publicamente entre manter o resultado e cancelar (RF034).
- **Casos de teste:** integration/voting.test.ts › incidente por divergência e alternativa inexistente
- **Situação:** Implementado

### RF061 — Definir responsáveis e papéis da consulta

- **Objetivo:** O sistema deve permitir que o gestor de acessos designe, para cada consulta, os responsáveis por condução, elaboração, revisão, aprovação, autorização de prazo excepcional, divulgação, acompanhamento, publicação de resultados e encaminhamentos. Uma conta pode acumular papéis, exceto elaborar ou revisar e aprovar. Publicamente aparece a unidade responsável, não o nome das pessoas.
- **Funcionalidade implementada:** /admin/consultas/[id]/responsaveis
- **Código:** lifecycle.service.ts (setAssignments); access.service.ts (assertConsultationRole)
- **Regras de negócio:** Segregação de funções (RN20); Gestão de acessos (RN21); Responsabilidades (RN36).
- **Dependências (matriz do documento):** depende de RF009, RF025, RF026, RF027, RF028, RF029, RF030, RF047; relaciona-se com —
- **Requisitos de segurança relacionados:** RS006
- **Critérios de aceitação:**
  - Substituição durante a consulta: Com justificativa no histórico.
  - Combinação vedada ou papel obrigatório vazio: Bloqueia a submissão (RF028).
- **Casos de teste:** integration/lifecycle.test.ts › combinação vedada
- **Situação:** Implementado
- **Pendência com o cliente (*):** Divisão do Administrador em papéis.

### RF062 — Divulgar consulta

- **Objetivo:** O sistema deve gerar, a partir dos dados aprovados, material de divulgação em linguagem simples (texto curto, link permanente, QR Code e cartão com tema, objetivo, público-alvo, período e instruções) e registrar os canais usados (portal, redes oficiais, avisos impressos, rádio) e as datas. A publicação externa é manual ou por integração futura; o material não traz parciais (RN16).
- **Funcionalidade implementada:** /admin/consultas/[id]/divulgacao
- **Código:** modules/dissemination/dissemination.service.ts (QR Code)
- **Regras de negócio:** Sigilo das parciais (RN16); Conteúdo mínimo (RN37).
- **Dependências (matriz do documento):** depende de RF030, RF051, RF053; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Proximidade do encerramento: Sugere nova divulgação a 3 dias do fim.
  - Texto livre divergente da pergunta: Exige revisão.
- **Casos de teste:** integration/administration.test.ts › Divulgação
- **Situação:** Implementado — Publicação externa manual, como prevê o documento.
- **Pendência com o cliente (*):** Canais de divulgação da Prefeitura.

### RF063 — Registrar e publicar encaminhamentos

- **Objetivo:** O sistema deve permitir, após o resultado final, registrar encaminhamentos (decisão relacionada, providências, justificativa, órgão, situação Prevista, Em andamento, Concluída ou Não realizada e data prevista, se informada), públicos e com histórico. O sistema não cria compromissos: exibe apenas o que for registrado e, sem registro, informa "Nenhum encaminhamento registrado até [data]".
- **Funcionalidade implementada:** /admin/consultas/[id]/encaminhamentos, /encaminhamentos
- **Código:** modules/outcomes/outcomes.service.ts
- **Regras de negócio:** Justificativa obrigatória (RN11); Registros imutáveis (RN28); Encaminhamentos (RN42).
- **Dependências (matriz do documento):** depende de RF043, RF044, RF055; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Atualização: Novo estado datado; o anterior permanece.
  - "Não realizada" sem justificativa: Bloqueado.
- **Casos de teste:** integration/lifecycle.test.ts › encaminhamentos
- **Situação:** Implementado
- **Pendência com o cliente (*):** Prazos de resposta da administração e de guarda dos registros.

### RF064 — Publicar comentários e perguntas

- **Objetivo:** Se o escopo for aprovado, o sistema deve permitir que o cidadão publique comentários (até 1.000 caracteres) ou perguntas sobre consulta ou proposta publicada, com nome de exibição, sem CPF ou e-mail, ordenados por recentes ou mais úteis; a administração responde com a marca "Resposta oficial". Comentários não são votos, não entram na apuração e não são exigidos para votar.
- **Funcionalidade implementada:** /consultas/[slug] e /propostas/[protocolo] (seção Comentários)
- **Código:** modules/moderation/moderation.service.ts (postComment, officialAnswer)
- **Regras de negócio:** Proteção de dados (RN27); Manifestação não é voto (RN38); Limites administrativos (RN39); Crianças e adolescentes (RN40).
- **Dependências (matriz do documento):** depende de RF065, RF066; relaciona-se com —
- **Requisitos de segurança relacionados:** RS005, RS010, RS011
- **Critérios de aceitação:**
  - Conteúdo sinalizado: Publicado antes ou depois da revisão, conforme a política (*).
- **Casos de teste:** integration/participation.test.ts › comentários
- **Situação:** Implementado — condicionado (*), desligado por padrão — Chave recursos.comentarios.
- **Pendência com o cliente (*):** Quais formas de participação entram nesta versão; política de uso e moderação.

### RF065 — Denunciar conteúdo

- **Objetivo:** O sistema deve permitir denunciar comentário, pergunta ou proposta publicada, com motivo (ofensa, discurso de ódio, dados pessoais expostos, propaganda, conteúdo ilegal ou outro), gerando protocolo e entrada na fila de moderação; o denunciante não é revelado ao autor.
- **Funcionalidade implementada:** /propostas/[protocolo], comentários
- **Código:** moderation.service.ts (reportContent)
- **Regras de negócio:** Justificativa obrigatória (RN11); Limites administrativos (RN39).
- **Dependências (matriz do documento):** depende de RF066; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Denúncia repetida: Ignorada.
  - Denúncias abusivas reiteradas: Registradas, sem bloqueio automático.
- **Casos de teste:** integration/participation.test.ts › denúncias
- **Situação:** Implementado
- **Pendência com o cliente (*):** Política de uso e moderação.

### RF066 — Moderar conteúdo e revisar decisões

- **Objetivo:** O sistema deve permitir que o moderador decida manter, ocultar trecho com dados pessoais ou remover o conteúdo, com justificativa baseada na política de uso; o autor é notificado e pode pedir uma revisão, feita por outro moderador. A moderação nunca atua sobre votos, participações ou resultados (RN39).
- **Funcionalidade implementada:** /admin/moderacao, /conta/avisos (pedido de revisão)
- **Código:** moderation.service.ts (decideModeration, requestModerationReview)
- **Regras de negócio:** Justificativa obrigatória (RN11); Registros imutáveis (RN28); Limites administrativos (RN39).
- **Dependências (matriz do documento):** depende de RF057, RF065; relaciona-se com —
- **Requisitos de segurança relacionados:** RS003
- **Critérios de aceitação:**
  - Pedido de revisão: Outro moderador decide em definitivo.
  - Moderador é autor ou denunciante: Bloqueado.
- **Casos de teste:** integration/participation.test.ts › moderação e revisão
- **Situação:** Implementado
- **Pendência com o cliente (*):** Política de uso e moderação.

### RF067 — Apoiar proposta cidadã

- **Objetivo:** Se adotado, o sistema deve permitir um apoio por cidadão a cada proposta Publicada e exibir o total; atingida a meta no prazo, ambos configuráveis, a proposta recebe análise prioritária com resposta obrigatória (RF021). Os dados de entrada citam 4 meses e 20 mil apoios, valores de um portal legislativo federal (Apêndice B), não adotados por poderem ser desproporcionais ao eleitorado municipal. Apoio não é voto nem subscrição de iniciativa popular.
- **Funcionalidade implementada:** /propostas/[protocolo] (Apoiar)
- **Código:** citizen-proposals.service.ts (supportProposal)
- **Regras de negócio:** Propostas cidadãs (RN30); Natureza consultiva (RN34); Manifestação não é voto (RN38).
- **Dependências (matriz do documento):** depende de RF020, RF021; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Prazo encerrado sem meta: Segue a resposta regular.
  - Apoio repetido: Recusado.
- **Casos de teste:** integration/participation.test.ts › Apoios
- **Situação:** Implementado — condicionado (*), desligado por padrão — Meta e prazo sem valor padrão (20 mil/4 meses não adotados).
- **Pendência com o cliente (*):** Quais formas de participação entram nesta versão; limite, apoios e metas das propostas cidadãs.

### RF068 — Divulgar evento participativo e receber perguntas

- **Objetivo:** Se adotado, o sistema deve permitir cadastrar evento vinculado a consulta (audiência, reunião ou debate), com pauta, data, local, link de transmissão em serviço externo e, depois, gravação legendada, ata e resumo. O cidadão envia perguntas antecipadas e durante a transmissão; perguntas por telefone são registradas por atendente. A plataforma não transmite vídeo nem faz videochamadas, e o evento não substitui o rito legal da audiência.
- **Funcionalidade implementada:** /eventos/[id], /admin/eventos
- **Código:** modules/events/events.service.ts
- **Regras de negócio:** Conteúdo mínimo (RN37); Manifestação não é voto (RN38); Limites administrativos (RN39).
- **Dependências (matriz do documento):** depende de RF023, RF064, RF065; relaciona-se com —
- **Requisitos de segurança relacionados:** —
- **Critérios de aceitação:**
  - Pergunta por telefone: Registrada com protocolo.
  - Transmissão indisponível: Aviso com data da gravação.
- **Casos de teste:** integration/administration.test.ts › Eventos participativos
- **Situação:** Implementado — condicionado (*), desligado por padrão — Chave recursos.eventos. Sem transmissão de vídeo.
- **Pendência com o cliente (*):** Quais formas de participação entram nesta versão.
