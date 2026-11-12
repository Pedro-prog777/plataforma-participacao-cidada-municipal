# Plano do quadro Trello — PPCM

> **Situação real (12/11/2026):** não há integração com o Trello no ambiente de desenvolvimento e não foi possível localizar nem criar um quadro. **Nenhum quadro foi criado e não existe link a informar.** Este plano e o arquivo `docs/trello/TRELLO_IMPORT.csv` deixam tudo pronto para a montagem manual.
>
> **Link do quadro:** _a preencher pela equipe depois de criar o quadro_ (colocar também no `README.md`, seção “Acompanhamento do Desenvolvimento”).
>
> **Repositório:** <https://github.com/Pedro-prog777/plataforma-participacao-cidada-municipal>

**Nome do quadro:** PPCM — Desenvolvimento da Plataforma de Participação Cidadã Municipal

## Listas (nesta ordem)
1. Planejamento · 2. Análise de requisitos · 3. Protótipos · 4. Backlog · 5. Em desenvolvimento · 6. Revisão de código · 7. Segurança · 8. Testes · 9. Concluído · 10. Pendências de validação

## Como montar
1. Crie o quadro e as 10 listas.
2. Importe `docs/trello/TRELLO_IMPORT.csv` (separador `;`, UTF-8) com um Power-Up de importação de CSV (ex.: “Import to Trello”), mapeando: `Lista` → lista, `Cartão` → título, `Descrição` → descrição, `Etiquetas` → etiqueta, `Checklist` → itens separados por ` | `. Sem Power-Up, crie os 29 cartões copiando do CSV.
3. Anexe as capturas reais de `screenshots/` aos cartões de protótipo:
   - **Protótipos — Área pública:** `screenshots/area-publica/*.png`
   - **Protótipos — Área do cidadão:** `screenshots/cidadao/*.png`
   - **Protótipos — Administração:** `screenshots/administrador/*.png`
   - celular: `screenshots/celular/*.png`
4. Acrescente nos cartões os links de commits e arquivos do repositório no GitHub.
5. Deixe o quadro **público** (ou convide o professor) e copie o link para o `README.md`.

## Cartões preparados (29)

| Lista | Cartões |
|---|---|
| Análise de requisitos | Análise do documento de requisitos; Arquitetura e decisões técnicas |
| Protótipos | Área pública; Área do cidadão; Administração (telas implementadas no sistema, com capturas) |
| Concluído | Módulos 1 a 11 (cada um com requisitos e checklist) |
| Segurança | Revisão OWASP Top 10 |
| Testes | Unitários e integração; E2E e acessibilidade |
| Concluído | Publicação no GitHub (repositório público) |
| Pendências de validação | 9 cartões, um por decisão do cliente (*) |

## Ajustes recomendados ao importar (para refletir o estado real)
- Mover para **Backlog**: medição de desempenho/disponibilidade (RNF09, RNF10), inspeção com leitores de tela (RNF01/RNF11), consentimento parental (RS010), integração oficial gov.br, provedor de SMS, RIPD (RNF06).
- Os módulos em “Concluído” estão implementados e testados conforme `docs/STATUS_DO_DESENVOLVIMENTO.md`; os recursos condicionados (RF064, RF067, RF068) ficam desligados até a validação.
- Responsáveis: João Pedro e Flávia Marina (atribuir conforme a divisão da equipe).
