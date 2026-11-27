# Usuários administrativos, papéis e permissões

**Requisitos:** RF046, RF047, RF061 · **Regras:** RN20, RN21, RN22, RN36

## 1. Objetivo

Controlar quem administra a plataforma e o que cada pessoa pode fazer, com separação de funções.

## 2. Descrição

O gestor de acessos pesquisa contas, cria contas administrativas por convite, bloqueia, desbloqueia ou desativa contas com justificativa e mantém os papéis (conjuntos de permissões). Em cada consulta, designa os responsáveis por papel, impedindo combinações vedadas.

## 3. Atores

Administrador com papel "gestor de acessos"; Convidado (servidor municipal).

## 4. Pré-condições

Gestor autenticado com segundo fator e as permissões `usuarios.gerenciar`, `papeis.gerenciar` ou `responsaveis.designar`.

## 5. Fluxo principal

1. Em `/admin/usuarios/convidar`, o gestor informa nome, matrícula, e-mail institucional, órgão e papéis.
2. O sistema confere a unicidade e envia o convite (link válido por 72 horas).
3. O convidado abre `/convite`, define a senha e cadastra o segundo fator (código TOTP).
4. Em `/admin/usuarios`, o gestor pesquisa, vê os detalhes e bloqueia, desbloqueia ou desativa com justificativa.
5. Em `/admin/papeis`, mantém os papéis e as permissões.
6. Em `/admin/consultas/[id]/responsaveis`, designa os responsáveis da consulta.

## 6. Fluxos alternativos

- **Bloquear ou desativar a própria conta:** recusado.
- **Remover o último gestor de acessos:** recusado.
- **Bloqueio:** encerra as sessões da conta; atos anteriores continuam válidos.
- **Combinação vedada na consulta** (elaborar ou revisar e aprovar): recusada.
- **Substituição durante a consulta:** exige justificativa, registrada no histórico público.
- **Convite vencido:** precisa de novo convite.

## 7. Regras de negócio

- Segregação de funções (RN20, RN36) — também conferida na entidade `Consulta` no momento da aprovação.
- Contas administrativas não votam (RN22) — recusadas pela elegibilidade.
- O gestor não vê senhas nem votos.

## 8. Validações

E-mail e matrícula únicos; justificativa obrigatória; papéis existentes; contas designadas ativas e com a permissão do papel; código TOTP válido no aceite do convite.

## 9. Persistência no banco de dados

`users` (contas administrativas, segredo TOTP cifrado), `roles`, `user_roles`, `consultation_assignments` (índice único parcial para designações ativas), `tokens` (convite), `sessions` (encerradas no bloqueio), `audit_log` (antes e depois das permissões).

## 10. Critérios de aceitação

- Só quem aceita o convite e cadastra o segundo fator entra na administração.
- O último gestor não pode ser removido; ninguém bloqueia a si mesmo.
- O mesmo administrador não fica designado para elaborar e aprovar a mesma consulta.

## Implementação

Telas `src/app/admin/usuarios/`, `src/app/admin/papeis/`, `src/app/(site)/convite/` · serviços `src/server/modules/admin/users.service.ts`, `src/server/modules/access/access.service.ts`, `setAssignments` (`lifecycle.service.ts`), `acceptInvite` (`auth.service.ts`) · testes `tests/integration/administration.test.ts`, `tests/integration/lifecycle.test.ts`, `tests/integration/performance.test.ts`.
