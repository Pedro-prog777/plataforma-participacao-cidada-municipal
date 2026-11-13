# Decisões técnicas — PPCM

Registro das escolhas de arquitetura e das interpretações do Documento de Requisitos v6. Cada decisão tem identificador (DT-nn) para ser citada no código e em outros documentos.

## DT-01 — Next.js 15 (App Router) com TypeScript, em monólito modular
- **Decisão:** um único projeto Next.js 15.5 com Server Components, Server Actions e Route Handlers; regras de negócio em `src/server/modules/*`, separadas da interface (`src/app`, `src/components`).
- **Motivo:** frontend e backend integrados com tipagem ponta a ponta, menos infraestrutura para um trabalho acadêmico e renderização no servidor (boa para internet fraca — RNF04 — e para acessibilidade).
- **Versão:** 15.5.29 (linha de manutenção com correções de segurança). A linha 16.x foi evitada por estabilidade e familiaridade da equipe.
- **Separação de camadas:** páginas/ações → *guards* de sessão (`src/server/auth/current.ts`) → serviços de domínio (validação Zod + autorização + transação + auditoria) → Drizzle ORM. Componentes de interface não podem importar o banco (regra de lint).

## DT-02 — PostgreSQL com Drizzle ORM e migrations versionadas
- Schema tipado em `src/server/db/schema.ts`; migrations SQL em `database/migrations/` geradas pelo `drizzle-kit` e versionadas no Git.
- A migration `0001_gatilhos_somente_acrescimo.sql` cria gatilhos que **recusam UPDATE/DELETE/TRUNCATE** em votos, participações, auditoria, resultados, históricos, versões e decisões de moderação (RN28, RN29, RN39).

## DT-03 — PGlite para desenvolvimento, PostgreSQL servidor para produção e CI
- **Problema:** o ambiente de desenvolvimento não tinha Docker nem PostgreSQL instalados.
- **Decisão:** com `DATABASE_URL` definido o sistema usa PostgreSQL via `node-postgres`; sem ele, usa **PGlite** (o próprio PostgreSQL compilado para WebAssembly), gravando em `.data/pglite`. É o mesmo motor SQL (mesmas constraints, gatilhos, `FOR UPDATE`, `CLUSTER`).
- **Testes:** integração em PGlite em memória (um banco limpo por arquivo). O workflow de CI roda a mesma suíte contra **PostgreSQL 16 real** (`TEST_DATABASE_URL`).
- **Limite conhecido:** o PGlite atende uma conexão por vez — concorrência real (vários processos) só é exercitada no CI/produção com PostgreSQL. A garantia de voto único, porém, está na restrição de unicidade do banco, que vale nos dois casos.
- **Cuidado:** encerrar o servidor à força pode corromper `.data/pglite`; o sistema fecha o banco nos sinais SIGINT/SIGTERM. Se corromper, `npm run db:reset`.

## DT-04 — Sigilo do voto por separação estrutural
- `participations` (cidadão, consulta, **data sem hora**, hash e cifra do comprovante) e `votes` (consulta, alternativa ou abstenção) **não têm nenhuma coluna, chave ou sequência em comum**. `votes.id` é UUID aleatório e não há `created_at`.
- Participação e voto são gravados na **mesma transação** (atomicidade), mas nada é registrado que permita ligá-los depois. O código de confirmação (RF011) também não guarda a alternativa; a escolha só chega ao servidor no envio final.
- Votos aceitos **não** são auditados (só as recusas, sem a alternativa) para não criar marca temporal ligada ao cidadão.
- Testes provam que painel, relatórios, auditoria, avisos, e-mails, exportações e o próprio histórico do titular não revelam a escolha.

## DT-05 — Mitigação da ordem física de gravação (risco residual)
- **Risco:** quem tem acesso ao armazenamento do PostgreSQL poderia tentar correlacionar a ordem física de inserção das linhas de `participations` e `votes`.
- **Mitigação implementada:** `votes.shuffle_key` aleatório com índice e `CLUSTER votes USING votes_shuffle_idx` executado no encerramento e periodicamente (a cada 15 min com consultas abertas), reordenando fisicamente a tabela.
- **Residual documentado:** logs de WAL/backup gerados antes da reordenação ainda guardam a ordem. Em produção recomenda-se restringir acesso a WAL/backups e cifrar backups. Ver `docs/seguranca/MATRIZ_DE_RISCOS.md`.

## DT-06 — CPF: HMAC com chave fora do banco + forma mascarada
- O CPF **não é gravado em claro**: guarda-se `HMAC-SHA256(CPF)` com `CPF_HMAC_KEY` (variável de ambiente) para unicidade e verificação, e a forma mascarada (`***.456.789-**`) para exibição ao titular.
- Um hash simples seria vulnerável a enumeração (há só 10⁹ CPFs possíveis); o HMAC exige a chave secreta.
- O HMAC é mantido após a desativação da conta (RN33). Consequência: a cópia de dados (RF015) mostra o CPF mascarado.

## DT-07 — Senhas com Argon2id; segundo fator TOTP
- `@node-rs/argon2` (Argon2id, m = 19 MiB, t = 2, p = 1 — parâmetros OWASP). Verificação com tempo equalizado quando a conta não existe.
- Contas administrativas usam TOTP (RFC 6238) cadastrado no convite; o segredo é cifrado com AES-256-GCM (`DATA_ENCRYPTION_KEY`).

## DT-08 — Sessões no servidor
- Cookie `ppcm_sessao` (HttpOnly, SameSite=Lax, Secure em HTTPS) com token aleatório; o banco guarda só o SHA-256. Expiração por inatividade (parâmetro, padrão 30 min cidadão / 15 min administração — **RN26 sem valor no documento**) e absoluta de 12 h. Troca/recuperação de senha encerra as demais sessões.
- **CSRF:** Server Actions do Next.js verificam a origem da requisição; somado ao SameSite=Lax. Rotas GET não alteram estado.

## DT-09 — gov.br: adaptador simulado, sem integração inventada
- A integração real exige credenciamento no Login Único. Sem credenciais, o sistema usa `SimulatedIdentityProvider`, **claramente identificado como demonstração**, sem marca nem endereço do gov.br, que permite simular CPF, nível (bronze/prata/ouro) e município de residência.
- `OfficialGovBrProvider` existe como ponto de extensão e falha explicitamente se usado sem implementação/credenciais.
- O provedor simulado só existe com `DEMO_MODE=true`.

## DT-10 — E-mail por fila (outbox)
- Toda mensagem vai para `email_outbox` dentro da transação do ato; a rotina envia com até 3 tentativas (RF053). Com `SMTP_URL` o envio é real (nodemailer); sem ele, as mensagens ficam visíveis em `/demo/caixa-de-email` (só no modo demonstração). SMS (RF011) é simulado — o documento não lista provedor de SMS.

## DT-11 — Upload seguro
- Tipo real por assinatura (magic bytes), não pela extensão; limites de tamanho; SHA-256; nome aleatório fora da pasta pública; download por rota com controle de acesso e CSP `sandbox`.
- Antivírus: ClamAV (`CLAMAV_HOST`) quando configurado; sem ele, verificação embutida (assinatura EICAR e executáveis PE/ELF) — **suficiente apenas para demonstração**.

## DT-12 — CAPTCHA próprio
- Desafio aritmético assinado com HMAC e validade de 10 min, exigido após muitas falhas por IP (RF010) e muitas verificações de comprovante (RF041). Em produção recomenda-se serviço com alternativa acessível.

## DT-13 — Limites de taxa em memória
- Reenvios, recuperação de senha, verificação de comprovante e tentativas de voto usam janela deslizante em memória (um processo). Falhas de login são contadas no banco. Com várias instâncias, trocar por armazenamento compartilhado (ex.: Redis).

## DT-14 — Parâmetros e recursos condicionados no banco
- Tabela `settings` com valores padrão no código (`src/server/lib/settings.ts`), editáveis em `/admin/configuracoes` com auditoria (RNF12). Itens (*) aparecem marcados como **pendentes**.
- Comentários (RF064), apoios (RF067) e eventos (RF068) começam **desligados**. Apoios exigem meta e prazo antes de ligar — os valores do portal federal (20 mil / 4 meses) não são usados como padrão.

## DT-15 — Interpretações do documento
| Ponto | Interpretação adotada |
|---|---|
| “Ciclo de vida (seção 6.1)” e “papéis (seção 4)” citados no texto não existem na v6 | Estados derivados dos RFs: rascunho → aguardando revisão → em análise → aprovada → agendada → aberta ⇄ suspensa → encerrada → apurada → resultado publicado; rejeitada e cancelada. |
| RF028 descreve envio, revisão e só então “Em análise” | Criado o estado intermediário **Aguardando revisão** (`em_revisao`). |
| RF025 exige responsáveis definidos (RF061), mas RF061 exige consulta em Rascunho | Quem cria vira elaborador; os demais papéis são exigidos **antes do envio para revisão**. |
| As regras RN01–RN42 são citadas mas não definidas na v6 | Implementadas pelo texto dos RFs que as citam; valores ausentes viraram parâmetros pendentes (RN15 antecedência, RN26 inatividade). |
| Papel responsável pela análise documental (RF004) não listado | Atribuído ao papel **Atendimento** (permissão `identidade.analisar`). |
| RF004 “confere o domicílio” pelo provedor | O provedor simulado pode informar o município; documentalmente, o comprovante de residência confirma o domicílio. |
| Quórum de referência | Comparado ao total de participações; percentual sobre os elegíveis estimados no retrato da abertura. |
| Empate | Sem regra de desempate publicada → sem alternativa vencedora (RF042). |
| Critério de público “outro” | Apenas informativo (não verificável automaticamente). |
| RF014 marcado (*) | Mantido ativo: o histórico é necessário para o titular rever o comprovante. |

## DT-16 — Interface
- Tailwind CSS 4 com tokens próprios (azul institucional, laranja de destaque), fonte Public Sans, componentes acessíveis próprios. Marca gráfica genérica — não reproduz brasões ou o padrão visual do gov.br.
- Barra de acessibilidade com atalhos (eMAG) e alto contraste; gráficos sempre acompanhados de tabela; formulários com erros por campo associados por `aria-describedby`.
- CSP com nonce por requisição (middleware), `frame-ancestors 'none'`, HSTS em produção.
- Formulários: a pontuação de CPF, data, celular e CEP entra sozinha (`src/lib/masks.ts`); a máscara só formata, a validação continua no servidor (RF002). A dica de cada campo fica abaixo dele, para que campos lado a lado permaneçam alinhados. No cadastro, o campo do município só aparece para quem escolhe “Moro fora”.
- Topo no celular: os atalhos de teclado da barra de acessibilidade ficam ocultos até receberem foco (visíveis a partir de 1024 px) e o aviso de demonstração usa texto curto, para o conteúdo começar mais acima.

## DT-17 — Testes
- Vitest (unitários + integração no banco real em memória) e Playwright (E2E em build de produção, com axe-core para WCAG 2.2 A/AA e verificação de 320 px). Detalhes em `docs/testes/PLANO_DE_TESTES.md`.

## DT-18 — Estrutura de pastas adaptada ao Next.js
- O modelo de entrega pedia `frontend/`, `backend/` e `database/` separados. A PPCM é um monólito Next.js (App Router): páginas, Server Actions e serviços são compilados juntos e o framework exige `src/app`. Separar em dois projetos obrigaria a reescrever a comunicação entre telas e regras, sem ganho para o requisito. A separação pedida foi mantida **por camadas dentro de `src/`**:

| Pasta do modelo | Onde está | Observação |
|---|---|---|
| `frontend/` | `src/app` (rotas e páginas), `src/components`, `src/lib` | Interface |
| `backend/` | `src/server` (`actions`, `auth`, `modules`, `lib`, `db`) | Regras de negócio só em `src/server/modules` |
| `database/migrations` | `database/migrations` | Antes em `drizzle/` |
| `database/seeds` | `database/seeds` | Importados pelo servidor com o alias `@database/*` (o servidor aplica os dados iniciais ao subir) |
| `database/diagrams` | `database/diagrams` | Diagrama ER |
| `tests/security` | `tests/security` | Entradas maliciosas e SSRF; sigilo do voto segue em `tests/integration/voting.test.ts` |
| `screenshots/prototipos` | — | Não houve protótipo separado (Figma); as capturas são das telas reais implementadas |

- Uma regra de lint impede que componentes importem serviços diretamente, preservando a fronteira entre interface e servidor.

## DT-19 — Links externos, cadastro e redirecionamento
- **Links (RF023):** só são aceitos endereços `https` com nome de domínio público; IP literal, `localhost`, sufixos internos e credenciais na URL são recusados. A rotina diária confere cada link com `HEAD`, tempo limite de 5 s e **sem seguir redirecionamentos**, para que o servidor não seja usado para alcançar a rede interna (SSRF). Link fora do ar avisa o responsável uma única vez e a página pública destaca a alternativa textual. Limite conhecido: não há resolução de DNS antes da requisição; um domínio público que aponte para endereço interno não é detectado.
- **Cadastro (RS004):** no máximo 10 cadastros por hora por rede, contados em memória (DT-13).
- **Redirecionamento pós-login:** o destino só é aceito se for caminho interno (`safeInternalPath`), o que evita redirecionamento aberto.

## DT-20 — Quadro Trello montado por script
- O acompanhamento no Trello não faz parte dos requisitos do sistema; é ferramenta de gestão do projeto. A organização do quadro fica versionada em `docs/trello/quadro.json` e é aplicada por `scripts/trello-sync.mjs` (`npm run trello:sync`), que cria listas, etiquetas, cartões, checklists, links para o GitHub e anexa as capturas de `screenshots/`.
- O script só acrescenta (não apaga nem altera o que existe) e pode ser repetido. As credenciais vêm de variáveis de ambiente ou de `.env.trello`, ignorado pelo Git; a chave e o token nunca aparecem em mensagens de erro.
