# Relatório de testes e revisão de qualidade — PPCM

**Data:** 24/11/2026 · **Ambiente:** Windows 11, Node 20.20.2, npm 10.8.2, Chromium (Playwright 1.56), banco PGlite
(PostgreSQL em WebAssembly), projeto dentro de pasta do OneDrive · **Dados:** somente os fictícios da demonstração
(`database/seeds/seed-demo.ts`); nenhum dado pessoal real. Nenhuma alteração foi feita em produção nem em banco
compartilhado: cada execução E2E recria um banco PGlite descartável em `.data/e2e`.

Fluxos de utilização mapeados: [`docs/fluxos/USER_FLOWS.md`](../fluxos/USER_FLOWS.md) · Cobertura por requisito:
[`MATRIZ_DE_COBERTURA.md`](MATRIZ_DE_COBERTURA.md).

## 1. Resumo

| Indicador | Antes da revisão | Depois da revisão |
|---|---|---|
| Tipos (`tsc --noEmit`) e lint (`eslint .`) | sem erros | sem erros |
| Vitest — unitários, integração e segurança | 150 de 152 aprovados (2 reprovados no Node 20) | **158 de 158 aprovados** (6 testes novos) |
| Playwright E2E + axe-core | 48 de 48 aprovados | **65 de 65 aprovados** (17 testes novos) |
| Varredura exploratória — páginas visitadas (7 perfis) | 568 | 568 |
| … com erro 500 | **12** | **0** |
| … com violação axe “serious/critical” | **38** | **0** |
| … com rolagem horizontal a 320 px | **149** | **7 → 0** (as 7 restantes, da tela de divulgação, foram corrigidas depois e entraram no E2E) |
| `npm audit --omit=dev` | 0 vulnerabilidades | 0 vulnerabilidades |
| Bugs encontrados / corrigidos | — | **11 / 11** (+ 3 de baixa prioridade registrados como pendentes) |

O README e o plano de testes citavam execuções anteriores (128/36 e 145/42). Esses números **não foram aceitos sem
verificação**: a suíte foi reexecutada do zero nesta máquina antes de qualquer alteração, e os números da coluna “Antes”
são os medidos agora.

## 2. Como os testes foram executados

1. `npm install` (dependências do `package-lock.json`) e `npx playwright install chromium`.
2. Linha de base sem alterar código: `npm run check` (tipos + lint + Vitest) e `npm run test:e2e`.
3. **Varredura exploratória** (script temporário com Playwright, não versionado): entra como visitante, como as cidadãs
   `maria` e `joao` e como os administradores `gestor`, `responsavel`, `analista` e `elaboradora`; segue todos os links
   internos de cada página e registra status HTTP, erros de console, violações axe (WCAG 2.2 A/AA) e rolagem horizontal
   a 320 px. Inclui URLs manipuladas de propósito (`?tema=abc`, `/conta/propostas/abc`, `?de=xyz` etc.).
4. Leitura de código dos módulos de maior risco (votação, ciclo de vida, resultados, autenticação, elegibilidade,
   consultas de leitura) em busca de defeitos que a interface não mostra.
5. Para cada defeito: reprodução (teste que falha ou medição), correção, teste automatizado novo e reexecução da
   suíte inteira.
6. Validação final: `npm run check`, `npm run test:e2e` (build de produção limpo) e nova varredura.

### Observações de ambiente (não são defeitos do sistema)

- **Vitest no Windows:** quando a pasta chega com a letra da unidade minúscula (`c:\…`, caso do terminal integrado do
  VS Code com Git Bash), o Vitest 4 carrega o executor duas vezes e **todos** os arquivos falham com “failed to find the
  runner”, sem executar teste algum. Rodando a partir de `C:\…` (PowerShell) a suíte executa normalmente.
- **OneDrive:** com um `.next-e2e` anterior (264 MB) dentro da pasta sincronizada, o `next build` ficou mais de 15 min
  parado tentando limpá-lo. O `scripts/e2e-server.mjs` passou a apagar essa pasta antes do build (menos de 1 s).
  A recomendação do `STATUS_DO_DESENVOLVIMENTO.md` de tirar o projeto do OneDrive continua válida.

## 3. Bugs encontrados e corrigidos

| # | Gravidade | Bug | Requisito afetado | Causa | Correção | Teste que impede a volta |
|---|---|---|---|---|---|---|
| B01 | Média | Dois testes do PDF de requisitos reprovavam no Node 20 (o projeto declara suporte a Node ≥ 20.11) | DT-24 | `TextDecoder("windows-1252")` do Node 20 trata 0x80–0x9F como Latin-1: o travessão “–” do apêndice virava `U+0096` | Tabela WinAnsi explícita em `scripts/pdf-requisitos/leitor.ts` | `tests/unit/requisitos-pdf.test.ts` (6/6) |
| B02 | **Alta** | **Erro 500 no portal público** em `/consultas?tema=abc`, `?regiao=…`, `?de=xyz`, `?ate=2026-13-45`; e em `/admin/consultas?situacao=xyz` | RF016, RF017 | Filtros da URL iam direto ao banco: texto em coluna UUID e `new Date("xyz")` inválido | `isUuid` e `parseIsoDay` (`src/lib/text.ts`); identificador inválido = nenhum resultado, data inválida = filtro ignorado, situação desconhecida ignorada | `security.test.ts` (filtros), `rules.test.ts`, 8 casos E2E |
| B03 | Média | **Erro 500** em `/conta/propostas/abc` e `/api/conta/dados/abc` (em vez de 404) | RF009, RF014, RF015 | Identificador malformado chegava ao PostgreSQL | Guarda `isUuid` → `notFound()` em todas as 20 rotas `[id]` (páginas, layout e API) | E2E “identificador fora do formato responde 404” (cidadão e administração) |
| B04 | Média | **Link quebrado:** o aviso “Identidade verificada”, enviado a todo cidadão que conclui a verificação, e a ação “Ver meu perfil” de conta inativa levavam a `/conta/perfil`, página inexistente (404) | RF004, RF012, RF036 | Rota renomeada para `/conta`; dois textos ficaram com o caminho antigo | Caminho corrigido para `/conta` | `tests/unit/links.test.ts`: confere **todo** caminho fixo em `href`, `link` e `redirect` contra as rotas do App Router |
| B05 | Média | Consulta **sumia da busca** pelo texto da proposta municipal depois de qualquer edição | RF017 (“busca em título, resumo e proposta”) | A criação indexava título + resumo + proposta; a edição (RF024) e a alteração publicada (RF032) recalculavam só título + resumo | Cálculo único `searchTextFor()` em `lifecycle.service.ts` usado nos três pontos | `lifecycle.test.ts` › “a busca continua encontrando a consulta pelo texto da proposta depois de editada” |
| B06 | **Alta** | **Área do cidadão com 930 px de largura em celular de 320 px** (todas as páginas de `/conta`) | RNF03 | O `<aside>` do menu da conta é item de grade com `min-width: auto`; o menu horizontal com rolagem impunha sua largura total à página | Regra base `.grid > * { min-width: 0 }` em `globals.css` | E2E “área do cidadão: o menu da conta rola sozinho” |
| B07 | Média | Telas administrativas com rolagem horizontal a 320 px (painel, consultas, incidentes, relatórios, divulgação) e cartões de consulta 3 px mais largos que a tela | RNF03 | Tabelas (`min-w-xl`) dentro de grades; `Badge` com `whitespace-nowrap` (“Votos contados — resultado em conferência”); `<select>` com a largura da opção mais longa; filtros sem `flex-wrap`; link longo sem quebra | Mesma regra de grade; `Badge` quebra linha; `select, .flex-wrap > * { max-width: 100% }`; `flex-wrap` nos filtros de incidentes; `break-words` no texto de divulgação | E2E “administração: tabelas e gráficos rolam dentro do próprio quadro” e “cartões com rótulos longos” |
| B08 | Média | 27 telas administrativas com violação axe **scrollable-region-focusable**: quadro de tabela rolável inalcançável pelo teclado | RNF01 (WCAG 2.1.1) | Contêiner `overflow-x-auto` sem foco | `Table` (e a tabela de preferências de aviso) com `role="region"`, `aria-label` e `tabIndex=0` | E2E axe em `/admin/relatorios` e `/admin/auditoria` |
| B09 | Baixa | Violação axe **list** em “Minhas participações” de quem não tem propostas | RNF01 | `<p>` como filho direto de `<ul>` | Mensagem fora da lista | E2E axe com o cidadão `joao` |
| B10 | Baixa | Assistente de votação: depois de errar o código e clicar em “Voltar e mudar a escolha”, o passo 1 continuava exibindo “Código incorreto. Restam 2 tentativa(s).” | RF011, RNF02 | O alerta do passo 1 lia sempre a última resposta da confirmação | Alerta só aparece quando o servidor manda recomeçar; some ao voltar por vontade própria | E2E “votação: depois de errar o código, voltar … não mostra o erro antigo” |
| B11 | Baixa | Filtro ativo de incidentes indicado só pela cor | RNF01 (WCAG 1.4.1) | Sem `aria-current` | `aria-current="page"` e rótulo no `<nav>` | — (verificação manual) |

Também corrigido: ambiente E2E travando no OneDrive (ver §2) e classes Tailwind `has-[:checked]:` reescritas na forma
canônica `has-checked:` (avisos do editor; mesmo CSS gerado).

## 4. Desempenho

| Melhoria | Medição | Antes | Depois |
|---|---|---|---|
| Listagem pública paginada **no banco** quando não há o filtro “posso participar” (antes: todas as consultas eram lidas e a contagem de participações rodava para cada uma antes de cortar a página) | 600 consultas no acervo, 40 cidadãos, mediana de 15 chamadas ao serviço — 1ª página | 19,4 ms | **4,0 ms** |
| idem | Acervo (finalizadas), página 3 | 16,0 ms | **4,0 ms** |
| idem | Busca sem resultados (passa a fazer 2 consultas: página + total) | 1,6 ms | 2,6 ms |
| Desempate por `id` na ordenação | Paginação estável quando há encerramentos iguais (antes uma consulta podia aparecer em duas páginas ou em nenhuma) | — | coberto por teste |
| Páginas públicas com os dados de demonstração (11 consultas), build de produção, mediana de 15 acessos | tempo até o 1º byte | 13–25 ms | 13–26 ms (igual, dentro do ruído) |

Com poucos dados a diferença não aparece; ela cresce com o acervo, que é permanente (RF056). Não houve teste de carga
(RNF09) nem medição de disponibilidade (RNF10).

## 5. Cenários executados por área

Contagem: **223 testes automatizados** (158 Vitest + 65 E2E) **+ 568 visitas de página na varredura**. Todos aprovados
na execução final. Atualização de 25/11/2026 (seção 9): **238 testes automatizados** (173 Vitest + 65 E2E), todos aprovados.

### 5.1 Funcionais (aprovados)
Cadastro válido e inválido (todos os erros por campo, dados preservados, máscaras); CPF já usado com mensagem genérica;
confirmação de e-mail (uso único, 24 h); login correto e incorreto; bloqueio após 5 falhas e CAPTCHA por IP; recuperação
de senha (30 min, uso único, encerra sessões); segundo fator das contas administrativas; controle de acesso por perfil
e papel; navegação entre todas as páginas (varredura); busca sem acentos e filtros; envio, ajuste e acompanhamento de
propostas; votação em 3 passos com código; comprovante e verificação pública; resultados e dados abertos (CSV/JSON/PDF);
ciclo completo da consulta (revisão, aprovação, publicação, suspensão, prorrogação, cancelamento, encerramento automático,
apuração, homologação, retificação, encaminhamentos); notificações e preferências; cópia dos dados e desativação.

### 5.2 Regras de negócio (aprovadas)
Voto único inclusive com 5 envios simultâneos; consulta encerrada ou suspensa recusa voto pelo horário do servidor;
publicação só de consulta aprovada; aprovação vedada a quem elaborou, editou ou revisou (inclusive com designação
forçada no banco); voto sem vínculo com a pessoa (teste “Sigilo do voto” percorre esquema, painel, relatórios,
auditoria, avisos, e-mails, histórico e exportações); nenhuma contagem por alternativa antes da publicação; auditoria
encadeada por hash; comprovante prova a participação sem revelar a escolha; tabelas somente de acréscimo recusam
UPDATE/DELETE.

### 5.3 Negativos e de segurança (aprovados)
Campos obrigatórios vazios; CPF inválido; dados duplicados; páginas administrativas sem autorização (redireciona e
audita); ações sem autenticação; parâmetros de URL manipulados (**achou B02 e B03**); injeção SQL na busca; HTML e
`javascript:` em texto livre; redirecionamento aberto; SSRF em links externos; arquivo com extensão falsa e EICAR;
dados de outro cidadão (proposta, comprovante, cópia dos dados → 404); alteração de registros imutáveis; tentativa de
descobrir o voto.

### 5.4 Interface e acessibilidade
axe-core (WCAG 2.2 A/AA) sem violações sérias nas **526 páginas HTML** visitadas pelos 7 perfis (antes: 38 com
violação); 320 px sem rolagem horizontal em 8 páginas públicas, 7 da área do cidadão e 7 administrativas; botão
Acessibilidade (espaçamento ampliado e tamanho do texto); navegação por teclado nas tabelas roláveis; nenhum link interno
quebrado no portal público (E2E) e no código (teste estático).

## 6. Pendências (não corrigidas nesta revisão)

| Item | Gravidade | Motivo / recomendação |
|---|---|---|
| Após o segundo fator, o administrador sempre vai para `/admin`, mesmo que tenha tentado abrir outra página administrativa | Baixa | Melhoria de usabilidade: levar o `proximo` do login até a etapa do segundo fator |
| Bairro adulterado no formulário de cadastro devolve mensagem genérica em vez de “Bairro inválido” | Baixa | Comportamento seguro (nada é gravado); ajustar `resolveDistrict` para validar o formato |
| Editar o título da proposta municipal não atualiza o índice de busca da consulta já criada | Baixa | Recalcular `searchTextFor` ao salvar a proposta |
| 10 vulnerabilidades moderadas em ferramentas de desenvolvimento (`drizzle-kit`/esbuild, plugins do ESLint/minimatch) | Baixa | Não vão para produção (`npm audit --omit=dev` = 0); corrigir exige versões com quebra de compatibilidade |

## 7. Não testado

Leitores de tela NVDA e TalkBack (RNF01, RNF11); Firefox, Safari e Edge (RNF11); teste de carga (RNF09) e
disponibilidade (RNF10); restauração de backup (RNF14); PostgreSQL servidor **nesta máquina** (sem Docker; o CI cobre
com PostgreSQL 16); integração real com gov.br e SMS (simulados por decisão do projeto); teste de intrusão independente.

## 8. Evidências

- Logs completos das execuções (fora do repositório, na pasta acima do projeto): `ppcm-baseline-check.log`,
  `ppcm-baseline-test.log`, `ppcm-baseline-e2e.log`, `ppcm-final-check.log`, `ppcm-final-e2e.log`, varredura
  `ppcm-explorar-antes.json` / `ppcm-explorar-depois.json`, tempos `ppcm-bench-antes.txt` / `ppcm-bench-depois.txt`.
- Testes novos: `tests/e2e/robustez.spec.ts`, `tests/unit/links.test.ts` e casos acrescentados em `rules.test.ts`,
  `security.test.ts`, `lifecycle.test.ts` e `performance.test.ts`.
- Relatório HTML do Playwright: `npx playwright show-report` após `npm run test:e2e`.

## 9. Atualização de 25/11/2026 — auditoria e melhorias (DT-30 a DT-33)

Executado num clone limpo fora do OneDrive (Windows 11, Node 24, PGlite), no commit das melhorias.

| Suíte | Resultado |
|---|---|
| Tipos (`tsc --noEmit`) e lint (`eslint .`) | sem erros |
| Vitest — unitários, integração e segurança | **173 de 173 aprovados** (15 novos) |
| Build de produção (`next build`) | sem erros |
| Playwright E2E + axe-core | **65 de 65 aprovados**, nenhum pulado |

Testes novos ou ampliados:

- **18 anos para votar (RF036, DT-30):** limites de 18 anos exatos e 17 anos e 364 dias, nascido em 29/02, data de Brasília, conta sem data de nascimento, critério etário abaixo de 18, ordem das verificações, estimativa de elegíveis; menor recusado mesmo com código inserido diretamente no banco, com a recusa auditada.
- **Plataforma só para maiores de 18 anos (DT-33):** cadastro de quem tem 17 anos e 364 dias recusado sem gravar nada, 18 anos completos hoje aceito; correção de data de nascimento para menor recusada; consulta para crianças e adolescentes só informativa ou educativa.
- **Sigilo (RS002, DT-31):** o `JOIN` por `xmin` entre participações e votos passa de mais de zero linhas para zero depois do reembaralhamento, com o mesmo hash da base apurada; o gatilho só admite a troca de `shuffle_key`.
- **Código de confirmação e comprovante (RF011, RF038, DT-32):** código anterior continua válido ao pedir outro; no máximo 3 válidos e descarte após 3 erros; código na tela só quando o envio é simulado; fila registra "simulado"; id da participação vindo da transação; E2E lê o código na tela, copia o comprovante, recarrega a página, volta e usa o código anterior — tudo numa única guia.

