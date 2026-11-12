# Plano de testes — PPCM

## Comandos

| Comando | O que executa |
|---|---|
| `npm run typecheck` | Verificação de tipos (TypeScript estrito) |
| `npm run lint` | ESLint (inclui regra de separação de camadas) |
| `npm run test` | Vitest: unitários + integração em PostgreSQL (PGlite em memória; no CI, PostgreSQL 16 real via `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright: build de produção + banco limpo + axe-core |
| `npm run screenshots` | Capturas reais das telas em `screenshots/` |
| `npm run check` | typecheck + lint + test |
| `npm audit --omit=dev` | Dependências vulneráveis |

## Última execução registrada (12/11/2026, ambiente local Windows 11, Node 24)

| Suíte | Resultado |
|---|---|
| Tipos | sem erros |
| Lint | sem erros |
| Unitários + integração + segurança (8 arquivos) | **114 de 114 aprovados** |
| E2E (3 arquivos, Chromium) | **32 de 32 aprovados** em execução única |
| `npm audit --omit=dev` | 0 vulnerabilidades (após atualizar nodemailer e forçar postcss ≥ 8.5.32) |
| Capturas (`npm run screenshots`) | 4 de 4 blocos concluídos; 57 capturas |

**Não executado localmente:** integração contra PostgreSQL servidor (o ambiente não tem Docker/PostgreSQL — fica a cargo do workflow de CI no GitHub Actions; o resultado da primeira execução deve ser conferido no repositório); testes de carga (RNF09/RNF10); leitores de tela NVDA/TalkBack (RNF11); Firefox/Safari/Edge.

## Arquivos de teste

| Arquivo | O que cobre |
|---|---|
| `tests/unit/rules.test.ts` | CPF, senha, apuração, percentuais, tipo real de arquivo, exportações |
| `tests/integration/database.test.ts` | Migrations, gatilhos de imutabilidade, auditoria encadeada |
| `tests/integration/auth.test.ts` | Cadastro, confirmação, login, bloqueio, 2º fator, recuperação, sessões |
| `tests/integration/lifecycle.test.ts` | Ciclo da consulta, separação de funções, prazos, rotina automática |
| `tests/integration/voting.test.ts` | Elegibilidade, voto único, concorrência, **sigilo do voto**, comprovante, integridade |
| `tests/integration/participation.test.ts` | Propostas, anexos, moderação, LGPD, resultados, dados abertos |
| `tests/integration/administration.test.ts` | Identidade (RF004), perfil (RF012, RF013), usuários e papéis (RF046, RF047), avisos (RF053, RF055), divulgação (RF062), eventos (RF068), parâmetros (RNF12) |
| `tests/security/security.test.ts` | SSRF em links, injeção em buscas, conteúdo executável, redirecionamento aberto |
| `tests/e2e/*.spec.ts` | Portal público, cidadão e administração no navegador, com axe-core e 320 px |

## Cenários obrigatórios do pedido

| # | Cenário | Teste | Situação |
|---|---|---|---|
| 1 | Cadastro com CPF inválido | `integration/auth.test.ts`, `e2e/citizen.spec.ts`, `unit/rules.test.ts` | aprovado |
| 2 | CPF já utilizado | `integration/auth.test.ts` (mensagem genérica; também após desativação) | aprovado |
| 3 | Confirmação de e-mail | `integration/auth.test.ts` (uso único, expiração 24 h) | aprovado |
| 4 | Login com dados incorretos | `integration/auth.test.ts`, `e2e/citizen.spec.ts` | aprovado |
| 5 | Bloqueio após tentativas excessivas | `integration/auth.test.ts` (5 falhas → 15 min; CAPTCHA por IP) | aprovado |
| 6 | Recuperação de senha | `integration/auth.test.ts` (30 min, uso único, sessões encerradas) | aprovado |
| 7 | Acesso administrativo sem permissão | `integration/auth.test.ts`, `e2e/admin.spec.ts`, `e2e/public.spec.ts` | aprovado |
| 8 | Aprovar consulta elaborada pelo próprio | `integration/lifecycle.test.ts` (inclusive com designação forçada no banco) | aprovado |
| 9 | Voto em consulta encerrada | `integration/voting.test.ts` (horário do servidor) | aprovado |
| 10 | Voto duplicado | `integration/voting.test.ts`, `e2e/citizen.spec.ts` | aprovado |
| 11 | Duas requisições simultâneas | `integration/voting.test.ts` (5 envios paralelos → 1 voto) | aprovado (PGlite); PostgreSQL real no CI |
| 12 | Falha durante a gravação | `integration/voting.test.ts` (falha injetada → nada gravado → nova tentativa) | aprovado |
| 13 | Sigilo da alternativa | `integration/voting.test.ts` › Sigilo (esquema, painel, relatório, auditoria, avisos, e-mails, histórico, exportação) | aprovado |
| 14 | Verificação de comprovante | `integration/voting.test.ts`, `e2e/citizen.spec.ts` | aprovado |
| 15 | Apuração | `unit/rules.test.ts`, `integration/voting.test.ts` | aprovado |
| 16 | Alteração indevida de votos | `integration/voting.test.ts` (gatilhos recusam UPDATE/DELETE) | aprovado |
| 17 | Exportação sem dados pessoais | `integration/voting.test.ts`, `integration/participation.test.ts`, `e2e/public.spec.ts` | aprovado |
| 18 | Cadeia de auditoria | `integration/database.test.ts`, `e2e/admin.spec.ts` | aprovado |
| 19 | Upload inválido | `integration/participation.test.ts` (extensão falsa, EICAR, tamanho, sem texto alternativo) | aprovado |
| 20 | Dados de outro cidadão | `integration/participation.test.ts` (proposta e cópia LGPD) | aprovado |

## Segurança (referência OWASP Top 10) — o que foi efetivamente verificado

| Categoria | Controle | Evidência |
|---|---|---|
| A01 Controle de acesso | Guardas em páginas/ações/rotas; papéis por consulta; dados só do titular | testes 7, 8, 20; E2E de redirecionamento e 403 |
| A02 Falhas criptográficas | Argon2id; HMAC do CPF; AES-GCM; tokens só como hash | `auth.test.ts` (hash `$argon2id$`, CPF ausente do registro); `rules.test.ts` (adulteração detectada) |
| A03 Injeção | Consultas parametrizadas (Drizzle); texto sem HTML; CSV sem fórmulas; CSP com nonce | `rules.test.ts`; E2E de cabeçalhos |
| A04 Projeto inseguro | Sigilo estrutural do voto; segregação de funções; registros imutáveis | testes 12, 13, 16 |
| A05 Configuração | Cabeçalhos de segurança; sem `X-Powered-By`; segredos por ambiente | `e2e/public.spec.ts` |
| A06 Componentes vulneráveis | `npm audit` | 0 vulnerabilidades em produção |
| A07 Autenticação | Bloqueio, CAPTCHA, 2º fator, expiração de sessão, mensagens genéricas | testes 4–6; `auth.test.ts` |
| A08 Integridade | Hash da base apurada, auditoria encadeada, verificação de arquivos | testes 15, 18, 19 |
| A09 Registro e monitoramento | Auditoria de negados/falhas sem dados sensíveis; incidentes automáticos | `database.test.ts`, `voting.test.ts` |
| A10 SSRF | Só a verificação de links externos faz requisições de saída: `HEAD`, tempo limite, sem seguir redirecionamentos e só para `https` com domínio público (DT-19) | `security/security.test.ts`; limite: sem resolução de DNS prévia |

**Limites desta verificação:** não houve teste de intrusão independente, varredura dinâmica (DAST) nem teste de carga. A proteção CSRF apoia-se na verificação de origem das Server Actions do Next.js e em `SameSite=Lax` (não há teste automatizado específico). Portanto, o sistema **não deve ser declarado “seguro” para produção** sem essas etapas e sem o RIPD (RNF06).

## Acessibilidade e responsividade
- axe-core (WCAG 2.2 A/AA) sem violações sérias/críticas em: início, consultas, detalhe, resultado, como funciona, transparência, comprovante, cadastro, login, votação e acesso negado administrativo. Corrigidos nesta rodada: contraste do botão de destaque e do contador de avisos.
- Sem rolagem horizontal a 320 px em 6 páginas públicas (E2E) e inspeção manual do início.
- **Pendente:** inspeção manual com NVDA e TalkBack; páginas administrativas não cobertas pelo axe além de uma.

## Requisitos não funcionais sem medição
RNF04 (1 MB no primeiro acesso), RNF09 (tempos de resposta), RNF10 (disponibilidade) e RNF14 (restauração de backup) têm apenas mecanismos preparados; não foram medidos.
