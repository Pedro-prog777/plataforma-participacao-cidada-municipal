# Requisitos completos — PPCM

> Transcrição do **Documento de Requisitos v6** da Plataforma de Participação Cidadã Municipal (PPCM) — CESMAC, Engenharia de Software — João Pedro e Flávia Marina.
> Original preservado em [`docs/requisitos/Documento_de_Requisitos_v6.pdf`](Documento_de_Requisitos_v6.pdf). Os RF001–RF068 foram extraídos do PDF por script (sem reescrita); as tabelas das seções 4–8 foram transcritas e conferidas (totais de pontos de função batem: 120/15/64/150/35 = 384).
> Citações jurídicas (leis, artigos, bases legais e normas) foram omitidas por decisão da equipe em 23/11/2026, sem alterar o conteúdo técnico nem a numeração (DT-24); o PDF original continua com o texto integral.
> Itens marcados com **(\*)** ainda precisam ser aprovados pelo cliente — ver [`docs/requisitos/PENDENCIAS_CLIENTE.md`](PENDENCIAS_CLIENTE.md).

## 1. Introdução

Este documento especifica os requisitos da Plataforma de Participação Cidadã Municipal (PPCM), fornecendo aos desenvolvedores as informações necessárias para o projeto e implementação, assim como para a realização dos testes e homologação do sistema.

### 1.2.1 Identificação dos requisitos

A referência a requisitos é feita pelo nome da subseção seguido do identificador: `[nome da subseção.identificador]` — ex.: `[Registrar voto.RF037]`, `[Segurança.RNF05]`. `[RS001]` trata dos requisitos de segurança. A numeração inicia em `[RF001]`, `[RNF01]` ou `[RS001]` e é incrementada à medida que surgem novos requisitos. Itens marcados com (\*) ainda precisam ser aprovados pelo cliente.

### 1.2.2 Prioridades

- **Essencial** — sem ele o sistema não entra em funcionamento; implementação obrigatória.
- **Importante** — sem ele o sistema funciona, mas de forma não satisfatória; deve ser implementado.
- **Desejável** — não compromete as funcionalidades básicas; pode ficar para versões posteriores.

## 2. Descrição geral do sistema

### 2.1 Abrangência e sistemas relacionados

A PPCM é um portal web cujo objetivo é aproximar a população da administração municipal. Pela plataforma, o cidadão conhece as consultas públicas abertas pela Prefeitura, entende o assunto em discussão, registra a sua opinião por votação, envia propostas e acompanha os resultados e o que foi feito depois da consulta (encaminhamentos). A votação é uma proposta da equipe e tem **caráter consultivo (\*)**: o resultado orienta a administração, mas não substitui audiência pública, plebiscito, referendo ou iniciativa popular, que seguem ritos próprios (RN34).

**Usuários:**

1. **Visitante** — pessoa não autenticada; consulta o portal de transparência (consultas, resultados, encaminhamentos e histórico) e verifica comprovantes, mas não vota nem envia propostas.
2. **Cidadão** — pessoa cadastrada com conta ativa; mantém o perfil, verifica a identidade, vota nas consultas cujo público-alvo o inclui, recebe comprovante, envia e acompanha propostas, denuncia conteúdos e escolhe os avisos que quer receber.
3. **Administrador** — conta da Prefeitura, dividida em papéis por consulta (gestor de acessos, responsável, elaborador, revisor, aprovador, autorizador de prazo excepcional, divulgação, acompanhamento, publicação de resultados, encaminhamentos, análise de propostas, moderação e atendimento) (\*). O servidor municipal usa uma conta desse perfil com papéis restritos. **Ninguém aprova a consulta que elaborou ou revisou, e contas administrativas não votam.**
4. **Sistema** — executa as rotinas automáticas: abertura e encerramento nas datas programadas, apuração, avisos, verificação de integridade e auditoria.

**Sistemas relacionados:** provedor de identidade gov.br (login e verificação de identidade, com análise documental pelo administrador como alternativa), serviço de e-mail (confirmação de conta, recuperação de senha, comprovantes e avisos), serviço externo de vídeo (a plataforma guarda apenas o link de vídeos longos e transmissões), portal institucional e redes oficiais da Prefeitura (a divulgação é feita manualmente, sem integração automática) e portal de dados abertos (resultados e encaminhamentos em CSV e JSON). A plataforma não executa as propostas e não acompanha obras ou orçamento: ela apenas publica os encaminhamentos registrados pela administração.

**Escopo — inclui:** cadastro, verificação de identidade e autenticação de cidadãos e de contas administrativas; perfil do cidadão, com histórico de participações, propostas e direitos do titular de dados; ciclo completo da consulta pública (preparação, responsáveis, revisão, aprovação, publicação, divulgação, monitoramento, encerramento, apuração, resultados e encaminhamentos); votação eletrônica consultiva, com voto único, sigiloso e com comprovante; propostas cidadãs, com estados, resposta administrativa e publicação autorizada; denúncia e moderação de conteúdos enviados por cidadãos; portal público de transparência, histórico, trilha de auditoria e dados abertos; notificações por e-mail e na plataforma; relatórios agregados para a administração.

**Fora do escopo:** eleições, plebiscitos, referendos e iniciativa popular formal; execução das propostas e acompanhamento de obras ou orçamento (a plataforma apenas publica os encaminhamentos registrados pela administração); transmissão de vídeo, chats e videochamadas; **comentários, apoios e eventos são requisitos condicionados à validação**; integração automática com redes sociais (a divulgação externa é feita por procedimento administrativo, RF062); votação presencial ou em papel; pagamentos e outros serviços da prefeitura; aplicativo móvel nativo (o acesso é feito pelo navegador, inclusive em celulares).

## 3. Requisitos funcionais (casos de uso)

### RF001 – Cadastrar cidadão

- **O que faz:** O sistema deve permitir que uma pessoa física crie conta de cidadão com nome completo, CPF, data de nascimento, e-mail, endereço no município, senha e aceite dos Termos de Uso e da Política de Privacidade; o celular é opcional. Cada dado tem finalidade declarada: o CPF garante uma conta por pessoa (RN02) e a verificação de identidade (RF004), nunca é exibido e pode vir do provedor de identidade; a data de nascimento só é usada em consulta com critério etário justificado (RN35, RN40); o endereço apoia consultas territoriais (RF027).
- **Pré-condição:** Visitante não autenticado; CPF sem conta de Cidadão.
- **Campos do formulário:**
  - **Nome completo** – texto, obrigatório.
  - **CPF** – texto no formato XXX.XXX.XXX-XX, com validação do dígito verificador (*). Único e nunca exibido em páginas públicas. Serve para garantir uma conta por pessoa (RN02) e pode vir do gov.br em vez de ser digitado.
  - **Data de nascimento** – data DD/MM/AAAA, obrigatória. Só é usada em consulta com critério de idade justificado; não existe idade mínima geral (RN01, RN40).
  - **E-mail** – texto, obrigatório, formato `texto@texto.texto`. Único entre as contas de cidadão.
  - **Celular** – máscara (XX) XXXXX-XXXX, opcional.
  - **Endereço no município** – CEP (XXXXX-XXX), logradouro, número e bairro, obrigatórios. Usado nas consultas restritas a bairros ou regiões (RF027).
  - **Senha** – mínimo de 8 caracteres, com letra e número, diferente do CPF, da data de nascimento e do e-mail (RN23). Guardada só como hash.
  - **Aceite dos Termos de Uso e da Política de Privacidade** – sim/não, obrigatório. O sistema guarda a versão aceita.
  - **Situação da conta** – Pendente de confirmação, Ativa, Bloqueada ou Desativada.
  - **Nível de verificação** – Não verificado, Em análise, Verificado ou Verificação recusada.
  - **Data do cadastro** – data e hora geradas pelo servidor.
- **Fluxo:** 1) preenche o formulário e aceita os termos; 2) o sistema valida (RF002); 3) grava a senha como hash; 4) cria a conta "Pendente de confirmação" e "Não verificado", com a versão dos termos; 5) envia o e-mail de confirmação (RF003).
- **Dados inválidos:** Campos com erro destacados; nada é gravado.
- **CPF ou e-mail já cadastrado:** Oferece recuperação de acesso (RF007), sem revelar a conta.
- **Entrada:** Dados cadastrais.
- **Saída:** Conta pendente.
- **Permissões:** Visitante; CPF nunca exibido.
- **Resultado:** Conta pendente; ainda não vota.
- **Regras:** CPF único (RN02); Política de senha (RN23); Proteção de dados (RN27); Dados de elegibilidade (RN31); Crianças e adolescentes (RN40).
- **A validar com o cliente (*):** Dados exigidos no cadastro e obrigatoriedade do CPF.

### RF002 – Validar dados cadastrais

- **O que faz:** O sistema deve validar no servidor, antes de gravar, os dados de RF001 e RF013 quanto a obrigatoriedade, formato, consistência e unicidade, mesmo que a interface também valide.
- **Pré-condição:** Formulário submetido.
- **Fluxo:** 1) verifica campos obrigatórios; 2) valida CPF pelos dígitos verificadores; 3) valida e-mail, celular, data e CEP; 4) verifica política de senha e unicidade de CPF e e-mail; 5) normaliza os dados.
- **Campos inválidos:**
  - Todos os erros devolvidos de uma vez, por campo.
- **Endereço fora do município:** Cadastro aceito; a elegibilidade é verificada por consulta (RF036).
- **Resultado:** Nenhum dado inválido persistido.
- **Regras:** Elegibilidade (RN01); CPF único (RN02); Política de senha (RN23); Proteção de dados (RN27).

### RF003 – Confirmar e-mail e ativar conta

- **O que faz:** O sistema deve confirmar a posse do e-mail por link com token aleatório, de uso único e válido por 24 horas, mudando a conta para "Ativa".
- **Pré-condição:** Conta "Pendente de confirmação".
- **Fluxo:** 1) envia o link; 2) o cidadão acessa; 3) o sistema valida o token, ativa a conta e o invalida.
- **Link expirado ou inválido:** Reenvio limitado a 3 por hora, sem revelar se o e-mail existe.
- **Resultado:** Conta ativa; a verificação (RF004) ainda é necessária para votar.
- **Regras:** Conta ativa (RN03).

### RF004 – Verificar identidade e domicílio do cidadão

- **O que faz:** O sistema deve permitir que o cidadão comprove ser titular do CPF e, quando exigido, morador do município, pelo login gov.br (nível prata ou superior) ou por análise de documentos por um administrador.
- **Pré-condição:** Conta ativa, "Não verificada" ou "Verificação recusada".
- **Fluxo:** 1) o cidadão autentica-se no provedor oficial; 2) o sistema confere CPF e nível; 3) confere o domicílio; 4) marca "Verificada", com método e data.
- **Verificação documental:** Documentos (até 5 MB) ficam "Em análise" até aprovação ou recusa motivada.
- **CPF divergente:** Recusa registrada na auditoria.
- **Resultado:** Conta verificada ou recusa motivada; documentos com acesso restrito.
- **Regras:** Elegibilidade (RN01); CPF único (RN02); Identidade verificada (RN04); Proteção de dados (RN27); Dados de elegibilidade (RN31).

### RF005 – Realizar login

- **O que faz:** O sistema deve autenticar contas ativas por CPF ou e-mail e senha, ou pelo gov.br, criando sessão segura; contas administrativas exigem segundo fator.
- **Pré-condição:** Conta ativa, usuário não autenticado.
- **Fluxo:** 1) informa credenciais; 2) o sistema compara com o hash e verifica bloqueios; 3) exige segundo fator de contas administrativas; 4) cria sessão em cookie protegido e registra o acesso.
- **Credenciais inválidas:** Mensagem genérica e contagem de falha (RF010).
- **Conta pendente ou bloqueada:** Informa a situação e a ação possível.
- **Regras:** Conta ativa (RN03); Tentativas de login (RN24); Expiração da sessão (RN26).

### RF006 – Realizar logout

- **O que faz:** O sistema deve encerrar a sessão no servidor quando o usuário pedir, encerrar automaticamente sessões inativas e permitir encerrar as sessões de outros dispositivos.
- **Fluxo:** 1) escolhe "Sair"; 2) o sistema invalida a sessão e remove o cookie.
- **Sessão expirada:** Pede novo login e descarta operações não concluídas, inclusive voto não confirmado.
- **Regras:** Expiração da sessão (RN26).

### RF007 – Recuperar senha

- **O que faz:** O sistema deve permitir redefinir a senha por link enviado ao e-mail cadastrado, sem revelar se o CPF ou e-mail possui conta.
- **Fluxo:** 1) informa CPF ou e-mail; 2) o sistema exibe mensagem genérica e, havendo conta, envia link de uso único (RN25); 3) o usuário define a senha; 4) o sistema grava, encerra as sessões e avisa.
- **Link expirado ou usado:** Nova solicitação, até 3 por hora.
- **Regras:** Política de senha (RN23); Link de recuperação (RN25).

### RF008 – Alterar senha

- **O que faz:** O sistema deve permitir que o usuário autenticado altere a senha informando a atual, a nova e a confirmação.
- **Fluxo:** 1) informa as senhas; 2) o sistema valida e grava; 3) encerra as demais sessões e confirma por e-mail.
- **Senha atual incorreta:** Recusa contada como falha (RF010).
- **Regras:** Política de senha (RN23).

### RF009 – Controlar acesso por perfil, papel e permissão

- **O que faz:** O sistema deve verificar em toda requisição a autenticação, o perfil, o papel e a posse do recurso; o cidadão acessa apenas os próprios dados.
- **Pré-condição:** Matriz de papéis (RF047).
- **Fluxo:** 1) identifica sessão e papéis; 2) classifica a operação como pública, autenticada ou restrita; 3) verifica permissão e posse; 4) executa e exibe só as ações permitidas.
- **Não autenticado:** Redireciona ao login.
- **Sem permissão ou recurso alheio:** Acesso negado, nada é alterado e a tentativa é auditada.
- **Regras:** Segregação de funções (RN20); Gestão de acessos (RN21); Contas administrativas não votam (RN22); Responsabilidades (RN36).

### RF010 – Controlar tentativas de autenticação

- **O que faz:** O sistema deve contar falhas por conta e por IP e bloquear temporariamente a conta no limite (RN24), contra força bruta.
- **Fluxo:** 1) incrementa os contadores; 2) no limite, bloqueia; 3) avisa o titular e audita; 4) ao fim do prazo, desbloqueia.
- **Muitas falhas do mesmo IP:** Exige CAPTCHA desse IP.
- **Regras:** Tentativas de login (RN24).

### RF011 – Confirmar identidade antes do voto

- **O que faz:** Antes de gravar o voto, o sistema deve exigir confirmação adicional por código de 6 dígitos (válido por 5 minutos) enviado ao e-mail ou celular, ou por reautenticação no gov.br.
- **Pré-condição:** Cidadão elegível com alternativa escolhida.
- **Fluxo:** 1) envia o código ao canal mascarado; 2) o cidadão digita; 3) o sistema valida e libera a confirmação.
- **Código incorreto ou expirado:** Após 3 erros, a votação é interrompida.
- **Regras:** Identidade verificada (RN04); Período de votação (RN08).

### RF012 – Visualizar perfil

- **O que faz:** O sistema deve exibir ao cidadão os dados da própria conta (CPF mascarado), a situação da verificação e um resumo de elegibilidade com o motivo e a ação necessária quando houver impedimento.
- **Fluxo:** 1) acessa "Meu perfil"; 2) o sistema exibe dados e resumo, com atalhos para RF004, RF008, RF013–RF015 e RF052.
- **Regras:** Proteção de dados (RN27).

### RF013 – Atualizar dados do perfil

- **O que faz:** O sistema deve permitir alterar nome social, e-mail, celular e endereço; o CPF é imutável e nome civil e nascimento só mudam após verificação documental.
- **Fluxo:** 1) edita; 2) confirma com a senha; 3) o sistema valida (RF002), grava e audita os campos alterados.
- **Novo e-mail:** Vale após confirmação; o anterior é avisado.
- **Novo endereço:** Exige nova comprovação; votos registrados não são afetados.
- **Regras:** Elegibilidade (RN01); CPF único (RN02); Proteção de dados (RN27); Dados de elegibilidade (RN31).

### RF014 – Acompanhar participações e propostas

- **O que faz:** O sistema deve listar as consultas em que o cidadão votou (data, comprovante, situação, resultado e encaminhamentos) e as propostas que enviou, com estado e respostas (RN30), sem nunca exibir a opção votada (RN07).
- **Fluxo:** 1) acessa "Minhas participações"; 2) o sistema lista, com filtros por situação e ano; 3) permite verificar o comprovante (RF041).
- **Consulta cancelada:** Indica que os votos não foram apurados.
- **Entrada:** Conta.
- **Saída:** Lista de participações e propostas.
- **Permissões:** Só o titular; sem opção votada.
- **Regras:** Sigilo do voto (RN07); Consulta cancelada (RN10); Propostas cidadãs (RN30); Encaminhamentos (RN42).
- **A validar com o cliente (*):** funcionalidade proposta pela equipe; precisa do aceite do cliente.

### RF015 – Exercer direitos do titular de dados

- **O que faz:** O sistema deve permitir obter cópia dos dados pessoais em formato estruturado e desativar a conta com anonimização, sem alterar votos nem resultados e mantendo o hash do CPF para impedir novo voto.
- **Fluxo:** 1) pede "Baixar meus dados" e confirma a senha; 2) o sistema gera JSON ou PDF disponível por 48 horas.
- **Desativação:** Encerra sessões e anonimiza nome, e-mail, celular e endereço.
- **Regras:** Voto único (RN05); Proteção de dados (RN27); Participação após desativação (RN33).

### RF016 – Listar consultas públicas

- **O que faz:** O sistema deve exibir a todos as consultas publicadas (título, resumo, tema, região, situação, período e participações), com as abertas primeiro, pelo encerramento mais próximo; Rascunho, Em análise e Rejeitada nunca aparecem.
- **Fluxo:** 1) acessa "Consultas"; 2) o sistema exibe 12 por página, indicando ao cidadão onde já participou ou não se enquadra.
- **Nenhuma consulta:** Oferece inscrição em avisos (RF052).
- **Regras:** Prazo de participação (RN14); Sigilo das parciais (RN16).

### RF017 – Pesquisar e filtrar consultas

- **O que faz:** O sistema deve buscar consultas por palavras-chave, sem diferenciar maiúsculas e acentos, com filtros de situação, tema, região e período e, para o cidadão, "ainda não participei" e "posso participar".
- **Fluxo:** 1) informa termos e filtros; 2) o sistema busca em título, resumo e proposta; 3) exibe resultados e filtros removíveis.
- **Nenhum resultado:** Sugere remover filtros.

### RF018 – Visualizar detalhes da consulta

- **O que faz:** O sistema deve exibir: título, tema, problema, objetivo, justificativa, pergunta e alternativas explicadas, orientações, público-alvo (ou "aberta ao público em geral"), abertura e encerramento com dias restantes, justificativa de prazo reduzido (RN14), natureza consultiva e o que acontece depois (RN34, RN42), unidade responsável, documentos e mídias com alternativa textual (RF023), histórico (RF051), participações e, depois, resultado (RF044) e encaminhamentos (RF063). Vídeos nunca são condição para participar (RN37).
- **Pré-condição:** Consulta em situação pública.
- **Fluxo:** 1) abre a consulta; 2) o sistema exibe os blocos, com o período em destaque; 3) para o cidadão, verifica a elegibilidade (RF036) e mostra "Participar", "Você já participou" ou "Fora do público-alvo" com o motivo; 4) ao visitante, "Entre para participar".
- **Suspensa ou cancelada:** Aviso e justificativa; voto desabilitado.
- **Prazo reduzido:** Selo "Prazo excepcional de 10 dias".
- **Mídia indisponível:** Exibe a alternativa textual.
- **Entrada:** ID da consulta.
- **Saída:** Página pública.
- **Permissões:** Pública; sem dados pessoais.
- **Regras:** Voto único (RN05); Voto irretratável (RN06); Prazo de participação (RN14); Sigilo das parciais (RN16); Natureza consultiva (RN34); Público-alvo (RN35); Conteúdo mínimo (RN37); Resultados (RN41); Encaminhamentos (RN42).
- **A validar com o cliente (*):** Caráter sempre consultivo da votação; nível de acessibilidade exigido.

### RF019 – Determinar a situação da consulta

- **O que faz:** O sistema deve manter a situação de cada consulta conforme o ciclo de vida (seção 6.1), abrindo e encerrando automaticamente nas datas definidas e aplicando só as transições permitidas.
- **Fluxo:** 1) rotina a cada minuto; 2) abre as Agendadas (RF031) e encerra as Abertas (RF035) no horário; 3) registra cada transição e notifica.
- **Transição inválida ou rotina atrasada:** Recusada e registrada; nenhum voto é aceito fora do período (RF040).
- **Regras:** Período de votação (RN08); Consulta suspensa (RN09); Consulta cancelada (RN10); Encerramento irreversível (RN32).

### RF020 – Enviar proposta cidadã

- **O que faz:** O sistema deve permitir que o cidadão envie proposta de competência municipal com título (até 120 caracteres), problema, solução sugerida, tema, região, até 3 anexos e a indicação de que autoriza ou não a publicação do texto, sempre sem seus dados pessoais. Antes do envio, mostra propostas semelhantes. A proposta não gera votação automática e segue os estados da RN30.
- **Pré-condição:** Cidadão autenticado e verificado, com menos de 3 propostas em análise.
- **Campos:**
  - **Título** – texto, até 120 caracteres, obrigatório.
  - **Descrição do problema** – texto, obrigatório.
  - **Solução sugerida** – texto, obrigatório.
  - **Área temática** – seleção única, obrigatória.
  - **Região ou bairro** – seleção única, obrigatória.
  - **Anexos** – até 3 arquivos, opcionais.
  - **Autoriza a publicação do texto** – sim/não. Os dados pessoais do autor nunca são publicados.
  - **Protocolo** – gerado pelo sistema.
  - **Estado** – Recebida, Em análise, Ajuste solicitado, Respondida, Publicada ou Encerrada (RN30).
  - **Data de envio** – data e hora do servidor.
- **Fluxo:** 1) informa título e tema e vê semelhantes; 2) completa e envia; 3) o sistema registra como "Recebida", com protocolo; 4) confirma por e-mail e na central de avisos.
- **Proposta semelhante:** Pode apoiar a existente (RF067, se adotado) ou prosseguir.
- **Limite atingido ou identidade não verificada:** Envio bloqueado com orientação.
- **Entrada:** Campos e anexos.
- **Saída:** Protocolo e estado.
- **Permissões:** Cidadão verificado; autor visível só à administração.
- **Resultado:** Proposta visível ao autor (RF014).
- **Regras:** Identidade verificada (RN04); Proteção de dados (RN27); Propostas cidadãs (RN30); Manifestação não é voto (RN38).
- **A validar com o cliente (*):** Limite, apoios e metas das propostas cidadãs.

### RF021 – Analisar e responder proposta cidadã

- **O que faz:** O sistema deve permitir que o administrador com papel de análise conduza a proposta pelos estados da RN30: Em análise; Ajuste solicitado, com orientação ao autor; Respondida, com resposta justificada (convertida em proposta municipal, encaminhada a outro órgão ou não acolhida); Publicada, se autorizada; e Encerrada. Cada mudança notifica o autor e fica no histórico.
- **Pré-condição:** Proposta Recebida ou Em análise.
- **Fluxo:** 1) abre a proposta na fila, das mais antigas; 2) analisa; 3) registra resposta e justificativa; 4) se aceita, o sistema cria proposta municipal vinculada (RF022); 5) publica, se autorizada, e encerra.
- **Ajuste sem retorno no prazo (parâmetro pendente):** Encerrada com justificativa.
- **Conteúdo impróprio:** Segue a moderação (RF066).
- **Entrada:** Decisão e justificativa.
- **Saída:** Novo estado e aviso.
- **Permissões:** Papel "analisar propostas".
- **Regras:** Justificativa obrigatória (RN11); Propostas cidadãs (RN30); Limites administrativos (RN39); Encaminhamentos (RN42).
- **A validar com o cliente (*):** Limite, apoios e metas das propostas cidadãs; prazos de resposta da administração e de guarda dos registros.

### RF022 – Cadastrar proposta municipal

- **O que faz:** O sistema deve permitir cadastrar a proposta oficial objeto de consulta, com título, resumo, descrição, justificativa, objetivos, tema, abrangência e órgão responsável; custo, fonte de recursos e prazo de execução são opcionais.
- **Fluxo:** 1) preenche; 2) o sistema valida e remove conteúdo executável; 3) grava em Rascunho com autor e data.
- **Rascunho incompleto:** Pode ser salvo; a validação completa ocorre na submissão (RF028).
- **Regras:** Segregação de funções (RN20).

### RF023 – Anexar documentos e materiais audiovisuais

- **O que faz:** O sistema deve permitir anexar documentos (PDF, ODS, XLSX, CSV), imagens, áudios, vídeos gravados e links de transmissão ou gravação em serviço externo, além de links oficiais. Imagens exigem texto alternativo; vídeo e áudio exigem transcrição ou resumo e, havendo fala, legenda. Limites: 20 MB por arquivo e 10 anexos. Mídias são opcionais e nunca condição para votar (RN37).
- **Pré-condição:** Item em situação editável.
- **Fluxo:** 1) envia arquivo ou link com título e alternativa textual; 2) o sistema verifica formato real, tamanho, vírus e alternativa; 3) armazena com hash SHA-256.
- **Consulta publicada:** Só acréscimo justificado (RF032).
- **Arquivo inválido ou sem alternativa:** Recusado e registrado.
- **Link indisponível:** Alerta o responsável e mostra a alternativa textual.
- **Entrada:** Arquivo ou URL e alternativa textual.
- **Saída:** Anexo com hash.
- **Permissões:** Papel elaborador.
- **Regras:** Justificativa obrigatória (RN11); Imutabilidade após publicação (RN12); Conteúdo mínimo (RN37).
- **A validar com o cliente (*):** Quais formas de participação entram nesta versão.

### RF024 – Editar proposta e consulta em elaboração

- **O que faz:** O sistema deve permitir editar propostas e consultas em Rascunho ou Rejeitada, mantendo as versões anteriores; Em análise, a edição é bloqueada.
- **Fluxo:** 1) edita; 2) o sistema grava nova versão com autor e data.
- **Item Em análise ou publicado:** Bloqueado (publicados seguem RF032).
- **Edição simultânea:** Mostra as diferenças, sem sobrescrever.
- **Regras:** Imutabilidade após publicação (RN12); Registros imutáveis (RN28).

### RF025 – Cadastrar consulta pública

- **O que faz:** O sistema deve permitir criar a consulta de uma proposta com tema, problema, objetivo, justificativa, forma de participação, pergunta clara e neutra (até 300 caracteres), alternativas (RF026), público-alvo (RF027), orientações, abertura e encerramento, regra de apuração (RN18), quórum de referência se adotado (RN17) e o que ocorrerá após o encerramento. O período padrão é de 20 dias; a redução para 10 exige emergência justificada e autorizada (RF029). A natureza é sempre consultiva (RN34); a opção "vinculante" da versão anterior foi removida.
- **Pré-condição:** Proposta em Rascunho sem consulta ativa; responsáveis definidos (RF061).
- **Campos:**
  - **Tema, problema, objetivo e justificativa** – texto, obrigatórios.
  - **Forma de participação** – seleção única.
  - **Pergunta** – texto, até 300 caracteres, obrigatória. Deve ser clara e neutra.
  - **Alternativas** – de 2 a 10, cadastradas no RF026.
  - **Público-alvo** – "aberta ao público em geral" ou limitações justificadas (RF027).
  - **Orientações de participação** – texto.
  - **Abertura e encerramento** – data e hora (horário de Brasília, do servidor). O sistema sugere 20 dias entre as datas (*).
  - **Prazo excepcional** – sim/não. Quando marcado, exige justificativa de emergência e autorização (RF029) (*).
  - **Regra de apuração** – padrão maioria simples dos votos válidos (RN18).
  - **Quórum de referência** – número inteiro ou percentual, opcional (RN17).
  - **Próximos passos após o encerramento** – texto, obrigatório.
  - Tema com rito próprio (Plano Diretor ou outro)
  - sim/não.
- **Fluxo:** 1) cria a consulta; o sistema sugere encerramento 20 dias após a abertura; 2) preenche campos, alternativas e público-alvo; 3) o sistema valida datas, antecedência (RN15) e duração (RN14); 4) grava em Rascunho.
- **Prazo reduzido:** Marca "emergência" e justifica; aguarda autorização.
- **Tema com rito próprio (Plano Diretor ou outro):** Exige confirmar que a norma aplicável foi verificada.
- **Período fora da regra ou datas inválidas:** Não grava.
- **Entrada:** Campos.
- **Saída:** Consulta em Rascunho.
- **Permissões:** Elaborador não publica.
- **Regras:** Alternativas de voto (RN13); Prazo de participação (RN14); Antecedência da publicação (RN15); Quórum de referência (RN17); Regra de apuração (RN18); Natureza consultiva (RN34); Público-alvo (RN35); Responsabilidades (RN36); Conteúdo mínimo (RN37).
- **A validar com o cliente (*):** Prazo padrão de 20 dias; redução para 10 dias e o que conta como emergência; quem autoriza a redução do prazo.

### RF026 – Definir alternativas de resposta

- **O que faz:** O sistema deve permitir definir de 2 a 10 alternativas, com rótulo, explicação e ordem, com modelos como "Sim/Não" e "Concordo/Discordo" para quando forem adequados; a abstenção, se habilitada, não é voto válido.
- **Fluxo:** 1) escolhe modelo ou cria alternativas; 2) define abstenção e ordem; 3) o sistema valida e grava.
- **Quantidade inválida ou rótulos repetidos:** Bloqueado.
- **Regras:** Imutabilidade após publicação (RN12); Alternativas de voto (RN13).

### RF027 – Definir público-alvo e critérios de participação

- **O que faz:** O sistema deve permitir definir o público-alvo de cada consulta: "aberta ao público em geral" ou com limitações justificadas por território, domicílio, faixa etária ou outro critério, publicadas em linguagem simples. Não há idade mínima geral; critério etário só por consulta, justificado e conforme a RN40. Até a resposta do cliente (*), o padrão herdado da versão anterior é o domicílio no município.
- **Pré-condição:** Consulta em Rascunho ou Rejeitada.
- **Fluxo:** 1) escolhe "aberta" ou adiciona limitações; 2) justifica cada limitação; 3) o sistema estima elegíveis e grava; 4) o texto passa a constar de RF018.
- **Consulta voltada a crianças e adolescentes:** Exige a modalidade (informativa, educativa, proposta ou voto) e as salvaguardas da RN40, com revisão (RF028).
- **Limitação sem justificativa:** Bloqueada.
- **Entrada:** Critérios e justificativas.
- **Saída:** Regra e texto público.
- **Permissões:** Aprovador confere.
- **Regras:** Elegibilidade (RN01); Imutabilidade após publicação (RN12); Público-alvo (RN35); Crianças e adolescentes (RN40).
- **A validar com o cliente (*):** Público-alvo padrão das consultas; participação de crianças e adolescentes.

### RF028 – Revisar e submeter consulta para aprovação

- **O que faz:** O sistema deve exigir, antes da aprovação, validação completa e revisão por pessoa diferente do elaborador (RN36), com lista de verificação registrada: conteúdo mínimo (RN37); pergunta clara e neutra; alternativas equilibradas e mutuamente exclusivas; contexto suficiente; público-alvo justificado; período conforme a RN14; materiais com alternativa textual; linguagem simples.
- **Fluxo:** 1) o elaborador pede o envio e o sistema valida; 2) o revisor preenche a lista; 3) aprovada a revisão, a consulta fica Em análise, com versão congelada, e os aprovadores são avisados.
- **Problema apontado:** Volta a Rascunho com observações.
- **Pendências:** Listadas com link para o campo.
- **Entrada:** Consulta e lista de verificação.
- **Saída:** Versão congelada.
- **Permissões:** Revisor ≠ elaborador.
- **Regras:** Prazo de participação (RN14); Antecedência da publicação (RN15); Segregação de funções (RN20); Responsabilidades (RN36); Conteúdo mínimo (RN37).
- **A validar com o cliente (*):** Divisão do Administrador em papéis.

### RF029 – Aprovar consulta e autorizar prazo excepcional

- **O que faz:** O sistema deve permitir que aprovador diferente do elaborador, do último editor e do revisor aprove ou rejeite a consulta e, havendo pedido de redução para 10 dias, que quem tem o papel "autorizar prazo excepcional" decida sobre a emergência, com justificativa publicada. Quem pode exercer esse papel é decisão pendente (*).
- **Pré-condição:** Consulta Em análise, sem conflito do aprovador.
- **Fluxo:** 1) revisa a versão congelada; 2) autoriza ou nega a redução; 3) aprova (registrando autor, data e versão) ou rejeita com justificativa; 4) segue para RF030 ou devolve.
- **Redução negada:** Volta a Rascunho com 20 dias sugeridos.
- **Antecedência insuficiente:** Aprovação bloqueada.
- **Entrada:** Decisões e justificativas.
- **Saída:** Aprovação registrada.
- **Permissões:** "Aprovar consulta"; "autorizar prazo excepcional".
- **Regras:** Justificativa obrigatória (RN11); Prazo de participação (RN14); Antecedência da publicação (RN15); Segregação de funções (RN20); Responsabilidades (RN36).
- **A validar com o cliente (*):** Redução para 10 dias e o que conta como emergência; quem autoriza a redução do prazo.

### RF030 – Publicar consulta

- **O que faz:** O sistema deve tornar pública a consulta aprovada, mudando-a para Agendada, com endereço permanente e contagem regressiva para a abertura.
- **Pré-condição:** Consulta aprovada.
- **Fluxo:** 1) publica ou agenda; 2) o sistema muda a situação, registra e notifica (RF053).
- **Agendamento desfeito antes da data:** Volta a Em análise.
- **Regras:** Imutabilidade após publicação (RN12); Antecedência da publicação (RN15).

### RF031 – Abrir votação

- **O que faz:** O sistema deve abrir automaticamente a votação no horário de abertura, mudando para Aberta e registrando um retrato dos parâmetros vigentes (alternativas, público-alvo, quórum e elegíveis estimados).
- **Fluxo:** 1) a rotina (RF019) identifica a consulta; 2) confirma que não está suspensa; 3) registra o retrato; 4) abre e notifica (RF053).
- **Suspensa antes da abertura:** Aguarda a retomada.
- **Regras:** Período de votação (RN08); Imutabilidade após publicação (RN12).

### RF032 – Alterar consulta publicada

- **O que faz:** O sistema deve permitir, com justificativa e registro público, apenas correção textual que não mude o sentido, inclusão de anexos, prorrogação antes do encerramento e ajuste da abertura enquanto Agendada.
- **Fluxo:** 1) altera e justifica; 2) o sistema valida pela RN12; 3) grava versão, publica antes e depois e notifica (RF054).
- **Alteração proibida:** Recusada; orienta cancelar e criar nova consulta.
- **Correção que muda o sentido:** Exige o aprovador.
- **Regras:** Voto irretratável (RN06); Justificativa obrigatória (RN11); Imutabilidade após publicação (RN12); Encerramento irreversível (RN32).

### RF033 – Suspender e retomar consulta

- **O que faz:** O sistema deve permitir suspender consulta Agendada ou Aberta, com justificativa pública; durante a suspensão nenhum voto é aceito e os registrados são preservados.
- **Fluxo:** 1) suspende com justificativa; 2) o sistema muda a situação, publica e notifica (RF054); 3) na retomada justificada, volta a Aberta ou Agendada, com prorrogação opcional.
- **Encerramento durante a suspensão:** Decide-se, com justificativa, entre apurar e cancelar (RF034).
- **Regras:** Consulta suspensa (RN09); Justificativa obrigatória (RN11).

### RF034 – Cancelar consulta

- **O que faz:** O sistema deve permitir cancelar, de forma irreversível, consulta ainda não apurada; os votos não são apurados e a consulta permanece visível como Cancelada, com justificativa.
- **Fluxo:** 1) justifica e confirma digitando o título; 2) o sistema cancela, lacra os votos, publica e notifica, inclusive quem votou.
- **Consulta já apurada:** Recusado; cabe retificação (RF043).
- **Regras:** Consulta cancelada (RN10); Justificativa obrigatória (RN11); Encerramento irreversível (RN32).

### RF035 – Encerrar votação

- **O que faz:** O sistema deve encerrar automaticamente a votação no horário divulgado, sem encerramento antecipado manual; a interrupção excepcional ocorre por suspensão ou cancelamento.
- **Fluxo:** 1) muda para Encerrada; 2) aceita só transações efetivadas até o horário; 3) confere participações e votos (RF059); 4) dispara a apuração (RF042) e o aviso (RF055).
- **Totais divergentes:** Apuração bloqueada e incidente aberto (RF060).
- **Regras:** Período de votação (RN08); Imutabilidade após publicação (RN12); Encerramento irreversível (RN32).

### RF036 – Verificar elegibilidade do cidadão

- **O que faz:** O sistema deve verificar, em ordem: conta ativa e desbloqueada; identidade verificada; perfil Cidadão; enquadramento no público-alvo da consulta (RF027), inclusive domicílio, território e eventual critério etário justificado; consulta Aberta e no período; e ausência de participação anterior. Nenhuma idade mínima geral é aplicada, e a verificação é repetida no servidor no momento do voto.
- **Fluxo:** 1) recupera conta e critérios; 2) avalia as condições na ordem; 3) habilita a participação.
- **Condição não atendida:** Informa, em linguagem simples, o primeiro motivo e a ação possível.
- **Entrada:** Conta e regras.
- **Saída:** Elegível ou motivo.
- **Permissões:** Somente o sistema.
- **Regras:** Elegibilidade (RN01); Conta ativa (RN03); Identidade verificada (RN04); Voto único (RN05); Período de votação (RN08); Contas administrativas não votam (RN22); Público-alvo (RN35); Crianças e adolescentes (RN40).
- **A validar com o cliente (*):** Público-alvo padrão das consultas; participação de crianças e adolescentes; forma de identificação e voto único e irretratável.

### RF037 – Registrar voto

- **O que faz:** O sistema deve registrar o voto do cidadão elegível em consulta Aberta, com exatamente uma alternativa, garantindo: voto único, pela unicidade do par cidadão– consulta no banco; sigilo, pois o voto é gravado sem identificador do cidadão, sem comprovante e sem horário exato; e atomicidade, pois participação e voto são gravados na mesma transação. O voto é irretratável após a confirmação.
- **Fluxo:** 1) escolhe a alternativa; 2) o sistema mostra a revisão e avisa que o voto não poderá ser alterado; 3) o cidadão confirma a identidade (RF011); 4) o servidor repete a elegibilidade; 5) grava participação e voto na mesma transação; 6) gera o comprovante (RF038).
- **Falha na gravação:** Transação desfeita por completo; nova tentativa permitida.
- **Alternativa inexistente:** Recusada e registrada (RF060).
- **Regras:** Voto único (RN05); Voto irretratável (RN06); Sigilo do voto (RN07); Período de votação (RN08); Consulta suspensa (RN09); Alternativas de voto (RN13).

### RF038 – Confirmar voto e emitir comprovante

- **O que faz:** O sistema deve confirmar o registro e entregar comprovante com título, data e código aleatório de 12 caracteres, que prova a participação sem informar a alternativa.
- **Fluxo:** 1) exibe "Seu voto foi registrado"; 2) mostra o código, oferece PDF e envia por e- mail; 3) inclui no histórico (RF014).
- **Falha no e-mail:** O comprovante permanece no histórico.
- **Regras:** Voto irretratável (RN06); Sigilo do voto (RN07).

### RF039 – Impedir voto duplicado

- **O que faz:** O sistema deve impedir segundo voto do mesmo cidadão na consulta em qualquer circunstância (outro dispositivo, requisições simultâneas, duplo clique ou nova conta com o mesmo CPF), em três camadas: interface, regra de negócio e restrição de unicidade no banco.
- **Fluxo:** 1) verifica participação anterior; 2) se houver, mostra "Você já participou em [data]" e o comprovante; 3) em envios simultâneos, o banco recusa o segundo; 4) audita.
- **Mais de 5 tentativas por minuto:** Limita e alerta (RF060).
- **Regras:** CPF único (RN02); Voto único (RN05); Participação após desativação (RN33).

### RF040 – Rejeitar votos fora do período

- **O que faz:** O sistema deve recusar voto em consulta que não esteja Aberta ou fora do período, conferido sempre pelo horário do servidor, inclusive em cédulas abertas antes da mudança de situação.
- **Fluxo:** 1) na gravação, lê situação e horário do servidor; 2) se fora do permitido, desfaz e informa o motivo; 3) audita.
- **Regras:** Período de votação (RN08); Consulta suspensa (RN09); Consulta cancelada (RN10); Encerramento irreversível (RN32).

### RF041 – Verificar comprovante de voto

- **O que faz:** O sistema deve oferecer página pública em que, pelo código do comprovante, se confirme que a participação consta e foi contabilizada, sem revelar alternativa nem eleitor.
- **Fluxo:** 1) informa o código; 2) o sistema exibe consulta, data e situação ("Registrado", "Contabilizado" ou "Consulta cancelada").
- **Código inexistente ou excesso de consultas do mesmo IP:** Informa ou exige CAPTCHA.
- **Regras:** Sigilo do voto (RN07); Consulta cancelada (RN10).

### RF042 – Apurar votos

- **O que faz:** O sistema deve apurar a consulta Encerrada pela regra publicada antes da abertura (RN18), sem presumir o formato "Sim/Não": votos por alternativa, válidos, abstenções e total; percentuais sobre os válidos; participação sobre os elegíveis estimados, como indicador descritivo (RN41); quórum de referência, se adotado; e desempate. A apuração é determinística e gera resultado preliminar.
- **Pré-condição:** Consulta Encerrada e integridade verificada (RF059).
- **Fluxo:** 1) bloqueia a base de votos; 2) conta e confere com as participações; 3) calcula percentuais (RN19) e aplica quórum e critério; 4) grava o preliminar com hash; 5) muda para Apurada e avisa.
- **Abaixo do quórum, empate sem regra ou nenhum voto:** Registra a condição, sem vencedora.
- **Recontagem:** Antes da publicação, comparada à anterior.
- **Ocorrência de integridade:** Apuração suspensa (RF060).
- **Entrada:** Votos e regra.
- **Saída:** Resultado preliminar com hash.
- **Permissões:** Somente o sistema; ninguém altera votos.
- **Regras:** Consulta cancelada (RN10); Sigilo das parciais (RN16); Quórum de referência (RN17); Regra de apuração (RN18); Percentuais (RN19); Limites administrativos (RN39); Resultados (RN41).
- **A validar com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF043 – Homologar e publicar resultado final

- **O que faz:** O sistema deve permitir que o administrador com papel de publicação revise o preliminar, a metodologia e as ocorrências e publique o resultado final, com nota obrigatória sobre a natureza consultiva e os próximos passos. A publicação torna o resultado imutável. Publicar o preliminar antes da homologação depende de decisão (*) e exige o rótulo "Preliminar".
- **Pré-condição:** Consulta Apurada.
- **Fluxo:** 1) revisa; 2) redige a nota e publica; 3) o sistema registra autor e data, bloqueia alterações e notifica (RF055).
- **Retificação:** Comprovado erro, publica-se retificação justificada; o original permanece visível.
- **Entrada:** Preliminar e nota.
- **Saída:** Resultado final.
- **Permissões:** Papel de publicação.
- **Regras:** Justificativa obrigatória (RN11); Resultado imutável (RN29); Natureza consultiva (RN34); Resultados (RN41); Encaminhamentos (RN42).
- **A validar com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF044 – Visualizar resultado da consulta

- **O que faz:** O sistema deve exibir publicamente tema, objetivo, período (e justificativa, se reduzido), participações, votos e percentual por alternativa, abstenções, forma de contabilização, metodologia, quórum de referência, rótulo "Preliminar" ou "Final" com datas, nota oficial, ocorrências, hash e o aviso "Resultado de participação voluntária; não representa estatisticamente toda a população do município", além dos encaminhamentos (RF063), em gráfico com tabela.
- **Fluxo:** 1) acessa o resultado; 2) o sistema exibe dados, metodologia e aviso; 3) oferece download (RF045).
- **Resultado não publicado ou consulta cancelada:** Exibe a situação, sem números por alternativa.
- **Entrada:** Consulta.
- **Saída:** Página de resultado.
- **Permissões:** Pública; somente agregados.
- **Regras:** Sigilo das parciais (RN16); Quórum de referência (RN17); Percentuais (RN19); Resultado imutável (RN29); Resultados (RN41); Encaminhamentos (RN42).
- **A validar com o cliente (*):** Regra de apuração, quórum e publicação do resultado preliminar.

### RF045 – Exportar resultados em formato aberto

- **O que faz:** O sistema deve permitir baixar resultados publicados e dados agregados em CSV, JSON e PDF, sem dados pessoais nem votos individuais.
- **Fluxo:** 1) escolhe formato e período; 2) o sistema gera o arquivo com contagens, percentuais, datas e hash.
- **Sem dados no período:** Informa.
- **Regras:** Sigilo do voto (RN07); Proteção de dados (RN27).

### RF046 – Gerenciar usuários

- **O que faz:** O sistema deve permitir que o gestor de acessos pesquise contas, crie contas administrativas por convite válido por 72 horas e bloqueie, desbloqueie ou desative contas com justificativa, sem ver senhas nem votos.
- **Fluxo:** 1) informa nome, matrícula, e-mail institucional e órgão; 2) o sistema valida a unicidade; 3) envia o convite; 4) o convidado define senha e segundo fator; 5) audita.
- **Bloqueio:** Encerra sessões; atos anteriores permanecem válidos.
- **Remover o último gestor ou bloquear a si mesmo:** Recusado.
- **Regras:** Gestão de acessos (RN21); Contas administrativas não votam (RN22); Proteção de dados (RN27); Registros imutáveis (RN28).

### RF047 – Gerenciar papéis e permissões

- **O que faz:** O sistema deve permitir manter os papéis administrativos (seção 4) como conjuntos de permissões e atribuí-los às contas, impedindo combinações vedadas.
- **Fluxo:** 1) cria ou edita o papel; 2) o sistema valida combinações; 3) aplica na próxima requisição (RF009); 4) audita antes e depois.
- **Exclusão de papel em uso:** Recusada até a migração das contas.
- **Regras:** Segregação de funções (RN20); Gestão de acessos (RN21); Responsabilidades (RN36).

### RF048 – Monitorar consultas em andamento

- **O que faz:** O sistema deve oferecer painel interno com situação, participações, evolução diária, pendências administrativas, ocorrências (denúncias, alertas de integridade), tempo até o encerramento e tentativas recusadas por motivo, sem contagem por alternativa para nenhum perfil (RN16). Nenhuma ação do painel altera votos (RN39); parciais públicas não foram adotadas (*).
- **Fluxo:** 1) abre o painel; 2) o sistema atualiza os indicadores a cada 5 minutos; 3) o administrador detalha uma consulta e, com permissão, aciona RF032 ou RF033.
- **Baixa participação, denúncia ou alerta:** Destaca a consulta, com link para RF062, RF066 ou RF060.
- **Entrada:** Agregados.
- **Saída:** Indicadores a cada 5 min.
- **Permissões:** Papel de acompanhamento; sem parciais.
- **Regras:** Sigilo das parciais (RN16); Quórum de referência (RN17); Limites administrativos (RN39).
- **A validar com o cliente (*):** Exibição de resultados parciais.

### RF049 – Gerar relatórios e estatísticas

- **O que faz:** O sistema deve gerar relatórios agregados por período, tema, região e situação (consultas, participação, cadastros, propostas e tempo de tramitação), suprimindo grupos com menos de 10 pessoas, exportáveis em PDF e CSV.
- **Fluxo:** 1) escolhe relatório e filtros; 2) o sistema gera gráficos e tabelas; 3) exporta e audita.
- **Grupo com menos de 10 pessoas:** Exibido como "menos de 10".
- **Regras:** Sigilo do voto (RN07); Sigilo das parciais (RN16); Proteção de dados (RN27).

### RF050 – Disponibilizar portal público de transparência

- **O que faz:** O sistema deve oferecer, sem login, portal com consultas, propostas publicadas, resultados, encaminhamentos, histórico e indicadores gerais, e a página "Como funciona", que explica a natureza consultiva, o sigilo, o voto único, a apuração e a verificação de comprovantes.
- **Fluxo:** 1) acessa o portal; 2) o sistema exibe indicadores diários; 3) o usuário navega por RF016–RF018, RF044, RF045, RF056 e RF063.
- **Regras:** Sigilo do voto (RN07); Sigilo das parciais (RN16); Proteção de dados (RN27); Natureza consultiva (RN34).

### RF051 – Exibir histórico público da consulta

- **O que faz:** O sistema deve exibir, em cada consulta publicada, linha do tempo com publicação, divulgação, abertura, alterações, suspensões, cancelamento, encerramento, apuração, resultados, retificações e encaminhamentos, com data, hora, justificativa e unidade responsável.
- **Fluxo:** 1) cada evento gera registro; 2) o usuário abre "Histórico"; 3) o sistema exibe em ordem cronológica, sem edição ou exclusão.
- **Regras:** Justificativa obrigatória (RN11); Registros imutáveis (RN28).

### RF052 – Gerenciar preferências de notificação

- **O que faz:** O sistema deve permitir escolher avisos por tipo (novas consultas, abertura, alterações, lembretes, resultados, encaminhamentos e respostas a propostas), tema e bairro, por e-mail e central de avisos; avisos obrigatórios não podem ser desligados.
- **Fluxo:** 1) abre "Notificações"; 2) altera e salva.
- **Descadastro pelo e-mail:** Link desativa o tipo de aviso sem login.
- **Regras:** Proteção de dados (RN27).

### RF053 – Notificar nova consulta e abertura

- **O que faz:** O sistema deve avisar os interessados quando uma consulta for publicada e, na abertura, quem se enquadra no público-alvo, com título, resumo, período e link.
- **Fluxo:** 1) seleciona destinatários por preferência e público-alvo; 2) monta a mensagem; 3) envia em fila e registra.
- **Falha de envio:** Até 3 tentativas; o aviso permanece na central.
- **Regras:** Elegibilidade (RN01); Público-alvo (RN35).

### RF054 – Notificar alterações, suspensão e cancelamento

- **O que faz:** O sistema deve notificar alterações, suspensões, retomadas e cancelamentos, informando o que mudou, a justificativa e o efeito sobre os votos; quem votou é sempre avisado.
- **Fluxo:** 1) identifica evento e destinatários; 2) monta a mensagem; 3) envia e registra.
- **Regras:** Consulta suspensa (RN09); Consulta cancelada (RN10); Justificativa obrigatória (RN11).

### RF055 – Notificar lembrete, resultado e encaminhamentos

- **O que faz:** O sistema deve enviar lembrete a quem se enquadra e ainda não participou, 48 horas antes do encerramento; aviso de encerramento; aviso de resultado a quem votou; e aviso de novos encaminhamentos a quem optou por recebê-los.
- **Fluxo:** 1) identifica evento e destinatários; 2) no lembrete, exclui quem já participou; 3) envia e registra.
- **Consulta suspensa no horário do lembrete:** Adiado para após a retomada.
- **Regras:** Voto único (RN05); Encaminhamentos (RN42).

### RF056 – Consultar acervo de consultas encerradas

- **O que faz:** O sistema deve manter acervo público permanente das consultas finalizadas e canceladas, com dados, anexos, histórico, resultados e encaminhamentos, pesquisável por ano, tema, região e resultado.
- **Fluxo:** 1) abre "Consultas anteriores"; 2) filtra e abre uma consulta (RF018, RF044, RF051).
- **Regras:** Registros imutáveis (RN28); Resultado imutável (RN29).

### RF057 – Registrar trilha de auditoria

- **O que faz:** O sistema deve registrar, em log somente de acréscimo e encadeado por hash, logins e falhas, bloqueios, alterações cadastrais (sem valores), atos sobre propostas e consultas, designação de papéis, autorizações de prazo, moderação, apurações, publicações, encaminhamentos, mudanças de permissão e acessos negados, com data e hora do servidor, autor, papel, ação, objeto, resultado e justificativa.
- **Fluxo:** 1) o componente gera o evento; 2) o sistema completa os campos e o hash; 3) grava sem permitir alteração.
- **Falha ao auditar ato administrativo:** O ato é desfeito.
- **Regras:** Sigilo do voto (RN07); Registros imutáveis (RN28).

### RF058 – Consultar trilha de auditoria

- **O que faz:** O sistema deve permitir ao gestor de acessos filtrar o log por período, usuário, ação e objeto, exportar em CSV e verificar o encadeamento.
- **Fluxo:** 1) filtra; 2) o sistema exibe e permite exportar e verificar; 3) a consulta é auditada.
- **Encadeamento quebrado:** Indica o primeiro registro inconsistente e alerta (RF060).
- **Regras:** Gestão de acessos (RN21); Registros imutáveis (RN28).

### RF059 – Verificar integridade da votação e da apuração

- **O que faz:** O sistema deve verificar, no encerramento, antes da apuração e sob demanda: votos iguais a participações; votos só em alternativas válidas; nenhuma participação duplicada ou fora do período; soma por alternativa igual ao total; percentuais somando 100% (tolerância de 0,01 ponto); e nova apuração com mesmo resultado e hash.
- **Fluxo:** 1) executa as verificações; 2) registra o relatório; 3) libera a etapa seguinte.
- **Falha:** Bloqueia apuração ou publicação e aciona RF060.
- **Regras:** Voto único (RN05); Período de votação (RN08); Consulta suspensa (RN09); Percentuais (RN19).

### RF060 – Tratar inconsistências e incidentes

- **O que faz:** O sistema deve registrar como incidentes, com severidade, falhas de integridade, votos com dados adulterados, excesso de tentativas, cadastros suspeitos e quebra da auditoria, para análise e encerramento justificado por administrador.
- **Fluxo:** 1) cria o incidente com evidências; 2) alerta; 3) em severidade alta com consulta Aberta, sugere suspensão, que depende de confirmação humana; 4) registra conclusão e encerra.
- **Contas fraudulentas que já votaram:** Como os votos não são vinculados, decide-se publicamente entre manter o resultado e cancelar (RF034).
- **Regras:** Sigilo do voto (RN07); Consulta cancelada (RN10); Justificativa obrigatória (RN11); Registros imutáveis (RN28).

### RF061 – Definir responsáveis e papéis da consulta

- **O que faz:** O sistema deve permitir que o gestor de acessos designe, para cada consulta, os responsáveis por condução, elaboração, revisão, aprovação, autorização de prazo excepcional, divulgação, acompanhamento, publicação de resultados e encaminhamentos. Uma conta pode acumular papéis, exceto elaborar ou revisar e aprovar. Publicamente aparece a unidade responsável, não o nome das pessoas.
- **Pré-condição:** Consulta em Rascunho.
- **Fluxo:** 1) abre "Responsáveis"; 2) seleciona contas por papel; 3) o sistema valida acúmulos vedados; 4) grava e notifica os designados.
- **Substituição durante a consulta:** Com justificativa no histórico.
- **Combinação vedada ou papel obrigatório vazio:** Bloqueia a submissão (RF028).
- **Entrada:** Contas e papéis.
- **Saída:** Matriz de responsabilidade.
- **Permissões:** Gestor de acessos.
- **Regras:** Segregação de funções (RN20); Gestão de acessos (RN21); Responsabilidades (RN36).
- **A validar com o cliente (*):** Divisão do Administrador em papéis.

### RF062 – Divulgar consulta

- **O que faz:** O sistema deve gerar, a partir dos dados aprovados, material de divulgação em linguagem simples (texto curto, link permanente, QR Code e cartão com tema, objetivo, público-alvo, período e instruções) e registrar os canais usados (portal, redes oficiais, avisos impressos, rádio) e as datas. A publicação externa é manual ou por integração futura; o material não traz parciais (RN16).
- **Pré-condição:** Consulta Agendada ou Aberta.
- **Fluxo:** 1) abre "Divulgação"; 2) o sistema gera o material; 3) o administrador usa e registra os canais; 4) o registro entra no histórico (RF051).
- **Proximidade do encerramento:** Sugere nova divulgação a 3 dias do fim.
- **Texto livre divergente da pergunta:** Exige revisão.
- **Entrada:** Consulta.
- **Saída:** Texto, link, QR Code e registro de canais.
- **Permissões:** Papel de divulgação.
- **Regras:** Sigilo das parciais (RN16); Conteúdo mínimo (RN37).
- **A validar com o cliente (*):** Canais de divulgação da Prefeitura.

### RF063 – Registrar e publicar encaminhamentos

- **O que faz:** O sistema deve permitir, após o resultado final, registrar encaminhamentos (decisão relacionada, providências, justificativa, órgão, situação Prevista, Em andamento, Concluída ou Não realizada e data prevista, se informada), públicos e com histórico. O sistema não cria compromissos: exibe apenas o que for registrado e, sem registro, informa "Nenhum encaminhamento registrado até [data]".
- **Pré-condição:** Resultado publicado.
- **Campos:**
  - **Decisão relacionada** – texto, obrigatório.
  - **Providências** – texto, obrigatório.
  - **Órgão responsável** – seleção única, obrigatório.
  - **Situação** – Prevista, Em andamento, Concluída ou Não realizada.
  - **Justificativa** – texto, obrigatória quando a situação for "Não realizada".
  - **Data prevista** – data, opcional.
  - **Data do registro** – data e hora do servidor. Registros anteriores são preservados.
- **Fluxo:** 1) registra; 2) o sistema valida e publica na consulta e no portal; 3) notifica quem optou (RF055).
- **Atualização:** Novo estado datado; o anterior permanece.
- **"Não realizada" sem justificativa:** Bloqueado.
- **Entrada:** Encaminhamento.
- **Saída:** Linha do tempo pública.
- **Permissões:** Papel de encaminhamentos; não altera resultado.
- **Regras:** Justificativa obrigatória (RN11); Registros imutáveis (RN28); Encaminhamentos (RN42).
- **A validar com o cliente (*):** Prazos de resposta da administração e de guarda dos registros.

### RF064 – Publicar comentários e perguntas

- **O que faz:** Se o escopo for aprovado, o sistema deve permitir que o cidadão publique comentários (até 1.000 caracteres) ou perguntas sobre consulta ou proposta publicada, com nome de exibição, sem CPF ou e-mail, ordenados por recentes ou mais úteis; a administração responde com a marca "Resposta oficial". Comentários não são votos, não entram na apuração e não são exigidos para votar.
- **Pré-condição:** Comentários habilitados na consulta.
- **Fluxo:** 1) escreve; 2) o sistema valida, remove conteúdo executável e sinaliza termos para a moderação, sem bloqueio automático; 3) publica; 4) avisa o responsável, se for pergunta.
- **Conteúdo sinalizado:** Publicado antes ou depois da revisão, conforme a política (*).
- **Entrada:** Texto.
- **Saída:** Manifestação pública.
- **Permissões:** Cidadão; dados pessoais protegidos.
- **Regras:** Proteção de dados (RN27); Manifestação não é voto (RN38); Limites administrativos (RN39); Crianças e adolescentes (RN40).
- **A validar com o cliente (*):** Quais formas de participação entram nesta versão; política de uso e moderação.

### RF065 – Denunciar conteúdo

- **O que faz:** O sistema deve permitir denunciar comentário, pergunta ou proposta publicada, com motivo (ofensa, discurso de ódio, dados pessoais expostos, propaganda, conteúdo ilegal ou outro), gerando protocolo e entrada na fila de moderação; o denunciante não é revelado ao autor.
- **Fluxo:** 1) aciona "Denunciar" e informa o motivo; 2) o sistema gera protocolo; 3) atingido o limite de denúncias (parâmetro), oculta o conteúdo até a decisão.
- **Denúncia repetida:** Ignorada.
- **Denúncias abusivas reiteradas:** Registradas, sem bloqueio automático.
- **Entrada:** Motivo.
- **Saída:** Protocolo.
- **Permissões:** Usuário autenticado; denunciante anônimo ao autor.
- **Regras:** Justificativa obrigatória (RN11); Limites administrativos (RN39).
- **A validar com o cliente (*):** Política de uso e moderação.

### RF066 – Moderar conteúdo e revisar decisões

- **O que faz:** O sistema deve permitir que o moderador decida manter, ocultar trecho com dados pessoais ou remover o conteúdo, com justificativa baseada na política de uso; o autor é notificado e pode pedir uma revisão, feita por outro moderador. A moderação nunca atua sobre votos, participações ou resultados (RN39).
- **Fluxo:** 1) abre a fila, priorizada por motivo; 2) analisa; 3) decide e justifica; 4) o sistema aplica, notifica sem revelar identidades e audita.
- **Pedido de revisão:** Outro moderador decide em definitivo.
- **Moderador é autor ou denunciante:** Bloqueado.
- **Entrada:** Decisão.
- **Saída:** Conteúdo mantido, ocultado ou removido.
- **Permissões:** Moderador; sem acesso a votos.
- **Regras:** Justificativa obrigatória (RN11); Registros imutáveis (RN28); Limites administrativos (RN39).
- **A validar com o cliente (*):** Política de uso e moderação.

### RF067 – Apoiar proposta cidadã

- **O que faz:** Se adotado, o sistema deve permitir um apoio por cidadão a cada proposta Publicada e exibir o total; atingida a meta no prazo, ambos configuráveis, a proposta recebe análise prioritária com resposta obrigatória (RF021). Os dados de entrada citam 4 meses e 20 mil apoios, valores de um portal legislativo federal (Apêndice B), não adotados por poderem ser desproporcionais ao eleitorado municipal. Apoio não é voto nem subscrição de iniciativa popular.
- **Fluxo:** 1) aciona "Apoiar"; 2) o sistema verifica apoio anterior e registra; 3) atingida a meta, muda o estado e notifica.
- **Prazo encerrado sem meta:** Segue a resposta regular.
- **Apoio repetido:** Recusado.
- **Entrada:** Apoio.
- **Saída:** Total e eventual mudança de estado.
- **Permissões:** Cidadão autenticado; um apoio por proposta.
- **Regras:** Propostas cidadãs (RN30); Natureza consultiva (RN34); Manifestação não é voto (RN38).
- **A validar com o cliente (*):** Quais formas de participação entram nesta versão; limite, apoios e metas das propostas cidadãs.

### RF068 – Divulgar evento participativo e receber perguntas

- **O que faz:** Se adotado, o sistema deve permitir cadastrar evento vinculado a consulta (audiência, reunião ou debate), com pauta, data, local, link de transmissão em serviço externo e, depois, gravação legendada, ata e resumo. O cidadão envia perguntas antecipadas e durante a transmissão; perguntas por telefone são registradas por atendente. A plataforma não transmite vídeo nem faz videochamadas, e o evento não substitui o rito da audiência.
- **Fluxo:** 1) cadastra evento e pauta; 2) publica e abre perguntas; 3) no evento, exibe o link e recebe perguntas; 4) depois, anexa gravação, ata e resumo (RF023).
- **Pergunta por telefone:** Registrada com protocolo.
- **Transmissão indisponível:** Aviso com data da gravação.
- **Entrada:** Pauta e perguntas.
- **Saída:** Evento, perguntas e materiais.
- **Permissões:** Administrador; atendimento por telefone.
- **Regras:** Conteúdo mínimo (RN37); Manifestação não é voto (RN38); Limites administrativos (RN39).
- **A validar com o cliente (*):** Quais formas de participação entram nesta versão.

## 4. Requisitos não funcionais

| ID | Requisito | Descrição | Prioridade |
| --- | --- | --- | --- |
| RNF01 | Externo – acessibilidade | **Acesso para todos.** Páginas e conteúdos conformes ao nível AA da WCAG 2.2 e às recomendações do eMAG 3.1; verificação automática e manual com leitor de tela nas páginas inicial, de consulta, de participação e de resultado, sem falhas de nível A ou AA. | Essencial |
| RNF02 | Produto – facilidade de uso | **Linguagem simples.** Textos da interface e das consultas em linguagem simples, conferidos na revisão (RF028); participar a partir da página da consulta em até 3 passos, sem contar o login. | Importante |
| RNF03 | Produto – portabilidade | **Uso no celular.** Uso completo a partir de 320 px de largura sem rolagem horizontal (WCAG 1.4.10) e alvos de toque com no mínimo 24 × 24 px (WCAG 2.5.8). | Importante |
| RNF04 | Produto – eficiência | **Internet fraca (\*).** Páginas inicial e de consulta funcionam sem vídeo e com imagens carregadas sob demanda; meta sugerida de até 1 MB transferido no primeiro acesso. | Importante |
| RNF05 | Produto – segurança | **Segurança da comunicação e do acesso.** Comunicação somente por HTTPS (TLS 1.2 ou superior); senhas com hash adaptativo; controle de acesso verificado no servidor em toda rota; testes baseados no OWASP Top 10 antes da operação. | Essencial |
| RNF06 | Externo – legal | **Proteção dos dados pessoais.** Minimização de dados; nenhum dado pessoal em páginas públicas, exportações ou registros de aplicação; relatório de impacto à proteção de dados recomendado antes da operação. | Essencial |
| RNF07 | Produto – confiabilidade | **Integridade do voto.** Participação e voto gravados na mesma transação e em estruturas sem vínculo; teste de concorrência com envios simultâneos do mesmo cidadão resulta em um único voto; hash da base apurada publicado. | Essencial |
| RNF08 | Produto – segurança | **Registro de tudo o que a administração faz (\*).** Todo ato administrativo registra autor, data e hora do servidor, ação e valores anterior e novo, em trilha somente de acréscimo e encadeada por hash. | Importante |
| RNF09 | Produto – desempenho | **Tempo de resposta (\*).** Meta sugerida: 95% das páginas públicas em até 2 s e 95% dos registros de voto em até 3 s, sob carga de referência a definir com o município. | Importante |
| RNF10 | Produto – confiabilidade | **Disponibilidade (\*).** Meta sugerida: 99,5% mensal durante consultas abertas; manutenção programada fora dos períodos de votação e anunciada com antecedência. | Importante |
| RNF11 | Produto – portabilidade | **Uso em vários navegadores.** Duas últimas versões de Chrome, Edge, Firefox e Safari, inclusive em celulares; leitores de tela NVDA e TalkBack. | Importante |
| RNF12 | Organizacional – manutenibilidade | **Parâmetros sem mexer no código.** Prazos, limites, quórum, metas e textos padrão configuráveis sem alterar código; testes automatizados das regras RN05–RN08, RN14 e RN18. | Importante |
| RNF13 | Externo – legal (transparência) | **Dados abertos.** Resultados e encaminhamentos em CSV e JSON, com dicionário de dados e sem dados pessoais. | Importante |
| RNF14 | Produto – confiabilidade | **Voto sem perda (\*).** Voto confirmado só após gravação completa; falha durante o registro não gera voto parcial e permite nova tentativa; cópias de segurança diárias com teste periódico de restauração (meta sugerida). | Importante |
| RNF15 | Produto – facilidade de uso | **Inclusão digital (\*).** Conteúdos essenciais legíveis sem vídeo nem plug-ins; atendimento assistido para registrar propostas e perguntas (RF068), sem votar em nome do cidadão. | Importante |

## 5. Requisitos de segurança

| ID | Perigo | Soluções |
| --- | --- | --- |
| RS001 | No RF037 e no RF039 foi verificado que o mesmo cidadão poderia registrar mais de um voto na consulta, por outro dispositivo, por duplo clique, por requisições ao mesmo tempo ou por nova conta com o mesmo CPF. | 1. Restrição de unicidade do par cidadão–consulta no banco de dados, além da verificação na tela e na regra de negócio (RF039, RN05). 2. Manter o hash do CPF mesmo depois da desativação da conta (RN33). 3. Teste de concorrência com envios simultâneos do mesmo cidadão (RNF07). |
| RS002 | Nos RF037, RF041 e RF049 foi verificado que alguém, inclusive um administrador, poderia descobrir em qual alternativa um cidadão votou. | 1. Gravar participação e voto em estruturas sem vínculo, sem horário exato e sem o código do comprovante junto ao voto (RN07). 2. O comprovante não informa a alternativa escolhida (RF038). 3. Relatórios só com dados agregados, ocultando grupos com menos de 10 pessoas (RF049). |
| RS003 | Nos RF042, RF043 e RF066 foi verificado que votos ou resultados poderiam ser alterados por uma ferramenta administrativa ou de moderação. | 1. Nenhuma ação administrativa ou de moderação altera, exclui ou revela votos (RN39). 2. Resultado final imutável; só muda por retificação justificada e visível (RN29). 3. Hash da base apurada e verificação de integridade antes da apuração (RF059). |
| RS004 | Nos RF001 e RF004 foi verificado que contas falsas ou de outra pessoa poderiam participar das consultas. | 1. Verificação de identidade pelo gov.br ou por análise documental (RF004). 2. Confirmação adicional de identidade antes do voto (RF011). 3. Registrar cadastros suspeitos como incidentes (RF060). |
| RS005 | Nos RF012, RF045 e RF064 foi verificado que dados pessoais poderiam aparecer em páginas públicas, exportações ou registros. | 1. Coletar só o necessário, com finalidade declarada, e mostrar o CPF mascarado (RN27). 2. Exportações apenas com dados agregados (RF045). 3. Relatório de impacto à proteção de dados antes da operação (RNF06). |
| RS006 | Nos RF009, RF029 e RF061 foi verificado que uma conta administrativa poderia acessar o que não deve ou acumular funções (elaborar e aprovar a mesma consulta). | 1. Controle de acesso verificado no servidor em toda requisição (RF009). 2. Separação de funções: quem elabora ou revisa não aprova (RN20, RN36). 3. Segundo fator de autenticação obrigatório para contas administrativas (RF005). |
| RS007 | Nos RF005 e RF007 foi verificado o risco de alguém adivinhar senhas por tentativa e erro ou tomar a conta de outra pessoa. | 1. Bloqueio por 15 minutos após 5 falhas seguidas e CAPTCHA por IP (RN24, RF010). 2. Link de recuperação de uso único, válido por 30 minutos (RN25). 3. Sessão expira por inatividade (RN26) e HTTPS obrigatório (RNF05). |
| RS008 | No RF048 foi verificado que a divulgação de resultados parciais durante a votação poderia influenciar quem ainda não votou. | 1. Durante a votação, mostrar só o número de participações, para qualquer perfil (RN16). 2. Parciais só com decisão explícita do cliente (\*). |
| RS009 | Nos RF019 e RF040 foi verificado que um voto poderia ser aceito fora do período por causa do relógio do aparelho ou de atraso da rotina automática. | 1. Conferir a situação e o período sempre pelo horário do servidor (RF040, RN08). 2. Recusar e registrar na auditoria os votos fora do período. |
| RS010 | Nos RF027 e RF064 foi verificado que dados de crianças e adolescentes poderiam ser tratados sem os cuidados exigidos. | 1. Forma de participação definida por consulta, com coleta mínima e linguagem adequada (RN40). 2. Consentimento de um dos pais quando o tratamento depender de consentimento. 3. Análise jurídica antes da operação (\*). |
| RS011 | Nos RF020 e RF064 foi verificado que comentários e propostas poderiam conter conteúdo ofensivo, ilegal ou dados pessoais. | 1. Denúncia com protocolo e ocultação preventiva (RF065). 2. Moderação justificada, com direito a um pedido de revisão (RF066). |
| RS012 | Nos RF020 e RF023 foi verificado que poderia ser anexado um arquivo com vírus. | 1. Verificar o formato real, o tamanho e a presença de vírus antes de guardar o arquivo (RF023). 2. Guardar cada arquivo com hash SHA-256. |
| RS013 | Nos RF057 e RF058 foi verificado que a trilha de auditoria poderia ser adulterada ou perdida. | 1. Log somente de acréscimo, encadeado por hash (RF057). 2. Verificação do encadeamento com alerta de segurança (RF058, RF060). 3. Cópia de segurança diária com teste de restauração (RNF14). |

## 6. Matriz de avaliação de risco

| Probabilidade \ Severidade | Catastrófico (1) | Crítico (2) | Marginal (3) | Insignificante (4) |
| --- | --- | --- | --- | --- |
| Frequente (A) | | | | |
| Provável (B) | | | RS011 | |
| Ocasional (C) | | RS004, RS010 | RS007 | |
| Remoto (D) | RS002, RS003 | RS005, RS006, RS012 | | |
| Improvável (E) | RS001 | RS013 | RS008, RS009 | |
| Eliminado (F) | | | | |

Cores do documento original: vermelho (A1, A2, B1, B2, C1), laranja (A3, B3, C2, D1), amarelo (A4, B4, C3, D2, D3, E1, E2, E3), verde (C4, D4, E4), azul (F).

## 7. Matriz de rastreabilidade – requisito funcional

### 7.1 Matriz principal (D = depende de; R = relaciona-se com)

| Linha → Coluna | RF018 | RF022 | RF025 | RF026 | RF027 | RF028 | RF029 | RF030 | RF037 | RF042 | RF043 | RF044 | RF061 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF018 | | | | | | | | | | | | D | |
| RF022 | | | | | | R | | | | | | | |
| RF025 | | D | | D | D | | R | | | | | | D |
| RF026 | | | | | | | | | | | | | |
| RF027 | D | | D | | | R | | | | | | | |
| RF028 | | | D | D | D | | D | | | | | | |
| RF029 | | | | | | D | | D | | | | | D |
| RF030 | | | | | | | | | | | | | |
| RF037 | | | | | | | | | | | | | |
| RF042 | | | | | | | | | | | D | | |
| RF043 | | | | | | | | | | D | | D | |
| RF044 | | | | | | | | | | | D | | |
| RF061 | | | D | D | D | D | D | D | | | | | |

### 7.2 Dependências de todos os requisitos

| Requisito | D (depende de) | R (relaciona-se com) |
| --- | --- | --- |
| RF001 | RF002, RF003 | RF004, RF007, RF027 |
| RF002 | — | RF001, RF013, RF036 |
| RF003 | — | RF004 |
| RF004 | — | — |
| RF005 | — | RF010 |
| RF006 | — | — |
| RF007 | — | — |
| RF008 | — | RF010 |
| RF009 | RF047 | — |
| RF010 | — | — |
| RF011 | — | — |
| RF012 | RF004, RF008, RF013, RF014, RF015, RF052  — | — |
| RF013 | RF002 | — |
| RF014 | RF020, RF041, RF063 | — |
| RF015 | — | — |
| RF016 | — | RF052 |
| RF017 | — | — |
| RF018 | RF019, RF023, RF036, RF044, RF063 | RF051 |
| RF019 | RF031, RF035 | RF040 |
| RF020 | RF004, RF014, RF021 | RF067 |
| RF021 | RF020, RF022, RF066 | — |
| RF022 | — | RF028 |
| RF023 | RF018, RF028 | RF032 |
| RF024 | — | RF032 |
| RF025 | RF022, RF026, RF027, RF061 | RF029 |
| RF026 | — | — |
| RF027 | RF018, RF025, RF036 | RF028 |
| RF028 | RF025, RF026, RF027, RF029 | — |
| RF029 | RF028, RF030, RF061 | — |
| RF030 | RF053 | — |
| RF031 | RF019, RF053 | — |
| RF032 | RF054 | — |
| RF033 | RF054 | RF034 |
| RF034 | — | RF043 |
| RF035 | RF042, RF055, RF059 | RF060 |
| RF036 | RF004, RF027 | — |
| RF037 | RF011, RF038 | RF060 |
| RF038 | RF014 | — |
| RF039 | — | RF060 |
| RF040 | — | — |
| RF041 | — | — |
| RF042 | RF035, RF043, RF059 | RF060 |
| RF043 | RF042, RF044, RF055, RF063 | — |
| RF044 | RF043, RF045, RF063 | — |
| RF045 | — | — |
| RF046 | — | — |
| RF047 | RF009 | — |
| RF048 | RF019, RF032, RF033, RF059, RF065 | RF060, RF062, RF066 |
| RF049 | — | — |
| RF050 | RF016, RF017, RF018, RF044, RF045, RF056, RF063 | — |
| RF051 | — | — |
| RF052 | — | — |
| RF053 | — | — |
| RF054 | — | — |
| RF055 | — | — |
| RF056 | RF018, RF044, RF051 | — |
| RF057 | — | — |
| RF058 | — | RF060 |
| RF059 | — | RF060 |
| RF060 | — | RF034 |
| RF061 | RF009, RF025, RF026, RF027, RF028, RF029, RF030, RF047 | — |
| RF062 | RF030, RF051, RF053 | — |
| RF063 | RF043, RF044, RF055 | — |
| RF064 | RF065, RF066 | — |
| RF065 | RF066 | — |
| RF066 | RF057, RF065 | — |
| RF067 | RF020, RF021 | — |
| RF068 | RF023, RF064, RF065 | — |

## 8. Ponto de função

Contagem do tipo **projeto em desenvolvimento**. Escopo: os 68 requisitos funcionais. Dentro da fronteira ficam os dados mantidos pela própria plataforma; gov.br, serviço de e-mail e serviço externo de vídeo ficam fora dela e foram contados como AIE.

Pesos usados:

| Componente | Baixa | Média | Alta |
| --- | ---: | ---: | ---: |
| Consulta Externa (CE) | 3 | 4 | 6 |
| Entrada Externa (EE) | 3 | 4 | 6 |
| Saída Externa (SE) | 4 | 5 | 7 |
| Arquivo de Interface Externa (AIE) | 5 | 7 | 10 |
| Arquivo Lógico Interno (ALI) | 7 | 10 | 15 |

| Requisito | Complexidade | ALI | AIE | SE | EE | CE | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RF001 | MÉDIA | 10 | 0 | 0 | 4 | 0 | 14 |
| RF002 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF003 | BAIXA | 0 | 5 | 0 | 3 | 0 | 8 |
| RF004 | ALTA | 0 | 5 | 0 | 6 | 0 | 11 |
| RF005 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF006 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF007 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF008 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF009 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF010 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF011 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF012 | BAIXA | 0 | 0 | 0 | 0 | 3 | 3 |
| RF013 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF014 | MÉDIA | 0 | 0 | 0 | 0 | 4 | 4 |
| RF015 | MÉDIA / BAIXA | 0 | 0 | 5 | 3 | 0 | 8 |
| RF016 | MÉDIA | 0 | 0 | 0 | 0 | 4 | 4 |
| RF017 | MÉDIA | 0 | 0 | 0 | 0 | 4 | 4 |
| RF018 | ALTA | 0 | 0 | 0 | 0 | 6 | 6 |
| RF019 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF020 | MÉDIA | 10 | 0 | 0 | 4 | 0 | 14 |
| RF021 | ALTA | 0 | 0 | 0 | 6 | 0 | 6 |
| RF022 | MÉDIA | 10 | 0 | 0 | 4 | 0 | 14 |
| RF023 | MÉDIA | 0 | 5 | 0 | 4 | 0 | 9 |
| RF024 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF025 | ALTA | 15 | 0 | 0 | 6 | 0 | 21 |
| RF026 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF027 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF028 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF029 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF030 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF031 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF032 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF033 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF034 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF035 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF036 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF037 | ALTA | 10 | 0 | 0 | 6 | 0 | 16 |
| RF038 | BAIXA | 0 | 0 | 4 | 0 | 0 | 4 |
| RF039 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF040 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| RF041 | BAIXA | 0 | 0 | 0 | 0 | 3 | 3 |
| RF042 | ALTA | 10 | 0 | 7 | 0 | 0 | 17 |
| RF043 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF044 | MÉDIA | 0 | 0 | 5 | 0 | 0 | 5 |
| RF045 | MÉDIA | 0 | 0 | 5 | 0 | 0 | 5 |
| RF046 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF047 | MÉDIA | 7 | 0 | 0 | 4 | 0 | 11 |
| RF048 | MÉDIA | 0 | 0 | 5 | 0 | 0 | 5 |
| RF049 | ALTA | 0 | 0 | 7 | 0 | 0 | 7 |
| RF050 | MÉDIA | 0 | 0 | 5 | 0 | 0 | 5 |
| RF051 | BAIXA | 7 | 0 | 0 | 0 | 3 | 10 |
| RF052 | BAIXA | 7 | 0 | 0 | 3 | 0 | 10 |
| RF053 | BAIXA | 0 | 0 | 4 | 0 | 0 | 4 |
| RF054 | BAIXA | 0 | 0 | 4 | 0 | 0 | 4 |
| RF055 | BAIXA | 0 | 0 | 4 | 0 | 0 | 4 |
| RF056 | MÉDIA | 0 | 0 | 0 | 0 | 4 | 4 |
| RF057 | BAIXA | 10 | 0 | 0 | 3 | 0 | 13 |
| RF058 | MÉDIA | 0 | 0 | 0 | 0 | 4 | 4 |
| RF059 | MÉDIA | 0 | 0 | 5 | 0 | 0 | 5 |
| RF060 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF061 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF062 | BAIXA | 0 | 0 | 4 | 0 | 0 | 4 |
| RF063 | MÉDIA | 7 | 0 | 0 | 4 | 0 | 11 |
| RF064 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF065 | BAIXA | 10 | 0 | 0 | 3 | 0 | 13 |
| RF066 | MÉDIA | 0 | 0 | 0 | 4 | 0 | 4 |
| RF067 | BAIXA | 0 | 0 | 0 | 3 | 0 | 3 |
| RF068 | MÉDIA | 7 | 0 | 0 | 4 | 0 | 11 |
| **TOTAL** | | **120** | **15** | **64** | **150** | **35** | **384** |

**Total: 384 pontos de função não ajustados.** Cada ALI e cada AIE foi contado uma única vez, na linha do requisito que mantém aqueles dados; requisitos que são só regras internas de outro processo (RF002, RF006, RF009, RF010, RF036, RF039 e RF040) não somam pontos.

## 9. Referências

1. Baseado no documento de requisitos disponível em <http://demo.chiliproject.org/attachments/169/documentoRequisitos.doc>.
2. JOÃO PEDRO; FLAVIA MARINA. *Especificação de Requisitos de Software – Plataforma de Participação Cidadã Municipal*: versão 2.0. Trabalho acadêmico. Outubro de 2026.
3. ABNT. NBR 6024: numeração progressiva das seções de um documento. Rio de Janeiro: ABNT, 2012.
4. ABNT. NBR 14724: trabalhos acadêmicos: apresentação. Rio de Janeiro: ABNT, 2011.
5. BRASIL. MPOG. eMAG: Modelo de Acessibilidade em Governo Eletrônico. Versão 3.1. 2014.
6. ISO/IEC/IEEE 29148:2018 — requirements engineering.
7. PRESSMAN, R. S.; MAXIM, B. R. *Engenharia de software*. 9. ed. AMGH, 2021.
8. SOMMERVILLE, I. *Engenharia de software*. 10. ed. Pearson, 2019.
9. W3C. Web Content Accessibility Guidelines (WCAG) 2.2. 2023.
