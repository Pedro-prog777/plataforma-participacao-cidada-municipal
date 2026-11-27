# Relatórios agregados e painel de monitoramento

**Requisitos:** RF048, RF049 · **Regras:** RN07, RN16, RN27, RN39

## 1. Objetivo

Dar à administração indicadores para acompanhar as consultas e prestar contas, sem expor dados pessoais nem resultados parciais.

## 2. Descrição

O **painel de monitoramento** mostra, por consulta em andamento, situação, participações e evolução diária, pendências, ocorrências (denúncias, alertas de integridade), tempo até o encerramento e tentativas recusadas por motivo — nunca contagem por alternativa. Atualiza-se a cada 5 minutos e destaca baixa participação. Os **relatórios** agregam consultas, participação, cadastros, propostas e tempo de tramitação por período, tema, região e situação, com exportação em CSV e PDF.

## 3. Atores

Administrador com papel de acompanhamento (painel) ou de relatórios.

## 4. Pré-condições

Administrador autenticado com segundo fator e a permissão correspondente (`consultas.acompanhar`, `relatorios.gerar`).

## 5. Fluxo principal

1. Em `/admin/monitoramento`, o administrador vê os indicadores (atualização automática a cada 5 minutos) e pode detalhar uma consulta.
2. Em `/admin/relatorios`, escolhe período, tema, região e situação; o sistema mostra gráficos com tabela.
3. Exporta em CSV ou PDF (`/api/admin/relatorio?formato=csv|pdf`); a exportação é auditada.

## 6. Fluxos alternativos

- **Grupo com menos de 10 pessoas:** aparece como "menos de 10".
- **Baixa participação, denúncia ou alerta:** a consulta é destacada, com atalho para a ação.
- **Sem permissão:** acesso negado e auditado.

## 7. Regras de negócio

- Nenhum perfil vê contagem por alternativa durante a votação (RN16).
- Relatórios só com agregados; supressão de grupos pequenos (parâmetro `relatorio.supressao_minima`, padrão 10) (RN27).
- Nenhuma ação do painel altera votos (RN39).

## 8. Validações

Datas e filtros conferidos no servidor; formato de exportação `csv` ou `pdf`; CSV protegido contra fórmulas.

## 9. Persistência no banco de dados

Somente leitura e agregação de `consultations`, `participations`, `users`, `citizen_proposals`, `incidents`, `audit_log`, com consultas agrupadas (sem uma consulta por linha); a geração e a exportação gravam em `audit_log`. A conta de banco `ppcm_relatorios` lê apenas a view `vw_consultas_publicas` e as tabelas de referência (DT-34).

## 10. Critérios de aceitação

- Nenhum relatório ou exportação contém dado pessoal nem voto individual.
- Grupos com menos de 10 pessoas nunca aparecem com o número exato.

## Implementação

Telas `src/app/admin/monitoramento/`, `src/app/admin/relatorios/` · serviços `src/server/modules/admin/monitoring.service.ts`, `generateReport` · rota `src/app/api/admin/relatorio/route.ts` · testes `tests/integration/performance.test.ts`, `tests/integration/voting.test.ts` (sigilo no painel e no relatório).
