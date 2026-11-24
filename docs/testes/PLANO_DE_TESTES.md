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

## Última execução registrada (23/11/2026, ambiente local Windows 11, Node 24)

| Suíte | Resultado |
|---|---|
| Tipos | sem erros |
| Lint | sem erros |
| Unitários + integração + segurança (11 arquivos) | **145 de 145 aprovados** |
| E2E (3 arquivos, Chromium) | **42 de 42 aprovados** (a 1ª execução de 23/11 achou identificadores sem link na tela de Parâmetros; corrigido e reexecutado) |
| `npm audit --omit=dev` | não reexecutado em 23/11 (sem dependências novas); em 15/11: 0 vulnerabilidades |
| Capturas (`npm run screenshots`) | não refeitas em 23/11; em 15/11: 4 de 4 blocos, 57 capturas |

**Integração contínua (GitHub Actions, Ubuntu, Node 22, PostgreSQL 16 real), 12/11/2026:** a 1ª execução falhou no `npm ci` (lock fora de sincronia para o npm 10) e foi corrigida; a 2ª foi **aprovada** — tipos, lint, 114 de 114 testes no PostgreSQL 16, auditoria de dependências e 32 de 32 E2E ([execução](https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal/actions/runs/43258424027)).

**Não executado:** integração contra PostgreSQL servidor **no ambiente local** (sem Docker/PostgreSQL; coberta pelo CI); testes de carga (RNF09/RNF10); leitores de tela NVDA/TalkBack (RNF11); Firefox/Safari/Edge.

## Arquivos de teste

| Arquivo | O que cobre |
|---|---|
| `tests/unit/rules.test.ts` | CPF, senha, apuração, percentuais, tipo real de arquivo, exportações |
| `tests/unit/masks.test.ts` | Pontuação automática de CPF, data, celular e CEP (digitação, colagem e posição do cursor) |
| `tests/unit/requisitos-pdf.test.ts` | PDF do documento (DT-24): sem citações jurídicas, conteúdo técnico mantido, apêndice das RN, RN02 no RF001 levando ao apêndice, RF004 levando ao RF004 e mais de 900 links com destino válido |
| `tests/unit/requisitos.test.ts` | Referências cruzadas (DT-24): catálogo extraído do documento (68 RF, 15 RNF, 42 RN, 13 RS), RF001 → RN02 ("CPF único"), RF004, identificadores inexistentes e formatos parecidos, texto preservado palavra a palavra, cópias iguais em `AGENTS.md` e `REQUISITOS_COMPLETOS.md`, ausência de citações jurídicas e todo identificador citado em `src/` existente no documento |
| `tests/integration/database.test.ts` | Migrations, gatilhos de imutabilidade, auditoria encadeada |
| `tests/integration/auth.test.ts` | Cadastro, confirmação, login, bloqueio, 2º fator, recuperação, sessões |
| `tests/integration/lifecycle.test.ts` | Ciclo da consulta, separação de funções, prazos, rotina automática |
| `tests/integration/voting.test.ts` | Elegibilidade, voto único, concorrência, **sigilo do voto**, comprovante, integridade |
| `tests/integration/participation.test.ts` | Propostas, anexos, moderação, direitos do titular de dados, resultados, dados abertos |
| `tests/integration/administration.test.ts` | Identidade (RF004), perfil (RF012, RF013), usuários e papéis (RF046, RF047), avisos (RF053, RF055), divulgação (RF062), eventos (RF068), parâmetros (RNF12) |
| `tests/integration/performance.test.ts` | Consultas em lote e paginação devolvem o mesmo resultado: monitoramento (RF048), listagem com elegibilidade (RF016, RF017), usuários e auditoria (RF046, RF058), sessão; órgãos da página A Prefeitura (RF050) |
| `tests/security/security.test.ts` | SSRF em links, injeção em buscas, conteúdo executável, redirecionamento aberto |
| `tests/e2e/*.spec.ts` | Portal público, cidadão e administração no navegador, com axe-core e 320 px; referências cruzadas: clique em RN02 no RF001 (rolagem, foco, destaque que some, voltar), endereço `#RF004`, referência a verificar e varredura de 7 telas administrativas sem identificador solto; botão Acessibilidade (contraste e tamanho do texto, também a 320 px); varredura das telas do cidadão sem termos técnicos nem códigos de requisito (DT-26) |

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
| 20 | Dados de outro cidadão | `integration/participation.test.ts` (proposta e cópia dos dados pessoais) | aprovado |

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
- axe-core (WCAG 2.2 A/AA) sem violações sérias/críticas em: início, consultas, detalhe, resultado, como funciona, transparência, comprovante, cadastro, login, documento de requisitos, A Prefeitura, votação e acesso negado administrativo. Corrigidos nesta rodada: contraste do botão de destaque e do contador de avisos.
- Sem rolagem horizontal a 320 px em 8 páginas públicas (E2E, incluindo `/requisitos` e `/prefeitura`) e inspeção manual do início.
- **Pendente:** inspeção manual com NVDA e TalkBack; páginas administrativas não cobertas pelo axe além de uma.

## Requisitos não funcionais sem medição
RNF10 (disponibilidade) e RNF14 (restauração de backup) têm apenas mecanismos preparados; não foram medidos. RNF09 e RNF04 têm só a medição local abaixo, sem teste de carga.

## Desempenho — medição local (15/11/2026)

Medido com Playwright (Chromium) no mesmo computador, com os dados de demonstração (11 consultas, 155 contas, 144 votos), mediana de 3 acessos por página. “Servidor” é o tempo até o primeiro byte; “carregada” é o evento `load` do navegador.

**Modo de execução** (a causa principal da lentidão percebida):

| Página | Desenvolvimento (`npm run dev`) | Otimizada (`npm run preview`) |
|---|---|---|
| Primeiro acesso a cada página | 0,7 s a 30 s (compilação) | sem compilação |
| Início | 300–1.200 ms | 36 ms |
| Consultas | 360–570 ms | 29 ms |
| Detalhe da consulta | 420–480 ms | 29 ms |
| Resultados | 215–815 ms | 15 ms |

**Otimizações no código** (mesma versão otimizada, antes → depois):

| Página | Consultas ao banco | Tamanho do HTML | Servidor | Carregada |
|---|---|---|---|---|
| Administração › Monitoramento | 28 → 7 | 28 KB | 136 → 33 ms | 216 → 71 ms |
| Administração › Usuários | 5 → 6 | 120 → 38 KB | 100 → 26 ms | 336 → 79 ms |
| Administração › Auditoria | 7 → 8 | 101 → 49 KB | 137 → 32 ms | 393 → 92 ms |
| Início (cidadão autenticado) | 13 → 11 | 29 KB | 84 → 34 ms | 163 → 98 ms |
| Consultas (cidadão autenticado) | 12 → 11 | 34 → 33 KB | 62 → 34 ms | 147 → 110 ms |
| Minha conta | 5 → 4 | 24 KB | 40 → 22 ms | 83 → 89 ms |

Nas demais páginas públicas o servidor responde em 12–36 ms e a página carrega em 72–109 ms; a troca de página pelo menu leva 82–103 ms. O login leva cerca de 0,4 s por causa do Argon2id, mantido de propósito.

**Primeiro acesso, com o cache vazio (RNF04, meta sugerida de 1 MB):** cerca de 172 KB transferidos em 19–20 requisições nas páginas inicial, de consulta e de cadastro (JavaScript 109–114 KB, fontes 26 KB, HTML 18–23 KB, CSS 9 KB), sem vídeo. Medido em rede local; em internet fraca o tempo será maior, mas o volume é o mesmo.

**Limites desta medição:** uma máquina, um usuário, poucos dados e banco embutido (PGlite). As duas rodadas não foram feitas em condições idênticas de carga da máquina, então parte da diferença de tempo nas páginas que não mudaram é ruído; os números confiáveis são a quantidade de consultas e o tamanho das páginas. Não é teste de carga (RNF09) nem medição de disponibilidade (RNF10).
