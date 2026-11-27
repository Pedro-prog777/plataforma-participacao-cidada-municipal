/**
 * Domínio orientado a objetos (DT-35): entidades, estratégias e serviços de domínio, sem banco.
 * Comprova os quatro pilares no núcleo do sistema — abstração, encapsulamento, herança e polimorfismo —
 * e que as regras continuam as mesmas (mensagens e códigos de erro inclusive).
 */
import { describe, expect, it } from "vitest";
import { DomainError, ForbiddenError, ValidationError } from "@/server/lib/errors";
import { DAY, HOUR } from "@/server/lib/clock";
import { Consulta, type PropriedadesConsulta } from "@/server/domain/entities/consulta";
import { PropostaCidada, type PropriedadesProposta } from "@/server/domain/entities/proposta-cidada";
import { EntidadeComCicloDeVida } from "@/server/domain/entities/entidade-com-ciclo-de-vida";
import { Cidadao, type PerfilDoCidadao } from "@/server/domain/entities/cidadao";
import { PublicoAlvo } from "@/server/domain/entities/publico-alvo";
import { Cedula } from "@/server/domain/entities/cedula";
import { VoteRejected } from "@/server/domain/erros";
import { AvaliadorDeElegibilidade } from "@/server/domain/services/avaliador-de-elegibilidade";
import { Apuracao } from "@/server/domain/services/apuracao";
import {
  CriterioDeEndereco,
  CriterioDomicilio,
  CriterioFaixaEtaria,
  CriterioInformativo,
  CriterioPublicoAlvo,
  CriterioTerritorio,
} from "@/server/domain/strategies/criterios-publico-alvo";
import { QuorumAbsoluto, QuorumDeReferencia, QuorumPercentual, SemQuorum } from "@/server/domain/strategies/quorum-de-referencia";
import { CanalCentralDeAvisos, CanalEmail, TransporteSimulado } from "@/server/modules/notifications/canais";
import { tally } from "@/server/modules/results/tally";
import type { DbOrTx } from "@/server/db/client";

const AGORA = new Date("2026-11-27T12:00:00Z");

function consulta(p: Partial<PropriedadesConsulta> = {}): Consulta {
  return Consulta.reconstituir({
    id: "c1",
    titulo: "Ciclovia na Avenida Central",
    slug: "ciclovia",
    propostaMunicipalId: "pm1",
    situacao: "rascunho",
    situacaoAntesDaSuspensao: null,
    motivoDaSituacao: null,
    abertura: new Date(AGORA.getTime() + 5 * DAY),
    encerramento: new Date(AGORA.getTime() + 25 * DAY),
    abertaEm: null,
    encerradaEm: null,
    prazoExcepcional: false,
    autorizacaoDoPrazo: "nao_aplicavel",
    justificativaDoPrazo: null,
    prazoDecididoPor: null,
    versao: 3,
    versaoCongelada: null,
    criadaPor: "elaboradora",
    editadaPorUltimo: "elaboradora",
    aprovadaPor: null,
    aprovadaEm: null,
    publicadaEm: null,
    observacoesDaRevisao: null,
    retratoDaAbertura: null,
    elegiveisEstimados: null,
    atualizadaEm: AGORA,
    ...p,
  });
}

function proposta(p: Partial<PropriedadesProposta> = {}): PropostaCidada {
  return PropostaCidada.reconstituir({
    id: "p1",
    protocolo: "PROP-2026-ABC123",
    autorId: "autora",
    situacao: "recebida",
    titulo: "Praça limpa",
    problema: "Lixo acumulado",
    solucao: "Lixeiras",
    temaId: "t1",
    bairroId: "b1",
    autorizaPublicacao: true,
    textoDeBusca: "praca limpa",
    tipoDeResposta: null,
    textoDaResposta: null,
    orientacaoDoAjuste: null,
    prazoDoAjuste: null,
    propostaMunicipalId: null,
    publicadaEm: null,
    atualizadaEm: AGORA,
    ...p,
  });
}

function cidadao(p: Partial<PerfilDoCidadao> = {}): Cidadao {
  return new Cidadao({
    id: "u1",
    tipo: "cidadao",
    situacaoDaConta: "ativa",
    bloqueadoAte: null,
    nivelDeVerificacao: "verificado",
    bairroId: "centro",
    regiaoId: "r1",
    domicilioComprovadoEm: AGORA,
    nascimento: "1990-05-10",
    ...p,
  });
}

const erroDe = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e as DomainError;
  }
  throw new Error("esperava um erro");
};

describe("Encapsulamento: a Consulta controla a própria situação (seção 6.1)", () => {
  it("percorre o ciclo completo só pelos métodos de negócio e registra cada transição", () => {
    const c = consulta();
    c.enviarParaRevisao(AGORA);
    c.concluirRevisao(true, null, AGORA);
    c.aprovar("aprovadora", AGORA, 72);
    c.publicar(AGORA, 72);
    c.abrir(AGORA, { alternativas: 2 }, 100);
    c.suspender("Erro no material");
    c.retomar(AGORA, null);
    c.encerrarNoHorario(AGORA);
    c.registrarApuracao();
    c.homologarResultado();
    expect(c.situacao).toBe("finalizada");
    expect(c.transicoes.map((t) => t.para)).toEqual(["em_revisao", "em_analise", "aprovada", "agendada", "aberta", "suspensa", "aberta", "encerrada", "apurada", "finalizada"]);
  });

  it("a situação não pode ser alterada por fora: não há setter e os dados são campos privados", () => {
    const c = consulta();
    expect(() => {
      (c as unknown as { situacao: string }).situacao = "aberta";
    }).toThrow(TypeError);
    expect(c.situacao).toBe("rascunho");
    // Campos privados (#): nada aparece como propriedade pública do objeto.
    expect(Object.keys(c)).toEqual([]);
    expect(JSON.stringify(c)).toBe("{}");
  });

  it("recusa transições inválidas com as mesmas mensagens de antes", () => {
    expect(erroDe(() => consulta().publicar(AGORA, 72)).message).toBe("Somente consultas aprovadas podem ser publicadas.");
    expect(erroDe(() => consulta({ situacao: "encerrada" }).suspender("x")).message).toBe("Só é possível suspender consultas Agendadas ou Abertas.");
    expect(erroDe(() => consulta({ situacao: "aberta" }).garantirEdicao()).message).toBe('Consulta publicada: use "Alterar consulta publicada" (RF032).');
    expect(erroDe(() => consulta({ situacao: "em_analise" }).garantirEdicao()).code).toBe("edicao_bloqueada");
    expect(erroDe(() => consulta({ situacao: "rascunho" }).registrarApuracao()).message).toBe("A apuração exige consulta Encerrada.");
    const jaApurada = erroDe(() => consulta({ situacao: "apurada" }).cancelar("motivo", "Ciclovia na Avenida Central", AGORA));
    expect(jaApurada.code).toBe("ja_apurada");
  });

  it("aprovação: segregação de funções (RN20), prazo excepcional pendente e antecedência mínima (RN15)", () => {
    expect(erroDe(() => consulta({ situacao: "em_analise" }).aprovar("elaboradora", AGORA, 72))).toBeInstanceOf(ForbiddenError);
    expect(erroDe(() => consulta({ situacao: "em_analise", prazoExcepcional: true, autorizacaoDoPrazo: "pendente" }).aprovar("aprovadora", AGORA, 72)).code).toBe("prazo_pendente");
    const semAntecedencia = consulta({ situacao: "em_analise", abertura: new Date(AGORA.getTime() + 10 * HOUR) });
    expect(erroDe(() => semAntecedencia.aprovar("aprovadora", AGORA, 72)).code).toBe("antecedencia");
    expect(semAntecedencia.situacao).toBe("em_analise");
    expect(consulta().temConflitoDeAprovacao("revisor", { revisores: ["revisor"], papeisDoAtor: [] })).toBe(true);
    expect(consulta().temConflitoDeAprovacao("aprovadora", { revisores: ["revisor"], papeisDoAtor: ["aprovador"] })).toBe(false);
  });

  it("retomada volta a Agendada quando a abertura ainda não chegou; senão, a Aberta", () => {
    const antes = consulta({ situacao: "suspensa", situacaoAntesDaSuspensao: "agendada" });
    antes.retomar(AGORA, null);
    expect(antes.situacao).toBe("agendada");
    const depois = consulta({ situacao: "suspensa", situacaoAntesDaSuspensao: "aberta", abertura: new Date(AGORA.getTime() - DAY) });
    depois.retomar(AGORA, null);
    expect(depois.situacao).toBe("aberta");
    const vencida = consulta({ situacao: "suspensa", encerramento: new Date(AGORA.getTime() - HOUR) });
    expect(erroDe(() => vencida.retomar(AGORA, null)).code).toBe("encerrada_durante_suspensao");
    expect(erroDe(() => consulta({ situacao: "suspensa" }).retomar(AGORA, new Date(AGORA.getTime() + DAY)))).toBeInstanceOf(ValidationError);
  });

  it("cancelamento exige o título digitado e é irreversível (RF034)", () => {
    const c = consulta({ situacao: "aberta" });
    expect(erroDe(() => c.cancelar("motivo", "outro título", AGORA))).toBeInstanceOf(ValidationError);
    c.cancelar("motivo", "  Ciclovia na Avenida Central ", AGORA);
    expect(c.situacao).toBe("cancelada");
    expect(erroDe(() => c.suspender("x")).message).toBe("Só é possível suspender consultas Agendadas ou Abertas.");
  });

  it("o repositório recebe só o que mudou", () => {
    const c = consulta({ situacao: "agendada" });
    expect(c.temAlteracoes).toBe(false);
    c.suspender("Erro no material");
    expect(c.alteracoesPendentes()).toEqual({ situacao: "suspensa", situacaoAntesDaSuspensao: "agendada", motivoDaSituacao: "Erro no material" });
  });

  it("prazo excepcional negado devolve a Rascunho com o prazo padrão sugerido", () => {
    const c = consulta({ situacao: "em_analise", prazoExcepcional: true, autorizacaoDoPrazo: "pendente" });
    expect(erroDe(() => c.decidirPrazoExcepcional("elaboradora", true, "ok", 20))).toBeInstanceOf(ForbiddenError);
    c.decidirPrazoExcepcional("autorizador", false, "Sem emergência", 20);
    expect(c.situacao).toBe("rascunho");
    expect(c.encerramento?.getTime()).toBe(c.abertura!.getTime() + 20 * DAY);
    expect(c.prazoExcepcional).toBe(false);
  });
});

describe("Herança: Consulta e PropostaCidada compartilham a base EntidadeComCicloDeVida", () => {
  it("as duas são entidades com ciclo de vida e se descrevem de forma própria", () => {
    const entidades: EntidadeComCicloDeVida<string, { situacao: string }>[] = [consulta(), proposta()];
    for (const e of entidades) expect(e).toBeInstanceOf(EntidadeComCicloDeVida);
    expect(entidades.map((e) => e.descricao)).toEqual(["Consulta", "Proposta cidadã"]);
  });

  it("proposta cidadã percorre os estados da RN30 e recusa o que não é permitido", () => {
    const p = proposta();
    expect(erroDe(() => p.garantirAnalistaDiferenteDoAutor("autora")).message).toBe("Não é permitido analisar a própria proposta.");
    p.iniciarAnalise(AGORA);
    expect(erroDe(() => p.solicitarAjuste("", 15, AGORA))).toBeInstanceOf(ValidationError);
    p.solicitarAjuste("Informe o trecho da rua", 15, AGORA);
    expect(p.situacao).toBe("ajuste_solicitado");
    p.reenviarComAjustes({ titulo: "Praça limpa já", problema: "Lixo", solucao: "Lixeiras", temaId: "t1", bairroId: "b1", autorizaPublicacao: false }, AGORA);
    expect(p.alteracoesPendentes()).toMatchObject({ situacao: "em_analise", titulo: "Praça limpa já", textoDeBusca: "praca limpa ja lixo lixeiras" });
    p.responder("nao_acolhida", "Fora da competência municipal.", AGORA);
    expect(erroDe(() => p.publicar(AGORA)).message).toBe("O autor não autorizou a publicação do texto.");
    p.encerrar("Concluída", AGORA);
    expect(p.situacao).toBe("encerrada");
  });
});

describe("Polimorfismo: critérios de público-alvo (antes, um switch)", () => {
  it("a fábrica cria a subclasse certa; todas são CriterioPublicoAlvo", () => {
    const criterios = [
      CriterioPublicoAlvo.criar("domicilio"),
      CriterioPublicoAlvo.criar("territorio", { districtIds: ["centro"] }),
      CriterioPublicoAlvo.criar("faixa_etaria", { minAge: 60 }),
      CriterioPublicoAlvo.criar("outro"),
    ];
    expect(criterios.map((c) => c.constructor.name)).toEqual(["CriterioDomicilio", "CriterioTerritorio", "CriterioFaixaEtaria", "CriterioInformativo"]);
    for (const c of criterios) expect(c).toBeInstanceOf(CriterioPublicoAlvo);
    expect(criterios[0]).toBeInstanceOf(CriterioDeEndereco);
    expect(criterios[1]).toBeInstanceOf(CriterioDeEndereco);
    expect(criterios[2]).not.toBeInstanceOf(CriterioDeEndereco);
  });

  it("a mesma chamada avaliar() dá respostas diferentes conforme o tipo do critério", () => {
    const semComprovacao = cidadao({ domicilioComprovadoEm: null, nascimento: "1990-05-10" });
    const motivos = [new CriterioDomicilio(), new CriterioTerritorio(["centro"], []), new CriterioFaixaEtaria(60), new CriterioInformativo()].map((c) => c.avaliar(semComprovacao, AGORA)?.code ?? null);
    expect(motivos).toEqual(["domicilio_nao_comprovado", "domicilio_nao_comprovado", "fora_do_publico", null]);
  });

  it("critérios de endereço compartilham a exigência de comprovação, com mensagem própria", () => {
    const semComprovacao = cidadao({ domicilioComprovadoEm: null });
    expect(new CriterioDomicilio().avaliar(semComprovacao)?.reason).toBe("Esta consulta exige comprovação de domicílio no município.");
    expect(new CriterioTerritorio(["centro"], []).avaliar(semComprovacao)?.reason).toBe("Esta consulta exige comprovação de domicílio no território.");
    expect(new CriterioTerritorio(["outro-bairro"], ["r1"]).avaliar(cidadao())).toBeNull();
    expect(new CriterioTerritorio(["outro-bairro"], []).avaliar(cidadao())?.code).toBe("fora_do_publico");
    expect(new CriterioDomicilio().avaliar(cidadao({ bairroId: null }))?.action?.href).toBe("/conta/perfil/editar");
  });

  it("na estimativa, quem ainda vai comprovar o domicílio também conta", () => {
    const semComprovacao = cidadao({ domicilioComprovadoEm: null });
    expect(new CriterioDomicilio().enquadra(semComprovacao, AGORA)).toBe(true);
    expect(new PublicoAlvo(false, [new CriterioDomicilio()]).restricaoPara(semComprovacao, AGORA)?.code).toBe("domicilio_nao_comprovado");
  });
});

describe("AvaliadorDeElegibilidade: ordem do RF036", () => {
  const janela = { situacao: "aberta", abertura: new Date(AGORA.getTime() - DAY), encerramento: new Date(AGORA.getTime() + DAY) };
  const aberta = new AvaliadorDeElegibilidade(janela, new PublicoAlvo(true, []));

  it("aplica as verificações na ordem do documento", () => {
    expect(aberta.avaliar(cidadao({ situacaoDaConta: "bloqueada", nivelDeVerificacao: "nao_verificado" }), false, AGORA)).toMatchObject({ code: "conta_inativa" });
    expect(aberta.avaliar(cidadao({ nivelDeVerificacao: "nao_verificado" }), false, AGORA)).toMatchObject({ code: "identidade_nao_verificada" });
    expect(aberta.avaliar(cidadao({ tipo: "admin" }), false, AGORA)).toMatchObject({ code: "conta_administrativa" });
    expect(aberta.avaliar(cidadao({ bloqueadoAte: new Date(AGORA.getTime() + HOUR) }), false, AGORA)).toMatchObject({ code: "conta_inativa" });
    expect(aberta.avaliar(cidadao(), true, AGORA)).toMatchObject({ code: "ja_participou" });
    expect(aberta.avaliar(cidadao(), false, AGORA)).toEqual({ eligible: true });
    const restrita = new AvaliadorDeElegibilidade({ ...janela, situacao: "suspensa" }, new PublicoAlvo(false, [new CriterioTerritorio(["longe"], [])]));
    // Público-alvo vem antes do período.
    expect(restrita.avaliar(cidadao(), false, AGORA)).toMatchObject({ code: "fora_do_publico" });
    expect(new AvaliadorDeElegibilidade({ ...janela, situacao: "suspensa" }, new PublicoAlvo(true, [])).avaliar(cidadao(), false, AGORA)).toMatchObject({ code: "fora_do_periodo", reason: "A consulta está suspensa. Nenhum voto é aceito durante a suspensão." });
  });

  it("só vota quem tem 18 anos completos (DT-30): 17 anos e 364 dias não bastam", () => {
    expect(Cidadao.IDADE_MINIMA).toBe(18);
    expect(aberta.avaliar(cidadao({ nascimento: "2008-11-28" }), false, AGORA)).toMatchObject({ code: "menor_de_18" });
    expect(aberta.avaliar(cidadao({ nascimento: "2008-11-27" }), false, AGORA)).toEqual({ eligible: true });
    expect(AvaliadorDeElegibilidade.enquadraNoPublico(cidadao({ nascimento: "2010-01-01" }), new PublicoAlvo(true, []), AGORA)).toBe(false);
  });
});

describe("Cédula (RN13) e sigilo por construção (RN07)", () => {
  const opcoes = { consultaId: "c1", alternativasValidas: ["sim", "nao"], permiteAbstencao: false };

  it("aceita uma alternativa desta consulta e grava só consulta e escolha", () => {
    const registro = Cedula.preencher(opcoes, { abstencao: false, alternativaId: "sim" }).paraRegistro();
    expect(registro).toEqual({ consultaId: "c1", alternativaId: "sim", abstencao: false });
    // Não existe campo para o eleitor, o comprovante ou o horário.
    expect(Object.keys(registro).sort()).toEqual(["abstencao", "alternativaId", "consultaId"]);
    expect(Object.isFrozen(registro)).toBe(true);
  });

  it("recusa alternativa de outra consulta e abstenção não permitida", () => {
    const outra = erroDe(() => Cedula.preencher(opcoes, { abstencao: false, alternativaId: "de-outra-consulta" }));
    expect(outra).toBeInstanceOf(VoteRejected);
    expect(outra.code).toBe("alternativa_invalida");
    expect(erroDe(() => Cedula.preencher(opcoes, { abstencao: true, alternativaId: null })).message).toBe("Esta consulta não admite abstenção.");
    expect(Cedula.preencher({ ...opcoes, permiteAbstencao: true }, { abstencao: true, alternativaId: "sim" }).paraRegistro()).toEqual({ consultaId: "c1", alternativaId: null, abstencao: true });
  });
});

describe("Polimorfismo: quórum de referência (RN17) e apuração (RF042)", () => {
  it("cada quórum calcula as participações necessárias do seu jeito", () => {
    const quoruns: QuorumDeReferencia[] = [QuorumDeReferencia.criar("nenhum", null), QuorumDeReferencia.criar("absoluto", "50"), QuorumDeReferencia.criar("percentual", "10")];
    expect(quoruns.map((q) => q.constructor.name)).toEqual(["SemQuorum", "QuorumAbsoluto", "QuorumPercentual"]);
    expect(quoruns.map((q) => q.participacoesNecessarias(1000))).toEqual([null, 50, 100]);
    expect(quoruns.map((q) => q.foiAtingido(60, 1000))).toEqual([null, true, false]);
    expect(new QuorumPercentual("10").participacoesNecessarias(null)).toBeNull();
    expect(new QuorumAbsoluto(null).foiAtingido(10, 100)).toBeNull();
    expect(new SemQuorum().tipo).toBe("nenhum");
  });

  it("Apuracao produz exatamente o mesmo resultado do tally() usado no hash de integridade", () => {
    const entrada = {
      countingRule: "maioria_simples",
      alternatives: [
        { id: "b", label: "Não", position: 2 },
        { id: "a", label: "Sim", position: 1 },
      ],
      votes: [
        { alternativeId: "a", abstention: false },
        { alternativeId: "a", abstention: false },
        { alternativeId: "b", abstention: false },
        { alternativeId: null, abstention: true },
      ],
      participations: 4,
      estimatedEligible: 40,
      quorumType: "percentual",
      quorumValue: "20",
      computedAt: "2026-11-27T12:00:00.000Z",
    };
    const r = tally(entrada);
    expect(r).toMatchObject({ validVotes: 3, abstentions: 1, totalVotes: 4, winnerId: null, condition: "abaixo_quorum", quorum: { type: "percentual", value: "20", required: 8, met: false } });
    expect(r.alternatives.map((a) => a.percentage)).toEqual(["66.67", "33.33"]);
    expect(Apuracao.percentuaisPeloMaiorResto([1, 1, 1]).reduce((s, p) => s + Number(p), 0)).toBeCloseTo(100, 10);
    const semQuorum = tally({ ...entrada, quorumType: "nenhum", quorumValue: null });
    expect(semQuorum).toMatchObject({ winnerId: "a", condition: "vencedora", quorum: { required: null, met: null } });
  });
});

describe("Polimorfismo: canais de notificação e transportes de e-mail (RF052)", () => {
  const db = {} as DbOrTx;
  const aviso = (obrigatorio: boolean) => ({ tipo: "resultado", titulo: "Resultado", corpo: "…", obrigatorio });
  const destinatario = { id: "u1", email: "u1@exemplo.test", preferencia: { email: false, inApp: true } };

  it("cada canal olha a sua preferência; aviso obrigatório chega por todos", () => {
    const canais = [new CanalCentralDeAvisos(db), new CanalEmail(db)];
    expect(canais.map((c) => c.deveEntregar(destinatario, aviso(false)))).toEqual([true, false]);
    expect(canais.map((c) => c.deveEntregar(destinatario, aviso(true)))).toEqual([true, true]);
    expect(canais.map((c) => c.nome)).toEqual(["central de avisos", "e-mail"]);
  });

  it("o transporte simulado se identifica como simulação", () => {
    expect(new TransporteSimulado().simulado).toBe(true);
  });
});

describe("Erros de domínio continuam DomainError (mesma hierarquia)", () => {
  it("VoteRejected é DomainError, para o tratamento comum das ações", () => {
    expect(new VoteRejected("x", "y")).toBeInstanceOf(DomainError);
  });
});
