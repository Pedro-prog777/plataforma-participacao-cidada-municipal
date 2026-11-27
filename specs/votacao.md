# Votação em 3 passos com confirmação

**Requisitos:** RF011, RF036, RF037, RF039, RF040 · **Regras:** RN04–RN09, RN13, RN22 · **Classes:** `Cidadao`, `PublicoAlvo`, `CriterioPublicoAlvo`, `AvaliadorDeElegibilidade`, `Cedula`

## 1. Objetivo

Registrar o voto consultivo de quem pode participar — uma única vez, em segredo e sem perda.

## 2. Descrição

Na página da consulta, o cidadão elegível escolhe uma alternativa (passo 1), revisa e confirma com um código de 6 dígitos (passo 2) e recebe o comprovante (passo 3). A escolha fica no navegador até a confirmação; o servidor repete a elegibilidade no momento do voto e grava participação e voto na mesma transação, em registros sem ligação entre si.

## 3. Atores

Cidadão; Sistema.

## 4. Pré-condições

Cidadão autenticado, com conta ativa, identidade verificada e 18 anos completos; consulta Aberta e dentro do período; cidadão dentro do público-alvo e sem participação anterior.

## 5. Fluxo principal

1. Em `/consultas/[slug]`, o cidadão vê "Participar" (ou o motivo de não poder).
2. Em `/participar`, escolhe a alternativa (ou abstenção, se permitida) e o canal do código.
3. O servidor repete a elegibilidade e gera um código de 6 dígitos válido por 5 minutos (guardado só como hash, sem a alternativa).
4. O cidadão revisa a escolha, é avisado de que o voto não poderá ser alterado e digita o código.
5. Numa transação: a linha da consulta é travada em modo compartilhado; a elegibilidade é repetida pelo horário do servidor; a `Cedula` confere a escolha; grava-se a participação (com a data) e o voto (sem o cidadão); o código é consumido.
6. Depois do COMMIT, o comprovante de 12 caracteres é mostrado e enviado.

## 6. Fluxos alternativos

- **Não elegível:** mostra o primeiro motivo, na ordem do RF036, com a ação possível (ex.: "Verificar identidade").
- **Código incorreto:** "Código incorreto. Restam 2 tentativa(s)." (o número diminui a cada erro); no 3º erro a votação é interrompida e recomeça do passo 1.
- **Código expirado:** pede novo código (até 3 códigos válidos ao mesmo tempo).
- **Mais de 5 tentativas por minuto:** limita e abre incidente (RF060).
- **Consulta encerrada ou suspensa durante o voto:** recusado pelo horário do servidor (RF040).
- **Voto duplicado (outro dispositivo, duplo clique, envios simultâneos):** o índice único do banco recusa o segundo (RF039).
- **Alternativa de outra consulta:** recusada e registrada como incidente.
- **Falha na gravação:** nada é gravado; nova tentativa permitida (RNF14).
- **Demonstração sem e-mail real:** o código aparece na própria tela, identificado como simulação (DT-32).

## 7. Regras de negócio

- Ordem da elegibilidade (RF036): conta ativa e desbloqueada → identidade verificada → perfil cidadão (contas administrativas não votam, RN22) e 18 anos completos → público-alvo (domicílio, território, faixa etária; cada critério avaliado pela sua classe) → consulta aberta no período → sem participação anterior.
- Exatamente uma alternativa válida desta consulta ou abstenção permitida (RN13).
- Voto único (RN05), irretratável (RN06), secreto (RN07): o voto não tem cidadão, comprovante nem horário; só recusas são auditadas, nunca a alternativa.

## 8. Validações

Escolha obrigatória; código numérico de 6 dígitos; elegibilidade repetida no servidor; alternativa pertencente à consulta; abstenção só se permitida.

## 9. Persistência no banco de dados

- `participations`: cidadão, consulta, **data** e hash do comprovante (índice único consulta + cidadão).
- `votes`: consulta, alternativa ou abstenção e chave de embaralhamento — **sem** cidadão, participação ou horário.
- `one_time_codes`: hash do código, validade, tentativas.
- `audit_log` (só recusas, sem alternativa), `incidents`, `notifications`/`email_outbox` (comprovante).

## 10. Critérios de aceitação

- Cidadão elegível vota em 3 passos e recebe o comprovante.
- Segundo voto, voto fora do período e de conta administrativa são recusados.
- 5 envios simultâneos do mesmo cidadão geram 1 voto.
- Nenhum registro, tela, e-mail ou auditoria liga o voto à pessoa.

## Implementação

Tela `src/app/(site)/consultas/[slug]/participar/page.tsx` e `src/components/voting-wizard.tsx` · ações `prepareVoteAction`, `castVoteAction` (`src/server/actions/citizen.ts`) · serviço `src/server/modules/voting/voting.service.ts` e `eligibility.ts` · domínio `src/server/domain/entities/cidadao.ts`, `src/server/domain/entities/publico-alvo.ts`, `src/server/domain/entities/cedula.ts`, `src/server/domain/strategies/criterios-publico-alvo.ts`, `src/server/domain/services/avaliador-de-elegibilidade.ts` · testes `tests/integration/voting.test.ts` (inclui "Sigilo do voto"), `tests/unit/dominio.test.ts`, `tests/e2e/citizen.spec.ts`.
