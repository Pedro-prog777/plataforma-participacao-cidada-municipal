# Verificação de identidade e domicílio

**Requisitos:** RF004 · **Regras:** RN01, RN02, RN04, RN27, RN31

## 1. Objetivo

Comprovar que a pessoa é titular do CPF cadastrado e, quando a consulta exigir, que mora no município — condição para votar e enviar propostas.

## 2. Descrição

Há dois caminhos: o provedor de identidade (gov.br, nível prata ou superior) — **simulado** nesta versão acadêmica, identificado como demonstração — ou o envio de documentos, analisados por um administrador com a permissão de verificação.

## 3. Atores

Cidadão; Administrador (papel de verificação de identidade); Sistema.

## 4. Pré-condições

Conta ativa, "Não verificado" ou "Verificação recusada".

## 5. Fluxo principal

1. Em `/conta/verificacao`, o cidadão escolhe o provedor de identidade.
2. É levado ao provedor (simulado em `/demo/provedor-identidade`) e volta com o CPF e o nível da conta.
3. O sistema confere se o CPF é o mesmo do cadastro e se o nível é prata ou superior.
4. A conta fica "Verificada", com método e data; o domicílio também é comprovado quando o município informado pelo provedor é o da plataforma e o endereço do cadastro está num bairro do município.

**Por documentos:** envia os arquivos (até 5 MB cada); a verificação fica "Em análise" até um administrador aprovar ou recusar com motivo em `/admin/verificacoes`.

## 6. Fluxos alternativos

- **CPF divergente:** recusa registrada na auditoria.
- **Nível bronze:** recusa ("Nível de conta inferior a prata").
- **Documento recusado:** a pessoa é avisada do motivo e pode tentar de novo.
- **Arquivo inválido:** tipo real, tamanho e antivírus conferidos antes de guardar.

## 7. Regras de negócio

- Só identidade verificada vota e envia propostas (RN04).
- Documentos de identidade só são vistos pelo titular e por quem tem a permissão de análise (RN27).
- O provedor oficial do gov.br exige credenciamento; sem ele, só o simulado (restrito ao modo demonstração).

## 8. Validações

Estado (`state`) do fluxo do provedor conferido; CPF do provedor igual ao do cadastro (por HMAC; o CPF fictício aceito no cadastro também vale quando o provedor devolve o mesmo — DT-36); nível mínimo; arquivos com formato real permitido e até 5 MB.

## 9. Persistência no banco de dados

`identity_verifications` (método, situação, nível, motivo), `attachments` (documentos com hash SHA-256), `users` (`verification_level`, `verified_at`, `domicile_verified_at`), `notifications`, `audit_log`.

## 10. Critérios de aceitação

- Provedor com CPF igual e nível prata marca a conta como verificada.
- CPF divergente ou nível insuficiente são recusados e auditados.
- Documentos ficam em análise e só o analista decide.

## Implementação

Tela `src/app/(site)/conta/verificacao/page.tsx` · ações `startIdentityProviderAction`, `simulatedProviderReturnAction`, `submitDocumentsAction` · serviço `src/server/modules/identity/identity.service.ts` · provedores `IdentityProvider` (`SimulatedIdentityProvider`, `OfficialGovBrProvider`) em `src/server/lib/identity-provider.ts` · testes `tests/integration/administration.test.ts`.
