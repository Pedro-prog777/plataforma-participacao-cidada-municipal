# Ciclo de vida da consulta pública

**Requisitos:** RF022–RF035, RF061, RF062 · **Regras:** RN11–RN15, RN20, RN32, RN34–RN37 · **Classe:** `Consulta`

## 1. Objetivo

Conduzir cada consulta pública do rascunho ao encerramento com controle de quem faz cada ato, sem permitir transições indevidas.

## 2. Descrição

A partir de uma proposta municipal, o elaborador cria a consulta (texto, pergunta, alternativas, público-alvo, datas, anexos). Um revisor diferente confere a lista de verificação; um aprovador diferente de quem elaborou, editou e revisou aprova; o responsável publica. A rotina abre e encerra a votação no horário. Depois de publicada, só correções justificadas são permitidas; também é possível suspender, retomar e cancelar.

```text
rascunho → em_revisao → em_analise → aprovada → agendada → aberta → encerrada → apurada → finalizada
              ↓ problema      ↓ rejeitar / prazo negado        ↕ suspensa
           rascunho        rejeitada / rascunho          cancelada (de aprovada a encerrada)
```

## 3. Atores

Elaborador; Revisor; Aprovador; Autorizador de prazo excepcional; Responsável (condução e publicação); Gestor de acessos (designação de responsáveis); Sistema (abertura e encerramento).

## 4. Pré-condições

Proposta municipal em Rascunho sem outra consulta ativa; administrador autenticado com segundo fator e com o papel exigido **na consulta**.

## 5. Fluxo principal

1. **Criar** (`/admin/consultas/nova`): tema, problema, objetivo, justificativa, pergunta (até 300 caracteres), orientações, abertura e encerramento (20 dias sugeridos), próximos passos.
2. **Alternativas** (2 a 10, sem rótulos repetidos; abstenção opcional), **público-alvo** (aberta ou limitações justificadas), **anexos** (com alternativa textual) e **responsáveis** por papel.
3. **Enviar para revisão:** o sistema lista as pendências com link para o campo; sem pendências, a consulta vai para "em revisão".
4. **Revisar** (`/revisao`): lista de 8 itens; tudo certo → "em análise" com versão congelada.
5. **Aprovar** (`/aprovacao`): aprovador independente; confere prazo excepcional autorizado e antecedência mínima.
6. **Publicar** (`/conducao`): "agendada", com histórico público e avisos.
7. **Abrir** e **encerrar**: automáticos no horário (rotina a cada minuto).

## 6. Fluxos alternativos

- **Revisão com problema:** volta a Rascunho com observações.
- **Rejeição:** exige justificativa; volta a ser editável.
- **Prazo excepcional (10 dias):** exige justificativa de emergência e decisão do autorizador; negado, volta a Rascunho com 20 dias sugeridos.
- **Desfazer agendamento:** antes da abertura, volta a "em análise".
- **Alterar publicada (RF032):** só correção textual, prorrogação antes do encerramento e ajuste da abertura enquanto Agendada; correção que muda o sentido exige o aprovador; tudo com justificativa, com o antes e o depois no histórico público e no aviso a quem votou.
- **Suspender / retomar (RF033):** com justificativa; na retomada volta a Agendada (se a abertura não chegou) ou Aberta; se o prazo terminou na suspensão, decide-se entre apurar e cancelar.
- **Cancelar (RF034):** irreversível, exige justificativa e digitar o título; consulta já apurada não pode ser cancelada.
- **Transição inválida:** recusada com mensagem (ex.: "Somente consultas aprovadas podem ser publicadas.").

## 7. Regras de negócio

- Situações e transições do ciclo de vida (seção 6.1 do documento) — controladas pela classe `Consulta`; nenhuma outra parte do sistema altera a situação.
- Segregação de funções (RN20, RN36): quem elabora, edita por último ou revisa não aprova; o revisor é diferente do elaborador.
- Prazo de 20 dias (10 com emergência autorizada) (RN14); antecedência de 24 horas entre aprovação/publicação e abertura (RN15).
- Imutabilidade após publicar (RN12): pergunta, alternativas, público-alvo e regra de apuração não mudam.
- Toda decisão relevante exige justificativa (RN11).

## 8. Validações

Campos obrigatórios e tamanhos (Zod); datas no futuro e duração mínima; 2 a 10 alternativas sem repetição; limitação de público sem justificativa bloqueada; edição simultânea detectada pela versão; papel exigido conferido no servidor.

## 9. Persistência no banco de dados

`consultations` (situação e campos da transição, gravados pelo `ConsultaRepository`), `alternatives`, `audience_criteria`, `consultation_assignments`, `review_checklists`, `attachments`, `entity_versions` (versões), `consultation_events` (histórico público), `municipal_proposals`, `notifications`, `email_outbox`, `audit_log`. `CHECK consultations_periodo_valido` garante encerramento depois da abertura.

## 10. Critérios de aceitação

- Uma consulta só chega a Agendada depois de revisada e aprovada por pessoas diferentes de quem a elaborou.
- Toda transição fora da ordem é recusada sem gravar nada.
- Abertura e encerramento acontecem sozinhos no horário.
- Depois de publicada, só as alterações permitidas passam, com justificativa e histórico.

## Implementação

Telas `src/app/admin/consultas/` · ações em `src/server/actions/admin.ts` · serviço `src/server/modules/consultations/lifecycle.service.ts` · entidade `src/server/domain/entities/consulta.ts` (base `EntidadeComCicloDeVida`) · repositório `src/server/repositories/consulta.repository.ts` · rotina `src/server/modules/scheduler/scheduler.service.ts` · testes `tests/integration/lifecycle.test.ts`, `tests/unit/dominio.test.ts`, `tests/integration/repositorios.test.ts`, `tests/e2e/admin.spec.ts`.
