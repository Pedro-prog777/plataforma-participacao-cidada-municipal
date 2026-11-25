# Modelo de dados — PPCM

Fonte da verdade: `src/server/db/schema.ts`. Migrations: `database/migrations/0000_inicial.sql` (tabelas, índices, restrições), `0001_gatilhos_somente_acrescimo.sql` (imutabilidade), `0002_indices_de_desempenho.sql`, `0003_indice_codigos_de_confirmacao.sql` e `0004_votos_sigilo_reembaralhamento.sql` (gatilho de `votes` que só admite a troca de `shuffle_key` — DT-31).

## Diagrama entidade-relacionamento (principais)

O diagrama está em [`database/diagrams/modelo-er.md`](../../database/diagrams/modelo-er.md).

> **Não há relacionamento entre `participations` e `votes`.** Esse é o requisito central de sigilo (RN07, RS002, RNF07).

## Tabelas

| Tabela | Finalidade | Restrições e índices relevantes |
|---|---|---|
| `users` | Cidadãos e servidores | `cpf_hmac` único; (`kind`, `email`) único; matrícula única; CHECK: administrador sem CPF |
| `sessions` | Sessões (id = SHA-256 do token) | índice por usuário |
| `tokens` | Confirmação de e-mail, recuperação, convite, troca de e-mail (uso único) | `token_hash` único |
| `one_time_codes` | Código de 6 dígitos antes do voto (sem alternativa); até 3 válidos por consulta (DT-32) | Índice (user_id, purpose, scope) |
| `auth_failures` | Falhas por conta e IP (hash) | índice (ip_hash, created_at) |
| `roles`, `user_roles` | Papéis como conjuntos de permissões | chave composta |
| `identity_verifications` | Verificação gov.br/documental | — |
| `municipal_proposals` | Propostas oficiais (RF022) | — |
| `consultations` | Consultas e ciclo de vida | `slug` único; CHECK pergunta ≤ 300; índice (status, closes_at) |
| `alternatives` | 2 a 10 alternativas | único (consulta, lower(rótulo)) |
| `audience_criteria` | Limitações justificadas do público-alvo | — |
| `consultation_assignments` | Responsáveis por papel (RF061) | único parcial (consulta, papel, usuário) ativo |
| `review_checklists` | Lista de verificação da revisão (RF028) | — |
| `entity_versions` | Versões de propostas e consultas | **somente acréscimo** |
| `consultation_events` | Linha do tempo pública (RF051) | **somente acréscimo** |
| `participations` | Quem participou: cidadão, consulta, **data**, hash e cifra do comprovante | **único (consulta, cidadão)**; único `receipt_hash`; **somente acréscimo**; sem TRUNCATE |
| `votes` | O que foi escolhido: consulta, alternativa ou abstenção, `shuffle_key` | CHECK coerência abstenção/alternativa; **somente acréscimo** (o único UPDATE aceito troca `shuffle_key`, para que nenhum voto fique ligado à participação pela coluna de sistema `xmin` — DT-31); sem TRUNCATE; sem colunas de tempo ou de pessoa |
| `results` | Preliminar, final e retificações com hash | **somente acréscimo** |
| `integrity_checks` | Relatórios de integridade (RF059) | **somente acréscimo** |
| `incidents` | Incidentes (RF060) | — |
| `outcomes`, `outcome_entries` | Encaminhamentos e cada mudança de situação | entradas **somente acréscimo** |
| `citizen_proposals`, `citizen_proposal_events` | Propostas cidadãs e estados | protocolo único; CHECK título ≤ 120; eventos **somente acréscimo** |
| `proposal_supports` | Apoios (RF067) | chave (proposta, usuário) — um apoio por pessoa |
| `attachments` | Arquivos e links com alternativa textual e SHA-256 | índice (dono) |
| `notifications`, `notification_preferences`, `email_outbox` | Central de avisos, preferências e fila de e-mail | — |
| `audit_log` | Trilha encadeada por hash | **somente acréscimo**; sem TRUNCATE |
| `dissemination_records` | Canais de divulgação (RF062) | — |
| `comments`, `comment_helpful`, `content_reports`, `moderation_decisions` | Comentários, denúncias e moderação | denúncia única por (alvo, denunciante); decisões **somente acréscimo** |
| `participatory_events`, `event_questions` | Eventos (RF068) | protocolo único |
| `settings` | Parâmetros e recursos condicionados (RNF12) | — |
| `data_exports` | Cópias dos dados pessoais (RF015) por 48 h | removidas pela rotina |

## Dados pessoais e proteção

| Dado | Como é guardado |
|---|---|
| CPF | HMAC-SHA256 com chave externa + forma mascarada (nunca em claro) |
| Senha | Argon2id |
| Segredo TOTP | AES-256-GCM |
| Código do comprovante | SHA-256 (verificação pública) + AES-256-GCM (para o titular rever) |
| IP | HMAC truncado, só para contar tentativas |
| Data da participação | Somente a data (sem hora) |

## Estratégia de backup (RNF14)
- `pg_dump -Fc` diário, retenção de 30 dias, cópias cifradas e fora do servidor do banco.
- Teste mensal de restauração em ambiente isolado, seguido de `npm run test` apontando para o banco restaurado e da verificação da trilha de auditoria (`/admin/auditoria?verificar=1`).
- Acesso a backups e WAL restrito (ver DT-05).
- Em desenvolvimento (PGlite), o banco é descartável: `npm run db:reset`.
