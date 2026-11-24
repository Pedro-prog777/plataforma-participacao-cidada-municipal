# Fluxos de utilização (User Flow) — PPCM

Mapeamento dos caminhos que cada perfil percorre na Plataforma de Participação Cidadã Municipal, levantado
**no código** (`src/app`, `src/server/actions`, `src/server/modules`) e conferido no navegador em 24/11/2026
com o build de produção e os dados fictícios de demonstração (568 páginas visitadas por 7 perfis — ver
`docs/testes/RELATORIO_DE_TESTES.md`). Os identificadores (RFxxx, RNxx) são os do Documento de Requisitos v6.

Convenções dos diagramas: retângulo arredondado = início/fim; retângulo = tela ou ação; losango = decisão;
🔒 = exige autenticação; 🔐 = exige segundo fator (conta administrativa); setas tracejadas = caminho alternativo
ou de erro. Os caminhos de URL são os reais.

## Perfis e permissões

| Perfil | Como entra | O que pode | O que não pode |
|---|---|---|---|
| Visitante | sem login | portal público: consultas, detalhes, histórico, resultados publicados, encaminhamentos, propostas publicadas, indicadores, dados abertos, verificação de comprovante, páginas institucionais | votar, enviar propostas, acessar `/conta` ou `/admin` (redireciona para `/entrar?proximo=…`) |
| Cidadão | CPF ou e-mail + senha (`/entrar`) | perfil, verificação de identidade, votar (se elegível), comprovantes, propostas, avisos, preferências, cópia dos dados, desativação | acessar `/admin` (vai para `/acesso-negado`, tentativa auditada); ver a opção em que votou |
| Administrador | e-mail + senha + código TOTP (`/entrar/segundo-fator`) | o que os papéis permitem — gestor de acessos, elaborador, revisor, aprovador, autorizador de prazo, responsável, divulgação, acompanhamento, publicação de resultados, encaminhamentos, análise de propostas, moderação, atendimento | votar (RN22); aprovar consulta que elaborou, editou ou revisou (RN20, RN36); ver contagem por alternativa durante a votação (RN16); alterar votos (RN39) |
| Sistema | rotina a cada minuto (`scheduler.service.ts`) | abrir e encerrar consultas no horário, verificar integridade, apurar, lembretes de 48 h, encerrar propostas sem ajuste | — |

Contas fictícias: senha `Demo@2026`; cidadãos `maria@exemplo.com` (verificada), `joao@exemplo.com` (não verificado),
`carla@exemplo.com`; administradores `gestor@`, `elaboradora@`, `revisor@`, `aprovadora@`, `autorizador@`,
`responsavel@`, `analista@prefeitura.exemplo` (códigos TOTP em `/demo`).

---

## 1. Fluxo geral do sistema

```mermaid
flowchart TD
    I(["Acessa a plataforma"]) --> H["Início /"]
    H --> PUB{"Quer só consultar?"}
    PUB -- sim --> V["Portal público<br/>consultas, resultados, encaminhamentos,<br/>dados abertos, comprovante"]
    V --> FV(["Fim — visitante"])
    PUB -- não --> TEM{"Tem conta?"}
    TEM -- não --> CAD["Criar conta /cadastro"] --> CONF["Confirmar e-mail"] --> LOGIN
    TEM -- sim --> LOGIN["Entrar /entrar"]
    LOGIN --> TIPO{"Tipo de conta"}
    TIPO -- cidadão --> CID["🔒 Minha conta /conta"]
    TIPO -- administrativa --> MFA["🔐 Segundo fator<br/>/entrar/segundo-fator"] --> ADM["🔐 Painel /admin"]
    CID --> ACID["Verificar identidade · votar · propostas · avisos · meus dados"]
    ADM --> AADM["Ações conforme papéis e permissões"]
    ACID --> SAIR(["Sair → /entrar?ok=saiu"])
    AADM --> SAIR
    SYS(["Sistema — a cada minuto"]) -.-> AUTO["Abre/encerra consultas · integridade · apuração · lembretes"]
    AUTO -.-> V
```

## 2. Fluxo do visitante (portal público, sem autenticação)

```mermaid
flowchart TD
    I(["Visitante acessa /"]) --> H["Início: consultas abertas, resultados recentes, indicadores"]
    H --> L["Consultas /consultas"]
    L --> F["Busca e filtros<br/>palavras · situação · tema · região · período"]
    F --> R{"Encontrou?"}
    R -- não --> NR["Nenhuma consulta encontrada<br/>remover filtros / receber avisos"] -.-> F
    R -- sim --> D["Detalhes /consultas/slug<br/>problema, pergunta, alternativas, público-alvo,<br/>prazos, documentos, unidade responsável"]
    D --> DOC["Baixar anexo /api/anexos/id"]
    D --> HIST["Histórico /consultas/slug/historico"]
    D --> P{"Situação da consulta"}
    P -- aberta --> ENT["“Entre para participar” → /entrar?proximo=…"]
    P -- suspensa/cancelada --> AV["Aviso com justificativa; voto desabilitado"]
    P -- finalizada --> RES["Resultado /consultas/slug/resultado<br/>gráfico + tabela, metodologia, hash, nota oficial"]
    P -- encerrada/apurada --> SEMN["Sem números por alternativa até a publicação RN16"]
    RES --> ENC["Encaminhamentos da consulta"]
    H --> ARQ["Consultas anteriores /consultas/encerradas<br/>filtro por ano, tema, região"]
    H --> RS["Resultados /resultados"]
    H --> EN["Encaminhamentos /encaminhamentos"]
    H --> TR["Transparência /transparencia · Indicadores /indicadores"]
    H --> DA["Dados abertos /dados-abertos<br/>CSV e JSON sem dados pessoais"]
    H --> CO["Verificar comprovante /comprovante"]
    CO --> CV{"Código de 12 caracteres existe?"}
    CV -- sim --> OK["Consulta, data e situação<br/>Registrado / Contabilizado / Consulta cancelada<br/>sem a alternativa"]
    CV -- não --> ERR["“Código não encontrado…”"] -.-> CO
    CO -. mais de 10 por minuto do mesmo IP .-> CAP["Pede CAPTCHA"]
    H --> CF["Como funciona /como-funciona"]
    H --> AC["Acessibilidade /acessibilidade<br/>espaçamento ampliado, tamanho do texto, atalhos Alt+1…5"]
    H --> PR["Propostas publicadas /propostas"]
    H --> INS["Privacidade · Termos · A Prefeitura · Requisitos"]
    L -. URL inexistente .-> N404["Página não encontrada 404"]
    OK --> FIM(["Fim"])
    RES --> FIM
```

## 3. Fluxo completo do cidadão

```mermaid
flowchart TD
    I(["Pessoa sem conta"]) --> C["Cadastro /cadastro<br/>nome, CPF, nascimento, e-mail, celular opcional,<br/>endereço, senha, aceite dos termos"]
    C --> V{"Validação no servidor RF002"}
    V -- erro --> E1["Todos os erros por campo; dados digitados preservados;<br/>senhas nunca voltam"] -.-> C
    V -- CPF ou e-mail já usado --> E2["Mensagem genérica + oferta de recuperar acesso<br/>sem revelar a conta"] -.-> REC
    V -- mais de 10 cadastros/h da mesma rede --> E3["Tente em uma hora"] -.-> C
    V -- ok --> PEN["Conta Pendente → /entrar?ok=cadastro<br/>e-mail com link de 24 h"]
    PEN --> LNK{"Link válido?"}
    LNK -- não/expirado --> RE["Reenviar /reenviar-confirmacao<br/>até 3 por hora"] -.-> LNK
    LNK -- sim --> ATV["Conta Ativa → /entrar?ok=email_confirmado"]
    ATV --> LOGIN["🔒 Entrar"] --> CONTA["Meu perfil /conta<br/>CPF mascarado, situação, resumo de elegibilidade"]
    CONTA --> VER["Verificação /conta/verificacao"]
    VER --> VM{"Método"}
    VM -- provedor de identidade simulado --> VOK["Verificada"] 
    VM -- documentos até 5 MB --> VAN["Em análise → analista aprova ou recusa"]
    VAN --> VOK
    VAN -. recusa motivada .-> VER
    CONTA --> CONS["Consultas /consultas<br/>filtros “ainda não participei” e “posso participar”"]
    CONS --> DET["Detalhe da consulta"] --> EL{"Elegibilidade RF036, na ordem"}
    EL -- conta inativa/bloqueada --> X1["“Sua conta não está ativa” → Meu perfil"]
    EL -- identidade não verificada --> X2["“É preciso verificar sua identidade” → /conta/verificacao"]
    EL -- fora do público-alvo --> X3["Motivo em linguagem simples"]
    EL -- fora do período/suspensa --> X4["“A consulta não está aberta…”"]
    EL -- já participou --> X5["“Você já participou em …” + comprovante"]
    EL -- elegível --> VOTO[["Fluxo de votação — diagrama 4"]]
    VOTO --> COMP["Comprovante /conta/participacoes/id + PDF + e-mail"]
    CONTA --> PART["Minhas participações<br/>data, comprovante, situação — nunca a opção"]
    CONTA --> PROP["Nova proposta /conta/propostas/nova"]
    PROP --> PV{"Verificado e menos de 3 em análise?"}
    PV -- não --> PX["Envio bloqueado com orientação"]
    PV -- sim --> PR["Protocolo PROP-AAAA-XXXXXX · estado Recebida"]
    PR --> ACP["Acompanhar /conta/propostas/id<br/>Recebida → Em análise → Ajuste solicitado → Respondida → Publicada → Encerrada"]
    ACP -. ajuste solicitado .-> AJ["Reenviar com ajustes"] -.-> ACP
    CONTA --> AVI["Central de avisos /conta/avisos"]
    CONTA --> PREF["Preferências /conta/notificacoes<br/>tipo × e-mail/central, temas, bairros"]
    CONTA --> PRIV["Privacidade /conta/privacidade"]
    PRIV --> COP["Baixar meus dados JSON ou PDF<br/>senha → disponível por 48 h"]
    PRIV --> DES["Desativar conta: senha + texto de confirmação<br/>anonimiza nome, e-mail, celular, endereço"]
    PRIV --> SES["Encerrar outras sessões"]
    DES --> FIM(["Fim — conta desativada, votos preservados"])
    CONTA --> SAIR(["Sair"])
    CONTA -. tenta /admin .-> NEG["acesso-negado — tentativa auditada"]
```

## 4. Fluxo de votação (RF011, RF036–RF041)

```mermaid
flowchart TD
    I(["Cidadão elegível em consulta Aberta"]) --> P1["Passo 1 — Escolher<br/>/consultas/slug/participar<br/>alternativa ou abstenção, se permitida<br/>canal do código: e-mail ou celular"]
    P1 --> Q1{"Escolheu uma opção?"}
    Q1 -- não --> E0["“Escolha uma alternativa para continuar.”"] -.-> P1
    Q1 -- sim --> RC["Servidor repete a elegibilidade e envia código de 6 dígitos<br/>válido por 5 min — a escolha NÃO é gravada"]
    RC -. inelegível .-> EI["Recusa auditada sem a alternativa"] -.-> FIMN
    RC -. mais de 5 tentativas/min .-> LIM["“Muitas tentativas…” + incidente"] -.-> FIMN
    RC --> P2["Passo 2 — Revisar e confirmar<br/>aviso: o voto não poderá ser alterado"]
    P2 --> AC{"Ação"}
    AC -- voltar --> P1
    AC -- reenviar código --> RC
    AC -- confirmar com código --> CD{"Código"}
    CD -- incorreto, 1ª/2ª vez --> E1["“Código incorreto. Restam N tentativa(s).”"] -.-> P2
    CD -- incorreto 3ª vez --> E2["Votação interrompida → recomeça do passo 1"] -.-> P1
    CD -- expirado --> E3["“Código expirado… Solicite um novo código.”"] -.-> P2
    CD -- correto --> TX["Transação única: lê situação e horário do servidor,<br/>repete elegibilidade, grava participação só com a data<br/>e o voto sem vínculo com a pessoa"]
    TX -- consulta fechou/suspendeu --> E4["“A consulta não está aberta…” → passo 1"] -.-> FIMN
    TX -- voto simultâneo/duplicado --> E5["Banco recusa: “Você já participou…”"] -.-> FIMN
    TX -- alternativa inexistente --> E6["Recusa + incidente"] -.-> FIMN
    TX -- falha de gravação --> E7["Nada gravado; nova tentativa permitida"] -.-> P2
    TX -- ok --> P3["Passo 3 — Comprovante<br/>/conta/participacoes/id?novo=1<br/>código XXXX-XXXX-XXXX, PDF, e-mail"]
    P3 --> VC["Verificação pública /comprovante<br/>prova a participação, não a escolha"]
    VC --> FIM(["Fim — voto registrado, secreto e irretratável"])
    FIMN(["Fim — sem voto"])
```

## 5. Fluxo administrativo (por papel)

```mermaid
flowchart TD
    I(["Servidor municipal"]) --> L["entrar: e-mail + senha"] --> M["🔐 /entrar/segundo-fator<br/>código TOTP"]
    M -- código errado --> ME["Erro; limite de tentativas"] -.-> M
    M --> P["Painel /admin<br/>menu mostra só o que os papéis permitem"]
    P -. página sem permissão .-> AN["admin/acesso-negado — auditado"]
    P --> G1["Gestor de acessos"]
    G1 --> U["Usuários /admin/usuarios<br/>pesquisar · convidar 72 h · bloquear/desbloquear/desativar com justificativa"]
    G1 --> PP["Papéis e permissões /admin/papeis"]
    G1 --> RSP["Responsáveis da consulta<br/>/admin/consultas/id/responsaveis<br/>bloqueia elaborar/revisar + aprovar"]
    G1 --> AUD["Auditoria /admin/auditoria<br/>filtros, CSV, verificar encadeamento"]
    G1 --> PAR["Parâmetros /admin/configuracoes"]
    P --> E["Elaborador"]
    E --> PM["Proposta municipal /admin/propostas-municipais"] --> NC["Nova consulta /admin/consultas/nova"]
    NC --> ED["Editar · Alternativas · Público-alvo · Anexos"] --> SUB{"Enviar para revisão"}
    SUB -- pendências --> PEND["Lista de pendências com link para o campo"] -.-> ED
    SUB -- ok --> REV["Revisor: /revisao — lista de verificação"]
    REV -- problema --> ED
    REV -- ok, versão congelada --> APR["Aprovador /aprovacao"]
    APR -- é elaborador/editor/revisor --> SEG["Negado — segregação de funções RN20, auditado"]
    APR -- prazo excepcional pendente --> AUT["Autorizador de prazo decide com justificativa"]
    AUT -- negado --> ED
    AUT -- autorizado --> APR
    APR -- rejeita com justificativa --> ED
    APR -- aprova --> PUBL["Responsável publica /conducao → Agendada"]
    PUBL --> COND["Responsável: alterar publicada · suspender/retomar · cancelar digitando o título"]
    PUBL --> DIV["Divulgação /divulgacao: texto, link, QR Code, registro de canais"]
    PUBL --> MON["Acompanhamento /admin/monitoramento<br/>participações e recusas — nunca contagem por alternativa"]
    MON --> RES["Publicação de resultados /resultado<br/>revisar preliminar · nota oficial ≥ 20 caracteres · publicar · retificar"]
    RES --> ENC["Encaminhamentos /encaminhamentos<br/>“Não realizada” exige justificativa"]
    P --> AN2["Analista"]
    AN2 --> PC["Propostas cidadãs /admin/propostas<br/>em análise · pedir ajuste · responder · publicar · encerrar"]
    AN2 --> MOD["Moderação /admin/moderacao<br/>manter · ocultar trecho · remover; revisão por outro moderador"]
    AN2 --> VI["Verificação de identidade /admin/verificacoes"]
    P --> INC["Incidentes /admin/incidentes<br/>análise e encerramento justificado"]
    P --> REL["Relatórios /admin/relatorios<br/>agregados; grupos < 10 aparecem como “menos de 10”"]
```

## 6. Ciclo de vida de uma consulta pública (RF019, RF024–RF035, RF042–RF043)

```mermaid
stateDiagram-v2
    [*] --> rascunho: elaborador cria (RF025)
    rascunho --> em_revisao: enviar sem pendências (RF028)
    em_revisao --> rascunho: revisor aponta problema
    em_revisao --> em_analise: revisão ok — versão congelada
    em_analise --> rascunho: prazo excepcional negado
    em_analise --> rejeitada: aprovador rejeita (justificativa)
    rejeitada --> em_revisao: elaborador corrige e reenvia
    em_analise --> aprovada: aprovador ≠ elaborador/editor/revisor (RN20)
    aprovada --> agendada: responsável publica (antecedência RN15)
    agendada --> em_analise: desfazer agendamento antes da abertura
    agendada --> aberta: sistema, no horário de abertura (RF031)
    agendada --> suspensa: responsável, com justificativa
    aberta --> suspensa: responsável, com justificativa (RF033)
    suspensa --> aberta: retomada justificada (prorrogação opcional)
    suspensa --> agendada: retomada antes da abertura
    suspensa --> encerrada: prazo terminou na suspensão e decidiu-se apurar
    aberta --> encerrada: sistema, no horário de encerramento (RF035)
    encerrada --> apurada: integridade ok → apuração automática (RF059, RF042)
    apurada --> finalizada: publicação do resultado com nota oficial (RF043)
    finalizada --> finalizada: retificação justificada (original permanece)
    aprovada --> cancelada
    agendada --> cancelada
    aberta --> cancelada
    suspensa --> cancelada
    encerrada --> cancelada: cancelamento irreversível (RF034)
    cancelada --> [*]
    finalizada --> [*]
    note right of aberta
      Votos só aqui, conferidos pelo horário do servidor.
      Nenhum perfil vê contagem por alternativa (RN16).
    end note
    note right of encerrada
      Falha de integridade: apuração bloqueada
      e incidente de severidade alta (RF060).
    end note
```

Situações visíveis no portal: Agendada, Aberta, Suspensa, Encerrada, Apurada ("Votos contados — resultado em
conferência"), Finalizada ("Resultado publicado") e Cancelada. Rascunho, Em revisão, Em análise, Aprovada e
Rejeitada nunca aparecem ao público (RF016).

## 7. Autenticação e recuperação de senha (RF003, RF005–RF008, RF010)

```mermaid
flowchart TD
    I(["Abre /entrar"]) --> J{"Já tem sessão válida?"}
    J -- cidadão --> RC["/conta"]
    J -- administrador com 2º fator --> RA["/admin"]
    J -- não --> F["CPF ou e-mail + senha"]
    F --> CAP{"Muitas falhas deste IP na última hora?"}
    CAP -- sim --> CQ["Responder CAPTCHA"] --> F
    CAP -- não --> B{"Conta bloqueada temporariamente?"}
    B -- sim --> BL["“Bloqueada… tente após HH:MM ou redefina a senha”"] -.-> FR
    B -- não --> S{"Senha confere?"}
    S -- não --> G["“CPF/e-mail ou senha incorretos.” — mensagem genérica<br/>conta falha; na 5ª: bloqueio de 15 min + aviso ao titular"]
    G -.-> F
    S -- sim --> ST{"Situação da conta"}
    ST -- pendente --> PE["“Confirme seu e-mail…” + reenviar link"] -.-> FIM0(["Fim"])
    ST -- ativa, cidadão --> SC["Sessão em cookie HttpOnly/SameSite → próximo destino ou /conta"]
    ST -- ativa, administrador --> MF["🔐 /entrar/segundo-fator"]
    MF --> TO{"Código TOTP válido?"}
    TO -- não --> TE["Erro"] -.-> MF
    TO -- sim --> SA["/admin"]
    F --> FR["“Esqueci minha senha” /recuperar-senha"]
    FR --> FG["Mensagem genérica — não revela se a conta existe<br/>limite de 3 pedidos por hora"]
    FG --> EM["E-mail com link de uso único, 30 min"]
    EM --> RD["redefinir-senha: nova senha + confirmação"]
    RD --> PV{"Link válido e senha na política RN23?"}
    PV -- não --> RX["Link inválido/expirado ou erros da senha"] -.-> FR
    PV -- sim --> RO["Senha gravada como Argon2id · todas as sessões encerradas<br/>→ /entrar?ok=senha_redefinida"]
    SC --> TS["🔒 Alterar senha /conta/senha<br/>senha atual + nova + confirmação → encerra as outras sessões"]
    SC --> OUT["Sair → sessão invalidada no servidor → /entrar?ok=saiu"]
    SC -. inatividade .-> EXP["Sessão expira → novo login; voto não confirmado é descartado"]
```

## Caminhos alternativos verificados na revisão de 24/11/2026

| Situação | Comportamento observado |
|---|---|
| Visitante abre `/conta`, `/admin` ou `/consultas/slug/participar` | redireciona para `/entrar?proximo=…` |
| Cidadão abre `/admin` | `/acesso-negado`, tentativa registrada na auditoria |
| Administrador sem a permissão da página | `/admin/acesso-negado`, tentativa registrada |
| Cidadão abre proposta ou comprovante de outra pessoa | 404 (o recurso “não existe” para ele) |
| Endereço com identificador fora do formato (`/conta/propostas/abc`) | 404 — **antes da revisão: erro 500** |
| Filtro de URL manipulado (`/consultas?tema=abc`, `?de=xyz`) | página normal sem resultados / filtro ignorado — **antes: erro 500** |
| Cidadão já votou e abre `/participar` | redireciona ao comprovante |
| Consulta encerrada, suspensa ou cancelada | botão de participar desabilitado com o motivo; servidor recusa o voto |
