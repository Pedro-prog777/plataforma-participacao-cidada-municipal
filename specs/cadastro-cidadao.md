# Cadastro de cidadão e confirmação de e-mail

**Requisitos:** RF001, RF002, RF003 · **Regras:** RN02, RN23, RN27, RN31 · **Decisões:** DT-33 (18 anos)

## 1. Objetivo

Permitir que uma pessoa maior de idade crie a conta de cidadão e confirme a posse do e-mail, para depois verificar a identidade e participar.

## 2. Descrição

A pessoa preenche nome, CPF, data de nascimento, e-mail, celular (opcional), endereço no município (ou o município onde mora, se mora fora), senha e o aceite dos Termos e da Política de Privacidade. O servidor valida tudo de uma vez, grava a conta como "Pendente de confirmação" e envia o link de confirmação. Ao abrir o link, a conta fica "Ativa".

## 3. Atores

Visitante (não autenticado); Sistema (envio do e-mail).

## 4. Pré-condições

- Pessoa sem sessão ativa.
- CPF e e-mail ainda sem conta de cidadão.

## 5. Fluxo principal

1. A pessoa abre `/cadastro` e preenche o formulário (CPF, data, celular e CEP com pontuação automática).
2. O servidor valida todos os campos (RF002) e devolve os erros por campo, se houver.
3. A senha é guardada como hash Argon2id; o CPF, como HMAC (para unicidade) e mascarado.
4. A conta é criada como "Pendente de confirmação" e "Não verificado", com a versão dos termos aceita.
5. O sistema envia o link de confirmação (token aleatório, uso único, válido por 24 horas) e mostra `/entrar?ok=cadastro`.
6. A pessoa abre `/confirmar-email?token=…`; a conta passa a "Ativa".

## 6. Fluxos alternativos

- **Dados inválidos:** todos os erros aparecem de uma vez, por campo; nada é gravado; os valores digitados são preservados (exceto senhas).
- **CPF fora do formato:** "Informe os 11 números do CPF, no formato XXX.XXX.XXX-XX." CPF fictício, sem dígito verificador válido, é aceito (RF001, DT-36).
- **CPF ou e-mail já cadastrado:** mensagem genérica, sem revelar qual dado existe, com oferta de recuperar o acesso (RF007).
- **Menor de 18 anos:** recusa no campo data de nascimento ("É preciso ter 18 anos completos para criar uma conta.").
- **Mora fora do município:** cadastro aceito informando o município; a elegibilidade é verificada por consulta.
- **Link expirado ou já usado:** "Link inválido, expirado ou já utilizado"; reenvio em `/reenviar-confirmacao` (até 3 por hora por e-mail, sem revelar se o e-mail existe).
- **Muitos cadastros da mesma rede:** mais de 10 por hora são recusados temporariamente.

## 7. Regras de negócio

- Uma conta de cidadão por CPF (RN02), inclusive após desativação (o HMAC é mantido).
- Política de senha (RN23): 8 a 128 caracteres, letras e números, diferente do CPF, da data de nascimento e do e-mail.
- Só maiores de 18 anos completos criam conta (`Cidadao.IDADE_MINIMA`, DT-33).
- CPF nunca exibido em páginas públicas (RN27).

## 8. Validações

Nome (3 a 150 caracteres); CPF com 11 números no formato XXX.XXX.XXX-XX, **aceito mesmo fictício**, sem cálculo dos dígitos verificadores (`isCpfFormat`, DT-36); data DD/MM/AAAA real, não futura, a partir de 1900; e-mail válido; celular com 10 ou 11 dígitos; CEP com 8 dígitos; logradouro, número e bairro obrigatórios (ou município, se mora fora); confirmação de senha igual; aceite obrigatório. Tudo validado no servidor com Zod, mesmo que a tela também valide.

## 9. Persistência no banco de dados

- `users`: conta (status `pendente` → `ativa`, `verification_level` `nao_verificado`, `cpf_hmac` único, `cpf_masked`, `password_hash`, `terms_version`).
- `tokens`: token de confirmação (só o hash), com validade e uso único.
- `email_outbox`: e-mail de confirmação na fila.
- `audit_log`: `email_confirmado`.

## 10. Critérios de aceitação

- Cadastro válido cria a conta pendente e o e-mail de confirmação; o link ativa a conta uma única vez.
- CPF fora do formato, campos vazios e menor de 18 anos são recusados sem gravar nada.
- CPF fictício (ex.: 111.111.111-11) é aceito, e o mesmo CPF não abre uma segunda conta.
- CPF ou e-mail repetido recebe mensagem que não revela a existência da conta.

## Implementação

Tela `src/app/(site)/cadastro/page.tsx` · ação `registerAction` (`src/server/actions/auth.ts`) · serviço `registerCitizen`, `confirmEmail`, `resendConfirmation` (`src/server/modules/auth/auth.service.ts`) · regra de idade `Cidadao` (`src/server/domain/entities/cidadao.ts`) · testes `tests/integration/auth.test.ts`, `tests/unit/masks.test.ts`, `tests/e2e/citizen.spec.ts`.
