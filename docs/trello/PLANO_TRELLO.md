# Quadro Trello — PPCM

> **Quadro (público, qualquer pessoa pode ver):** <https://trello.com/b/AQX3bDST>
>
> **Repositório:** <https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal>

**Situação em 13/11/2026:** o quadro foi criado pela equipe e está público, com as três listas padrão do Trello e ainda sem cartões. A organização abaixo está pronta em `docs/trello/quadro.json` e é aplicada pelo comando `npm run trello:sync`, que precisa de uma chave e de um token do Trello da própria equipe. **Enquanto o comando não for executado com essas credenciais, os cartões ainda não estão no quadro.**

## Como o quadro fica organizado

| # | Lista | O que contém |
|---|---|---|
| 1 | Planejamento e documentação | Sobre o projeto, arquitetura e decisões, organização das pastas — com links para os documentos no GitHub |
| 2 | Análise de requisitos | Documento de Requisitos v6, mapeamento requisito → tela → código → teste, itens que dependem do cliente |
| 3 | Protótipos (telas) | Quatro cartões (área pública, cidadão, administração, celular) com as 57 capturas reais anexadas |
| 4 | A fazer | O que ainda não foi feito: gov.br e SMS oficiais, desempenho, leitores de tela, Docker e backup, teste de intrusão |
| 5 | Em andamento | Vazia (nada em andamento) |
| 6 | Revisão de código | Vazia |
| 7 | Segurança | Sigilo e unicidade do voto; revisão OWASP Top 10 |
| 8 | Testes | Unitários/integração/segurança, navegador e acessibilidade, integração contínua |
| 9 | Concluído | Módulos 1 a 11 (cada um com requisitos e checklist) e a publicação no GitHub |
| 10 | Pendências de validação | Nove decisões que o documento marca com (\*) e dependem do cliente |

São 41 cartões. Cada um tem descrição, etiqueta, checklist (marcada só no que está realmente feito) e links para os arquivos correspondentes no GitHub. As listas "A fazer", "Em andamento" e "Concluído", que já existem no quadro, são aproveitadas. Não houve protótipo separado em ferramenta de design: os cartões de protótipo trazem as telas reais do sistema.

## Passo a passo para montar o quadro

Tempo estimado: 10 minutos. Tudo é feito uma única vez.

### Etapa 1 — Criar a chave de API (no site do Trello)

1. Entre no Trello com a conta que criou o quadro.
2. Abra <https://trello.com/power-ups/admin>. Se aparecer um aviso sobre os termos de desenvolvedor, aceite.
3. Clique em **Novo** (ou "New") para criar um Power-Up e preencha:
   - **Nome:** `PPCM sync`
   - **Área de trabalho:** a área de trabalho onde está o quadro
   - **E-mail** e **Autor:** os seus
   - **URL do conector iframe:** deixe em branco
4. Clique em **Criar**.
5. No menu da esquerda do Power-Up, abra **Chave de API** e clique em **Gerar uma nova chave de API**.
6. Copie a **Chave de API** (32 letras e números). Não é o "Segredo".

### Etapa 2 — Guardar a chave no projeto

1. No VS Code, abra o arquivo `.env.trello`, que fica na pasta do projeto. Ele já existe, está vazio e **não vai para o GitHub**.
2. Cole a chave logo depois de `TRELLO_KEY=`, sem espaços e sem aspas, e salve (Ctrl+S).

### Etapa 3 — Gerar o token

1. No terminal do VS Code, execute:

   ```bash
   npm run trello:sync -- --autorizar
   ```

2. O navegador abre uma página do Trello. Confira que é a sua conta e clique em **Permitir**.
3. O Trello mostra um texto comprido: é o token. Copie tudo.
4. No `.env.trello`, cole depois de `TRELLO_TOKEN=` e salve.

O token vale por 1 dia e dá acesso de leitura e escrita aos seus quadros; por isso fica só no seu computador.

### Etapa 4 — Conferir e aplicar

```bash
npm run trello:sync -- --verificar   # confere a chave e o token e mostra o que já existe no quadro
npm run trello:sync -- --dry-run     # mostra tudo o que será criado, sem tocar no quadro
npm run trello:sync                  # cria listas, etiquetas, cartões, checklists, links e anexa as capturas
```

O último comando leva alguns minutos (são cerca de 600 chamadas ao Trello). Ao terminar, ele mostra quantos cartões criou e o endereço do quadro.

### Etapa 5 — Encerrar

1. Abra <https://trello.com/b/AQX3bDST> e confira as listas e os cartões.
2. Apague o conteúdo do `.env.trello` (ou o arquivo). O token expira sozinho em 1 dia; para revogar antes, use <https://trello.com/u/me/account>, na seção de aplicativos conectados.

### Se algo der errado

| Mensagem | O que fazer |
|---|---|
| `TRELLO_KEY não parece uma chave de API` | Foi colado outro valor (nome do Power-Up ou o "Segredo"). Copie a "Chave de API" de 32 caracteres. |
| `TRELLO_TOKEN está vazio` ou `parece incompleto` | Refaça a Etapa 3 e copie o texto inteiro. |
| `Trello respondeu 401` | Token vencido ou recusado: gere outro com `--autorizar`. |
| `Trello respondeu 404` | O token é de uma conta que não é membro do quadro. |
| O comando parou no meio | Execute de novo: ele continua de onde parou, sem duplicar nada. |

O comando não apaga nem arquiva nada e não altera cartões que já existam; ele cria o que falta e coloca as listas na ordem da tabela acima.

## Montagem manual (sem a chave)

Importe `docs/trello/TRELLO_IMPORT.csv` (separador `;`, UTF-8) com um Power-Up de importação de CSV, mapeando `Lista`, `Cartão`, `Descrição`, `Etiquetas` e `Checklist` (itens separados por ` | `), e anexe as imagens de `screenshots/area-publica`, `screenshots/cidadao`, `screenshots/administrador` e `screenshots/celular` aos cartões de protótipo.

## Manutenção

A situação real de cada requisito fica em `docs/STATUS_DO_DESENVOLVIMENTO.md`. Ao concluir um item de "A fazer", mova o cartão para "Concluído" no quadro. Responsáveis: João Pedro e Flávia Marina.
