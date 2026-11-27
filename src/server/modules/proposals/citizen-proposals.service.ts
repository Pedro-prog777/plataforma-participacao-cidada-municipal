/**
 * Propostas cidadãs (RF020, RF021, RF067; RN30, RN38, RN39, RN11).
 * Estados (RN30): Recebida → Em análise → (Ajuste solicitado ↔ Em análise) → Respondida → Publicada (se autorizada) → Encerrada.
 * O autor nunca é exibido publicamente; é visível apenas à administração.
 */
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "../../db/client";
import { attachments, citizenProposalEvents, citizenProposals, consultations, districts, municipalProposals, proposalSupports, themes, users } from "../../db/schema";
import { clock, DAY } from "../../lib/clock";
import { protocol } from "../../lib/crypto";
import { DomainError, NotFoundError, parseOrThrow, ValidationError } from "../../lib/errors";
import { receiveFile, type StoredFile } from "../../lib/files";
import { getSetting } from "../../lib/settings";
import { normalizeSearch, sanitizePlainText } from "@/lib/text";
import { PROPOSAL_RESPONSE, PUBLIC_STATUSES } from "@/lib/labels";
import { audit } from "../audit/audit.service";
import { assertPermission, usersWithPermission, type Actor } from "../access/access.service";
import { notifyUser } from "../notifications/notifications.service";
import { PropostaCidadaRepository } from "../../repositories/proposta-cidada.repository";

const OPEN_STATES = ["recebida", "em_analise", "ajuste_solicitado"] as const;

const proposalSchema = z.object({
  title: z.string().transform((v) => sanitizePlainText(v)).pipe(z.string().min(5, "Informe um título (mínimo 5 caracteres).").max(120, "O título deve ter até 120 caracteres.")),
  problem: z.string().transform((v) => sanitizePlainText(v)).pipe(z.string().min(20, "Descreva o problema (mínimo 20 caracteres).").max(5000)),
  solution: z.string().transform((v) => sanitizePlainText(v)).pipe(z.string().min(20, "Descreva a solução sugerida (mínimo 20 caracteres).").max(5000)),
  themeId: z.string().min(1, "Selecione a área temática."),
  districtId: z.string().min(1, "Selecione a região ou bairro."),
  authorizePublication: z.enum(["sim", "nao"], { error: "Informe se autoriza a publicação do texto." }),
});

/** Propostas semelhantes antes do envio (RF020): publicadas e consultas públicas com termos do título. */
export async function findSimilar(title: string, themeId?: string | null, db: DbOrTx = getDb()) {
  const terms = normalizeSearch(title)
    .split(" ")
    .filter((t) => t.length >= 4)
    .slice(0, 6);
  if (!terms.length) return { proposals: [], consultations: [] };
  const like = (col: typeof citizenProposals.searchText | typeof consultations.searchText) => or(...terms.map((t) => ilike(col, `%${t.replace(/[%_]/g, "")}%`)));
  const [ps, cs] = await Promise.all([
    db
      .select({ id: citizenProposals.id, protocol: citizenProposals.protocol, title: citizenProposals.title, supports: sql<number>`(select count(*)::int from proposal_supports s where s.proposal_id = ${citizenProposals.id})` })
      .from(citizenProposals)
      .where(and(eq(citizenProposals.status, "publicada"), eq(citizenProposals.hidden, false), like(citizenProposals.searchText), themeId ? eq(citizenProposals.themeId, themeId) : undefined))
      .limit(5),
    db.select({ slug: consultations.slug, title: consultations.title, status: consultations.status }).from(consultations).where(and(inArray(consultations.status, PUBLIC_STATUSES), like(consultations.searchText))).limit(5),
  ]);
  return { proposals: ps, consultations: cs };
}

export async function submitCitizenProposal(userId: string, input: Record<string, unknown>, files: File[], db: DbOrTx = getDb()) {
  const data = parseOrThrow(proposalSchema, input);
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  // Pré-condição: autenticado e verificado (RN04).
  if (!u || u.kind !== "cidadao" || u.status !== "ativa") throw new DomainError("Conta não autorizada a enviar propostas.");
  if (u.verificationLevel !== "verificado") throw new DomainError("Para enviar propostas é preciso verificar sua identidade.", "identidade_nao_verificada");
  const limit = await getSetting("proposta.limite_em_analise", db);
  const [{ n }] = await db.select({ n: count() }).from(citizenProposals).where(and(eq(citizenProposals.authorId, userId), inArray(citizenProposals.status, [...OPEN_STATES])));
  if (n >= limit) throw new DomainError(`Você já tem ${n} proposta(s) em análise. O limite é ${limit}; aguarde a resposta para enviar outra.`, "limite_propostas");
  const [theme] = await db.select().from(themes).where(eq(themes.id, data.themeId));
  const [district] = await db.select().from(districts).where(eq(districts.id, data.districtId));
  if (!theme) throw new ValidationError({ themeId: ["Área temática inválida."] });
  if (!district) throw new ValidationError({ districtId: ["Região ou bairro inválido."] });
  const valid = files.filter((f) => f && f.size > 0);
  if (valid.length > 3) throw new ValidationError({ files: ["Envie no máximo 3 anexos."] });
  const stored: StoredFile[] = [];
  for (const f of valid) stored.push(await receiveFile(f, { maxBytes: 20 * 1024 * 1024, allowed: ["documento", "imagem"] }));
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [p] = await tx
      .insert(citizenProposals)
      .values({
        protocol: protocol("PROP"),
        authorId: userId,
        title: data.title,
        problem: data.problem,
        solution: data.solution,
        themeId: data.themeId,
        districtId: data.districtId,
        authorizePublication: data.authorizePublication === "sim",
        status: "recebida",
        searchText: normalizeSearch(`${data.title} ${data.problem} ${data.solution}`),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    for (const s of stored) {
      await tx.insert(attachments).values({ ownerType: "citizen_proposal", ownerId: p.id, kind: "arquivo", mediaType: s.mediaType, title: s.filename, filename: s.filename, mime: s.mime, sizeBytes: s.sizeBytes, sha256: s.sha256, storagePath: s.storagePath, createdBy: userId });
    }
    await tx.insert(citizenProposalEvents).values({ proposalId: p.id, status: "recebida", note: "Proposta recebida.", actorId: userId, createdAt: now });
    await notifyUser(tx, userId, { type: "respostas_propostas", title: `Proposta recebida — protocolo ${p.protocol}`, body: `Recebemos sua proposta "${p.title}". Acompanhe o andamento pelo protocolo ${p.protocol}.`, link: `/conta/propostas/${p.id}` });
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "proposta_cidada_enviada", objectType: "proposta_cidada", objectId: p.id });
    return p;
  });
}

/** Autor reenvia após ajuste solicitado. */
export async function resubmitAfterAdjustment(userId: string, id: string, input: Record<string, unknown>, db: DbOrTx = getDb()) {
  const data = parseOrThrow(proposalSchema, input);
  await db.transaction(async (tx) => {
    const repositorio = new PropostaCidadaRepository(tx);
    const proposta = await repositorio.obter(id, { paraAtualizar: true });
    if (proposta.autorId !== userId) throw new NotFoundError();
    const now = clock.now();
    // Só reenvia quem está em "ajuste solicitado"; a proposta volta para análise (RN30) — regra da entidade.
    proposta.reenviarComAjustes({ titulo: data.title, problema: data.problem, solucao: data.solution, temaId: data.themeId, bairroId: data.districtId, autorizaPublicacao: data.authorizePublication === "sim" }, now);
    await repositorio.salvar(proposta);
    await tx.insert(citizenProposalEvents).values({ proposalId: id, status: "em_analise", note: "Autor enviou os ajustes solicitados.", actorId: userId, createdAt: now });
    await audit(tx, { actorId: userId, actorRole: "cidadao", action: "proposta_cidada_ajustada", objectType: "proposta_cidada", objectId: id });
  });
}

export async function myProposals(userId: string, db: DbOrTx = getDb()) {
  return db
    .select({ p: citizenProposals, theme: themes.name })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .where(eq(citizenProposals.authorId, userId))
    .orderBy(desc(citizenProposals.createdAt));
}

export async function getProposalForAuthor(userId: string, id: string, db: DbOrTx = getDb()) {
  const [r] = await db
    .select({ p: citizenProposals, theme: themes.name, district: districts.name })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .leftJoin(districts, eq(districts.id, citizenProposals.districtId))
    .where(and(eq(citizenProposals.id, id), eq(citizenProposals.authorId, userId)));
  if (!r) return null;
  const [events, files] = await Promise.all([
    db.select().from(citizenProposalEvents).where(eq(citizenProposalEvents.proposalId, id)).orderBy(asc(citizenProposalEvents.createdAt)),
    db.select().from(attachments).where(and(eq(attachments.ownerType, "citizen_proposal"), eq(attachments.ownerId, id))),
  ]);
  return { ...r, events, files };
}

/* ------------------------------ Público ------------------------------ */
export async function listPublishedProposals(filter: { q?: string; themeId?: string } = {}, db: DbOrTx = getDb()) {
  const conds = [eq(citizenProposals.status, "publicada"), eq(citizenProposals.hidden, false)];
  if (filter.q) normalizeSearch(filter.q).split(" ").filter(Boolean).slice(0, 6).forEach((t) => conds.push(ilike(citizenProposals.searchText, `%${t.replace(/[%_]/g, "")}%`)));
  if (filter.themeId) conds.push(eq(citizenProposals.themeId, filter.themeId));
  return db
    .select({
      id: citizenProposals.id,
      protocol: citizenProposals.protocol,
      title: citizenProposals.title,
      problem: citizenProposals.problem,
      responseType: citizenProposals.responseType,
      publishedAt: citizenProposals.publishedAt,
      priority: citizenProposals.priority,
      theme: themes.name,
      district: districts.name,
      supports: sql<number>`(select count(*)::int from proposal_supports s where s.proposal_id = ${citizenProposals.id})`,
    })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .leftJoin(districts, eq(districts.id, citizenProposals.districtId))
    .where(and(...conds))
    .orderBy(desc(citizenProposals.publishedAt));
}

/** Página pública da proposta: texto autorizado e resposta; nunca dados do autor. */
export async function getPublishedProposal(protocolCode: string, db: DbOrTx = getDb()) {
  const [r] = await db
    .select({
      id: citizenProposals.id,
      protocol: citizenProposals.protocol,
      title: citizenProposals.title,
      problem: citizenProposals.problem,
      solution: citizenProposals.solution,
      responseType: citizenProposals.responseType,
      responseText: citizenProposals.responseText,
      publishedAt: citizenProposals.publishedAt,
      createdAt: citizenProposals.createdAt,
      priority: citizenProposals.priority,
      theme: themes.name,
      district: districts.name,
    })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .leftJoin(districts, eq(districts.id, citizenProposals.districtId))
    .where(and(eq(citizenProposals.protocol, protocolCode), eq(citizenProposals.status, "publicada"), eq(citizenProposals.hidden, false)));
  if (!r) return null;
  const [{ n }] = await db.select({ n: count() }).from(proposalSupports).where(eq(proposalSupports.proposalId, r.id));
  return { ...r, supports: n };
}

/* --------------------------- Administração --------------------------- */
export async function proposalQueue(filter: { status?: string } = {}, db: DbOrTx = getDb()) {
  return db
    .select({ p: citizenProposals, theme: themes.name, district: districts.name, author: users.fullName })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .leftJoin(districts, eq(districts.id, citizenProposals.districtId))
    .leftJoin(users, eq(users.id, citizenProposals.authorId))
    .where(filter.status ? eq(citizenProposals.status, filter.status as (typeof OPEN_STATES)[number]) : ne(citizenProposals.status, "encerrada"))
    // Prioridade para propostas que atingiram a meta de apoios (RF067); depois, das mais antigas.
    .orderBy(desc(citizenProposals.priority), asc(citizenProposals.createdAt));
}

export async function getProposalAdmin(id: string, db: DbOrTx = getDb()) {
  const [r] = await db
    .select({ p: citizenProposals, theme: themes.name, district: districts.name, author: users.fullName, authorEmail: users.email })
    .from(citizenProposals)
    .leftJoin(themes, eq(themes.id, citizenProposals.themeId))
    .leftJoin(districts, eq(districts.id, citizenProposals.districtId))
    .leftJoin(users, eq(users.id, citizenProposals.authorId))
    .where(eq(citizenProposals.id, id));
  if (!r) return null;
  const [events, files, [{ n }]] = await Promise.all([
    db.select().from(citizenProposalEvents).where(eq(citizenProposalEvents.proposalId, id)).orderBy(asc(citizenProposalEvents.createdAt)),
    db.select().from(attachments).where(and(eq(attachments.ownerType, "citizen_proposal"), eq(attachments.ownerId, id))),
    db.select({ n: count() }).from(proposalSupports).where(eq(proposalSupports.proposalId, id)),
  ]);
  return { ...r, events, files, supports: n };
}

export type AnalysisAction =
  | { action: "iniciar_analise" }
  | { action: "solicitar_ajuste"; guidance: string }
  | { action: "responder"; responseType: keyof typeof PROPOSAL_RESPONSE; responseText: string }
  | { action: "publicar" }
  | { action: "encerrar"; justification: string };

export async function analyzeProposal(actor: Actor, id: string, act: AnalysisAction, db: DbOrTx = getDb()) {
  await assertPermission(actor, "propostas_cidadas.analisar", { objectType: "proposta_cidada", objectId: id }, db);
  return db.transaction(async (tx) => {
    const repositorio = new PropostaCidadaRepository(tx);
    const proposta = await repositorio.obter(id, { paraAtualizar: true });
    proposta.garantirAnalistaDiferenteDoAutor(actor.id);
    const now = clock.now();
    let note = "";
    // Cada ação é um método da entidade, que confere o estado de origem (RN30) e as justificativas (RN11).
    switch (act.action) {
      case "iniciar_analise":
        proposta.iniciarAnalise(now);
        note = "Proposta em análise pela administração.";
        break;
      case "solicitar_ajuste": {
        const g = sanitizePlainText(act.guidance ?? "");
        const days = await getSetting("proposta.prazo_ajuste_dias", tx);
        proposta.solicitarAjuste(g, days, now);
        note = `Ajuste solicitado: ${g} (prazo de ${days} dias).`;
        break;
      }
      case "responder": {
        const text = sanitizePlainText(act.responseText ?? "");
        proposta.responder(act.responseType, text, now);
        note = `${PROPOSAL_RESPONSE[act.responseType]}: ${text}`;
        if (act.responseType === "convertida") {
          // Aceita: o sistema cria proposta municipal vinculada (RF022) em Rascunho.
          const [mp] = await tx
            .insert(municipalProposals)
            .values({ title: proposta.titulo.slice(0, 200), summary: proposta.problema.slice(0, 600), description: proposta.solucao, justification: text, themeId: proposta.temaId, status: "rascunho", originCitizenProposalId: proposta.id, createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now })
            .returning();
          proposta.vincularPropostaMunicipal(mp.id);
        }
        break;
      }
      case "publicar":
        proposta.publicar(now);
        note = "Texto publicado no portal (sem dados pessoais do autor).";
        break;
      case "encerrar": {
        const j = sanitizePlainText(act.justification ?? "");
        proposta.encerrar(j, now);
        note = `Encerrada: ${j}`;
        break;
      }
    }
    await repositorio.salvar(proposta);
    const status = proposta.situacao;
    await tx.insert(citizenProposalEvents).values({ proposalId: id, status, note, actorId: actor.id, createdAt: now });
    await notifyUser(tx, proposta.autorId, { type: "respostas_propostas", title: `Proposta ${proposta.protocolo}: ${status.replace("_", " ")}`, body: note, link: `/conta/propostas/${id}` });
    await audit(tx, { actorId: actor.id, actorRole: "analise_propostas", action: `proposta_cidada_${act.action}`, objectType: "proposta_cidada", objectId: id });
  });
}

/* ------------------------- RF067 — Apoios (*) ------------------------- */
export async function supportProposal(userId: string, proposalId: string, db: DbOrTx = getDb()) {
  if (!(await getSetting("recursos.apoios", db))) throw new DomainError("O apoio a propostas não está habilitado nesta versão.", "recurso_desabilitado");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "cidadao" || u.status !== "ativa") throw new DomainError("Apenas cidadãos autenticados podem apoiar.");
  const [p] = await db.select().from(citizenProposals).where(eq(citizenProposals.id, proposalId));
  if (!p || p.status !== "publicada" || p.hidden) throw new NotFoundError();
  if (p.authorId === userId) throw new DomainError("Não é possível apoiar a própria proposta.");
  const inserted = await db.insert(proposalSupports).values({ proposalId, userId, createdAt: clock.now() }).onConflictDoNothing().returning();
  if (!inserted.length) throw new DomainError("Você já apoiou esta proposta.", "apoio_repetido");
  const [{ n }] = await db.select({ n: count() }).from(proposalSupports).where(eq(proposalSupports.proposalId, proposalId));
  const [goal, days] = await Promise.all([getSetting("apoios.meta", db), getSetting("apoios.prazo_dias", db)]);
  const withinDeadline = p.publishedAt && days > 0 && clock.now().getTime() - p.publishedAt.getTime() <= days * DAY;
  if (goal > 0 && n >= goal && withinDeadline && !p.priority) {
    await db.update(citizenProposals).set({ priority: true }).where(eq(citizenProposals.id, proposalId));
    await db.insert(citizenProposalEvents).values({ proposalId, status: p.status, note: `Meta de ${goal} apoios atingida no prazo: análise prioritária com resposta obrigatória.`, createdAt: clock.now() });
    for (const a of await usersWithPermission("propostas_cidadas.analisar", db)) await notifyUser(db, a.id, { type: "conta", title: "Proposta atingiu a meta de apoios", body: p.title, link: `/admin/propostas/${proposalId}` });
    await notifyUser(db, p.authorId, { type: "respostas_propostas", title: "Sua proposta atingiu a meta de apoios", body: "Ela receberá análise prioritária.", link: `/conta/propostas/${proposalId}` });
  }
  return { supports: n };
}
