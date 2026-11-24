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
- Tailwind CSS 4 com tokens próprios (azul institucional, laranja de destaque), fonte Public Sans, componentes acessíveis próprios. A marca é um desenho próprio (DT-21) e não reproduz o padrão visual do gov.br.
- Atalhos de teclado (eMAG), espaçamento ampliado para leitura e tamanho do texto (DT-22); gráficos sempre acompanhados de tabela; formulários com erros por campo associados por `aria-describedby`.
- CSP com nonce por requisição (middleware), `frame-ancestors 'none'`, HSTS em produção.
- Formulários: a pontuação de CPF, data, celular e CEP entra sozinha (`src/lib/masks.ts`); a máscara só formata, a validação continua no servidor (RF002). A dica de cada campo fica abaixo dele, para que campos lado a lado permaneçam alinhados. No cadastro, o campo do município só aparece para quem escolhe “Moro fora”.
- Topo no celular: o aviso de demonstração usa texto curto, para o conteúdo começar mais acima.

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
| `screenshots/prototipos` | — | As capturas são das telas reais implementadas; o protótipo conceitual fica no Figma (link em DT-24 e no README) |

- Uma regra de lint impede que componentes importem serviços diretamente, preservando a fronteira entre interface e servidor.

## DT-19 — Links externos, cadastro e redirecionamento
- **Links (RF023):** só são aceitos endereços `https` com nome de domínio público; IP literal, `localhost`, sufixos internos e credenciais na URL são recusados. A rotina diária confere cada link com `HEAD`, tempo limite de 5 s e **sem seguir redirecionamentos**, para que o servidor não seja usado para alcançar a rede interna (SSRF). Link fora do ar avisa o responsável uma única vez e a página pública destaca a alternativa textual. Limite conhecido: não há resolução de DNS antes da requisição; um domínio público que aponte para endereço interno não é detectado.
- **Cadastro (RS004):** no máximo 10 cadastros por hora por rede, contados em memória (DT-13).
- **Redirecionamento pós-login:** o destino só é aceito se for caminho interno (`safeInternalPath`), o que evita redirecionamento aberto.

## DT-20 — Quadro Trello montado por script
- O acompanhamento no Trello não faz parte dos requisitos do sistema; é ferramenta de gestão do projeto. A organização do quadro fica versionada em `docs/trello/quadro.json` e é aplicada por `scripts/trello-sync.mjs` (`npm run trello:sync`), que cria listas, etiquetas, cartões, checklists, links para o GitHub e anexa as capturas de `screenshots/`.
- O script só acrescenta (não apaga nem altera o que existe) e pode ser repetido. As credenciais vêm de variáveis de ambiente ou de `.env.trello`, ignorado pelo Git; a chave e o token nunca aparecem em mensagens de erro.

## DT-21 — Município de referência: Maceió/AL
- A pedido da equipe (13/11/2026), a demonstração deixou de usar um município fictício e passou a ser ambientada em **Maceió/AL**: nome do município (`MUNICIPIO_NOME`, `MUNICIPIO_UF`) e os 50 bairros agrupados nas 8 regiões administrativas (`database/seeds/seed-reference.ts`). Trocar de município continua sendo só configuração e dados de referência.
- **Continua fictício:** consultas, propostas, pessoas, órgãos, endereços e números. As consultas de exemplo citam bairros reais apenas como cenário.
- **Não é serviço oficial.** O aviso aparece na faixa de demonstração, no rodapé (sempre, mesmo fora do modo demonstração) e no README. O sistema não deve ser publicado na internet com o nome da Prefeitura sem autorização dela.
- **Marca:** escudo desenhado para o projeto, inspirado nos elementos do brasão da cidade (coroa mural, jangada, ondas, faixas verde, branca e azul). **Não é o brasão oficial**, cujo uso depende de autorização da Prefeitura (pendência registrada em `docs/requisitos/PENDENCIAS_CLIENTE.md`).
- **Topo:** faixa institucional com o nome da Prefeitura, serviços de uso rápido e faixa nas cores do município (layout atual em DT-22).
- **Alto contraste (eMAG 6.1):** regra única — fundo preto, texto branco, links e botões em amarelo, bordas brancas — aplicada a qualquer componente. A versão anterior trocava as cores da marca por amarelo e deixava textos ilegíveis (branco sobre amarelo). Elementos cujo significado é só a cor usam a classe `.ac-preenchido`. *(Alto contraste retirado em 24/11/2026 a pedido da equipe; ver DT-22.)*
- A lista de bairros e regiões deve ser conferida com a Prefeitura antes de qualquer uso real.

## DT-22 — Controles de acessibilidade fora da faixa do topo
- A pedido da equipe (14/11/2026), a faixa do topo deixou de mostrar o link “Acessibilidade” e a chave “Alto contraste”. Ela traz o nome da Prefeitura e dois serviços para o cidadão: “Verificar comprovante” e “Dados abertos”.
- **Nenhum recurso foi excluído** (RNF01 continua valendo — WCAG 2.2 AA e eMAG 3.1):
  - os atalhos “Ir para o conteúdo / menu / rodapé” (WCAG 2.4.1) continuam na página, invisíveis até receberem foco pelo teclado, com as teclas de acesso 1, 2 e 4;
  - o alto contraste é ligado na página **Acessibilidade** (link no rodapé) ou pela tecla de acesso 5; a preferência fica guardada no navegador e vale para todas as páginas, inclusive a administração;
  - a página Acessibilidade descreve os atalhos e os recursos.
- Consequência conhecida: o eMAG recomenda que esses controles fiquem visíveis no topo. Deixá-los no rodapé é um afastamento dessa recomendação, a ser reavaliado com o cliente (registrado em `docs/requisitos/PENDENCIAS_CLIENTE.md`).
- **Atualização (24/11/2026, pedido da equipe):** um botão “Acessibilidade” chegou a ser colocado na faixa superior e foi retirado no mesmo dia, porque não combinou com o topo; a faixa traz “Verificar comprovante” e “A Prefeitura” (DT-25).
- **Alto contraste retirado (24/11/2026, pedido da equipe)** e substituído pelo **espaçamento ampliado para leitura** (WCAG 2.2, critério 1.4.12): mais espaço entre linhas, palavras (0,16 em) e letras (0,12 em), útil para quem tem dislexia ou baixa visão. Fica na página Acessibilidade, ao lado do **tamanho do texto** (100%, 115% e 130%); as duas escolhas ficam guardadas no navegador e valem para todas as páginas, inclusive a administração. A tecla de acesso 5 passou a ligar e desligar o espaçamento. O contraste mínimo AA das cores do site continua (RNF01). O E2E confere as páginas a 320 px com espaçamento e texto ampliados, sem rolagem horizontal.

## DT-23 — Desempenho: diagnóstico e otimizações (15/11/2026)
- **Causa principal da lentidão percebida:** o sistema estava sendo usado em modo de desenvolvimento (`npm run dev`), em que cada página é compilada no primeiro acesso (de 0,7 s a 30 s medidos) e mesmo depois responde em 200–500 ms. A versão otimizada (`next build` + `next start`) responde em 12–36 ms. Foi criado o comando `npm run preview`, indicado para testar e apresentar. O Turbopack foi testado e descartado: neste ambiente (pasta no OneDrive) ficou mais lento (1,4–1,8 s por página já compilada).
- **Consultas ao banco:**
  - painel de monitoramento: de 4 consultas por consulta pública para 3 consultas agrupadas no total (28 → 7 por acesso);
  - listagem para o cidadão autenticado: critérios de público-alvo de todas as consultas abertas em uma única consulta (antes, duas por consulta);
  - página inicial: tudo em paralelo e só os 3 resultados e 3 encaminhamentos exibidos;
  - sessão: os dados do cidadão vêm junto com a validação da sessão (uma consulta a menos em toda página autenticada).
- **Paginação:** usuários (25 por página) e auditoria (50 por página); antes eram 200 e 300 linhas de uma vez (HTML de 120 KB e 101 KB → 38 KB e 49 KB). A exportação CSV da auditoria continua trazendo tudo.
- **Índices** (`database/migrations/0002_indices_de_desempenho.sql`): participações por cidadão, avisos não lidos, auditoria por objeto, propostas por autor, critérios, incidentes e encaminhamentos por consulta, fila de e-mails. Nenhum índice novo em `votes`.
- **Interface:** barra de carregamento no topo quando a troca de página demora mais de 150 ms.
- **Diagnóstico:** `DB_LOG_QUERIES=1` escreve no log do servidor cada consulta SQL, sem os parâmetros (podem conter dados pessoais).
- **Não alterado de propósito:** o custo do Argon2id no login (~0,3 s) é proteção contra força bruta (RN23); não há cache de páginas, porque todas dependem da sessão e de dados que mudam (votação, avisos).
- Medições antes e depois em `docs/testes/PLANO_DE_TESTES.md`. São medições locais com poucos dados; **não substituem o teste de carga do RNF09**.

## DT-24 — Referências cruzadas entre requisitos e remoção das citações jurídicas (23/11/2026)
- **O que é:** todo identificador RF, RNF, RN ou RS citado no Documento de Requisitos ou na interface vira link para o ponto em que o requisito é descrito. Ao chegar, a página rola até o requisito, move o foco para ele e o destaca por 3 segundos (contados depois que a rolagem termina). Os botões voltar/avançar do navegador refazem o caminho.
- **Sem cadastro manual:** o catálogo é montado a partir de `docs/requisitos/REQUISITOS_COMPLETOS.md`, embutido no build (`import …md?raw`, regra em `next.config.ts`). RF = título `### RFxxx – Nome` da seção 3; RNF e RS = linhas das tabelas das seções 4 e 5; RN = nome usado nas linhas "Regras:" (ex.: "CPF único (RN02)"). Código: `src/lib/requisitos/` (reconhecimento, leitura do Markdown e catálogo), `src/server/lib/documento-requisitos.ts` (carga), `src/components/requisitos/` (link, texto com referências, página e navegação) e a página pública `/requisitos`.
- **Regras de negócio:** o documento cita RN01–RN42 mas não as descreve (DT-15). O destino do link de uma RN é um índice gerado das próprias citações: o nome escrito no documento e os requisitos que a citam. Nenhuma descrição foi inventada.
- **Identificador inexistente:** não vira link; aparece com sublinhado ondulado, fundo de alerta e "?" (texto para leitores de tela: "referência a verificar"). Formatos parecidos com os oficiais (RF01, RN001) também são sinalizados. Hoje o documento e a interface não têm nenhuma referência inexistente — o teste `tests/unit/requisitos.test.ts` confere isso a cada `npm run check`.
- **Na interface:** títulos, descrições, alertas, rótulos, dicas, mensagens de erro, tabelas e linhas do tempo dos componentes base (`primitives.tsx`, `form.tsx`) reconhecem os identificadores; textos escritos direto nas páginas usam `<RefText>`. Fora da página do documento o link abre em nova aba, para não perder um formulário em preenchimento. Texto que já é link (ex.: pendências do envio para revisão) não recebe outro link. O E2E percorre telas administrativas e falha se sobrar identificador sem link.
- **Citações jurídicas removidas** (pedido da equipe): saíram do documento transcrito (`REQUISITOS_COMPLETOS.md` e a cópia no `AGENTS.md`) e dos textos visíveis da interface as menções a leis, artigos, bases legais e normas (LGPD, LAI, LBI, Constituição, Lei nº 13.460/2017, Lei nº 15.211/2025 e as demais), retirando só a menção e mantendo a informação técnica — ex.: "Base legal: LGPD." sai do RNF06; "RF015 – Exercer direitos do titular de dados (LGPD)" passa a "RF015 – Exercer direitos do titular de dados"; "(LGPD, art. 14)" sai do RS010; nas Referências ficaram as obras técnicas e acadêmicas (ABNT, eMAG, ISO/IEC/IEEE, WCAG, livros), renumeradas. Numeração e texto dos requisitos foram preservados (o teste compara palavra a palavra o arquivo com o que a página exibe). Comentários de código e nomes de testes não foram alterados.
- **PDF do documento (24/11/2026, pedido da equipe):** as mudanças também foram aplicadas no próprio `docs/requisitos/Documento_de_Requisitos_v6.pdf`, preservando o layout do LibreOffice. O script `npm run requisitos:pdf` (`scripts/pdf-requisitos/`, com `pdf-lib`) parte do original guardado em `docs/requisitos/original/Documento_de_Requisitos_v6_original.pdf` e: (1) retira do conteúdo das páginas as mesmas citações jurídicas — o texto sai do arquivo, não é só coberto; cada trecho tem contagem esperada e o script falha se não o encontrar; (2) renumera as referências restantes (1 a 9) e sobe as linhas para não deixar espaço vazio; (3) acrescenta um apêndice ("Índice das regras de negócio citadas", também nos marcadores do PDF) gerado das citações, porque o documento cita as RN sem descrevê-las; (4) cria links internos em todo RF, RNF, RN e RS citado (988 links), com fundo azul-claro e sublinhado, apontando para o título do RF, a célula do RNF/RS ou a regra no apêndice; identificador sem destino ficaria com sublinhado tracejado laranja e sem link (hoje não há nenhum). Rodapés passam a "Página N de 43". Limite do formato: um PDF não tem destaque temporário — o leitor de PDF só posiciona o requisito no topo da tela. Teste: `tests/unit/requisitos-pdf.test.ts`.
- **Protótipo no Figma:** <https://www.figma.com/design/wskUxNo797ipkbNxqqI3BY/Plataforma-de-Participa%C3%A7%C3%A3o-Cidad%C3%A3-Municipal-%E2%80%94-Prot%C3%B3tipo?node-id=35-51> — seção "Referências cruzadas entre requisitos" na página "Tela inicial", com cinco telas (RF001 → RN02, RF004, painel administrativo → RN16), componentes "Referência a requisito" (Link, Hover, A verificar), "Identificador do requisito" e "Destaque do requisito" (Ativo → Encerrado após 3 s) e interações de protótipo. O protótipo representa o comportamento; o reconhecimento real é o do código.

## DT-25 — Atalho "A Prefeitura" no lugar de "Dados abertos" no topo (24/11/2026)
- **Pedido da equipe:** trocar o atalho "Dados abertos" da faixa superior por algo ligado à Prefeitura.
- **Feito:** a faixa superior passa a ter "A Prefeitura", que leva à página `/prefeitura` (parte do portal público do RF050): o papel da Prefeitura em cada consulta (preparar, divulgar, publicar o resultado e prestar contas, com links), os órgãos municipais com quantas consultas públicas conduzem e quantos encaminhamentos registraram (uma consulta agrupada, só agregados) e o atendimento em eventos participativos. A página repete o aviso de que a plataforma não é serviço oficial e de que órgãos, consultas e números são fictícios (DT-21).
- **Não removido:** a exportação em formato aberto é exigida pelo RF045 e pelo RNF13; continua em `/dados-abertos`, com links em Transparência, Resultados e no rodapé.

## DT-26 — Linguagem do cidadão nas telas públicas e na área “Minha conta” (24/11/2026)
- **Pedido da equipe:** deixar o sistema pronto para o cidadão, sem termos que só o desenvolvedor entende (RNF02 — linguagem simples).
- **Trocas** (o significado não muda): apuração → contagem dos votos; homologação → conferência; retificação → correção oficial; metodologia → “como o resultado foi calculado”; quórum de referência → participação mínima de referência; elegibilidade → “se você pode participar”; provedor de identidade → conta gov.br (com o aviso de que é simulada na demonstração); horário do servidor → horário oficial da plataforma; HMAC, SMTP, DEMO_MODE e TOTP saíram dos textos. As situações “Encerrada — contando os votos” e “Votos contados — resultado em conferência” substituem os rótulos técnicos. Os avisos e e-mails enviados ao cidadão e os textos do histórico público seguem a mesma linguagem.
- **Mantido por exigência dos requisitos, mas fora do caminho:** os códigos de verificação do resultado (RF044) ficam num bloco recolhível “Códigos de verificação (para conferência técnica)”; o código dos anexos (RF023) continua guardado, sem aparecer na lista de materiais; a exportação em JSON (RF045) continua em Dados abertos, e a página do resultado oferece PDF e planilha. A página Dados abertos mantém uma nota técnica curta, porque o público dela usa planilhas e outros sistemas.
- **Documento de requisitos do projeto:** o link saiu da coluna “Informações” do rodapé e foi para a linha do trabalho acadêmico, no fim da página; a página `/requisitos` continua pública.
- **Controle:** o E2E percorre as telas públicas e as da cidadã de demonstração e falha se aparecer termo técnico ou código de requisito (RF/RNF/RN/RS).
- **Dados de demonstração já gravados:** eventos do histórico criados antes desta mudança mantêm o texto antigo até `npm run db:reset`.

## DT-27 — Revisão de qualidade: fluxos, robustez e largura mínima (24/11/2026)
- **Pedido:** mapear os fluxos de utilização, reexecutar todos os testes, procurar e corrigir defeitos sem mudar funcionalidades nem a arquitetura.
- **Parâmetros de URL:** filtros e rotas `[id]` conferem o formato antes de consultar o banco (`isUuid`, `parseIsoDay` em `src/lib/text.ts`). Identificador fora do formato → 404 (rotas) ou nenhum resultado (filtros); data inválida → filtro ignorado. Antes, o PostgreSQL recusava a consulta e a página respondia 500.
- **Largura mínima (RNF03):** três regras na camada base de `globals.css` em vez de correções tela a tela — `.grid > * { min-width: 0 }` (item de grade não se alarga além da coluna) e `select, .flex-wrap > * { max-width: 100% }`. O `Badge` passou a quebrar linha. Utilitários do Tailwind continuam podendo sobrescrever (camada base).
- **Tabelas roláveis:** o componente `Table` é uma região nomeada e focável (`role="region"`, `aria-label` = legenda, `tabIndex=0`), para quem navega só pelo teclado (WCAG 2.1.1).
- **Busca (RF017):** o texto indexado (título, resumo e proposta municipal) é calculado por uma única função usada na criação, na edição e na alteração publicada.
- **Paginação no banco (DT-23):** `listPublicConsultations` só lê todas as linhas quando o filtro "posso participar" exige calcular a elegibilidade; nos demais casos usa `LIMIT/OFFSET` com total à parte, e a ordenação ganhou desempate por `id`.
- **Controle:** `tests/e2e/robustez.spec.ts` e `tests/unit/links.test.ts` reproduzem cada defeito encontrado.
