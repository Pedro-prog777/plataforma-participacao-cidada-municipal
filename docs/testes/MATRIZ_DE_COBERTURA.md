# Matriz de cobertura de testes — PPCM

Execução de referência: **24/11/2026** (Windows 11, Node 20.20.2, Chromium). Resultado final: Vitest **158/158**,
Playwright E2E **65/65**, tipos e lint sem erros, varredura exploratória de 568 páginas sem erro 500 e sem violação axe
séria. Detalhes, bugs e evidências em [RELATORIO_DE_TESTES.md](RELATORIO_DE_TESTES.md); fluxos em
[USER_FLOWS.md](../fluxos/USER_FLOWS.md). Os testes acrescentados nesta revisão aparecem em **negrito**, com o código do
bug (Bxx) que cada um impede de voltar.

Situação: **Aprovado** (teste automatizado executado e aprovado) · **Parcial** (só parte do requisito é verificável
automaticamente) · **Não testado**.

## 1. Requisitos funcionais (68)

| Requisito | Funcionalidade (telas / rotas) | Cenários de teste | Resultado | Situação |
|---|---|---|---|---|
| RF001 Cadastrar cidadão | /cadastro | integration/auth.test.ts › Cadastro, só cria conta quem tem 18 anos completos (DT-33); unit/masks.test.ts; e2e/citizen.spec.ts › cadastro | Aprovado em 25/11/2026 | Aprovado |
| RF002 Validar dados cadastrais | /cadastro, /conta/perfil/editar | integration/auth.test.ts › todos os erros por campo; unit/rules.test.ts › CPF | Aprovado em 24/11/2026 | Aprovado |
| RF003 Confirmar e-mail e ativar conta | /confirmar-email, /reenviar-confirmacao | integration/auth.test.ts › Confirmação de e-mail | Aprovado em 24/11/2026 | Aprovado |
| RF004 Verificar identidade e domicílio do cidadão | /conta/verificacao, /demo/provedor-identidade, /admin/verificacoes | integration/administration.test.ts › Verificação de identidade e domicílio; e2e/citizen.spec.ts › orientação de verificação; **unit/links.test.ts › aviso “Identidade verificada” leva a página existente (B04)** | Aprovado em 24/11/2026 (integração externa simulada) | Aprovado |
| RF005 Realizar login | /entrar, /entrar/segundo-fator | integration/auth.test.ts › Login; e2e/admin.spec.ts › segundo fator | Aprovado em 24/11/2026 | Aprovado |
| RF006 Realizar logout | menu Sair, /conta/privacidade (sessões) | integration/auth.test.ts › sessão expira por inatividade | Aprovado em 24/11/2026 | Aprovado |
| RF007 Recuperar senha | /recuperar-senha, /redefinir-senha | integration/auth.test.ts › Recuperação | Aprovado em 24/11/2026 | Aprovado |
| RF008 Alterar senha | /conta/senha, /admin/senha | integration/auth.test.ts › senha atual incorreta conta como falha | Aprovado em 24/11/2026 | Aprovado |
| RF009 Controlar acesso por perfil, papel e permissão | todas as rotas protegidas | integration/auth.test.ts › Controle de acesso; e2e/public.spec.ts › áreas protegidas; e2e/admin.spec.ts; **e2e/robustez.spec.ts › identificador fora do formato responde 404 para cidadão, API e administração (B03)** | Aprovado em 24/11/2026 | Aprovado |
| RF010 Controlar tentativas de autenticação | /entrar (CAPTCHA) | integration/auth.test.ts › bloqueio 15 min; CAPTCHA por IP | Aprovado em 24/11/2026 | Aprovado |
| RF011 Confirmar identidade antes do voto | /consultas/[slug]/participar (passo 2) | integration/voting.test.ts › código, código anterior válido, limite de 3, código na tela só quando simulado; e2e/citizen.spec.ts › código lido na tela (DT-32); **e2e/robustez.spec.ts › erro do código não reaparece ao voltar (B10) e o código anterior continua valendo (DT-32)** | Aprovado em 25/11/2026 (integração externa simulada) | Aprovado |
| RF012 Visualizar perfil | /conta | integration/administration.test.ts › Visualização do perfil; **unit/links.test.ts (B04)** | Aprovado em 24/11/2026 | Aprovado |
| RF013 Atualizar dados do perfil | /conta/perfil/editar | integration/administration.test.ts › Atualização do perfil | Aprovado em 24/11/2026 | Aprovado |
| RF014 Acompanhar participações e propostas | /conta/participacoes, /conta/participacoes/[id] | integration/voting.test.ts › histórico sem a opção votada; e2e/citizen.spec.ts; **e2e/robustez.spec.ts › 404 em /conta/propostas/abc; axe sem lista inválida (B03, B09)** | Aprovado em 24/11/2026 | Aprovado |
| RF015 Exercer direitos do titular de dados | /conta/privacidade, /api/conta/dados/[id] | integration/participation.test.ts › LGPD; integration/auth.test.ts › desativação; **e2e/robustez.spec.ts › /api/conta/dados/abc responde 404 (B03)** | Aprovado em 24/11/2026 | Aprovado |
| RF016 Listar consultas públicas | /consultas, / | integration/lifecycle.test.ts › não aparece antes de publicada; e2e/public.spec.ts; **e2e/robustez.spec.ts › parâmetros manipulados, 320 px; integration/performance.test.ts › paginação no banco sem repetição (B02, B07)** | Aprovado em 24/11/2026 | Aprovado |
| RF017 Pesquisar e filtrar consultas | /consultas, /consultas/pesquisa | e2e/public.spec.ts › busca sem acentos; **integration/lifecycle.test.ts › busca pelo texto da proposta após edição; security/security.test.ts › filtros de URL fora do formato; unit/rules.test.ts › isUuid/parseIsoDay (B02, B05)** | Aprovado em 24/11/2026 | Aprovado |
| RF018 Visualizar detalhes da consulta | /consultas/[slug] | e2e/public.spec.ts; e2e/citizen.spec.ts | Aprovado em 24/11/2026 | Aprovado |
| RF019 Determinar a situação da consulta | rotina automática (instrumentation) e /admin/monitoramento | integration/lifecycle.test.ts › ciclo completo; integration/voting.test.ts › encerramento | Aprovado em 24/11/2026 | Aprovado |
| RF020 Enviar proposta cidadã | /conta/propostas/nova | integration/participation.test.ts › Propostas cidadãs | Aprovado em 24/11/2026 | Aprovado |
| RF021 Analisar e responder proposta cidadã | /admin/propostas, /admin/propostas/[id] | integration/participation.test.ts › percorre os estados | Aprovado em 24/11/2026 | Aprovado |
| RF022 Cadastrar proposta municipal | /admin/propostas-municipais | integration/lifecycle.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RF023 Anexar documentos e materiais audiovisuais | /admin/consultas/[id]/anexos, /admin/propostas-municipais/[id], /api/anexos/[id] | integration/participation.test.ts › Anexos; unit/rules.test.ts › tipo real e EICAR; security/security.test.ts › Links externos e SSRF | Aprovado em 24/11/2026 | Aprovado |
| RF024 Editar proposta e consulta em elaboração | /admin/consultas/[id]/editar | integration/lifecycle.test.ts › edição simultânea; **integration/lifecycle.test.ts › busca após edição (B05)** | Aprovado em 24/11/2026 | Aprovado |
| RF025 Cadastrar consulta pública | /admin/consultas/nova | integration/lifecycle.test.ts › período mínimo | Aprovado em 24/11/2026 | Aprovado |
| RF026 Definir alternativas de resposta | /admin/consultas/[id]/alternativas | integration/lifecycle.test.ts › alternativas | Aprovado em 24/11/2026 | Aprovado |
| RF027 Definir público-alvo e critérios de participação | /admin/consultas/[id]/publico-alvo | integration/lifecycle.test.ts › limitação sem justificativa, consulta para crianças e adolescentes só informativa ou educativa (DT-33); unit › elegibilidade | Aprovado em 25/11/2026 | Aprovado |
| RF028 Revisar e submeter consulta para aprovação | /admin/consultas/[id] (pendências), /admin/consultas/[id]/revisao | integration/lifecycle.test.ts › Segregação | Aprovado em 24/11/2026 | Aprovado |
| RF029 Aprovar consulta e autorizar prazo excepcional | /admin/consultas/[id]/aprovacao | integration/lifecycle.test.ts › ninguém aprova o que elaborou; prazo excepcional; antecedência | Aprovado em 24/11/2026 | Aprovado |
| RF030 Publicar consulta | /admin/consultas/[id]/conducao | integration/lifecycle.test.ts › ciclo completo | Aprovado em 24/11/2026 | Aprovado |
| RF031 Abrir votação | rotina automática | integration/lifecycle.test.ts › abertura | Aprovado em 24/11/2026 | Aprovado |
| RF032 Alterar consulta publicada | /admin/consultas/[id]/conducao | integration/lifecycle.test.ts › alteração e bloqueio de alternativas; **integration/lifecycle.test.ts › busca após edição (B05)** | Aprovado em 24/11/2026 | Aprovado |
| RF033 Suspender e retomar consulta | /admin/consultas/[id]/conducao | integration/lifecycle.test.ts; integration/voting.test.ts › voto em consulta suspensa | Aprovado em 24/11/2026 | Aprovado |
| RF034 Cancelar consulta | /admin/consultas/[id]/conducao | integration/lifecycle.test.ts › cancelamento | Aprovado em 24/11/2026 | Aprovado |
| RF035 Encerrar votação | rotina automática | integration/voting.test.ts › encerra no horário; totais divergentes | Aprovado em 24/11/2026 | Aprovado |
| RF036 Verificar elegibilidade do cidadão | /consultas/[slug], /consultas/[slug]/participar | unit/rules.test.ts › Elegibilidade na ordem, só vota quem tem 18 anos completos (DT-30); integration/voting.test.ts › Idade mínima para votar; **unit/links.test.ts › ação “Ver meu perfil” (B04)** | Aprovado em 25/11/2026 | Aprovado |
| RF037 Registrar voto | /consultas/[slug]/participar | integration/voting.test.ts › Registro, atomicidade, concorrência; e2e/citizen.spec.ts | Aprovado em 24/11/2026 | Aprovado |
| RF038 Confirmar voto e emitir comprovante | /conta/participacoes/[id], /api/conta/comprovante/[id] | integration/voting.test.ts › id da transação; e2e/citizen.spec.ts › código na tela, botão Copiar, recarregar, uma única guia (DT-32) | Aprovado em 25/11/2026 | Aprovado |
| RF039 Impedir voto duplicado | — | integration/voting.test.ts › Voto único (3 camadas) | Aprovado em 24/11/2026 | Aprovado |
| RF040 Rejeitar votos fora do período | — | integration/voting.test.ts › horário do servidor | Aprovado em 24/11/2026 | Aprovado |
| RF041 Verificar comprovante de voto | /comprovante | integration/voting.test.ts › Comprovante público; e2e/citizen.spec.ts | Aprovado em 24/11/2026 | Aprovado |
| RF042 Apurar votos | rotina automática; /admin/consultas/[id]/resultado (recontagem) | unit/rules.test.ts › Apuração; integration/voting.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RF043 Homologar e publicar resultado final | /admin/consultas/[id]/resultado | integration/lifecycle.test.ts › resultado e retificação; e2e/admin.spec.ts | Aprovado em 24/11/2026 | Aprovado |
| RF044 Visualizar resultado da consulta | /consultas/[slug]/resultado, /resultados | e2e/public.spec.ts › resultado publicado; consulta cancelada | Aprovado em 24/11/2026 | Aprovado |
| RF045 Exportar resultados em formato aberto | /dados-abertos, /api/dados-abertos/[dataset] | integration/voting.test.ts › exportação; e2e/public.spec.ts | Aprovado em 24/11/2026 | Aprovado |
| RF046 Gerenciar usuários | /admin/usuarios, /admin/usuarios/convidar, /convite | integration/administration.test.ts › Gestão de usuários | Aprovado em 24/11/2026 | Aprovado |
| RF047 Gerenciar papéis e permissões | /admin/papeis, /admin/usuarios/[id] | integration/administration.test.ts › Papéis e permissões; e2e/admin.spec.ts › menu por permissão | Aprovado em 24/11/2026 | Aprovado |
| RF048 Monitorar consultas em andamento | /admin/monitoramento | integration/voting.test.ts › painel sem alternativas; e2e/admin.spec.ts; **e2e/robustez.spec.ts › telas administrativas a 320 px e axe (B07, B08)** | Aprovado em 24/11/2026 | Aprovado |
| RF049 Gerar relatórios e estatísticas | /admin/relatorios, /api/admin/relatorio | integration/voting.test.ts › relatório sem alternativas; **e2e/robustez.spec.ts › axe em /admin/relatorios (B08)** | Aprovado em 24/11/2026 | Aprovado |
| RF050 Disponibilizar portal público de transparência | /transparencia, /indicadores, /como-funciona, /prefeitura | e2e/public.spec.ts; integration/performance.test.ts › A Prefeitura; **e2e/robustez.spec.ts › portal público sem links internos quebrados** | Aprovado em 24/11/2026 | Aprovado |
| RF051 Exibir histórico público da consulta | /consultas/[slug]/historico | integration/lifecycle.test.ts › histórico | Aprovado em 24/11/2026 | Aprovado |
| RF052 Gerenciar preferências de notificação | /conta/notificacoes, /avisos/descadastrar | integration/participation.test.ts › preferências | Aprovado em 24/11/2026 | Aprovado |
| RF053 Notificar nova consulta e abertura | e-mail e /conta/avisos | integration/administration.test.ts › Avisos de consulta | Aprovado em 24/11/2026 | Aprovado |
| RF054 Notificar alterações, suspensão e cancelamento | e-mail e /conta/avisos | integration/lifecycle.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RF055 Notificar lembrete, resultado e encaminhamentos | e-mail e /conta/avisos | integration/lifecycle.test.ts; integration/administration.test.ts › Avisos de consulta | Aprovado em 24/11/2026 | Aprovado |
| RF056 Consultar acervo de consultas encerradas | /consultas/encerradas | e2e/public.spec.ts › consulta cancelada; **e2e/robustez.spec.ts › /consultas/encerradas?ano=abc (B02)** | Aprovado em 24/11/2026 | Aprovado |
| RF057 Registrar trilha de auditoria | — | integration/database.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RF058 Consultar trilha de auditoria | /admin/auditoria, /api/admin/auditoria | integration/database.test.ts › detecta adulteração; e2e/admin.spec.ts; **e2e/robustez.spec.ts › axe em /admin/auditoria (B08)** | Aprovado em 24/11/2026 | Aprovado |
| RF059 Verificar integridade da votação e da apuração | /admin/consultas/[id]/resultado | integration/voting.test.ts › integridade | Aprovado em 24/11/2026 | Aprovado |
| RF060 Tratar inconsistências e incidentes | /admin/incidentes | integration/voting.test.ts › incidente por divergência e alternativa inexistente; **e2e/robustez.spec.ts › /admin/incidentes a 320 px (B07)** | Aprovado em 24/11/2026 | Aprovado |
| RF061 Definir responsáveis e papéis da consulta | /admin/consultas/[id]/responsaveis | integration/lifecycle.test.ts › combinação vedada | Aprovado em 24/11/2026 | Aprovado |
| RF062 Divulgar consulta | /admin/consultas/[id]/divulgacao | integration/administration.test.ts › Divulgação; **e2e/robustez.spec.ts › divulgação a 320 px (B07)** | Aprovado em 24/11/2026 | Aprovado |
| RF063 Registrar e publicar encaminhamentos | /admin/consultas/[id]/encaminhamentos, /encaminhamentos | integration/lifecycle.test.ts › encaminhamentos | Aprovado em 24/11/2026 | Aprovado |
| RF064 Publicar comentários e perguntas | /consultas/[slug] e /propostas/[protocolo] (seção Comentários) | integration/participation.test.ts › comentários | Aprovado em 24/11/2026 (desligado por padrão, testado ligado) | Aprovado |
| RF065 Denunciar conteúdo | /propostas/[protocolo], comentários | integration/participation.test.ts › denúncias | Aprovado em 24/11/2026 | Aprovado |
| RF066 Moderar conteúdo e revisar decisões | /admin/moderacao, /conta/avisos (pedido de revisão) | integration/participation.test.ts › moderação e revisão | Aprovado em 24/11/2026 | Aprovado |
| RF067 Apoiar proposta cidadã | /propostas/[protocolo] (Apoiar) | integration/participation.test.ts › Apoios | Aprovado em 24/11/2026 (desligado por padrão, testado ligado) | Aprovado |
| RF068 Divulgar evento participativo e receber perguntas | /eventos/[id], /admin/eventos | integration/administration.test.ts › Eventos participativos | Aprovado em 24/11/2026 (desligado por padrão, testado ligado) | Aprovado |

## 2. Requisitos não funcionais (15)

| Requisito | Funcionalidade | Cenários de teste | Resultado | Situação |
|---|---|---|---|---|
| RNF01 Acessibilidade | Todas as telas | e2e/*.spec.ts › axe-core WCAG 2.2 A/AA; **varredura de 526 páginas com 7 perfis (38 → 0 com violação séria); e2e/robustez.spec.ts › tabelas roláveis e lista vazia (B08, B09)** | Aprovado no axe; **inspeção com NVDA/TalkBack não feita** | Parcial |
| RNF02 Linguagem simples / 3 passos | Votação, telas do cidadão | e2e/citizen.spec.ts › votação em 3 passos; varredura de termos técnicos | Aprovado | Aprovado |
| RNF03 Uso a partir de 320 px | Todas as telas | e2e/public.spec.ts › 8 páginas; **e2e/robustez.spec.ts › área do cidadão (7), administração (7 + divulgação), cartões com rótulos longos (B06, B07)** | Aprovado (antes: 149 páginas com rolagem) | Aprovado |
| RNF04 Internet fraca | Início, consulta | medição de 15/11/2026 (≈172 KB no primeiro acesso) | Não remedido nesta revisão | Parcial |
| RNF05 Segurança da comunicação e do acesso | Cabeçalhos, sessão, guardas | e2e/public.spec.ts › cabeçalhos; integration/auth.test.ts; security/security.test.ts; **parâmetros manipulados (B02, B03)** | Aprovado; HTTPS depende da hospedagem | Aprovado |
| RNF06 Proteção de dados | Páginas públicas, exportações | voting.test.ts › Sigilo; participation.test.ts › exportação e dados de outro cidadão | Aprovado; relatório de impacto (RIPD) não elaborado | Parcial |
| RNF07 Integridade do voto | Votação | voting.test.ts › concorrência (5 envios → 1 voto), falha injetada, hash da base | Aprovado | Aprovado |
| RNF08 Registro dos atos administrativos | Auditoria | database.test.ts › encadeamento; e2e/admin.spec.ts | Aprovado | Aprovado |
| RNF09 Tempo de resposta | Páginas públicas, voto | medição local: páginas em 13–26 ms; **listagem com 600 consultas 19,4 → 4,0 ms** | Sem teste de carga | Parcial |
| RNF10 Disponibilidade | — | — | Não medido | Não testado |
| RNF11 Vários navegadores | — | Somente Chromium | Firefox, Safari, Edge, NVDA e TalkBack não testados | Parcial |
| RNF12 Parâmetros sem mexer no código | /admin/configuracoes | integration/administration.test.ts › parâmetros; unit/rules.test.ts (RN05–RN08, RN14, RN18) | Aprovado | Aprovado |
| RNF13 Dados abertos | /dados-abertos, /api/dados-abertos | integration/participation.test.ts; e2e/public.spec.ts | Aprovado | Aprovado |
| RNF14 Voto sem perda | Votação | voting.test.ts › falha durante a gravação | Aprovado; restauração de backup não exercitada | Parcial |
| RNF15 Inclusão digital | Conteúdo sem vídeo, atendimento | e2e › páginas sem dependência de mídia | Aprovado | Aprovado |

## 3. Requisitos de segurança (13)

| Requisito | Controles | Cenários de teste | Resultado | Situação |
|---|---|---|---|---|
| RS001 | Índice único `participations(consultation_id, citizen_id)`; verificação na regra e na tela; HMAC do CPF mantido após desativação | voting.test.ts › Voto único, simultâneos; auth.test.ts › desativação | Aprovado em 24/11/2026 | Aprovado |
| RS002 | `votes` sem cidadão/horário/comprovante; sem FK para participações; participação só com data; reembaralhamento da chave (sem ligação por `xmin`) + CLUSTER aleatório (DT-31); relatórios com supressão <10 | voting.test.ts › Sigilo do voto (inclui `xmin`) | Aprovado em 25/11/2026 | Aprovado |
| RS003 | Gatilhos impedem UPDATE/DELETE/TRUNCATE em votos e resultados; resultado só por retificação; hash da base | voting.test.ts › votos não podem ser alterados; database.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RS004 | Verificação de identidade; código antes do voto; incidente de cadastro suspeito | voting.test.ts › código; identity (CPF divergente) | Aprovado em 24/11/2026 | Aprovado |
| RS005 | CPF mascarado; exportações agregadas; auditoria sem campos pessoais | voting.test.ts › exportação; participation.test.ts › exportação | Aprovado em 24/11/2026 | Aprovado |
| RS006 | RBAC no servidor; papéis por consulta; segregação; TOTP obrigatório | lifecycle.test.ts › Segregação; auth.test.ts › segundo fator; e2e/admin | Aprovado em 24/11/2026 | Aprovado |
| RS007 | Bloqueio 15 min após 5 falhas; CAPTCHA por IP; link de 30 min uso único; inatividade; HTTPS/HSTS | auth.test.ts | Aprovado em 24/11/2026 | Aprovado |
| RS008 | Painel e páginas só com nº de participações durante a votação | voting.test.ts › painel; e2e/public › sem parciais | Aprovado em 24/11/2026 | Aprovado |
| RS009 | Período conferido pelo relógio do servidor dentro da transação (FOR SHARE) | voting.test.ts › horário do servidor | Aprovado em 24/11/2026 | Aprovado |
| RS010 | Critério etário justificado; modalidade e salvaguardas obrigatórias para menores | unit › elegibilidade; lifecycle (validação) | Aprovado em 24/11/2026 | Aprovado |
| RS011 | Denúncia com protocolo, ocultação preventiva, moderação com revisão | participation.test.ts › moderação | Aprovado em 24/11/2026 | Aprovado |
| RS012 | Tipo real por assinatura, limite de tamanho, antivírus, SHA-256 | participation.test.ts › Anexos; unit › EICAR | Aprovado em 24/11/2026 | Aprovado |
| RS013 | Log encadeado por hash, somente acréscimo, verificação com alerta | database.test.ts | Aprovado em 24/11/2026 | Aprovado |

## 4. Regras de negócio verificadas explicitamente

| Regra | Cenário | Teste | Situação |
|---|---|---|---|
| RN05 Voto único | segundo voto, outro dispositivo, 5 envios simultâneos, nova conta com o mesmo CPF | voting.test.ts; auth.test.ts; e2e/citizen.spec.ts | Aprovado |
| RN07 Sigilo do voto | esquema, painel, relatórios, auditoria, avisos, e-mails, histórico, exportações, comprovante | voting.test.ts › Sigilo do voto | Aprovado |
| RN08 Período de votação | voto após o encerramento pelo horário do servidor | voting.test.ts | Aprovado |
| RN09 Consulta suspensa | voto recusado durante a suspensão | voting.test.ts; lifecycle.test.ts | Aprovado |
| RN16 Sigilo das parciais | nenhuma contagem por alternativa antes da publicação | voting.test.ts › painel; e2e/public.spec.ts | Aprovado |
| RN20/RN36 Segregação de funções | aprovar consulta elaborada, editada ou revisada pela mesma conta | lifecycle.test.ts | Aprovado |
| RN22 Contas administrativas não votam | elegibilidade de conta administrativa | unit/rules.test.ts | Aprovado |
| RN28 Registros imutáveis | UPDATE/DELETE em tabelas somente de acréscimo | database.test.ts; voting.test.ts | Aprovado |
| Publicação só após aprovação | publicar consulta não aprovada | lifecycle.test.ts | Aprovado |
