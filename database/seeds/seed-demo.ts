/**
 * DADOS FICTÍCIOS para demonstração acadêmica. Nenhuma pessoa, CPF ou endereço é real.
 * A linha do tempo é produzida pelos próprios serviços com relógio simulado, de modo que
 * histórico público, auditoria, resultados e avisos ficam coerentes.
 * Votos sintéticos são inseridos diretamente (mesma estrutura sem vínculo usada pelo sistema).
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { alternatives, citizenProposals, consultations, districts, organs, participations, regions, roles, themes, userRoles, users, votes } from "@/server/db/schema";
import { brDate, clock, DAY, HOUR } from "@/server/lib/clock";
import { cpfHmac, encrypt, receiptCode, sha256 } from "@/server/lib/crypto";
import { hashPassword } from "@/server/lib/password";
import { generateCpf, maskCpf } from "@/lib/cpf";
import { toLocalInput } from "@/lib/labels";
import { loadActor, type Actor } from "@/server/modules/access/access.service";
import { createMunicipalProposal } from "@/server/modules/proposals/municipal-proposals.service";
import {
  cancelConsultation,
  createConsultation,
  decideApproval,
  decideExceptionalDeadline,
  publishConsultation,
  reviewConsultation,
  REVIEW_ITEMS,
  setAlternatives,
  setAssignments,
  setAudience,
  submitForReview,
  suspendConsultation,
} from "@/server/modules/consultations/lifecycle.service";
import { closeDueConsultations, openDueConsultations } from "@/server/modules/scheduler/scheduler.service";
import { publishFinalResult } from "@/server/modules/results/results.service";
import { registerOutcome, updateOutcomeStatus } from "@/server/modules/outcomes/outcomes.service";
import { analyzeProposal, submitCitizenProposal } from "@/server/modules/proposals/citizen-proposals.service";
import { registerDissemination } from "@/server/modules/dissemination/dissemination.service";
import { notifyUser } from "@/server/modules/notifications/notifications.service";
import { audit } from "@/server/modules/audit/audit.service";

export const DEMO_PASSWORD = "Demo@2026";
/** Segredos TOTP FICTÍCIOS das contas de demonstração (documentados no README). */
export const DEMO_ADMINS = [
  { key: "gestor", name: "Gilberto Gestor (fictício)", email: "gestor@prefeitura.exemplo", roles: ["gestor_acessos", "acompanhamento"], totp: "GESTORDEMOPPCMAAGESTORDEMOPPCMAA" },
  { key: "elaboradora", name: "Elaine Elaboradora (fictícia)", email: "elaboradora@prefeitura.exemplo", roles: ["elaborador"], totp: "ELABORADORADEMOAELABORADORADEMOA" },
  { key: "revisor", name: "Rui Revisor (fictício)", email: "revisor@prefeitura.exemplo", roles: ["revisor"], totp: "REVISORDEMOPPCMAAREVISORDEMOPPCM" },
  { key: "aprovadora", name: "Ana Aprovadora (fictícia)", email: "aprovadora@prefeitura.exemplo", roles: ["aprovador"], totp: "APROVADORADEMOPPAPROVADORADEMOPP" },
  { key: "autorizador", name: "Augusto Autorizador (fictício)", email: "autorizador@prefeitura.exemplo", roles: ["autorizador_prazo"], totp: "AUTORIZADORDEMOPAUTORIZADORDEMOP" },
  { key: "responsavel", name: "Rita Responsável (fictícia)", email: "responsavel@prefeitura.exemplo", roles: ["responsavel", "divulgacao", "acompanhamento", "publicacao_resultados", "encaminhamentos"], totp: "RESPONSAVELDEMOPRESPONSAVELDEMOP" },
  { key: "analista", name: "Paula Analista (fictícia)", email: "analista@prefeitura.exemplo", roles: ["analise_propostas", "moderacao", "atendimento"], totp: "ANALISTADEMOPPCMAANALISTADEMOPPC" },
] as const;

export const DEMO_CITIZENS = [
  { key: "maria", name: "Maria Aparecida Santos (fictícia)", email: "maria@exemplo.com", verified: true, district: "Centro" },
  { key: "joao", name: "João Batista Lima (fictício)", email: "joao@exemplo.com", verified: false, district: "Benedito Bentes" },
  { key: "carla", name: "Carla Nunes Ferreira (fictícia)", email: "carla@exemplo.com", verified: true, district: "Jatiúca" },
] as const;

const FIRST = ["Ana", "Bruno", "Cecília", "Diego", "Elisa", "Fábio", "Gabriela", "Heitor", "Iara", "Jonas", "Kátia", "Lucas", "Marta", "Nilo", "Olga", "Pedro", "Quitéria", "Renato", "Sônia", "Tiago"];
const LAST = ["Alves", "Barros", "Cardoso", "Dias", "Esteves", "Farias", "Gomes", "Holanda", "Lins", "Moura"];

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedDemoData(db: Db) {
  const rnd = mulberry(2026);
  const realNow = new Date();
  const pwHash = await hashPassword(DEMO_PASSWORD);
  const allDistricts = await db.select({ id: districts.id, name: districts.name, regionId: districts.regionId }).from(districts);
  const regionsRows = await db.select().from(regions);
  const themeId = async (name: string) => (await db.select().from(themes).where(eq(themes.name, name)))[0].id;
  const organId = async (acr: string) => (await db.select().from(organs).where(eq(organs.acronym, acr)))[0].id;
  const districtId = (name: string) => allDistricts.find((d) => d.name === name)!.id;

  // ---------------- Contas administrativas ----------------
  const admins: Record<string, Actor> = {};
  const [seplag] = await db.select().from(organs).where(eq(organs.acronym, "SEPLAG"));
  for (const a of DEMO_ADMINS) {
    const [u] = await db
      .insert(users)
      .values({ kind: "admin", fullName: a.name, email: a.email, registration: `DEMO-${a.key.toUpperCase()}`, organId: seplag.id, passwordHash: pwHash, status: "ativa", verificationLevel: "verificado", mfaSecretEnc: encrypt(a.totp), mfaEnabledAt: realNow, emailVerifiedAt: realNow })
      .returning();
    for (const key of a.roles) {
      const [r] = await db.select().from(roles).where(eq(roles.key, key));
      await db.insert(userRoles).values({ userId: u.id, roleId: r.id });
    }
    admins[a.key] = (await loadActor(u.id, db))!;
  }

  // ---------------- Cidadãos ----------------
  const mkCitizen = async (name: string, email: string, district: string, opts: { verified?: boolean; status?: "ativa" | "pendente"; birth?: string } = {}) => {
    const cpf = generateCpf(rnd);
    const [u] = await db
      .insert(users)
      .values({
        kind: "cidadao",
        fullName: name,
        email,
        cpfHmac: cpfHmac(cpf),
        cpfMasked: maskCpf(cpf),
        birthDate: opts.birth ?? `${1960 + Math.floor(rnd() * 45)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`,
        phone: `(82) 9${Math.floor(1000 + rnd() * 8999)}-${Math.floor(1000 + rnd() * 8999)}`,
        cep: "57000-000",
        street: "Rua Fictícia das Acácias",
        number: String(1 + Math.floor(rnd() * 900)),
        districtId: districtId(district),
        domicileVerifiedAt: opts.verified === false ? null : realNow,
        passwordHash: pwHash,
        status: opts.status ?? "ativa",
        verificationLevel: opts.verified === false ? "nao_verificado" : "verificado",
        verificationMethod: opts.verified === false ? null : "provedor_simulado",
        verifiedAt: opts.verified === false ? null : realNow,
        emailVerifiedAt: opts.status === "pendente" ? null : realNow,
        termsVersion: "1.0",
        termsAcceptedAt: realNow,
        createdAt: new Date(realNow.getTime() - Math.floor(rnd() * 120) * DAY),
      })
      .returning();
    return u;
  };
  const named: Record<string, typeof users.$inferSelect> = {};
  for (const c of DEMO_CITIZENS) named[c.key] = await mkCitizen(c.name, c.email, c.district, { verified: c.verified });
  await mkCitizen("Ana Pendente (fictícia)", "ana@exemplo.com", "Farol", { verified: false, status: "pendente" });
  const crowd: (typeof users.$inferSelect)[] = [];
  // Três participantes por bairro (50 bairros): garante eleitores suficientes nas consultas por região.
  for (let i = 0; i < 150; i++) {
    const d = allDistricts[i % allDistricts.length].name;
    crowd.push(await mkCitizen(`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} (fictício)`, `participante${i + 1}@exemplo.com`, d, { verified: i % 9 !== 0 }));
  }
  const voters = [named.maria, ...crowd.filter((c) => c.verificationLevel === "verificado")];

  const allOk = Object.fromEntries(Object.keys(REVIEW_ITEMS).map((k) => [k, true]));
  const team = { revisor: [admins.revisor.id], aprovador: [admins.aprovadora.id], responsavel: [admins.responsavel.id], publicacao_resultados: [admins.responsavel.id], encaminhamentos: [admins.responsavel.id], divulgacao: [admins.responsavel.id], acompanhamento: [admins.responsavel.id] };

  type Spec = {
    title: string;
    summary: string;
    theme: string;
    organ: string;
    problem: string;
    objective: string;
    justification: string;
    question: string;
    guidance: string;
    nextSteps: string;
    alternatives: [string, string][];
    abstention?: boolean;
    audience?: { open: boolean; criteria?: Parameters<typeof setAudience>[2]["criteria"] };
    exceptional?: string;
    quorum?: [string, string];
    regionName?: string;
  };

  async function prepare(spec: Spec, at: Date, opensInDays: number, durationDays: number, stage: "rascunho" | "em_revisao" | "em_analise" | "agendada") {
    clock.set(at);
    const p = await createMunicipalProposal(admins.elaboradora, { title: spec.title, summary: spec.summary, description: `${spec.problem}\n\n${spec.objective}`, justification: spec.justification, objectives: spec.objective, themeId: await themeId(spec.theme), organId: await organId(spec.organ), scope: spec.regionName ?? "Todo o município" }, db);
    const opens = new Date(at.getTime() + opensInDays * DAY + 2 * HOUR);
    const regionId = spec.regionName ? regionsRows.find((r) => r.name === spec.regionName)?.id : undefined;
    const c = await createConsultation(
      admins.elaboradora,
      {
        municipalProposalId: p.id,
        title: spec.title,
        summary: spec.summary,
        themeId: await themeId(spec.theme),
        organId: await organId(spec.organ),
        regionId,
        problem: spec.problem,
        objective: spec.objective,
        justification: spec.justification,
        question: spec.question,
        guidance: spec.guidance,
        opensAt: toLocalInput(opens),
        closesAt: toLocalInput(new Date(opens.getTime() + durationDays * DAY)),
        nextSteps: spec.nextSteps,
        exceptionalDeadline: spec.exceptional ? "on" : undefined,
        emergencyJustification: spec.exceptional,
        quorumType: spec.quorum?.[0] ?? "nenhum",
        quorumValue: spec.quorum?.[1],
      },
      db,
    );
    await setAlternatives(admins.elaboradora, c.id, { items: spec.alternatives.map(([label, explanation]) => ({ label, explanation })), allowAbstention: !!spec.abstention }, db);
    await setAudience(admins.elaboradora, c.id, spec.audience ? { open: spec.audience.open, criteria: spec.audience.criteria ?? [] } : { open: false, criteria: [{ type: "domicilio", justification: "Tema de interesse local; público-alvo padrão herdado (pendente de validação).", publicText: "Pessoas que moram no município, com domicílio comprovado." }] }, db);
    await setAssignments(admins.gestor, c.id, spec.exceptional ? { ...team, autorizador_prazo: [admins.autorizador.id] } : team, null, db);
    if (stage === "rascunho") return c;
    await submitForReview(admins.elaboradora, c.id, db);
    if (stage === "em_revisao") return c;
    await reviewConsultation(admins.revisor, c.id, { items: allOk, observations: "" }, db);
    if (spec.exceptional) await decideExceptionalDeadline(admins.autorizador, c.id, { authorize: true, justification: "Emergência caracterizada por relatório da Defesa Civil (fictício)." }, db);
    if (stage === "em_analise") return c;
    await decideApproval(admins.aprovadora, c.id, { approve: true, justification: "Conteúdo completo e neutro." }, db);
    await publishConsultation(admins.responsavel, c.id, db);
    await registerDissemination(admins.responsavel, c.id, { channel: "portal", usedOn: brDate(clock.now()) }, db);
    return c;
  }

  async function castSynthetic(consultationId: string, picks: number[], abstentions: number, opensAt: Date, closesAt: Date, regionName?: string) {
    const alts = await db.select().from(alternatives).where(eq(alternatives.consultationId, consultationId)).orderBy(alternatives.position);
    const regionId = regionName ? regionsRows.find((r) => r.name === regionName)?.id : undefined;
    const inRegion = (c: typeof users.$inferSelect) => !regionId || allDistricts.find((d) => d.id === c.districtId)?.regionId === regionId;
    const pool = voters.filter(inRegion).sort(() => rnd() - 0.5);
    let idx = 0;
    const span = Math.max(1, closesAt.getTime() - opensAt.getTime() - HOUR);
    const add = async (alternativeId: string | null) => {
      const citizen = pool[idx++];
      if (!citizen) return;
      const code = receiptCode();
      const when = new Date(opensAt.getTime() + rnd() * span);
      await db.transaction(async (tx) => {
        await tx.insert(participations).values({ consultationId, citizenId: citizen.id, participatedOn: brDate(when), receiptHash: sha256(code), receiptEnc: encrypt(code) });
        await tx.insert(votes).values({ consultationId, alternativeId, abstention: alternativeId === null });
      });
    };
    for (let a = 0; a < picks.length; a++) for (let k = 0; k < picks[a]; k++) await add(alts[a].id);
    for (let k = 0; k < abstentions; k++) await add(null);
  }

  // ---------------- 1) Finalizada com encaminhamentos ----------------
  const t1 = new Date(realNow.getTime() - 75 * DAY);
  const escola = await prepare(
    {
      title: "Prioridade de investimento nas escolas municipais em 2027",
      summary: "Qual melhoria deve receber prioridade no orçamento das escolas municipais no próximo ano?",
      theme: "Educação",
      organ: "SEMED",
      problem: "As 18 escolas municipais têm demandas de climatização, reforma de banheiros e quadras esportivas, mas o orçamento de 2027 permite atender integralmente apenas uma frente.",
      objective: "Conhecer a opinião da comunidade sobre qual frente deve ser priorizada primeiro.",
      justification: "Conselhos escolares e ouvidoria registraram pedidos nas três frentes ao longo de 2026.",
      question: "Qual melhoria deve ser prioridade nas escolas municipais em 2027?",
      guidance: "Leia o estudo de custos anexo. Escolha a alternativa que considera mais urgente. Seu voto é secreto.",
      nextSteps: "A Secretaria de Educação apresentará o cronograma de obras ao Conselho Municipal de Educação em até 60 dias após o resultado.",
      alternatives: [
        ["Climatização das salas de aula", "Instalação de ar-condicionado e adequação elétrica."],
        ["Reforma dos banheiros", "Acessibilidade, louças e vestiários."],
        ["Cobertura das quadras", "Cobertura e iluminação das quadras esportivas."],
      ],
      abstention: true,
    },
    t1,
    2,
    20,
    "agendada",
  );
  clock.set(new Date(t1.getTime() + 2 * DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e1] = await db.select().from(consultations).where(eq(consultations.id, escola.id));
  await castSynthetic(escola.id, [24, 13, 9], 3, e1.opensAt!, e1.closesAt!);
  clock.set(new Date(e1.closesAt!.getTime() + HOUR));
  await closeDueConsultations(db);
  clock.set(new Date(e1.closesAt!.getTime() + 2 * DAY));
  await publishFinalResult(admins.responsavel, escola.id, "Votação consultiva: o resultado orienta a Prefeitura, mas não substitui a deliberação orçamentária da Câmara Municipal. A climatização será priorizada no projeto de lei orçamentária de 2027, e as demais frentes seguirão em cronograma escalonado.", db);
  const o1 = await registerOutcome(admins.responsavel, escola.id, { decision: "Climatização das salas incluída como prioridade no PLOA 2027", actions: "Levantamento de carga elétrica em 18 escolas e elaboração de termo de referência.", organId: await organId("SEMED"), status: "prevista", expectedDate: brDate(new Date(realNow.getTime() + 120 * DAY)) }, db);
  clock.set(new Date(realNow.getTime() - 20 * DAY));
  await updateOutcomeStatus(admins.responsavel, o1.id, { status: "em_andamento", justification: "Levantamento elétrico iniciado em 6 escolas." }, db);
  await registerOutcome(admins.responsavel, escola.id, { decision: "Reforma de banheiros em 4 escolas com laudo crítico", actions: "Uso de recurso de manutenção já previsto.", organId: await organId("SEINFRA"), status: "em_andamento" }, db);

  // ---------------- 2) Finalizada (Sim/Não) ----------------
  const t2 = new Date(realNow.getTime() - 55 * DAY);
  const coleta = await prepare(
    {
      title: "Coleta seletiva porta a porta",
      summary: "Implantar a coleta seletiva semanal porta a porta em todos os bairros.",
      theme: "Meio Ambiente",
      organ: "SEMA",
      problem: "Apenas 4% do resíduo reciclável é recuperado; os pontos de entrega voluntária ficam distantes de boa parte das casas.",
      objective: "Saber se a população apoia a coleta seletiva semanal porta a porta.",
      justification: "Meta do Plano Municipal de Resíduos Sólidos (fictício) e redução de custos com aterro.",
      question: "Você concorda com a implantação da coleta seletiva semanal porta a porta?",
      guidance: "A coleta seria feita uma vez por semana, em dia diferente da coleta comum.",
      nextSteps: "A Secretaria de Meio Ambiente definirá o calendário por bairro e a campanha educativa.",
      alternatives: [
        ["Sim", "Concordo com a coleta seletiva porta a porta."],
        ["Não", "Não concordo com a coleta seletiva porta a porta."],
      ],
      audience: { open: true },
      quorum: ["absoluto", "30"],
    },
    t2,
    2,
    20,
    "agendada",
  );
  clock.set(new Date(t2.getTime() + 2 * DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e2] = await db.select().from(consultations).where(eq(consultations.id, coleta.id));
  await castSynthetic(coleta.id, [31, 8], 0, e2.opensAt!, e2.closesAt!);
  clock.set(new Date(e2.closesAt!.getTime() + HOUR));
  await closeDueConsultations(db);
  clock.set(new Date(e2.closesAt!.getTime() + DAY));
  await publishFinalResult(admins.responsavel, coleta.id, "Resultado consultivo favorável à coleta seletiva. A implantação será gradual, começando pela Região Administrativa 1, com campanha educativa prévia.", db);
  const o2 = await registerOutcome(admins.responsavel, coleta.id, { decision: "Implantação gradual da coleta seletiva", actions: "Fase 1 na Região Administrativa 1; fase 2 nas demais regiões.", organId: await organId("SEMA"), status: "em_andamento" }, db);
  clock.set(new Date(realNow.getTime() - 5 * DAY));
  await updateOutcomeStatus(admins.responsavel, o2.id, { status: "concluida", justification: "Fase 1 concluída na Região Administrativa 1." }, db);

  // ---------------- 3) Apurada (aguardando homologação) ----------------
  const t3 = new Date(realNow.getTime() - 26 * DAY);
  const feira = await prepare(
    {
      title: "Feira livre aos domingos no Poço",
      summary: "Criação de uma feira livre de agricultura familiar aos domingos pela manhã.",
      theme: "Desenvolvimento Econômico",
      organ: "SEPLAG",
      problem: "Moradores relatam falta de opções de hortifrúti aos domingos e agricultores pedem espaço de venda direta.",
      objective: "Ouvir os moradores da Região Administrativa 1 sobre a feira e o local preferido.",
      justification: "Pedido da associação de agricultores familiares (fictícia).",
      question: "Onde deve funcionar a feira livre de domingo no Poço?",
      guidance: "Escolha o local que considera mais adequado.",
      nextSteps: "A Secretaria de Planejamento fará o estudo de trânsito do local escolhido.",
      alternatives: [
        ["Praça Central do Poço", "Espaço amplo, exige interdição parcial da rua."],
        ["Estacionamento do Ginásio", "Sem interdição de ruas, mais distante do comércio."],
      ],
      regionName: "Região Administrativa 1",
      audience: { open: false, criteria: [{ type: "territorio", regionIds: [regionsRows.find((r) => r.name === "Região Administrativa 1")!.id], justification: "A feira afeta diretamente a mobilidade e o comércio da Região Administrativa 1.", publicText: "Moradores da Região Administrativa 1 (Poço, Jaraguá, Ponta da Terra, Pajuçara, Ponta Verde, Jatiúca e Mangabeiras) com domicílio comprovado." }] },
    },
    t3,
    2,
    20,
    "agendada",
  );
  clock.set(new Date(t3.getTime() + 2 * DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e3] = await db.select().from(consultations).where(eq(consultations.id, feira.id));
  await castSynthetic(feira.id, [9, 5], 0, e3.opensAt!, e3.closesAt!, "Região Administrativa 1");
  clock.set(new Date(e3.closesAt!.getTime() + HOUR));
  await closeDueConsultations(db);

  // ---------------- 4) Aberta (votação em andamento) ----------------
  const t4 = new Date(realNow.getTime() - 10 * DAY);
  const ciclo = await prepare(
    {
      title: "Ciclofaixa na orla lagunar",
      summary: "Implantação de ciclofaixa protegida nos 3,2 km da orla lagunar.",
      theme: "Mobilidade e Transporte",
      organ: "SEMOB",
      problem: "A orla lagunar concentra o maior fluxo de bicicletas da cidade e registrou 14 sinistros envolvendo ciclistas em 2026 (dados fictícios).",
      objective: "Saber se a população apoia a ciclofaixa e qual lado da via é preferido.",
      justification: "Plano de Mobilidade Urbana (fictício) e pedido de associações de ciclistas.",
      question: "Qual proposta para a ciclofaixa na orla lagunar você prefere?",
      guidance: "Veja o mapa e o estudo anexos. A ciclofaixa remove vagas de estacionamento no lado escolhido.",
      nextSteps: "A Secretaria de Mobilidade publicará o projeto executivo e o cronograma de obras após o resultado.",
      alternatives: [
        ["Ciclofaixa no lado da lagoa", "Remove 120 vagas de estacionamento junto ao calçadão."],
        ["Ciclofaixa no lado do comércio", "Remove 95 vagas em frente às lojas."],
        ["Não implantar a ciclofaixa", "Mantém a configuração atual da avenida."],
      ],
      abstention: true,
      audience: { open: true },
    },
    t4,
    1,
    20,
    "agendada",
  );
  clock.set(new Date(t4.getTime() + DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e4] = await db.select().from(consultations).where(eq(consultations.id, ciclo.id));
  await castSynthetic(ciclo.id, [12, 9, 5], 2, e4.opensAt!, new Date(realNow.getTime() - HOUR));

  // ---------------- 5) Aberta com prazo excepcional ----------------
  const t5 = new Date(realNow.getTime() - 4 * DAY);
  const alaga = await prepare(
    {
      title: "Plano emergencial para áreas de alagamento",
      summary: "Definir a obra emergencial de drenagem a ser feita antes do período chuvoso.",
      theme: "Infraestrutura e Iluminação",
      organ: "SEINFRA",
      problem: "As chuvas de outubro (fictícias) alagaram 230 casas em Vergel do Lago e Levada.",
      objective: "Escolher a intervenção de drenagem a executar antes do próximo período chuvoso.",
      justification: "Situação de emergência decretada (fictícia); a obra precisa começar em até 30 dias.",
      question: "Qual intervenção de drenagem deve ser feita primeiro?",
      guidance: "As duas obras têm custo semelhante. Escolha a que considera mais urgente.",
      nextSteps: "A obra escolhida será licitada em regime emergencial e o andamento publicado nos encaminhamentos.",
      alternatives: [
        ["Galeria pluvial no Vergel do Lago", "Atende 140 casas."],
        ["Bacia de retenção na Levada", "Atende 90 casas e reduz o volume a jusante."],
      ],
      regionName: "Região Administrativa 2",
      exceptional: "Situação de emergência por alagamentos (decreto fictício nº 100/2026); a obra precisa ser contratada antes do período chuvoso.",
      audience: { open: false, criteria: [{ type: "territorio", regionIds: [regionsRows.find((r) => r.name === "Região Administrativa 2")!.id], justification: "Os bairros afetados ficam na Região Administrativa 2.", publicText: "Moradores da Região Administrativa 2 (Centro, Pontal da Barra, Trapiche da Barra, Prado, Ponta Grossa, Levada e Vergel do Lago)." }] },
    },
    t5,
    1,
    10,
    "agendada",
  );
  clock.set(new Date(t5.getTime() + DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e5] = await db.select().from(consultations).where(eq(consultations.id, alaga.id));
  await castSynthetic(alaga.id, [4, 3], 0, e5.opensAt!, new Date(realNow.getTime() - HOUR), "Região Administrativa 2");

  // ---------------- 6) Suspensa ----------------
  const t6 = new Date(realNow.getTime() - 9 * DAY);
  const onibus = await prepare(
    {
      title: "Nova linha de ônibus para Ipioca",
      summary: "Criação de linha direta entre Ipioca e o Centro.",
      theme: "Mobilidade e Transporte",
      organ: "SEMOB",
      problem: "O bairro tem apenas duas viagens diárias, com baldeação.",
      objective: "Ouvir os moradores sobre o horário prioritário da nova linha.",
      justification: "Demanda da associação de moradores (fictícia).",
      question: "Qual faixa de horário deve ter mais viagens na nova linha?",
      guidance: "Escolha a faixa de horário mais importante para você.",
      nextSteps: "A Secretaria de Mobilidade ajustará a ordem de serviço da concessionária.",
      alternatives: [
        ["Manhã (5h às 9h)", "Mais viagens no início do dia."],
        ["Tarde e noite (16h às 21h)", "Mais viagens no retorno."],
      ],
      audience: { open: true },
    },
    t6,
    1,
    20,
    "agendada",
  );
  clock.set(new Date(t6.getTime() + DAY + 3 * HOUR));
  await openDueConsultations(db);
  clock.set(new Date(realNow.getTime() - 2 * DAY));
  await suspendConsultation(admins.responsavel, onibus.id, "O itinerário precisa ser revisado após interdição da ponte da Estrada Velha (fictícia). Os votos já registrados estão preservados.", db);

  // ---------------- 7) Agendada ----------------
  await prepare(
    {
      title: "Revitalização da Praça do Centro",
      summary: "Escolha do projeto paisagístico para a Praça do Centro.",
      theme: "Cultura e Lazer",
      organ: "SECEL",
      problem: "A praça tem piso danificado, pouca sombra e iluminação insuficiente.",
      objective: "Escolher entre dois projetos de revitalização.",
      justification: "Recurso de emenda (fictícia) disponível para 2027.",
      question: "Qual projeto de revitalização da Praça do Centro você prefere?",
      guidance: "Compare os dois projetos nos anexos.",
      nextSteps: "O projeto escolhido seguirá para licitação.",
      alternatives: [
        ["Projeto Sombra e Convivência", "Mais árvores, bancos e área de piquenique."],
        ["Projeto Cultura e Eventos", "Palco fixo, piso amplo e iluminação cênica."],
      ],
      audience: { open: true },
    },
    new Date(realNow.getTime() - 2 * DAY),
    7,
    20,
    "agendada",
  );

  // ---------------- 8) Cancelada ----------------
  const t8 = new Date(realNow.getTime() - 30 * DAY);
  const mercado = await prepare(
    {
      title: "Mudança de horário do Mercado Público",
      summary: "Ampliar o horário de funcionamento do Mercado Público até as 20h.",
      theme: "Desenvolvimento Econômico",
      organ: "SEPLAG",
      problem: "Trabalhadores não conseguem comprar no mercado durante a semana.",
      objective: "Avaliar a ampliação do horário.",
      justification: "Pedido de permissionários (fictício).",
      question: "Você concorda com a ampliação do horário do Mercado Público até as 20h?",
      guidance: "Escolha uma alternativa.",
      nextSteps: "Ajuste do regulamento do mercado.",
      alternatives: [
        ["Sim", "Concordo com a ampliação."],
        ["Não", "Não concordo com a ampliação."],
      ],
      audience: { open: true },
    },
    t8,
    2,
    20,
    "agendada",
  );
  clock.set(new Date(t8.getTime() + 2 * DAY + 3 * HOUR));
  await openDueConsultations(db);
  const [e8] = await db.select().from(consultations).where(eq(consultations.id, mercado.id));
  await castSynthetic(mercado.id, [5, 2], 0, e8.opensAt!, new Date(t8.getTime() + 6 * DAY));
  clock.set(new Date(t8.getTime() + 7 * DAY));
  await cancelConsultation(admins.responsavel, mercado.id, { justification: "O mercado entrará em reforma estrutural em 2027; a consulta será refeita após a obra.", confirmTitle: "Mudança de horário do Mercado Público" }, db);

  // ---------------- 9–11) Em preparação (só administração) ----------------
  clock.set(new Date(realNow.getTime() - DAY));
  await prepare(
    {
      title: "Academia ao ar livre no Trapiche da Barra",
      summary: "Instalar academia ao ar livre na orla da lagoa.",
      theme: "Esporte",
      organ: "SECEL",
      problem: "Falta de equipamentos públicos de atividade física na Região Administrativa 2.",
      objective: "Escolher o local da academia.",
      justification: "Pedido da comunidade (fictício).",
      question: "Onde deve ser instalada a academia ao ar livre do Trapiche da Barra?",
      guidance: "Escolha o local.",
      nextSteps: "Instalação em até 90 dias.",
      alternatives: [
        ["Orla norte", "Próxima à escola."],
        ["Orla sul", "Próxima ao posto de saúde."],
      ],
      audience: { open: true },
    },
    new Date(realNow.getTime() - DAY),
    10,
    20,
    "em_analise",
  );
  await prepare(
    {
      title: "Horário estendido das Unidades Básicas de Saúde",
      summary: "Atendimento até as 21h em duas UBS da Região Administrativa 7.",
      theme: "Saúde",
      organ: "SMS",
      problem: "Trabalhadores não conseguem atendimento no horário comercial.",
      objective: "Definir quais UBS terão horário estendido.",
      justification: "Programa federal de horário estendido (referência genérica).",
      question: "Quais Unidades Básicas de Saúde devem ter horário estendido primeiro?",
      guidance: "Escolha a opção.",
      nextSteps: "Reorganização das escalas.",
      alternatives: [
        ["UBS Clima Bom e UBS Santa Lúcia", "Maior população atendida."],
        ["UBS Santos Dumont e UBS Santa Lúcia", "Maior distância de pronto atendimento."],
      ],
      regionName: "Região Administrativa 7",
    },
    new Date(realNow.getTime() - DAY),
    12,
    20,
    "em_revisao",
  );
  await prepare(
    {
      title: "Arborização das vias do Benedito Bentes",
      summary: "Plantio de 1.500 árvores nas calçadas do Benedito Bentes.",
      theme: "Meio Ambiente",
      organ: "SEMA",
      problem: "O Benedito Bentes tem a menor cobertura arbórea da cidade.",
      objective: "Definir as espécies prioritárias.",
      justification: "Ilhas de calor (estudo fictício).",
      question: "Que tipo de árvore deve ser priorizado nas calçadas do Benedito Bentes?",
      guidance: "Escolha uma opção.",
      nextSteps: "Plano de plantio.",
      alternatives: [
        ["Frutíferas nativas", "Atraem fauna, exigem mais manutenção."],
        ["Sombreamento nativo", "Copa ampla, menor manutenção."],
      ],
    },
    new Date(realNow.getTime() - DAY),
    15,
    20,
    "rascunho",
  );

  // ---------------- Propostas cidadãs ----------------
  clock.set(new Date(realNow.getTime() - 40 * DAY));
  const files: File[] = [];
  const p1 = await submitCitizenProposal(named.maria.id, { title: "Faixa de pedestres elevada em frente à Escola Municipal do Centro", problem: "Os carros passam em alta velocidade na saída dos alunos e já houve atropelamentos leves.", solution: "Construir faixa elevada e instalar sinalização de área escolar.", themeId: await themeId("Mobilidade e Transporte"), districtId: districtId("Centro"), authorizePublication: "sim" }, files, db);
  await analyzeProposal(admins.analista, p1.id, { action: "iniciar_analise" }, db);
  clock.set(new Date(realNow.getTime() - 30 * DAY));
  await analyzeProposal(admins.analista, p1.id, { action: "responder", responseType: "convertida", responseText: "A proposta foi acolhida e convertida em proposta municipal para estudo técnico da Secretaria de Mobilidade." }, db);
  await analyzeProposal(admins.analista, p1.id, { action: "publicar" }, db);
  clock.set(new Date(realNow.getTime() - 25 * DAY));
  const p2 = await submitCitizenProposal(named.carla.id, { title: "Horta comunitária no terreno baldio da Rua das Mangueiras", problem: "O terreno acumula lixo e atrai insetos, preocupando os moradores do bairro.", solution: "Ceder o terreno para uma horta comunitária gerida pela associação de moradores.", themeId: await themeId("Meio Ambiente"), districtId: districtId("Jatiúca"), authorizePublication: "sim" }, files, db);
  await analyzeProposal(admins.analista, p2.id, { action: "iniciar_analise" }, db);
  await analyzeProposal(admins.analista, p2.id, { action: "responder", responseType: "encaminhada", responseText: "Encaminhada à Secretaria de Meio Ambiente, responsável pelo programa de hortas urbanas." }, db);
  await analyzeProposal(admins.analista, p2.id, { action: "publicar" }, db);
  clock.set(new Date(realNow.getTime() - 12 * DAY));
  const p3 = await submitCitizenProposal(named.maria.id, { title: "Iluminação na trilha do Parque Municipal", problem: "A trilha fica escura a partir das 18h e moradores evitam passar pelo parque.", solution: "Instalar postes de LED ao longo da trilha principal.", themeId: await themeId("Infraestrutura e Iluminação"), districtId: districtId("Bebedouro"), authorizePublication: "nao" }, files, db);
  await analyzeProposal(admins.analista, p3.id, { action: "iniciar_analise" }, db);
  await analyzeProposal(admins.analista, p3.id, { action: "solicitar_ajuste", guidance: "Informe o trecho aproximado da trilha (início e fim) para orçamento." }, db);
  clock.set(new Date(realNow.getTime() - 3 * DAY));
  await submitCitizenProposal(crowd[2].id, { title: "Mais vagas na creche municipal de Santa Lúcia", problem: "A fila de espera da creche tem mais de 80 crianças no bairro.", solution: "Ampliar a creche com duas novas salas.", themeId: await themeId("Educação"), districtId: districtId("Santa Lúcia"), authorizePublication: "sim" }, files, db);
  await submitCitizenProposal(crowd[4].id, { title: "Ponto de ônibus coberto na Avenida do Sol", problem: "Os passageiros esperam sob sol e chuva sem abrigo.", solution: "Instalar abrigo com banco e cobertura.", themeId: await themeId("Mobilidade e Transporte"), districtId: districtId("Levada"), authorizePublication: "sim" }, files, db);

  // ---------------- Avisos de boas-vindas ----------------
  clock.set(null);
  await notifyUser(db, named.maria.id, { type: "conta", title: "Bem-vinda à demonstração da PPCM", body: "Esta conta é fictícia. Explore as consultas abertas, suas participações e suas propostas.", link: "/conta" });
  await audit(db, { action: "dados_demonstracao_carregados", objectType: "sistema", objectId: "seed", details: { consultas: 11, cidadaos: crowd.length + 4 } });
  // Garantia: nenhuma proposta "sem dono"
  void citizenProposals;
}
