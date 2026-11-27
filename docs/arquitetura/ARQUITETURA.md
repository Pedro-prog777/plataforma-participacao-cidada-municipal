# Arquitetura — PPCM

Monólito Next.js 15 em TypeScript (App Router e Server Actions) com PostgreSQL acessado pelo Drizzle ORM.
O núcleo de regras é orientado a objetos (DT-35): entidades com estado encapsulado, hierarquias de
critérios e estratégias polimórficas, e repositórios que traduzem entre os objetos e as tabelas.

## Visão geral

```mermaid
flowchart LR
  subgraph Navegador
    UI[Páginas React<br/>Server Components]
    CF[Componentes cliente<br/>formulários, votação]
  end
  subgraph Servidor Next.js
    MW[Middleware<br/>CSP com nonce]
    PG[Páginas e layouts<br/>src/app]
    SA[Server Actions<br/>src/server/actions]
    RH[Route Handlers<br/>src/app/api]
    GU[Guardas de sessão<br/>src/server/auth]
    SV[Serviços — casos de uso<br/>src/server/modules]
    DOM[Domínio orientado a objetos<br/>src/server/domain]
    REP[Repositórios<br/>src/server/repositories]
    SCH[Rotina de 1 minuto<br/>instrumentation-node.ts]
  end
  DB[(PostgreSQL<br/>ou PGlite)]
  FS[(Arquivos<br/>STORAGE_DIR)]
  SMTP[[SMTP ou caixa simulada]]
  IDP[[Provedor de identidade<br/>simulado / gov.br]]
  AV[[ClamAV opcional]]

  UI --> MW --> PG
  CF --> SA
  PG --> GU --> SV
  SA --> GU
  RH --> GU
  SCH --> SV
  SV --> DOM
  SV --> REP
  REP --> DOM
  REP --> DB
  SV --> DB
  SV --> FS
  SV --> SMTP
  SV --> AV
  CF -.redireciona.-> IDP
```

## Camadas

| Camada | Pasta | Responsabilidade | Pode depender de |
|---|---|---|---|
| Interface | `src/app`, `src/components` | Páginas (Server Components), formulários cliente, layout e acessibilidade. **Não acessa o banco** (regra de lint). | ações, guardas, serviços (leitura) |
| Ações | `src/server/actions` | Recebem `FormData`, chamam o guarda de sessão e o serviço, convertem erros de domínio em mensagens por campo e redirecionam. | guardas, serviços |
| Guardas | `src/server/auth/current.ts` | Sessão atual, `requireCitizen`, `requireAdmin(permissão)`; auditam acessos negados. | serviços de acesso e auditoria |
| Serviços (casos de uso) | `src/server/modules/*` | Coordenam cada operação: validação de entrada (Zod), autorização (permissão + papel na consulta), transação, chamada às entidades, persistência pelos repositórios, auditoria e avisos. | domínio, repositórios, infraestrutura |
| **Domínio** | `src/server/domain` | Entidades, estratégias e serviços de domínio com as regras de negócio. **Não acessa banco, relógio nem interface**: recebe `agora` de quem chama. | apenas utilitários puros (`lib/errors`, `lib/clock` só constantes e `ageOn`, `lib/labels`, `lib/text`) |
| **Repositórios** | `src/server/repositories` | Traduzem entre entidades e tabelas (Drizzle ORM); gravam só o que a entidade mudou. | domínio, `db` |
| Infraestrutura | `src/server/lib`, `src/server/db` | Banco, criptografia, CPF, Argon2id, TOTP, arquivos, CSV/PDF, CAPTCHA, parâmetros, relógio do servidor. | — |
| Compartilhado | `src/lib` | Rótulos, permissões, CPF e texto — seguros para cliente e servidor. | — |

**Comunicação entre camadas.** A página chama uma ação → a ação confere a sessão e chama o serviço → o
serviço abre a transação, carrega a entidade pelo repositório, chama o método de negócio
(`consulta.publicar(...)`), pede ao repositório que grave as alterações, registra a auditoria e os
avisos e confirma. Se a regra recusa, a entidade lança `DomainError` (mensagem em português simples),
a transação é desfeita e a ação devolve a mensagem ao formulário.

### Organização do domínio

| Pasta | Conteúdo |
|---|---|
| `domain/entities/` | `EntidadeComCicloDeVida` (abstrata), `Consulta`, `PropostaCidada`, `Cidadao`, `PublicoAlvo`, `Cedula` |
| `domain/strategies/` | `CriterioPublicoAlvo` e subclasses; `QuorumDeReferencia` e subclasses |
| `domain/services/` | `AvaliadorDeElegibilidade`, `Apuracao` (serviços de domínio puros) |
| `domain/interfaces/` | contratos: `CanalDeNotificacao`, `TransporteDeEmail`, aviso e destinatário, resultado da elegibilidade |
| `domain/erros.ts` | `VoteRejected` |
| `repositories/` | `RepositorioDeEntidade` (abstrata), `ConsultaRepository`, `PropostaCidadaRepository` |
| `modules/notifications/canais.ts` | implementações dos canais (`CanalCentralDeAvisos`, `CanalEmail`) e transportes (`TransporteSmtp`, `TransporteSimulado`), que dependem do banco e do SMTP |

## Integração com PostgreSQL e Drizzle ORM

- **Esquema e migrations:** o modelo é declarado em `src/server/db/schema.ts` (Drizzle) e versionado em `database/migrations` (SQL gerado e revisado). `database/schema.sql` é a estrutura completa num arquivo só, gerada das migrations (`npm run db:sql`); um teste confere que ela reconstrói o mesmo banco.
- **Conexão:** `src/server/db/client.ts` — PostgreSQL real por `DATABASE_URL` (pool do `pg`) ou PGlite (PostgreSQL em WebAssembly) quando a variável está vazia. As migrations são aplicadas ao iniciar (`db/bootstrap.ts`).
- **Leitura e escrita:** os serviços usam o construtor de consultas do Drizzle (consultas parametrizadas, sem SQL concatenado) e transações (`db.transaction`). As entidades com ciclo de vida são lidas e gravadas pelos repositórios; leituras de listagem e relatórios continuam em consultas agrupadas (DT-23).
- **Integridade no banco:** chaves primárias e estrangeiras, `UNIQUE`, `CHECK` de regra de negócio, tipos `ENUM`, gatilhos de registros somente de acréscimo e de `updated_at`, view `vw_consultas_publicas` e contas com permissões (DT-34) — ver `database/README.md`.

## Orientação a objetos (POO)

### Os quatro pilares no núcleo do sistema

| Pilar | Onde | Como |
|---|---|---|
| **Abstração** | `Consulta`, `PropostaCidada`, `Cidadao`, `Cedula`, `PublicoAlvo`, `AvaliadorDeElegibilidade`, `Apuracao`, repositórios | Cada classe representa um conceito do domínio da participação cidadã e expõe só operações com significado de negócio (`publicar()`, `suspender()`, `preencher()`, `avaliar()`, `calcular()`), escondendo como os dados são guardados. |
| **Encapsulamento** | `EntidadeComCicloDeVida` (campos `#original`, `#atual`, `#transicoes`), `Cidadao` (`#perfil`), `Cedula` (`#consultaId`, `#alternativaId`), critérios (`#bairros`, `#regioes`, `#idadeMinima`) | Campos privados do JavaScript (`#`), sem setters. A situação da consulta e da proposta só muda por `transicionar()` (protegido), chamado pelos métodos de negócio, que conferem a situação de origem e aplicam os campos da transição de uma só vez. Tentativa de atribuir `consulta.situacao` lança `TypeError`. |
| **Herança** | `EntidadeComCicloDeVida` → `Consulta`, `PropostaCidada`; `CriterioPublicoAlvo` → `CriterioDeEndereco` → `CriterioDomicilio`, `CriterioTerritorio`; `CriterioPublicoAlvo` → `CriterioFaixaEtaria`, `CriterioInformativo`; `QuorumDeReferencia` → `SemQuorum`, `QuorumAbsoluto`, `QuorumPercentual`; `CanalComPreferencia` → `CanalCentralDeAvisos`, `CanalEmail`; `RepositorioDeEntidade` → `ConsultaRepository`, `PropostaCidadaRepository`; `Error` → `DomainError` → `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `VoteRejected` | A base guarda o comportamento comum (validação de transição e controle de alterações; exigência de domicílio comprovado; regra "obrigatório sempre chega"; fluxo buscar → converter → gravar); cada subclasse só acrescenta o que é dela. |
| **Polimorfismo** | `CriterioPublicoAlvo.avaliar()`, `QuorumDeReferencia.participacoesNecessarias()`/`foiAtingido()`, `CanalDeNotificacao.deveEntregar()`/`entregar()`, `TransporteDeEmail.enviar()`, `EntidadeComCicloDeVida.descricao`, `IdentityProvider.authorizationUrl()` | Quem usa conhece só a abstração: `PublicoAlvo` percorre os critérios sem saber o tipo de cada um (antes, um `switch` em `voting/eligibility.ts`); `Apuracao` pergunta ao quórum sem saber qual foi adotado; `notifyUser` percorre os canais; a fila de e-mails usa o transporte configurado. Métodos-modelo (`CriterioDeEndereco.avaliar`, `RepositorioDeEntidade.salvar`) chamam métodos abstratos sobrescritos nas subclasses. |

### Entidades, persistência e erros

```mermaid
classDiagram
  direction TB
  class EntidadeComCicloDeVida~S~ {
    <<abstract>>
    -original
    -atual
    -transicoes
    +situacao S
    +descricao string*
    +transicoes
    +estaEm(situacoes) bool
    +alteracoesPendentes()
    +temAlteracoes bool
    #transicionar(para, permitidasDe, recusa, campos)
    #garantirSituacao(permitidas, recusa)
    #alterar(campos)
  }
  class Consulta {
    +reconstituir(propriedades)$ Consulta
    +titulo
    +abertura
    +encerramento
    +estaPublica bool
    +garantirEdicao()
    +enviarParaRevisao(agora)
    +garantirRevisorIndependente(revisorId, papeis)
    +concluirRevisao(aprovada, observacoes, agora)
    +decidirPrazoExcepcional(decisorId, autorizar, justificativa, prazoDias)
    +temConflitoDeAprovacao(atorId, contexto) bool
    +aprovar(aprovadorId, agora, antecedenciaHoras)
    +rejeitar(aprovadorId, justificativa)
    +publicar(agora, antecedenciaHoras)
    +desfazerAgendamento(agora)
    +abrir(agora, retrato, elegiveis)
    +encerrarNoHorario(agora)
    +suspender(justificativa)
    +retomar(agora, novoEncerramento)
    +encerrarAposSuspensao(agora)
    +cancelar(justificativa, tituloDigitado, agora)
    +registrarApuracao()
    +homologarResultado()
  }
  class PropostaCidada {
    +reconstituir(propriedades)$ PropostaCidada
    +garantirAnalistaDiferenteDoAutor(analistaId)
    +iniciarAnalise(agora)
    +solicitarAjuste(orientacao, prazoDias, agora)
    +responder(tipo, texto, agora)
    +vincularPropostaMunicipal(id)
    +publicar(agora)
    +encerrar(justificativa, agora)
    +encerrarPorAjusteVencido(agora)
    +reenviarComAjustes(conteudo, agora)
  }
  class EntidadePersistivel~P~ {
    <<interface>>
    +id string
    +alteracoesPendentes()
  }
  class RepositorioDeEntidade~E~ {
    <<abstract>>
    #db
    +obter(id, opcoes) E
    +deRegistro(registro) E
    +salvar(entidade)
    #buscarRegistro(id, paraAtualizar)*
    #paraPropriedades(registro)*
    #criarEntidade(propriedades)*
    #colunaDe(propriedade)*
    #gravarColunas(id, colunas)*
  }
  class ConsultaRepository
  class PropostaCidadaRepository
  class Cedula {
    -consultaId
    -alternativaId
    +preencher(opcoes, escolha)$ Cedula
    +abstencao bool
    +paraRegistro() RegistroDeVoto
  }
  class DomainError {
    +code string
    +fieldErrors
  }
  class ValidationError
  class ForbiddenError
  class NotFoundError
  class ConflictError
  class VoteRejected

  EntidadeComCicloDeVida <|-- Consulta
  EntidadeComCicloDeVida <|-- PropostaCidada
  EntidadePersistivel <|.. EntidadeComCicloDeVida
  RepositorioDeEntidade <|-- ConsultaRepository
  RepositorioDeEntidade <|-- PropostaCidadaRepository
  ConsultaRepository ..> Consulta : reconstrói e grava
  PropostaCidadaRepository ..> PropostaCidada : reconstrói e grava
  DomainError <|-- ValidationError
  DomainError <|-- ForbiddenError
  DomainError <|-- NotFoundError
  DomainError <|-- ConflictError
  DomainError <|-- VoteRejected
  Cedula ..> VoteRejected : lança
  Consulta ..> DomainError : recusa transições
```

### Elegibilidade e apuração

```mermaid
classDiagram
  direction TB
  class Cidadao {
    -perfil
    +IDADE_MINIMA$ number
    +temIdadeMinima(nascimento, data)$ bool
    +ehContaAdministrativa bool
    +contaAtiva bool
    +contaAtivaEm(agora) bool
    +identidadeVerificada bool
    +temIdadeMinimaEm(agora) bool
    +idadeEm(agora) number
    +informouEndereco bool
    +domicilioComprovado bool
    +moraEmAlgum(bairros, regioes) bool
    +comDomicilioPresumido(agora) Cidadao
  }
  class PublicoAlvo {
    -abertoAoPublicoEmGeral
    -criterios
    +de(aberto, criterios)$ PublicoAlvo
    +restricaoPara(cidadao, agora) Inelegibilidade
    +enquadra(cidadao, agora) bool
  }
  class CriterioPublicoAlvo {
    <<abstract>>
    +tipo string
    +criar(tipo, parametros)$ CriterioPublicoAlvo
    +avaliar(cidadao, agora) Inelegibilidade*
    +enquadra(cidadao, agora) bool
    #recusar(code, reason, action) Inelegibilidade
  }
  class CriterioDeEndereco {
    <<abstract>>
    +avaliar(cidadao) Inelegibilidade
    #conferirEndereco(cidadao)*
    #exigenciaDeComprovacao string*
  }
  class CriterioDomicilio
  class CriterioTerritorio {
    -bairros
    -regioes
  }
  class CriterioFaixaEtaria {
    -idadeMinima
    -idadeMaxima
  }
  class CriterioInformativo
  class AvaliadorDeElegibilidade {
    -janela
    -publico
    +avaliar(cidadao, jaParticipou, agora) ResultadoElegibilidade
    +votacaoAbertaEm(agora) bool
    +enquadraNoPublico(cidadao, publico, agora)$ bool
  }
  class Apuracao {
    -dados
    -alternativas
    +percentuaisPeloMaiorResto(contagens, casas)$ string[]
    +calcular() ResultadoDaApuracao
    -definirVencedora(contagens, validos, quorumAtingido)
  }
  class QuorumDeReferencia {
    <<abstract>>
    +tipo string
    +valor string
    +criar(tipo, valor)$ QuorumDeReferencia
    +participacoesNecessarias(elegiveis) number*
    +foiAtingido(participacoes, elegiveis) bool
  }
  class SemQuorum
  class QuorumAbsoluto
  class QuorumPercentual

  CriterioPublicoAlvo <|-- CriterioDeEndereco
  CriterioDeEndereco <|-- CriterioDomicilio
  CriterioDeEndereco <|-- CriterioTerritorio
  CriterioPublicoAlvo <|-- CriterioFaixaEtaria
  CriterioPublicoAlvo <|-- CriterioInformativo
  PublicoAlvo *-- "0..*" CriterioPublicoAlvo : critérios
  AvaliadorDeElegibilidade o-- "1" PublicoAlvo
  AvaliadorDeElegibilidade ..> Cidadao : avalia
  CriterioPublicoAlvo ..> Cidadao : consulta
  QuorumDeReferencia <|-- SemQuorum
  QuorumDeReferencia <|-- QuorumAbsoluto
  QuorumDeReferencia <|-- QuorumPercentual
  Apuracao o-- "1" QuorumDeReferencia
```

### Notificações e provedores externos

```mermaid
classDiagram
  direction LR
  class CanalDeNotificacao {
    <<interface>>
    +nome string
    +deveEntregar(destinatario, aviso) bool
    +entregar(destinatario, aviso)
  }
  class CanalComPreferencia {
    <<abstract>>
    #db
    +deveEntregar(destinatario, aviso) bool
    #preferenciaLigada(preferencia)* bool
    +entregar(destinatario, aviso)*
  }
  class CanalCentralDeAvisos
  class CanalEmail
  class TransporteDeEmail {
    <<interface>>
    +simulado bool
    +enviar(para, assunto, corpo)
  }
  class TransporteSmtp {
    -transporte
    -remetente
    +conectar(url, remetente)$ TransporteSmtp
  }
  class TransporteSimulado
  class IdentityProvider {
    <<interface>>
    +name string
    +simulated bool
    +authorizationUrl(state, returnTo) string
  }
  class SimulatedIdentityProvider
  class OfficialGovBrProvider

  CanalDeNotificacao <|.. CanalComPreferencia
  CanalComPreferencia <|-- CanalCentralDeAvisos
  CanalComPreferencia <|-- CanalEmail
  TransporteDeEmail <|.. TransporteSmtp
  TransporteDeEmail <|.. TransporteSimulado
  IdentityProvider <|.. SimulatedIdentityProvider
  IdentityProvider <|.. OfficialGovBrProvider
```

### Exemplo: publicar uma consulta

```mermaid
sequenceDiagram
  actor R as Responsável
  participant A as Server Action
  participant S as lifecycle.service
  participant Rep as ConsultaRepository
  participant C as Consulta
  participant DB as PostgreSQL
  R->>A: Publicar
  A->>S: publishConsultation(ator, id)
  S->>S: papel "responsável" na consulta (RF009)
  S->>DB: BEGIN · SELECT … FOR UPDATE
  S->>Rep: deRegistro(linha)
  Rep-->>S: Consulta
  S->>C: publicar(agora, antecedência)
  C->>C: só Aprovada (senão DomainError) · antecedência RN15 · situação → Agendada
  S->>Rep: salvar(consulta)
  Rep->>DB: UPDATE consultations SET status, published_at (só o que mudou)
  S->>DB: histórico público, auditoria e avisos
  S->>DB: COMMIT (qualquer erro desfaz tudo)
```

## Módulos de serviço (casos de uso)

| Módulo | Arquivo | Classes de domínio usadas | Requisitos |
|---|---|---|---|
| Autenticação e sessões | `auth/auth.service.ts`, `auth/session.service.ts` | `Cidadao.IDADE_MINIMA` (cadastro) | RF001–RF003, RF005–RF008, RF010, RF046 (convite) |
| Controle de acesso | `access/access.service.ts` | — | RF009, RF047, RF061 |
| Identidade | `identity/identity.service.ts` | `IdentityProvider` | RF004 |
| Perfil e direitos do titular de dados | `profile/profile.service.ts` | elegibilidade (resumo) | RF012, RF013, RF015 |
| Consultas — ciclo de vida | `consultations/lifecycle.service.ts` | `Consulta`, `ConsultaRepository` | RF024–RF030, RF032–RF034, RF061 |
| Consultas — leitura | `consultations/queries.service.ts` | `AvaliadorDeElegibilidade` (indicação ao cidadão) | RF016–RF018, RF050, RF056 |
| Votação | `voting/eligibility.ts`, `voting/voting.service.ts` | `Cidadao`, `PublicoAlvo`, critérios, `AvaliadorDeElegibilidade`, `Cedula` | RF011, RF036–RF041 |
| Resultados | `results/tally.ts`, `results/results.service.ts`, `results/open-data.service.ts` | `Apuracao`, `QuorumDeReferencia`, `Consulta` | RF042–RF045, RF059 |
| Rotina automática | `scheduler/scheduler.service.ts` | `Consulta`, `PropostaCidada` | RF019, RF031, RF035, RF055 |
| Propostas | `proposals/*.ts` | `PropostaCidada`, `PropostaCidadaRepository` | RF020–RF022, RF067 |
| Encaminhamentos | `outcomes/outcomes.service.ts` | — | RF063 |
| Anexos | `attachments/attachments.service.ts` | — | RF023 |
| Notificações | `notifications/*.ts` | `CanalDeNotificacao`, `TransporteDeEmail` | RF052–RF055 |
| Auditoria | `audit/audit.service.ts` | — | RF057, RF058 |
| Incidentes | `integrity/incidents.service.ts` | — | RF060 |
| Divulgação | `dissemination/dissemination.service.ts` | — | RF062 |
| Moderação | `moderation/moderation.service.ts` | — | RF064–RF066 |
| Administração | `admin/users.service.ts`, `admin/monitoring.service.ts` | — | RF046–RF049, RNF12 |
| Eventos | `events/events.service.ts` | — | RF068 |

## Fluxo do voto (RF036–RF038)

```mermaid
sequenceDiagram
  actor C as Cidadão
  participant UI as Tela de votação
  participant A as Server Action
  participant V as voting.service
  participant D as Domínio
  participant DB as PostgreSQL
  C->>UI: 1. escolhe alternativa (fica no navegador)
  UI->>A: prepareVote(consulta, canal)
  A->>V: requestVoteCode
  V->>D: AvaliadorDeElegibilidade.avaliar(Cidadao, …)
  V->>DB: grava código (hash), SEM alternativa
  V-->>C: código de 6 dígitos (5 min)
  C->>UI: 2. revisa e digita o código
  UI->>A: castVote(consulta, alternativa, código)
  A->>V: castVote
  V->>DB: BEGIN · SELECT consulta FOR SHARE
  V->>D: repete a elegibilidade pelo horário do servidor
  V->>D: Cedula.preencher(opções da consulta, escolha)
  V->>DB: INSERT participations (cidadão, data, hash do comprovante)
  V->>DB: INSERT votes (cedula.paraRegistro(): consulta e escolha — sem cidadão/hora)
  V->>DB: COMMIT (falha → tudo desfeito)
  V-->>C: 3. comprovante de 12 caracteres (sem alternativa)
```

## Rotina automática (RF019)

A cada minuto (`src/instrumentation-node.ts`): abre consultas agendadas no horário (`Consulta.abrir`, com retrato dos parâmetros), encerra as abertas no horário (`Consulta.encerrarNoHorario`; o `UPDATE` aguarda votos em andamento), verifica integridade e apura (`Consulta.registrarApuracao`), envia lembretes 48 h antes, encerra propostas sem ajuste no prazo (`PropostaCidada.encerrarPorAjusteVencido`), remove cópias de dados pessoais expiradas (RF015), reordena fisicamente os votos e processa a fila de e-mails pelo `TransporteDeEmail` configurado. Pode ser executada manualmente em `/admin/monitoramento` ou com `npm run jobs:tick`.

## Segurança transversal

- CSP com nonce, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção (`next.config.ts`, `src/middleware.ts`).
- Autorização no servidor em toda página, ação e rota; papéis por consulta para atos do ciclo de vida. A segregação de funções (RN20, RN36) também está na entidade `Consulta` (`temConflitoDeAprovacao`, `garantirRevisorIndependente`).
- Toda escrita administrativa ocorre em transação com auditoria encadeada; se a auditoria falhar, o ato é desfeito.
- Sigilo do voto por construção: a `Cedula` não tem campo para o eleitor; `votes` não tem chave para cidadão, participação ou horário (RN07).
- Nenhum dado pessoal em páginas públicas, exportações ou auditoria (filtro de campos proibidos em `audit.service.ts`).

## Implantação

- `Dockerfile` (build standalone) e `docker-compose.yml` (PostgreSQL 16 + aplicação). Variáveis em `.env.example`.
- Produção: definir `DATABASE_URL`, `CPF_HMAC_KEY`, `DATA_ENCRYPTION_KEY`, `APP_SIGNING_KEY`, `APP_URL` com https, `DEMO_MODE=false`, `SMTP_URL` e, se possível, `CLAMAV_HOST`.
- Banco a partir de um arquivo: `database/schema.sql` + `database/seed-referencia.sql` (ver `database/README.md`).
- Backups: `pg_dump` diário com teste periódico de restauração (RNF14) — ver `docs/arquitetura/MODELO_DE_DADOS.md`.
