# Comprovante de participação e verificação pública

**Requisitos:** RF014, RF038, RF041 · **Regras:** RN06, RN07, RN10

## 1. Objetivo

Dar ao cidadão uma prova de que participou — verificável por qualquer pessoa — sem revelar a alternativa escolhida.

## 2. Descrição

Ao confirmar o voto, o cidadão recebe um código aleatório de 12 caracteres (formato `XXXX-XXXX-XXXX`), disponível na tela, em PDF, por e-mail e no histórico "Minhas participações". Na página pública `/comprovante`, qualquer pessoa informa o código e vê a consulta, a data e a situação.

## 3. Atores

Cidadão (titular); Visitante (verificação pública).

## 4. Pré-condições

Voto registrado (o comprovante só é devolvido depois do COMMIT da transação do voto).

## 5. Fluxo principal

1. Após o voto, `/conta/participacoes/[id]?novo=1` mostra "Seu voto foi registrado" e o código.
2. O cidadão pode baixar o PDF (`/api/conta/comprovante/[id]`, só o titular).
3. O comprovante entra no histórico (`/conta/participacoes`), com data e situação — nunca a alternativa.
4. Em `/comprovante`, qualquer pessoa informa o código e vê: consulta, data e situação ("Registrado", "Contabilizado" ou "Consulta cancelada").

## 6. Fluxos alternativos

- **Código inexistente ou com tamanho errado:** "Código não encontrado. Confira os 12 caracteres do comprovante."
- **Mais de 10 verificações por minuto da mesma rede:** exige CAPTCHA.
- **Falha no envio do e-mail:** o comprovante continua no histórico (RF038).
- **Consulta cancelada:** a situação informa que os votos não foram contados.
- **Comprovante de outra pessoa:** `/conta/participacoes/[id]` e o PDF respondem "não encontrado".

## 7. Regras de negócio

- O comprovante prova a participação, não a escolha (RN07): o código fica só na participação, nunca junto ao voto.
- O voto é irretratável (RN06).

## 8. Validações

Código normalizado (sem hífens e maiúsculas/minúsculas) com exatamente 12 caracteres; identificador da participação no formato UUID; acesso ao PDF só pelo titular.

## 9. Persistência no banco de dados

`participations.receipt_hash` (SHA-256, índice único, usado na verificação pública) e `receipt_enc` (código cifrado com AES-256-GCM, mostrado só ao titular); `notifications` e `email_outbox` (aviso do comprovante).

## 10. Critérios de aceitação

- O código aparece só depois de o voto estar gravado.
- A verificação pública confirma participação e situação sem mostrar a alternativa nem o eleitor.
- Ninguém além do titular vê o próprio histórico ou baixa o PDF.

## Implementação

Telas `src/app/(site)/conta/participacoes/`, `src/app/(site)/comprovante/page.tsx` · ação `verifyReceiptAction` · serviço `verifyReceipt`, `myParticipations`, `myParticipation` (`voting.service.ts`) · rota `src/app/api/conta/comprovante/[id]/route.ts` · testes `tests/integration/voting.test.ts`, `tests/e2e/citizen.spec.ts`.
