# Banco de dados — PPCM

PostgreSQL 16 em produção e no CI; PGlite (PostgreSQL em WebAssembly) no desenvolvimento local, sem instalação.

| Pasta / arquivo | Conteúdo |
|---|---|
| `migrations/0000_inicial.sql` | Tabelas, índices e restrições (gerado pelo Drizzle a partir de `src/server/db/schema.ts`) |
| `migrations/0001_gatilhos_somente_acrescimo.sql` | Gatilhos que tornam imutáveis votos, participações, auditoria e resultados. **Não remover.** |
| `migrations/meta/` | Controle de versões das migrations (Drizzle) |
| `diagrams/modelo-er.md` | Diagrama entidade-relacionamento |

**Dados iniciais (seeds).** Ficam junto do código porque o servidor os aplica ao iniciar: `src/server/db/seed-reference.ts` (regiões, bairros, temas, órgãos e papéis) e `src/server/db/seed-demo.ts` (município, pessoas e consultas **fictícios**, só em modo demonstração).

**Comandos:** `npm run db:migrate` · `npm run db:seed` · `npm run db:reset` (recria o banco local) · `npm run db:generate` (nova migration após alterar o schema).

Descrição das tabelas e das garantias de sigilo do voto: `docs/arquitetura/MODELO_DE_DADOS.md`.
