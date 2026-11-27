# Trilha de auditoria encadeada

**Requisitos:** RF057, RF058 · **Regras:** RN07, RN21, RN28 · **Segurança:** RS013

## 1. Objetivo

Registrar, sem possibilidade de alteração, os atos relevantes do sistema e permitir consultá-los e verificar a sua integridade.

## 2. Descrição

Cada ato (logins e falhas, bloqueios, alterações cadastrais sem valores, atos sobre propostas e consultas, papéis, prazos, moderação, apurações, publicações, encaminhamentos, permissões, acessos negados) gera um registro com data e hora do servidor, autor, papel, ação, objeto, resultado e justificativa, encadeado ao anterior por hash. O gestor de acessos filtra, exporta em CSV e verifica o encadeamento.

## 3. Atores

Sistema (registro); Administrador com permissão `auditoria.consultar` (consulta).

## 4. Pré-condições

Registro: qualquer ato auditável. Consulta: administrador autenticado com a permissão.

## 5. Fluxo principal

1. O serviço chama `audit(...)` dentro da mesma transação do ato.
2. O sistema completa os campos, calcula o hash com o registro anterior e grava.
3. Em `/admin/auditoria`, o gestor filtra por período, usuário, ação, objeto e resultado (paginado).
4. Exporta em CSV (`/api/admin/auditoria`) e pede a verificação do encadeamento.

## 6. Fluxos alternativos

- **Falha ao auditar um ato administrativo:** o ato inteiro é desfeito (mesma transação).
- **Encadeamento quebrado:** a verificação indica o primeiro registro inconsistente e alerta (RF060).
- **Tentativa de alterar ou apagar:** o banco recusa (gatilho `ppcm_somente_acrescimo`; `TRUNCATE` também bloqueado).

## 7. Regras de negócio

- Somente acréscimo (RN28); votos aceitos não são auditados individualmente — só recusas, sem a alternativa (RN07).
- Nenhum dado pessoal ou senha nos detalhes (campos proibidos são filtrados).
- A consulta à trilha também é auditada.

## 8. Validações

Filtros conferidos no servidor; paginação limitada; campos sensíveis removidos dos detalhes antes de gravar.

## 9. Persistência no banco de dados

`audit_log` (hash do registro e do anterior), protegida pelos gatilhos `audit_log_somente_acrescimo` e `audit_log_sem_truncate` e pelos índices `audit_log_action_idx`, `audit_log_actor_idx`, `audit_log_object_idx`. A conta de banco `ppcm_auditoria` só lê a trilha (DT-34).

## 10. Critérios de aceitação

- UPDATE, DELETE e TRUNCATE na trilha são recusados pelo banco.
- Uma adulteração (com o gatilho contornado) é detectada pela verificação, que aponta o primeiro registro inválido.

## Implementação

Serviço `src/server/modules/audit/audit.service.ts` · tela `src/app/admin/auditoria/page.tsx` · rota `src/app/api/admin/auditoria/route.ts` · gatilhos `database/migrations/0001_gatilhos_somente_acrescimo.sql` · testes `tests/integration/database.test.ts`, `tests/integration/performance.test.ts`, `tests/e2e/admin.spec.ts`.
