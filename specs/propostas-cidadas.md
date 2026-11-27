# Propostas cidadãs

**Requisitos:** RF020, RF021 (RF022 na conversão; RF067 desligado) · **Regras:** RN04, RN11, RN27, RN30, RN38 · **Classe:** `PropostaCidada`

## 1. Objetivo

Permitir que o cidadão envie propostas de competência municipal e acompanhe a resposta da administração.

## 2. Descrição

O cidadão verificado envia título, problema, solução sugerida, tema, bairro, até 3 anexos e se autoriza publicar o texto. Antes do envio, vê propostas semelhantes. A proposta recebe um protocolo e segue os estados da RN30, conduzidos pela administração; cada mudança avisa o autor e entra no histórico. A proposta não gera votação automática.

## 3. Atores

Cidadão (autor); Administrador com papel "Análise de propostas"; Visitante (propostas publicadas); Sistema (prazo de ajuste).

## 4. Pré-condições

Cidadão autenticado, ativo e com identidade verificada, com menos de 3 propostas em análise.

## 5. Fluxo principal

1. Em `/conta/propostas/nova`, o cidadão preenche e envia.
2. O sistema registra como "Recebida", com protocolo `PROP-AAAA-XXXXXX`, e confirma por e-mail e na central de avisos.
3. Na fila `/admin/propostas` (mais antigas e prioritárias primeiro), o analista abre a proposta e **inicia a análise**.
4. O analista **responde** com justificativa: convertida em proposta municipal (o sistema cria a proposta municipal vinculada, em Rascunho), encaminhada a outro órgão ou não acolhida.
5. Se o autor autorizou, o analista **publica** o texto em `/propostas` (sem dados do autor).
6. O analista **encerra** com justificativa.
7. O autor acompanha tudo em `/conta/propostas/[id]`.

## 6. Fluxos alternativos

- **Ajuste solicitado:** o analista orienta o autor; prazo de 15 dias (parâmetro); o autor reenvia e a proposta volta para análise.
- **Ajuste não atendido no prazo:** a rotina encerra automaticamente, com aviso.
- **Limite atingido ou identidade não verificada:** envio bloqueado com orientação.
- **Analista é o autor:** "Não é permitido analisar a própria proposta."
- **Publicar sem autorização do autor:** "O autor não autorizou a publicação do texto."
- **Ação fora do estado:** recusada (ex.: "Só propostas respondidas podem ser publicadas.").
- **Conteúdo impróprio:** segue a denúncia e a moderação (RF065, RF066).

## 7. Regras de negócio

- Estados (RN30): Recebida → Em análise → (Ajuste solicitado → Em análise) → Respondida → Publicada; Encerrada com justificativa — controlados pela classe `PropostaCidada`.
- Resposta e encerramento exigem justificativa (RN11).
- Autor visível só à administração; texto publicado sem dados pessoais (RN27).
- Proposta não é voto (RN38).

## 8. Validações

Título até 120 caracteres (também `CHECK` no banco); problema e solução obrigatórios; tema e bairro existentes; até 3 anexos com tipo real e antivírus; tipo de resposta válido; textos sem HTML executável.

## 9. Persistência no banco de dados

`citizen_proposals` (estado e campos da transição, gravados pelo `PropostaCidadaRepository`), `citizen_proposal_events` (histórico, somente acréscimo), `attachments`, `municipal_proposals` (conversão), `notifications`, `email_outbox`, `audit_log`.

## 10. Critérios de aceitação

- Proposta enviada recebe protocolo e aparece para o autor.
- Cada ação do analista só é aceita no estado certo e avisa o autor.
- Só propostas autorizadas e publicadas aparecem no portal, sem dados do autor.

## Implementação

Telas `src/app/(site)/conta/propostas/`, `src/app/admin/propostas/`, `src/app/(site)/propostas/` · ações `submitProposalAction`, `resubmitProposalAction` e a de análise em `admin.ts` · serviço `src/server/modules/proposals/citizen-proposals.service.ts` · entidade `src/server/domain/entities/proposta-cidada.ts` · repositório `src/server/repositories/proposta-cidada.repository.ts` · testes `tests/integration/participation.test.ts`, `tests/unit/dominio.test.ts`, `tests/integration/repositorios.test.ts`.
