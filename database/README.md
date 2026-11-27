# Banco de dados — PPCM

PostgreSQL 16 em produção e no CI; PGlite (PostgreSQL em WebAssembly) no desenvolvimento local, sem instalação.

| Pasta / arquivo | Conteúdo |
|---|---|
| `migrations/0000_inicial.sql` | Tabelas, índices e restrições (gerado pelo Drizzle a partir de `src/server/db/schema.ts`) |
| `migrations/0001_gatilhos_somente_acrescimo.sql` | Gatilhos que tornam imutáveis votos, participações, auditoria e resultados. **Não remover.** |
| `migrations/0002_indices_de_desempenho.sql` | Índices dos filtros e das listagens (DT-23) |
| `migrations/0003_indice_codigos_de_confirmacao.sql` | Índice dos códigos de confirmação do voto |
| `migrations/0004_votos_sigilo_reembaralhamento.sql` | Gatilho de `votes` que admite só a troca da chave de embaralhamento (DT-31) |
| `migrations/0005_view_consultas_publicas.sql` | View `vw_consultas_publicas` (DT-34) |
| `migrations/0006_reforco_integridade.sql` | `CHECK` do período da consulta e gatilho que preenche `updated_at` (DT-34) |
| `migrations/0007_papeis_e_permissoes.sql` | Contas `ppcm_app`, `ppcm_relatorios`, `ppcm_auditoria` com `GRANT`/`REVOKE` (DT-34) |
| `migrations/meta/` | Controle de versões das migrations (Drizzle) |
| `schema.sql` | **Estrutura completa em um só script** (as 8 migrations, na ordem do controle de versões): tipos `ENUM`, 44 tabelas com chaves e `CHECK`, índices, funções e gatilhos, a view e as contas. Gerado — não editar à mão |
| `seed-referencia.sql` | Dados de referência em SQL: 8 regiões, 50 bairros, 12 temas, 9 órgãos e 13 papéis administrativos, com `ON CONFLICT DO NOTHING` (pode ser executado mais de uma vez). Gerado |
| `seeds/seed-reference.ts` | Dados de referência: regiões, bairros, temas, órgãos e papéis administrativos |
| `seeds/seed-demo.ts` | Município, pessoas e consultas **fictícios**; carregados só em modo demonstração |
| `diagrams/modelo-er.md` | Diagrama entidade-relacionamento |

**Comandos:** `npm run db:migrate` · `npm run db:seed` · `npm run db:reset` (recria o banco local) · `npm run db:generate` (nova migration após alterar o schema) · `npm run db:sql` (regenera `schema.sql` e `seed-referencia.sql`; rode depois de uma nova migration ou de mudar os dados de referência).

**Criar o banco só com SQL** (banco vazio, sem a aplicação):

```sh
psql -d ppcm --single-transaction -f database/schema.sql
psql -d ppcm -f database/seed-referencia.sql
```

A aplicação continua usando as migrations (aplicadas ao iniciar ou por `npm run db:migrate`), que produzem exatamente a mesma estrutura: o teste `tests/integration/schema-sql.test.ts` compara o catálogo criado pelo `schema.sql` com o criado pelas migrations (tabelas, colunas, restrições, índices, gatilhos, funções, tipos e view) e falha se os arquivos ficarem desatualizados. Os dados de demonstração não entram no `seed-referencia.sql`, porque dependem das chaves de criptografia do ambiente (`npm run db:seed` com `DEMO_MODE=true`).

Descrição das tabelas e das garantias de sigilo do voto: `docs/arquitetura/MODELO_DE_DADOS.md`.

## Onde está cada recurso de banco de dados

| Recurso | Arquivo | O que conferir |
|---|---|---|
| **DDL com as quatro integridades** | `0000_inicial.sql`, `0006_reforco_integridade.sql` | **Domínio:** 7 tipos `ENUM` (ex.: `consultation_status`), `NOT NULL`, tipos e `DEFAULT`. **Entidade:** `PRIMARY KEY` nas 44 tabelas e índices `UNIQUE` (ex.: `users_cpf_hmac_uq`). **Referencial:** 69 `FOREIGN KEY … REFERENCES`. **Definida pelo usuário:** `CHECK` de regra de negócio (`votes_choice`, `users_admin_no_cpf`, `consultations_periodo_valido`, limites de tamanho) e os gatilhos. |
| **Trigger** | `0001_gatilhos_somente_acrescimo.sql`, `0004_…`, `0006_reforco_integridade.sql` | Funções PL/pgSQL `ppcm_somente_acrescimo()` e `ppcm_sem_truncate()` (impedem alterar/apagar registros imutáveis), `ppcm_votos_somente_reembaralhar()` e `ppcm_preenche_updated_at()` (executa uma ação: grava o momento da alteração). |
| **Campo indexado** | `0000_inicial.sql`, `0002_…`, `0003_…` | 33 índices explícitos, ex.: `consultations_status_idx (status, closes_at)`, `participations_citizen_consultation_uq` (voto único) e o índice parcial `notifications_unread_idx`. |
| **Contas e permissões** | `0007_papeis_e_permissoes.sql` | `CREATE ROLE`, `GRANT` e `REVOKE` com três perfis (tabela abaixo). |
| **View** | `0005_view_consultas_publicas.sql` | `vw_consultas_publicas`: consultas públicas com tema, região, órgão e número de participações — sem dados pessoais nem votos. |

Os testes que comprovam cada recurso estão em `tests/integration/database.test.ts`.

**Sem chave estrangeira entre `votes` e `users`/`participations` — de propósito.** É o que garante o sigilo do voto (RN07): nenhuma ligação no banco permite descobrir em quem cada pessoa votou.

### Contas do banco

| Conta | Pode | Não pode |
|---|---|---|
| `ppcm_app` | ler e gravar as tabelas do sistema; usar as sequências | alterar ou apagar votos, participações, auditoria, resultados e demais registros imutáveis (só troca `votes.shuffle_key`) |
| `ppcm_relatorios` | ler `vw_consultas_publicas` e as tabelas de referência (temas, regiões, bairros, órgãos) | ler contas, votos, participações ou auditoria |
| `ppcm_auditoria` | ler a trilha de auditoria, o histórico público, as verificações de integridade, os incidentes e a view | ler contas e votos; alterar qualquer dado |

As contas nascem **sem senha** (não entram até a implantação definir uma); nenhuma senha fica no Git:

```sql
ALTER ROLE ppcm_relatorios PASSWORD 'defina-na-implantacao';
-- conferir: entre como ppcm_relatorios e rode
SELECT * FROM vw_consultas_publicas;   -- funciona
SELECT * FROM users;                   -- ERROR: permission denied for table users
```

Nesta versão a aplicação continua conectando com a conta dona do banco, que aplica as migrations ao iniciar (DT-34, opção A); `ppcm_app` fica pronta para quando a conexão da aplicação for separada da conta de migração.
