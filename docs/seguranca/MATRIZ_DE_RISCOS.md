# Matriz de avaliação de risco — PPCM

## 1. Matriz original (Documento de Requisitos v6, seção 6)

| Probabilidade \ Severidade | Catastrófico (1) | Crítico (2) | Marginal (3) | Insignificante (4) |
|---|---|---|---|---|
| Frequente (A) | | | | |
| Provável (B) | | | RS011 | |
| Ocasional (C) | | RS004, RS010 | RS007 | |
| Remoto (D) | RS002, RS003 | RS005, RS006, RS012 | | |
| Improvável (E) | RS001 | RS013 | RS008, RS009 | |
| Eliminado (F) | | | | |

## 2. Tratamento implementado

| Risco | Classe | Mitigações implementadas | Evidência (teste) | Risco residual |
|---|---|---|---|---|
| RS001 — voto duplicado | E1 | Índice único (consulta, cidadão) no banco; regra de negócio; tela; HMAC do CPF mantido após desativação | `voting.test.ts` (sequencial, 5 simultâneos, inserção direta) | Concorrência multi-processo exercitada só no CI com PostgreSQL |
| RS002 — descobrir o voto | D1 | Separação estrutural participação/voto; sem hora; código sem alternativa; reembaralhamento da chave de todos os votos da consulta numa única instrução, sem ligação por `xmin` (DT-31), e CLUSTER aleatório; relatórios com supressão <10; auditoria e logs sem alternativa | `voting.test.ts` › Sigilo (painel, relatório, auditoria, avisos, e-mail, exportação, histórico, banco, `xmin`) | Até 15 min entre o voto e o reembaralhamento; WAL/backups anteriores ao CLUSTER preservam ordem física (DT-05); restringir acesso |
| RS003 — alterar votos/resultados | D1 | Gatilhos somente acréscimo (UPDATE/DELETE/TRUNCATE); moderação não toca votos; resultado só por retificação visível; hash da base | `voting.test.ts`, `database.test.ts` | Superusuário pode desligar gatilhos — detectado por hash da base e da auditoria |
| RS004 — contas falsas | C2 | Verificação de identidade; código antes do voto; incidente de cadastro suspeito por CPF divergente; limite de cadastros por rede | `voting.test.ts` › código; `administration.test.ts` › Verificação de identidade | Provedor gov.br simulado nesta versão |
| RS005 — dados pessoais expostos | D2 | CPF mascarado; exportações agregadas; filtro de campos na auditoria; nome de exibição abreviado em comentários | `voting.test.ts`, `participation.test.ts` | RIPD ainda não elaborado (RNF06) |
| RS006 — acesso indevido / acúmulo | D2 | RBAC no servidor; papéis por consulta; segregação verificada na designação e na aprovação; TOTP obrigatório | `lifecycle.test.ts`, `auth.test.ts`, `e2e/admin.spec.ts` | — |
| RS007 — força bruta / sequestro | C3 | Bloqueio 15 min após 5 falhas; CAPTCHA por IP; link de 30 min uso único; inatividade; sessão no servidor; HSTS | `auth.test.ts` | Limites em memória por processo (DT-13) |
| RS008 — parciais | E3 | Nenhuma tela/rota mostra contagem por alternativa antes da apuração | `voting.test.ts`, `e2e/public.spec.ts` | — |
| RS009 — voto fora do período | E3 | Horário do servidor dentro da transação com a consulta bloqueada (FOR SHARE); recusa auditada | `voting.test.ts` | — |
| RS010 — crianças e adolescentes | C2 | Critério etário justificado; modalidade e salvaguardas obrigatórias | `unit/rules.test.ts` | Consentimento parental e análise jurídica pendentes (*) |
| RS011 — conteúdo ofensivo | B3 | Denúncia com protocolo; ocultação preventiva; moderação justificada com revisão por outro moderador | `participation.test.ts` | Política de uso a validar (*) |
| RS012 — arquivo com vírus | D2 | Tipo real, tamanho, antivírus, SHA-256, armazenamento fora da pasta pública, CSP sandbox no download | `participation.test.ts`, `unit/rules.test.ts` | Sem ClamAV a verificação é básica (DT-11) |
| RS013 — auditoria adulterada | E2 | Somente acréscimo, encadeamento SHA-256, verificação com incidente automático | `database.test.ts`, `e2e/admin.spec.ts` | Backup diário depende da implantação |

## 3. Riscos de projeto identificados durante o desenvolvimento

| Risco | Probabilidade | Impacto | Tratamento |
|---|---|---|---|
| Pasta do projeto sincronizada pelo OneDrive bloqueia arquivos de build (`EBUSY`) e pode corromper o PGlite | Alta | Médio | Recomendar pasta fora do OneDrive; fechamento gracioso do banco; `npm run db:reset` |
| Requisitos (*) mudarem após validação | Média | Médio | Parâmetros configuráveis e recursos desligáveis (DT-14) |
| Integração gov.br indisponível | Alta | Médio | Adaptador simulado e verificação documental (DT-09) |
