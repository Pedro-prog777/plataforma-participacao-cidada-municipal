# PRD — Plataforma de Participação Cidadã Municipal (PPCM)

| | |
|---|---|
| **Produto** | Plataforma de Participação Cidadã Municipal (PPCM) |
| **Equipe** | João Pedro e Flávia Marina — Engenharia de Software, CESMAC (trabalho acadêmico) |
| **Versão do documento** | 1.0 — 27/11/2026 |
| **Base** | Documento de Requisitos v6 (`docs/requisitos/Documento_de_Requisitos_v6.pdf`, transcrito em `docs/requisitos/REQUISITOS_COMPLETOS.md`) e o sistema implementado neste repositório |
| **Especificações** | `specs/*.md` (uma por funcionalidade) · arquitetura em `docs/arquitetura/ARQUITETURA.md` |

## 1. Visão geral do produto

A PPCM é um portal web que aproxima a população da administração municipal. Pela plataforma, a pessoa
conhece as consultas públicas abertas pela Prefeitura, entende o assunto, registra a sua opinião por
votação **consultiva**, envia propostas e acompanha os resultados e o que foi feito depois
(encaminhamentos). A administração conduz cada consulta do rascunho ao resultado, com revisão,
aprovação por outra pessoa, publicação, apuração automática e prestação de contas.

A demonstração é ambientada em **Maceió/AL** (bairros reais; pessoas, consultas e órgãos fictícios) e
não é serviço oficial.

## 2. Problema

- A participação da população em decisões municipais costuma ser presencial, em horários restritos, e
  pouco transparente quanto ao que acontece depois.
- Consultas informais (formulários, enquetes) não garantem **uma pessoa, um voto**, nem o **sigilo** da
  escolha, nem impedem que **resultados parciais** influenciem quem ainda não votou.
- Falta rastreabilidade: quem elaborou, revisou e aprovou a consulta, e o que foi alterado depois de
  publicada.

## 3. Objetivos

1. Permitir que o cidadão maior de idade, com identidade verificada, vote **uma única vez**, de forma
   **secreta** e com **comprovante**, nas consultas cujo público-alvo o inclui.
2. Dar à administração um fluxo controlado de consulta pública com **segregação de funções** (quem
   elabora ou revisa não aprova) e registro de cada ato.
3. Publicar resultados **conferidos** (integridade e hash), com metodologia, e os encaminhamentos.
4. Oferecer transparência total sem expor dados pessoais: portal público, histórico, dados abertos.
5. Ser acessível (WCAG 2.2 AA, uso a partir de 320 px) e escrito em linguagem simples.

## 4. Público-alvo e perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| **Visitante** | Qualquer pessoa, sem login | Consulta o portal: consultas, resultados, encaminhamentos, histórico, propostas publicadas, dados abertos; verifica comprovantes. |
| **Cidadão** | Pessoa com 18 anos completos, conta ativa | Mantém o perfil, verifica a identidade, vota, recebe comprovante, envia e acompanha propostas, escolhe os avisos, baixa os próprios dados, desativa a conta. |
| **Administrador** | Servidor da Prefeitura, com segundo fator | Atua conforme os papéis: gestor de acessos, elaborador, revisor, aprovador, autorizador de prazo excepcional, responsável, divulgação, acompanhamento, publicação de resultados, encaminhamentos, análise de propostas, moderação e atendimento. **Não vota.** |
| **Sistema** | Rotina automática a cada minuto | Abre e encerra consultas no horário, verifica integridade, apura, envia lembretes e e-mails. |

## 5. Principais funcionalidades

| # | Funcionalidade | Telas principais | Especificação |
|---|---|---|---|
| 1 | Cadastro de cidadão e confirmação de e-mail | `/cadastro`, `/confirmar-email` | `specs/cadastro-cidadao.md` |
| 2 | Login, segundo fator, bloqueio e sessões | `/entrar`, `/entrar/segundo-fator` | `specs/autenticacao.md` |
| 3 | Recuperação e alteração de senha | `/recuperar-senha`, `/redefinir-senha`, `/conta/senha` | `specs/recuperacao-senha.md` |
| 4 | Verificação de identidade e domicílio | `/conta/verificacao`, `/admin/verificacoes` | `specs/verificacao-identidade.md` |
| 5 | Ciclo de vida da consulta pública | `/admin/consultas/*` | `specs/consultas.md` |
| 6 | Votação em 3 passos com código de confirmação | `/consultas/[slug]/participar` | `specs/votacao.md` |
| 7 | Comprovante e verificação pública | `/conta/participacoes`, `/comprovante` | `specs/comprovantes.md` |
| 8 | Apuração, resultado e dados abertos | `/consultas/[slug]/resultado`, `/admin/consultas/[id]/resultado`, `/dados-abertos` | `specs/apuracao-resultados.md` |
| 9 | Propostas cidadãs | `/conta/propostas`, `/admin/propostas`, `/propostas` | `specs/propostas-cidadas.md` |
| 10 | Busca e filtros de consultas | `/consultas`, `/consultas/encerradas` | `specs/busca-filtros.md` |
| 11 | Relatórios e painel de monitoramento | `/admin/relatorios`, `/admin/monitoramento` | `specs/relatorios.md` |
| 12 | Trilha de auditoria | `/admin/auditoria` | `specs/auditoria.md` |
| 13 | Gestão de usuários, papéis e permissões | `/admin/usuarios`, `/admin/papeis`, `/convite` | `specs/gestao-usuarios.md` |
| 14 | Notificações e preferências | `/conta/avisos`, `/conta/notificacoes` | `specs/notificacoes.md` |

Também implementados: perfil e direitos do titular de dados (RF012–RF015), encaminhamentos (RF063),
divulgação com QR Code (RF062), anexos com verificação de arquivo (RF023), incidentes (RF060), portal
de transparência e indicadores (RF050). Comentários (RF064), apoios (RF067) e eventos (RF068) existem
e ficam **desligados por padrão** até a validação do cliente.

## 6. Requisitos funcionais

Os 68 requisitos funcionais (RF001–RF068) estão no Documento de Requisitos v6. Agrupados:

| Grupo | Requisitos |
|---|---|
| Conta e acesso | RF001–RF011 |
| Perfil e titular de dados | RF012–RF015 |
| Portal e consultas públicas | RF016–RF019, RF050, RF051, RF056 |
| Propostas | RF020–RF022, RF067 |
| Elaboração e condução da consulta | RF023–RF035, RF061, RF062 |
| Votação e comprovante | RF036–RF041 |
| Resultado e prestação de contas | RF042–RF045, RF063 |
| Administração | RF046–RF049 |
| Notificações | RF052–RF055 |
| Auditoria e integridade | RF057–RF060 |
| Participação complementar (desligada por padrão) | RF064–RF066, RF068 |

Situação de cada um, com tela, módulo e teste: `docs/requisitos/MATRIZ_DE_RASTREABILIDADE.md` e `docs/testes/MATRIZ_DE_COBERTURA.md`.

## 7. Requisitos não funcionais

| ID | Requisito | Como o produto atende |
|---|---|---|
| RNF01 | Acessibilidade WCAG 2.2 AA / eMAG | axe-core nos testes E2E, alto contraste e tamanho do texto; inspeção com leitor de tela ainda pendente |
| RNF02 | Linguagem simples; votar em até 3 passos | Telas do cidadão sem termos técnicos (teste E2E); votação em 3 passos |
| RNF03 | Uso a partir de 320 px | Testes E2E sem rolagem horizontal a 320 px |
| RNF05 | Segurança da comunicação e do acesso | HTTPS/HSTS em produção, Argon2id, autorização no servidor, CSP com nonce |
| RNF06 | Proteção de dados pessoais | Minimização, CPF só como HMAC e mascarado, exportações agregadas |
| RNF07 | Integridade do voto | Participação e voto na mesma transação, sem vínculo; teste de concorrência |
| RNF08 | Registro dos atos administrativos | Auditoria somente de acréscimo, encadeada por hash |
| RNF12 | Parâmetros sem mexer no código | Tela de parâmetros (`/admin/configuracoes`) |
| RNF13 | Dados abertos | CSV e JSON sem dados pessoais |
| RNF14 | Voto sem perda | Falha durante o registro desfaz tudo e permite nova tentativa |

RNF04, RNF09, RNF10 e RNF11 têm metas sugeridas (*) e não foram medidos com carga real.

## 8. Regras de negócio principais

| Regra | Descrição | Onde está no código |
|---|---|---|
| Idade mínima | Só quem tem **18 anos completos** cria conta de cidadão e vota (DT-30, DT-33) | `Cidadao.IDADE_MINIMA` |
| Voto único (RN05) | Um voto por pessoa por consulta, inclusive com envios simultâneos | índice único em `participations` + elegibilidade |
| Voto secreto (RN07) | O voto não tem ligação com quem votou | `Cedula` (sem campo de eleitor), tabela `votes` |
| Período de votação (RN08) | Vale o horário do servidor | `AvaliadorDeElegibilidade.votacaoAbertaEm` |
| Alternativas (RN13) | 2 a 10 alternativas; exatamente uma escolha válida ou abstenção permitida | `setAlternatives`, `Cedula.preencher` |
| Prazo (RN14) | 20 dias; 10 com emergência justificada e autorizada | `consulta.prazo_padrao_dias`, `Consulta.decidirPrazoExcepcional` |
| Antecedência (RN15) | Abertura pelo menos 24 h após aprovação/publicação | `Consulta.aprovar`, `Consulta.publicar` |
| Sigilo das parciais (RN16) | Nenhuma contagem por alternativa antes da publicação | painel e páginas só com nº de participações |
| Apuração (RN18, RN19) | Maioria simples dos válidos; percentuais pelo maior resto | `Apuracao` |
| Quórum de referência (RN17) | Nenhum, absoluto ou percentual dos elegíveis | `QuorumDeReferencia` e subclasses |
| Segregação de funções (RN20, RN36) | Quem elabora, edita ou revisa não aprova | `Consulta.temConflitoDeAprovacao` |
| Imutabilidade (RN12, RN28, RN29) | Após publicar, só correções justificadas; registros somente de acréscimo | `Consulta.garantirAlteracaoPublicada`, gatilhos do banco |
| Propostas (RN30) | Recebida → Em análise → Ajuste/Respondida → Publicada → Encerrada | `PropostaCidada` |

## 9. Restrições

- **Acadêmico:** sem integração real com o gov.br e sem SMS — os adaptadores são simulados, identificados
  e restritos ao modo demonstração (`DEMO_MODE`).
- **Natureza consultiva (*):** o resultado orienta a administração e não substitui plebiscito, referendo
  ou audiência pública (RN34).
- **Decisões pendentes do cliente (*):** listadas em `docs/requisitos/PENDENCIAS_CLIENTE.md`.
- **CPF fictício (DT-36):** como no Documento v6, o cadastro aceita CPF fictício — só o formato
  XXX.XXX.XXX-XX é conferido, sem dígitos verificadores; a conta única por CPF (RN02) continua. Com o
  gov.br real, uma conta com CPF fictício não passaria da verificação de identidade e não votaria.
- **Dados:** somente fictícios na demonstração; repositório público sem segredos.

## 10. Tecnologias

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (orientação a objetos no domínio — DT-35) |
| Aplicação | Next.js 15 (App Router, Server Actions), React 19 |
| Interface | Tailwind CSS 4 |
| Banco | PostgreSQL 16 (PGlite em desenvolvimento e testes) |
| Persistência | Drizzle ORM + migrations SQL (`database/migrations`) e `database/schema.sql` |
| Validação | Zod |
| Segurança | Argon2id, HMAC do CPF, AES-256-GCM, TOTP, CSP com nonce |
| Testes | Vitest (unitários, integração e segurança), Playwright + axe-core (E2E e acessibilidade) |
| Infra | Docker e docker compose; GitHub Actions (CI com PostgreSQL 16) |

## 11. Critérios de aceitação do produto

1. `npm run check` (tipos, lint e testes) e `npm run test:e2e` aprovados.
2. Cidadão elegível vota em até 3 passos e recebe comprovante; segundo voto, voto fora do período e voto
   de conta administrativa são recusados.
3. Nenhuma tela, rota, relatório ou exportação revela em quem alguém votou nem contagem parcial por
   alternativa (teste "Sigilo do voto").
4. Consulta só é publicada depois de revisada e aprovada por pessoas diferentes de quem a elaborou.
5. Resultado só é publicado após verificação de integridade; o hash permite conferir a apuração.
6. Todas as telas públicas e da área do cidadão sem violações sérias do axe e sem rolagem a 320 px.
7. O banco pode ser reconstruído por `database/schema.sql` + `database/seed-referencia.sql` (teste
   automatizado compara com as migrations).

## 12. Escopo

**Inclui:** cadastro, verificação de identidade e autenticação; perfil e direitos do titular de dados;
ciclo completo da consulta pública; votação consultiva com voto único, sigiloso e com comprovante;
propostas cidadãs; denúncia e moderação; portal de transparência, histórico, auditoria e dados abertos;
notificações por e-mail e na plataforma; relatórios agregados.

**Fora do escopo:** eleições, plebiscitos, referendos e iniciativa popular formal; execução das propostas
e acompanhamento de obras ou orçamento; transmissão de vídeo e videochamadas; integração automática com
redes sociais; votação presencial; pagamentos; aplicativo móvel nativo.
