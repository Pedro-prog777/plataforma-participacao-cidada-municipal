# Listagem, busca e filtros de consultas

**Requisitos:** RF016, RF017, RF056 · **Regras:** RN14, RN16

## 1. Objetivo

Permitir que qualquer pessoa encontre consultas públicas por palavra, situação, tema, região e período, e que o cidadão veja onde pode participar.

## 2. Descrição

A listagem mostra só consultas publicadas, com as abertas primeiro (pelo encerramento mais próximo), 12 por página. A busca não diferencia maiúsculas nem acentos e procura no título, no resumo e na proposta municipal. Para o cidadão, cada cartão indica "Você pode participar", "Você já participou" ou o motivo de não se enquadrar, e há os filtros "Ainda não participei" e "Posso participar". O acervo reúne as consultas finalizadas e canceladas.

## 3. Atores

Visitante; Cidadão.

## 4. Pré-condições

Nenhuma (página pública). Os filtros pessoais aparecem só para o cidadão autenticado.

## 5. Fluxo principal

1. Em `/consultas`, a pessoa informa palavras-chave e filtros (situação, tema, região, período).
2. O sistema busca e mostra os cartões (título, resumo, tema, região, situação, período e número de participações).
3. Os filtros ativos aparecem como etiquetas removíveis; a paginação mantém os filtros.
4. Em `/consultas/encerradas`, o acervo filtra por ano, tema e região.

## 6. Fluxos alternativos

- **Nenhum resultado:** sugere remover filtros e oferece a inscrição em avisos (RF052).
- **Parâmetro de URL manipulado** (tema que não é identificador, data inválida, página negativa): página normal — identificador inválido não encontra nada, data inválida é ignorada; nunca erro 500.
- **Cidadão fora do público-alvo:** o cartão mostra o motivo (mesma regra da votação).

## 7. Regras de negócio

- Rascunho, em revisão, em análise, aprovada e rejeitada nunca aparecem (RF016).
- Nenhuma contagem por alternativa durante a votação (RN16).
- A indicação ao cidadão usa a mesma avaliação de elegibilidade da votação (`AvaliadorDeElegibilidade`), sem duplicar a regra.

## 8. Validações

Termos normalizados (até 8), com os curingas `%` e `_` removidos; tema e região só se forem UUID; datas só no formato AAAA-MM-DD reais; página numérica ≥ 1.

## 9. Persistência no banco de dados

Leitura de `consultations` (coluna `search_text` normalizada e índice `consultations_status_idx`), `themes`, `regions`, `organs`, `participations` (contagem) e `audience_criteria`; paginação feita no banco (`LIMIT/OFFSET`) com desempate estável. A view `vw_consultas_publicas` oferece a mesma lista pública, agregada, para relatórios externos.

## 10. Critérios de aceitação

- A busca não diferencia maiúsculas nem acentos: "PRACA" encontra "Revitalização da Praça do Centro" e "CICLOVIA avenida" encontra "Ciclovia na Avenida Central".
- Filtros combinados restringem o resultado; páginas não repetem nem omitem consultas.
- URLs manipuladas não geram erro 500.

## Implementação

Telas `src/app/(site)/consultas/page.tsx`, `src/app/(site)/consultas/encerradas/page.tsx` · serviço `listPublicConsultations` (`src/server/modules/consultations/queries.service.ts`) · testes `tests/integration/lifecycle.test.ts` (busca), `tests/integration/performance.test.ts` (paginação), `tests/security/security.test.ts` (filtros manipulados), `tests/e2e/public.spec.ts`, `tests/e2e/robustez.spec.ts`.
