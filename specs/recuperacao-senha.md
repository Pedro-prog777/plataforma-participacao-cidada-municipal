# Recuperação e alteração de senha

**Requisitos:** RF007, RF008 · **Regras:** RN23, RN25

## 1. Objetivo

Permitir que a pessoa redefina a senha esquecida sem expor se a conta existe, e que quem está autenticado troque a senha.

## 2. Descrição

Em "Esqueci minha senha", a pessoa informa CPF ou e-mail e recebe, se houver conta, um link de uso único válido por 30 minutos. Ao definir a nova senha, todas as sessões são encerradas. Autenticada, a pessoa pode trocar a senha informando a atual.

## 3. Atores

Cidadão; Administrador.

## 4. Pré-condições

Recuperação: pessoa não autenticada. Alteração: pessoa autenticada.

## 5. Fluxo principal

1. A pessoa abre `/recuperar-senha` e informa CPF ou e-mail.
2. O sistema mostra sempre a mesma mensagem genérica e, havendo conta, envia o link.
3. A pessoa abre `/redefinir-senha?token=…`, informa e confirma a nova senha.
4. O sistema grava o novo hash, invalida o link, encerra todas as sessões e avisa o titular.

**Alteração (RF008):** em `/conta/senha` (ou `/admin/senha`), informa a senha atual, a nova e a confirmação; o sistema grava, encerra as demais sessões e confirma.

## 6. Fluxos alternativos

- **Conta inexistente:** mesma mensagem genérica, sem envio.
- **Mais de 3 pedidos por hora para o mesmo CPF/e-mail (ou 10 da mesma rede):** pedido recusado temporariamente.
- **Link expirado ou já usado:** recusado; nova solicitação.
- **Senha atual incorreta:** recusa contada como falha de autenticação (RF010).

## 7. Regras de negócio

- Link de uso único, válido por 30 minutos (RN25).
- Nova senha segue a política (RN23).
- Redefinir encerra todas as sessões; alterar encerra as demais.

## 8. Validações

Token com até 200 caracteres, existente, não usado e não vencido; nova senha conforme a política; confirmação igual.

## 9. Persistência no banco de dados

`tokens` (propósito `recuperar_senha`, hash e uso), `users.password_hash`, `sessions` (revogadas), `email_outbox` e `notifications` (aviso), `audit_log`.

## 10. Critérios de aceitação

- O pedido nunca revela se a conta existe.
- O link funciona uma única vez e só por 30 minutos.
- Depois de redefinir, as sessões anteriores deixam de valer.

## Implementação

Telas `src/app/(site)/recuperar-senha/`, `src/app/(site)/redefinir-senha/`, `src/app/(site)/conta/senha/` · ações `requestResetAction`, `resetPasswordAction`, `changePasswordAction` · serviços `requestPasswordReset`, `resetPassword`, `changePassword` (`auth.service.ts`) · testes `tests/integration/auth.test.ts`.
