# Integridade, apuração, resultado e dados abertos

**Requisitos:** RF042, RF043, RF044, RF045, RF059 · **Regras:** RN16–RN19, RN29, RN34, RN41 · **Classes:** `Apuracao`, `QuorumDeReferencia`, `Consulta`

## 1. Objetivo

Contar os votos de forma automática, determinística e conferível, e publicar o resultado só depois de verificado.

## 2. Descrição

No encerramento, o sistema verifica a integridade da votação e apura: votos por alternativa, válidos, abstenções, percentuais sobre os válidos, participação sobre os elegíveis estimados e quórum de referência. O resultado preliminar é gravado com hash e aguarda a conferência. Quem tem o papel de publicação de resultados publica o resultado final com uma nota oficial; depois, só retificação justificada. Resultados e encaminhamentos ficam em formato aberto.

## 3. Atores

Sistema (integridade e apuração); Administrador com papel "publicação de resultados"; Visitante (resultado público e dados abertos).

## 4. Pré-condições

Consulta Encerrada (apuração); Apurada (publicação); Finalizada (retificação).

## 5. Fluxo principal

1. A rotina encerra a consulta no horário e reembaralha os votos (sigilo contra correlação, DT-31).
2. **Integridade (RF059):** votos iguais a participações; votos só em alternativas válidas; nenhuma participação duplicada ou fora do período; soma por alternativa igual ao total; percentuais somando 100% (tolerância 0,01); nova apuração com o mesmo resultado e hash.
3. **Apuração (RF042):** a classe `Apuracao` calcula o resultado; o quórum adotado (`SemQuorum`, `QuorumAbsoluto` ou `QuorumPercentual`) informa as participações necessárias e se foi atingido; maioria simples dos válidos define a vencedora. Grava-se o resultado preliminar com o hash e a consulta passa a "Apurada".
4. **Publicação (RF043):** em `/admin/consultas/[id]/resultado`, o responsável revisa e publica com nota oficial (mínimo 20 caracteres) sobre a natureza consultiva e os próximos passos; a integridade é verificada de novo; a consulta passa a "Finalizada" e quem votou é avisado.
5. **Resultado público (RF044):** `/consultas/[slug]/resultado` com gráfico e tabela, metodologia, hash e o aviso de que não representa estatisticamente toda a população.
6. **Dados abertos (RF045):** `/dados-abertos` e `/api/dados-abertos/{resultados|encaminhamentos}?formato=csv|json|pdf`, com filtro por consulta e período.

## 6. Fluxos alternativos

- **Falha de integridade:** apuração ou publicação bloqueada e incidente de severidade alta aberto (RF060).
- **Sem votos, abaixo do quórum ou empate:** registrado, sem vencedora.
- **Recontagem:** antes da publicação, comparada à anterior; divergência abre incidente.
- **Retificação:** com o erro comprovado e justificativa; o resultado original continua visível.
- **Resultado não publicado:** a página pública mostra a situação, sem números por alternativa.

## 7. Regras de negócio

- Nenhuma contagem por alternativa antes da publicação, para nenhum perfil (RN16).
- Percentuais com 2 casas pelo método do maior resto, somando exatamente 100% (RN19).
- Quórum de referência é descritivo e não muda a natureza consultiva (RN17, RN34).
- Resultado publicado é imutável; só muda por retificação (RN29).
- Publicar o preliminar antes da conferência depende de decisão do cliente (parâmetro `resultado.publicar_preliminar`, desligado).

## 8. Validações

Situação da consulta conferida pela entidade `Consulta` (`garantirApuracaoPermitida`, `homologarResultado`, `garantirResultadoPublicado`); nota oficial obrigatória; papel de publicação na consulta; formato do arquivo de dados abertos.

## 9. Persistência no banco de dados

`results` (preliminar, final e retificação, com hash do resultado e da base — somente acréscimo), `integrity_checks` (relatório de cada verificação), `incidents`, `consultation_events`, `consultations` (situação), `audit_log`. A apuração lê `votes` e `participations` sem nunca ligar um ao outro.

## 10. Critérios de aceitação

- O mesmo conjunto de votos gera sempre o mesmo resultado e hash.
- Com falha de integridade, nada é publicado.
- Os arquivos de dados abertos não têm dados pessoais nem votos individuais.

## Implementação

Serviços `src/server/modules/results/results.service.ts`, `tally.ts`, `open-data.service.ts` · domínio `src/server/domain/services/apuracao.ts`, `src/server/domain/strategies/quorum-de-referencia.ts` · rotina `scheduler.service.ts` · telas `src/app/(site)/consultas/[slug]/resultado/`, `src/app/admin/consultas/[id]/resultado/`, `src/app/(site)/dados-abertos/` · testes `tests/unit/rules.test.ts`, `tests/unit/dominio.test.ts`, `tests/integration/voting.test.ts`, `tests/integration/lifecycle.test.ts`, `tests/integration/participation.test.ts`.
