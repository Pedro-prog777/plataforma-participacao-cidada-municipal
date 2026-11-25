# Status do desenvolvimento — PPCM

Atualizado em 24/11/2026. Estados: Não iniciado · Em desenvolvimento · Implementado (código e tela prontos, verificação manual) · Testado (coberto por teste automatizado aprovado) · Pendente · Bloqueado.

## Resumo

- **Requisitos funcionais:** 68 implementados e cobertos por teste automatizado (68 no total); RF004, RF005 e RF011 com provedor de identidade/SMS simulados. RF064, RF067 e RF068 existem, mas ficam desligados até a validação do cliente.
- **Testes (24/11/2026, revisão de qualidade):** 158/158 unitários, de integração e de segurança; 65/65 E2E (com acessibilidade axe e 320 px); tipos e lint limpos; `npm audit` de produção sem vulnerabilidades. Varredura de 568 páginas com 7 perfis sem erro 500 nem violação axe séria. Relatório em `docs/testes/RELATORIO_DE_TESTES.md`; fluxos de utilização em `docs/fluxos/USER_FLOWS.md` (DT-27).
- **Telas:** 60+ rotas reais e navegáveis; capturas reais em `screenshots/` (`area-publica`, `cidadao`, `administrador`, `celular`).
- **Município de referência:** Maceió/AL — nome e 50 bairros reais em 8 regiões administrativas; consultas, pessoas e órgãos fictícios; avisos de que não é serviço oficial (DT-21).
- **Trello:** quadro público montado em 13/11/2026 — <https://trello.com/b/AQX3bDST>: 10 listas, 41 cartões (documentação, requisitos, telas, o que falta, segurança, testes, módulos concluídos e pendências), com checklists, 68 links para o GitHub e as 57 capturas anexadas. Definição em `docs/trello/quadro.json`, aplicada por `npm run trello:sync`.
- **Referências cruzadas (DT-24):** página pública `/requisitos` com o Documento de Requisitos navegável; todo RF/RNF/RN/RS citado no documento ou na interface vira link para o requisito, com rolagem e destaque temporário; identificador inexistente fica marcado "a verificar". Catálogo extraído do próprio documento (68 RF, 15 RNF, 42 RN, 13 RS). Citações jurídicas retiradas do documento transcrito, da interface e do próprio PDF (`Documento_de_Requisitos_v6.pdf`), que também ganhou 470 links internos entre RF, RNF e RS, com as mesmas 39 páginas do original (`npm run requisitos:pdf`; o apêndice com o índice das RN foi retirado em 24/11/2026); o original fica em `docs/requisitos/original/`.
- **A Prefeitura (DT-25):** o atalho "Dados abertos" da faixa superior virou "A Prefeitura" (`/prefeitura`: papel da Prefeitura, órgãos municipais com consultas e encaminhamentos, atendimento); os dados abertos (RF045) continuam em Transparência, Resultados e no rodapé.
- **Figma:** protótipo atualizado em 23/11/2026 com a seção "Referências cruzadas entre requisitos" — <https://www.figma.com/design/wskUxNo797ipkbNxqqI3BY/Plataforma-de-Participa%C3%A7%C3%A3o-Cidad%C3%A3-Municipal-%E2%80%94-Prot%C3%B3tipo?node-id=35-51>. Pendência: as molduras de destaque dos cartões RN02, RF004 e RN16 precisam voltar a "posição absoluta" (ver Próxima etapa).
- **Pronto para o cidadão (DT-26):** telas públicas, área “Minha conta”, avisos e e-mails em linguagem simples (sem apuração, homologação, hash, quórum, elegibilidade, provedor de identidade etc.); códigos de verificação exigidos pelo RF044 num bloco recolhível. Página Acessibilidade com espaçamento ampliado para leitura e tamanho do texto; o alto contraste e o botão do topo foram retirados a pedido da equipe (DT-22). `.env.local` com `DEMO_MODE=true` para `npm run preview` funcionar na demonstração.
- **GitHub:** repositório público, autorizado pela equipe em 12/11/2026: <https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal>.

## O que funciona (verificado)
Cadastro, confirmação de e-mail, login com bloqueio e 2º fator, recuperação de senha, verificação de identidade (provedor simulado e documental), perfil e direitos do titular de dados, ciclo completo da consulta com segregação de funções, abertura/encerramento automáticos, votação em 3 passos com sigilo estrutural e voto único, comprovante e verificação pública, integridade, apuração, homologação, retificação, dados abertos, encaminhamentos, propostas cidadãs, denúncia e moderação, notificações, auditoria encadeada, incidentes, monitoramento, relatórios, usuários, papéis e parâmetros; documento de requisitos navegável com referências cruzadas automáticas (DT-24).

## Parcial, simulado ou não medido
| Item | Estado | Observação |
|---|---|---|
| Integração gov.br (RF004/RF005/RF011) | Bloqueado | Exige credenciamento oficial; adaptador simulado identificado como demonstração |
| SMS do código de voto (RF011) | Pendente | Sem provedor definido; SMS simulado, e-mail real |
| Envio real de e-mail | Implementado | Funciona com `SMTP_URL`; não testado contra servidor SMTP real |
| Antivírus ClamAV (RF023) | Implementado | Cliente clamd não testado contra servidor real; verificação embutida testada |
| Testes em PostgreSQL servidor | Testado | CI no GitHub Actions com PostgreSQL 16: 114/114 e E2E 32/32 em 12/11/2026 ([execução](https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal/actions/runs/43258424027)) |
| Docker/Compose | Implementado | Arquivos criados; **não executados** (sem Docker no ambiente) |
| RNF04, RNF09, RNF10 (desempenho/disponibilidade) | Pendente | Medição local feita e otimizações aplicadas (DT-23); falta teste sob carga e medição de disponibilidade |
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
| RF015 | Exercer direitos do titular de dados | Testado | — |
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
| RNF04 Internet fraca | Medido localmente (parcial) | Sem vídeo obrigatório; cerca de 172 KB no primeiro acesso (meta sugerida: 1 MB); não testado em rede lenta real |
| RNF05 Segurança da comunicação e acesso | Testado (parcial) | Argon2id, guardas, cabeçalhos; TLS depende da implantação |
| RNF06 Proteção dos dados pessoais | Implementado | Minimização e exportações agregadas testadas; RIPD não iniciado |
| RNF07 Integridade do voto | Testado | Transação única, sem vínculo, concorrência, hash da base |
| RNF08 Registro de atos | Testado | Auditoria encadeada; valores pessoais não gravados (pendência 17) |
| RNF09 Tempo de resposta | Medido localmente (parcial) | Versão otimizada: páginas em 12–36 ms no servidor e 52–112 ms até carregar, com dados de demonstração; sem teste de carga |
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
- Campo de seleção (bairro) voltava vazio quando o servidor devolvia o formulário com erro → o campo é recriado com o valor enviado. Achado pelo teste novo do cadastro.
- Colar um valor com caracteres a mais em campo com máscara perdia dígitos por causa do limite de tamanho → a máscara passou a limitar os dígitos.
- Topo do site ocupava cerca de 240 px no celular e cortava o nome do portal → barra de acessibilidade e faixa de demonstração em uma linha cada (122 px).
- Modo de alto contraste deixava textos ilegíveis (branco sobre amarelo, botão amarelo sobre amarelo) → reescrito com regra única (DT-21) e coberto por teste com axe. (Recurso retirado em 24/11/2026, DT-22.)
- Navegação lenta: o sistema era usado em modo de desenvolvimento → comando `npm run preview`; painel de monitoramento fazia 28 consultas ao banco por acesso e listas administrativas vinham sem paginação → consultas em lote, paginação e índices (DT-23).
- Referências cruzadas (DT-24): o E2E que percorre as telas administrativas achou identificadores sem link na tela de Parâmetros (rótulos vindos de `settings.ts`) → passaram por `<RefText>`; tabelas, listas de descrição e linha do tempo dos componentes base também passaram a reconhecer os identificadores.
- Na página `/requisitos`, o destaque de 3 s terminava antes do fim da rolagem suave em saltos longos e o destino parava 160 px abaixo do topo (margem do cabeçalho aplicada duas vezes) → o destaque passou a contar a partir do fim da rolagem e a margem duplicada saiu.
- Bloqueios de arquivo `EBUSY` causados pelo OneDrive durante builds → recomenda-se mover o projeto para fora do OneDrive.
- Revisão de qualidade de 24/11/2026 (DT-27, detalhes em `docs/testes/RELATORIO_DE_TESTES.md`): erro 500 no portal com filtros de URL manipulados e em rotas com identificador malformado → validação de formato (404 ou filtro ignorado); aviso "Identidade verificada" e ação "Ver meu perfil" levavam a `/conta/perfil` (404) → `/conta` e teste que confere todos os links fixos; consulta sumia da busca pelo texto da proposta depois de editada → índice calculado em um só lugar; área do cidadão com 930 px a 320 px e telas administrativas largas → regras base de largura; tabelas roláveis sem foco de teclado e lista inválida (axe) → corrigidas; erro antigo no assistente de votação → some ao voltar; listagem pública paginada no banco (19,4 → 4,0 ms com 600 consultas); leitor do PDF incompatível com Node 20 → tabela WinAnsi; `next build` travando com `.next-e2e` antigo no OneDrive → pasta apagada antes do build.

## Próxima etapa recomendada
0. Figma: nos cartões "Regra · RN02", "Requisito · RF004" e "Regra · RN16" da seção "Referências cruzadas entre requisitos", selecionar a instância "Destaque do requisito" e ativar "Posição absoluta" (Absolute position), com restrições Esquerda e direita / Topo e base e tamanho igual ao do cartão. A última correção não pôde ser aplicada porque o limite de chamadas do Figma MCP do plano Starter foi atingido em 23/11/2026.
1. Manter o quadro Trello em dia: mover os cartões de "A fazer" conforme forem concluídos.
2. Levar `docs/requisitos/PENDENCIAS_CLIENTE.md` ao cliente e ajustar parâmetros.
3. Executar o `docker compose` e exercitar backup e restauração (RNF14).
4. Inspeção de acessibilidade com NVDA/TalkBack e medição de desempenho.
