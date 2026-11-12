# Plano do quadro Trello — PPCM

> **Link do quadro:** <https://trello.com/invite/b/6af5eab7a85ea3fed1422ceb/ATTI524f049c496b020899b71b8eee407bf74ACB1531/plataforma-de-participacao-cidada-municipal-ppcm>
>
> O quadro foi criado pela equipe; o link é de convite e pede login no Trello.
>
> **Repositório:** <https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal>

**Situação em 12/11/2026:** a organização do quadro está definida em `docs/trello/quadro.json` e é aplicada pelo comando `npm run trello:sync`. O comando precisa de uma chave e de um token do Trello da própria equipe; **enquanto ele não for executado com essas credenciais, os cartões abaixo ainda não estão no quadro.**

## Como o quadro é organizado

| # | Lista | O que contém |
|---|---|---|
| 1 | Planejamento e documentação | Sobre o projeto, arquitetura e decisões, organização das pastas — com links para os documentos no GitHub |
| 2 | Análise de requisitos | Documento de Requisitos v6, mapeamento requisito → tela → código → teste, itens que dependem do cliente |
| 3 | Protótipos (telas) | Quatro cartões (área pública, cidadão, administração, celular) com as 57 capturas reais anexadas |
| 4 | Backlog | O que ainda não foi feito: gov.br e SMS oficiais, desempenho, leitores de tela, Docker e backup, teste de intrusão |
| 5 | Em desenvolvimento | Vazia (nada em andamento) |
| 6 | Revisão de código | Vazia |
| 7 | Segurança | Sigilo e unicidade do voto; revisão OWASP Top 10 |
| 8 | Testes | Unitários/integração/segurança, navegador e acessibilidade, integração contínua |
| 9 | Concluído | Módulos 1 a 11 (cada um com requisitos e checklist) e a publicação no GitHub |
| 10 | Pendências de validação | Nove decisões que o documento marca com (\*) e dependem do cliente |

São 41 cartões. Cada um tem descrição, etiqueta, checklist (marcada só no que está realmente feito) e links para os arquivos correspondentes no GitHub. Não houve protótipo separado em ferramenta de design: os cartões de protótipo trazem as telas reais do sistema.

## Como aplicar no quadro (automático)

1. Entre no Trello com a conta que é membro do quadro e abra <https://trello.com/power-ups/admin>.
2. Crie um Power-Up (qualquer nome, por exemplo "PPCM sync"), abra a aba **API Key** e gere a chave.
3. Na mesma página, clique no link **Token**, autorize e copie o token.
4. Na raiz do projeto, crie o arquivo `.env.trello` (ele é ignorado pelo Git) com duas linhas:

   ```text
   TRELLO_KEY=sua_chave
   TRELLO_TOKEN=seu_token
   ```

5. Confira o que será criado, sem tocar no quadro: `npm run trello:sync -- --dry-run`
6. Aplique: `npm run trello:sync`
7. Depois de usar, revogue o token em <https://trello.com/u/me/account> (seção de aplicativos) e apague o `.env.trello`.

O comando só **acrescenta**: não apaga, não arquiva e não altera listas ou cartões que já existam no quadro. Pode ser executado mais de uma vez; o que já foi criado é reaproveitado pelo nome.

## Como aplicar manualmente

Sem a chave, importe `docs/trello/TRELLO_IMPORT.csv` (separador `;`, UTF-8) com um Power-Up de importação de CSV, mapeando `Lista`, `Cartão`, `Descrição`, `Etiquetas` e `Checklist` (itens separados por ` | `), e anexe as imagens de `screenshots/area-publica`, `screenshots/cidadao`, `screenshots/administrador` e `screenshots/celular` aos cartões de protótipo.

## Manutenção

A situação real de cada requisito fica em `docs/STATUS_DO_DESENVOLVIMENTO.md`. Ao concluir um item do Backlog, mova o cartão para "Concluído" no quadro. Responsáveis: João Pedro e Flávia Marina.
