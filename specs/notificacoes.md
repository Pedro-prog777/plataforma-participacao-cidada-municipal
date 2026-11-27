# Avisos por e-mail e na plataforma

**Requisitos:** RF052, RF053, RF054, RF055 · **Regras:** RN01, RN09–RN11, RN27, RN35, RN42 · **Classes:** `CanalDeNotificacao`, `CanalCentralDeAvisos`, `CanalEmail`, `TransporteDeEmail`

## 1. Objetivo

Manter o cidadão informado sobre consultas, resultados, propostas e a própria conta, respeitando as preferências.

## 2. Descrição

Cada aviso tem um tipo. Os opcionais (novas consultas, abertura, alterações, lembrete 48 h antes, resultados, encaminhamentos, respostas a propostas) seguem as preferências do cidadão por canal, tema e bairro; os obrigatórios (segurança da conta, comprovante, mudanças que afetam consultas em que votou, decisões de moderação) sempre chegam. Os canais são a central de avisos da plataforma e o e-mail; o e-mail vai para uma fila enviada pela rotina com até 3 tentativas.

## 3. Atores

Cidadão; Sistema.

## 4. Pré-condições

Conta não desativada.

## 5. Fluxo principal

1. Um evento (publicação, abertura, alteração, resultado, resposta a proposta, comprovante) chama `notifyUser`.
2. O sistema monta o aviso e o destinatário (com a preferência daquele tipo).
3. Cada canal decide se entrega e entrega do seu jeito: a central grava o aviso; o e-mail entra na fila com o link e, nos opcionais, o link de descadastro.
4. A rotina envia a fila pelo transporte configurado (SMTP real ou simulado).
5. O cidadão vê os avisos em `/conta/avisos` e ajusta as preferências em `/conta/notificacoes`.

## 6. Fluxos alternativos

- **Descadastro pelo e-mail:** o link assinado desliga aquele tipo de aviso por e-mail, sem login.
- **Falha de envio:** até 3 tentativas; o aviso continua na central.
- **Sem SMTP configurado:** nenhuma mensagem sai de verdade; a fila marca "simulado" (e, no modo demonstração, mostra em `/demo/caixa-de-email`).
- **Consulta suspensa no horário do lembrete:** o lembrete fica para depois da retomada.

## 7. Regras de negócio

- Avisos obrigatórios não podem ser desligados (RF052).
- Abertura avisa só quem se enquadra no público-alvo (RN35) — mesma regra da elegibilidade.
- Lembrete só para quem ainda não participou; aviso de resultado para quem votou.
- Nenhum aviso contém a alternativa votada (RN07).

## 8. Validações

Tipo de aviso existente; preferências salvas só para tipos opcionais; link de descadastro assinado e conferido.

## 9. Persistência no banco de dados

`notifications` (central de avisos), `notification_preferences` (por tipo, temas e bairros), `email_outbox` (fila com situação, tentativas e último erro; índice `email_outbox_pending_idx`).

## 10. Critérios de aceitação

- Com o e-mail desligado para um tipo opcional, o aviso chega só na central; obrigatórios chegam pelos dois canais.
- O link de descadastro funciona sem login e só para aquele tipo.

## Implementação

Serviço `src/server/modules/notifications/notifications.service.ts` e `dispatch.ts` · canais e transportes `src/server/modules/notifications/canais.ts` · contratos `src/server/domain/interfaces/notificacao.ts` · telas `src/app/(site)/conta/avisos/`, `src/app/(site)/conta/notificacoes/`, `src/app/(site)/avisos/descadastrar/` · testes `tests/integration/administration.test.ts`, `tests/unit/dominio.test.ts`, `tests/integration/voting.test.ts` (sigilo nos avisos e e-mails).
