# Pendências de validação com o cliente (*)

Itens marcados com (\*) no Documento de Requisitos v6 e lacunas encontradas na análise. Nenhum foi tratado como decisão aprovada: cada um está implementado de forma **configurável** ou **desligável**, com o valor provisório indicado.

| # | Pendência | Origem | Como está no sistema | Onde mudar |
|---|---|---|---|---|
| 1 | Caráter sempre consultivo da votação | §2.1, RF018 | Sempre consultivo; avisos em todas as telas; opção “vinculante” inexistente | — (decisão de produto) |
| 2 | Divisão do Administrador em papéis | §2.1, RF028, RF061 | 13 papéis do documento como conjuntos de permissões editáveis | `/admin/papeis` |
| 3 | Dados exigidos no cadastro e obrigatoriedade do CPF | RF001, RF002 | CPF obrigatório **com validação dos dígitos verificadores** — o Documento v6 (DT-29) passou a aceitar CPF fictício sem verificador, mas o sistema não foi alterado, aguardando a avaliação dos professores. Atenção: com CPF sem verificador, a verificação pelo gov.br (RF004, RS004) sempre recusaria a conta | `auth.service.ts`, `identity.service.ts` |
| 4 | Prazo padrão de 20 dias; redução para 10; o que é emergência; quem autoriza | RF025, RF029 | 20 / 10 dias; redução exige justificativa + papel “Autorizador de prazo excepcional” | `/admin/configuracoes` |
| 5 | Público-alvo padrão das consultas | RF027, RF036 | Padrão herdado: **domicílio no município** | `consulta.publico_padrao` |
| 6 | Participação de crianças e adolescentes | RF027, RF036, RS010 | **Só vota quem tem 18 anos completos** (DT-30). O RF027 ainda cita a modalidade "voto" para crianças e adolescentes, o que contradiz o RF036: no sistema, a modalidade "voto" não é mais selecionável (ficam informativa, educativa e envio de propostas). Cadastro, propostas e denúncias continuam permitidos a menores — decidir se também passam a exigir 18 anos. Consentimento parental **não implementado** | `voting/eligibility.ts`; análise jurídica |
| 7 | Regra de apuração, quórum e publicação do preliminar | RF042–RF044 | Maioria simples dos válidos; quórum opcional por consulta; preliminar **não** publicado | `resultado.publicar_preliminar` |
| 8 | Exibição de resultados parciais | RF048, RS008 | Não adotada (somente participações) | — |
| 9 | Limite, apoios e metas das propostas cidadãs | RF020, RF021, RF067 | Limite 3 em análise; apoios desligados; meta e prazo **sem valor** | `proposta.limite_em_analise`, `recursos.apoios`, `apoios.meta`, `apoios.prazo_dias` |
| 10 | Prazos de resposta da administração e de guarda dos registros | RF021, RF063 | Prazo para ajuste: 15 dias (provisório); guarda indefinida | `proposta.prazo_ajuste_dias` |
| 11 | Formas de participação desta versão (comentários, eventos, mídias) | RF023, RF064, RF068 | Comentários e eventos **desligados** | `recursos.comentarios`, `recursos.eventos` |
| 12 | Política de uso e moderação | RF064–RF066 | Termos sinalizados para revisão humana; ocultação após 3 denúncias; moderação prévia desligada | `denuncia.limite_ocultacao`, `comentarios.moderacao_previa` |
| 13 | Nível de acessibilidade exigido | RF018 | Meta WCAG 2.2 AA + eMAG 3.1 (RNF01) | — |
| 14 | Canais de divulgação | RF062 | Portal, redes oficiais, impressos, rádio, outro | `DISSEMINATION_CHANNELS` |
| 15 | Forma de identificação e voto único/irretratável | RF036, RF011 | Identidade verificada + código por e-mail (na demonstração, o código aparece na própria tela, como mensagem simulada — DT-32); voto único e irretratável | — |
| 16 | Metas de desempenho, disponibilidade, internet fraca, backup | RNF04, RNF09, RNF10, RNF14 | Metas sugeridas registradas; não medidas sob carga real | `docs/testes/PLANO_DE_TESTES.md` |
| 17 | Registro de valores anterior/novo em todo ato administrativo | RNF08 | Auditoria registra ação, autor, data, justificativa e **nomes** dos campos; valores pessoais não são gravados (conflito com RNF06 a decidir) | `audit.service.ts` |

## Lacunas do documento (não marcadas com *, mas sem definição)

| Lacuna | Tratamento provisório |
|---|---|
| Definições das regras RN01–RN42 não constam da v6 | Implementadas pelo texto dos RFs; ver `docs/arquitetura/DECISOES_TECNICAS.md` DT-15 |
| “Seção 6.1” (ciclo de vida) e “seção 4” (papéis) citadas não existem | Ciclo de vida e papéis derivados dos RFs |
| RN15 — antecedência mínima da publicação | Parâmetro `consulta.antecedencia_minima_horas` = 24 h |
| RN26 — tempo de inatividade da sessão | 30 min (cidadão) / 15 min (administração) |
| Papel responsável pela análise documental (RF004) | Papel “Atendimento” |
| Critério de público “outro” | Apenas informativo |
| Provedor de SMS (RF011) | SMS simulado; e-mail real |
| Integração oficial gov.br | Exige credenciamento; adaptador simulado (DT-09) |
| Uso do brasão e da identidade visual oficiais da Prefeitura de Maceió | Marca própria inspirada no brasão; o brasão oficial só com autorização (DT-21) |
| Lista oficial de bairros e regiões administrativas | 50 bairros em 8 regiões, a conferir com a Prefeitura (DT-21) |
| Posição dos controles de acessibilidade (eMAG recomenda no topo) | Atalhos ocultos até o foco; espaçamento ampliado e tamanho do texto na página Acessibilidade, por decisão da equipe; o alto contraste foi retirado a pedido da equipe (DT-22) |
