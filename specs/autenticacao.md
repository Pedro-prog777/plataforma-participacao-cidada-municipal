# Login, segundo fator, bloqueio por tentativas e sessões

**Requisitos:** RF005, RF006, RF009, RF010 · **Regras:** RN03, RN24, RN26

## 1. Objetivo

Autenticar cidadãos e contas administrativas com segurança, proteger contra tentativa e erro e controlar o acesso de cada perfil.

## 2. Descrição

O login aceita CPF ou e-mail e senha. Contas administrativas exigem o código do aplicativo autenticador (TOTP). A sessão fica num cookie protegido e expira por inatividade. Falhas são contadas por conta e por rede; no limite, a conta é bloqueada temporariamente e a rede passa a responder a um CAPTCHA.

## 3. Atores

Cidadão; Administrador; Visitante (ao tentar áreas protegidas).

## 4. Pré-condições

Conta ativa e usuário não autenticado.

## 5. Fluxo principal

1. A pessoa abre `/entrar` e informa CPF ou e-mail e a senha.
2. O servidor compara a senha com o hash e confere bloqueios.
3. Cidadão: a sessão é criada e a pessoa vai para `/conta` (ou para a página que tentou abrir).
4. Administrador: vai para `/entrar/segundo-fator`, digita o código TOTP de 6 dígitos e entra em `/admin`.
5. "Sair" invalida a sessão no servidor e remove o cookie (RF006).

## 6. Fluxos alternativos

- **Credenciais inválidas:** mensagem genérica "CPF/e-mail ou senha incorretos." e contagem de falha.
- **5 falhas seguidas:** a conta é bloqueada por 15 minutos; o titular é avisado e o bloqueio é auditado.
- **10 falhas da mesma rede em 1 hora:** exige CAPTCHA dessa rede.
- **Conta pendente:** orienta a confirmar o e-mail e oferece reenvio.
- **Sessão expirada:** pede novo login; operações não concluídas, inclusive voto não confirmado, são descartadas.
- **Cidadão em área administrativa:** acesso negado (`/acesso-negado`) e tentativa auditada.
- **Administrador sem a permissão da página:** `/admin/acesso-negado`, auditado.

## 7. Regras de negócio

- Conta ativa e desbloqueada para entrar (RN03); tentativas limitadas (RN24).
- Sessão expira por inatividade (RN26): 30 minutos para cidadão, 15 para administrador; duração máxima de 12 horas.
- Segundo fator obrigatório para contas administrativas (RS006).
- Toda página, ação e rota confere sessão, perfil, papel e posse do recurso no servidor (RF009).

## 8. Validações

CPF ou e-mail e senha obrigatórios; código TOTP de 6 dígitos válido para o segredo cifrado da conta; resposta do CAPTCHA quando exigida.

## 9. Persistência no banco de dados

- `sessions`: token da sessão (só o hash), tipo, segundo fator confirmado, expiração.
- `auth_failures`: falhas por conta e por rede (hash do IP).
- `users`: `failed_login_count`, `locked_until`, `last_login_at`.
- `audit_log`: login, falhas, bloqueios, logout e acessos negados.

## 10. Critérios de aceitação

- Login correto cria a sessão; incorreto mostra a mensagem genérica.
- A 5ª falha bloqueia a conta por 15 minutos; a rede com muitas falhas passa a ver CAPTCHA.
- Administrador só entra após o segundo fator; cidadão não acessa `/admin`.

## Implementação

Telas `src/app/(site)/entrar/` · ações `loginAction`, `mfaAction`, `logoutAction` (`src/server/actions/auth.ts`) · serviços `login`, `verifySecondFactor` (`auth.service.ts`), `session.service.ts` · guardas `src/server/auth/current.ts` · testes `tests/integration/auth.test.ts`, `tests/e2e/admin.spec.ts`, `tests/e2e/public.spec.ts`.
