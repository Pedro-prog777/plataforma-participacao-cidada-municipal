/**
 * Caminhos otimizados (RNF09): as consultas em lote e a paginação devem devolver exatamente o
 * mesmo resultado das versões anteriores — RF016, RF017, RF046, RF048, RF058.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { createAdmin, createCitizen, createOpenConsultation } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { audienceCriteria, incidents, participations, regions, roles, sessions, users } from "@/server/db/schema";
import { monitoringPanel } from "@/server/modules/admin/monitoring.service";
import { searchUsers, setUserRoles, USERS_PAGE_SIZE } from "@/server/modules/admin/users.service";
import { audit, countAudit, searchAudit } from "@/server/modules/audit/audit.service";
import { createSession, validateSession } from "@/server/modules/auth/session.service";
import { listPublicConsultations, listPublicOutcomes, listPublishedResults } from "@/server/modules/consultations/queries.service";
import { loadAudienceCriteria } from "@/server/modules/voting/eligibility";
import { clock } from "@/server/lib/clock";
import { resetRateLimits } from "@/server/lib/rate-limit";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

const participate = (consultationId: string, citizenId: string, day: string) =>
  db.insert(participations).values({ consultationId, citizenId, participatedOn: day, receiptHash: `h-${Math.random()}`, receiptEnc: "x" });

describe("Painel de monitoramento em lote (RF048)", () => {
  it("separa participações diárias, recusas e incidentes por consulta, sem misturar consultas", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const gestor = await createAdmin(db, ["acompanhamento"]);
    const a = (await createOpenConsultation(db, { createdBy: elab.id })).consultation;
    const b = (await createOpenConsultation(db, { createdBy: elab.id })).consultation;
    const vazia = (await createOpenConsultation(db, { createdBy: elab.id })).consultation;
    const cs = await Promise.all([1, 2, 3, 4].map(() => createCitizen(db)));
    await participate(a.id, cs[0].id, "2026-11-10");
    await participate(a.id, cs[1].id, "2026-11-10");
    await participate(a.id, cs[2].id, "2026-11-11");
    await participate(b.id, cs[0].id, "2026-11-12");
    for (const motivo of ["fora_do_periodo", "fora_do_periodo", "ja_participou"]) {
      await audit(db, { actorId: cs[3].id, action: "voto_recusado", result: "negado", objectType: "consulta", objectId: a.id, details: { motivo } });
    }
    await db.insert(incidents).values([
      { severity: "media", type: "teste", consultationId: a.id, description: "aberto" },
      { severity: "media", type: "teste", consultationId: a.id, description: "encerrado", status: "encerrado" },
      { severity: "alta", type: "teste", consultationId: b.id, description: "em análise", status: "em_analise" },
    ]);

    const panel = await monitoringPanel(gestor, db);
    const of = (id: string) => panel.find((p) => p.id === id)!;
    expect(of(a.id).participations).toBe(3);
    expect(of(a.id).daily).toEqual([
      { day: "2026-11-10", n: 2 },
      { day: "2026-11-11", n: 1 },
    ]);
    expect(of(a.id).refused.sort((x, y) => x.motivo.localeCompare(y.motivo))).toEqual([
      { motivo: "fora_do_periodo", n: 2 },
      { motivo: "ja_participou", n: 1 },
    ]);
    expect(of(a.id).openIncidents).toBe(1);
    expect(of(a.id).alerts.incidents).toBe(true);
    expect(of(b.id)).toMatchObject({ participations: 1, daily: [{ day: "2026-11-12", n: 1 }], refused: [], openIncidents: 1 });
    expect(of(vazia.id)).toMatchObject({ participations: 0, daily: [], refused: [], openIncidents: 0 });
    // RN16: nenhuma contagem por alternativa no painel.
    expect(JSON.stringify(panel)).not.toMatch(/alternativ/i);
  });
});

describe("Listagem pública com elegibilidade em lote (RF016, RF017)", () => {
  it("indica onde o cidadão já participou, pode participar ou não se enquadra, e filtra por “posso participar”", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const cidadao = await createCitizen(db); // Centro — Região Administrativa 2
    const aberta = (await createOpenConsultation(db, { createdBy: elab.id })).consultation;
    const outraRegiao = (await createOpenConsultation(db, { createdBy: elab.id, audienceOpen: false })).consultation;
    const minhaRegiao = (await createOpenConsultation(db, { createdBy: elab.id, audienceOpen: false })).consultation;
    const jaVotei = (await createOpenConsultation(db, { createdBy: elab.id })).consultation;
    const [ra1] = await db.select().from(regions).where(eq(regions.name, "Região Administrativa 1"));
    const [ra2] = await db.select().from(regions).where(eq(regions.name, "Região Administrativa 2"));
    await db.insert(audienceCriteria).values([
      { consultationId: outraRegiao.id, type: "territorio", params: { regionIds: [ra1.id] }, justification: "j", publicText: "Moradores da Região Administrativa 1." },
      { consultationId: minhaRegiao.id, type: "territorio", params: { regionIds: [ra2.id] }, justification: "j", publicText: "Moradores da Região Administrativa 2." },
    ]);
    await participate(jaVotei.id, cidadao.id, "2026-11-10");

    const byId = new Map((await loadAudienceCriteria([outraRegiao.id, minhaRegiao.id, aberta.id], db)).entries());
    expect(byId.get(outraRegiao.id)).toHaveLength(1);
    expect(byId.has(aberta.id)).toBe(false);
    expect((await loadAudienceCriteria([], db)).size).toBe(0);

    const all = await listPublicConsultations({ status: "aberta" }, cidadao.id, db);
    type Item = Awaited<ReturnType<typeof listPublicConsultations>>["items"][number];
    const everyPage: Item[] = [];
    for (let p = 1; p <= all.pages; p++) everyPage.push(...(await listPublicConsultations({ status: "aberta", page: p }, cidadao.id, db)).items);
    const found = (id: string) => everyPage.find((i) => i.id === id)!;
    expect(found(aberta.id)).toMatchObject({ viewerState: "pode_participar", viewerReason: null });
    expect(found(minhaRegiao.id).viewerState).toBe("pode_participar");
    expect(found(outraRegiao.id).viewerState).toBe("nao_se_enquadra");
    expect(found(outraRegiao.id).viewerReason).toBeTruthy();
    expect(found(jaVotei.id).viewerState).toBe("participou");

    const posso: Item[] = [];
    const first = await listPublicConsultations({ status: "aberta", canParticipate: true }, cidadao.id, db);
    for (let p = 1; p <= first.pages; p++) posso.push(...(await listPublicConsultations({ status: "aberta", canParticipate: true, page: p }, cidadao.id, db)).items);
    const ids = posso.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([aberta.id, minhaRegiao.id]));
    expect(ids).not.toContain(outraRegiao.id);
    expect(ids).not.toContain(jaVotei.id);
    // Visitante: nenhuma indicação pessoal.
    expect((await listPublicConsultations({ status: "aberta" }, null, db)).items.every((i) => i.viewerState === null)).toBe(true);
  });

  it("limites da página inicial devolvem só os mais recentes", async () => {
    expect((await listPublishedResults(3, db)).length).toBeLessThanOrEqual(3);
    expect((await listPublicOutcomes({ limit: 3 }, db)).length).toBeLessThanOrEqual(3);
  });
});

describe("Paginação de usuários e auditoria (RF046, RF058)", () => {
  it("usuários: 25 por página, total correto, papéis só das contas da página e página fora do intervalo ajustada", async () => {
    const gestor = await createAdmin(db, ["gestor_acessos"], "Zuleica Gestora");
    for (let i = 0; i < USERS_PAGE_SIZE + 3; i++) await createCitizen(db);
    const p1 = await searchUsers(gestor, { kind: "cidadao" }, db);
    expect(p1.items).toHaveLength(USERS_PAGE_SIZE);
    expect(p1.total).toBeGreaterThanOrEqual(USERS_PAGE_SIZE + 3);
    expect(p1.pages).toBe(Math.ceil(p1.total / USERS_PAGE_SIZE));
    const p2 = await searchUsers(gestor, { kind: "cidadao", page: 2 }, db);
    expect(p2.page).toBe(2);
    const seen = new Set(p1.items.map((u) => u.id));
    expect(p2.items.some((u) => seen.has(u.id))).toBe(false);
    expect((await searchUsers(gestor, { kind: "cidadao", page: 9999 }, db)).page).toBe(p1.pages);
    expect((await searchUsers(gestor, { kind: "cidadao", page: -3 }, db)).page).toBe(1);

    const [revisor] = await db.select().from(roles).where(eq(roles.key, "revisor"));
    const servidor = await createAdmin(db, []);
    await setUserRoles(gestor, servidor.id, [revisor.id], db);
    const admins = await searchUsers(gestor, { kind: "admin" }, db);
    expect(admins.items.find((u) => u.id === servidor.id)!.roles).toEqual([revisor.name]);
    expect(admins.items.find((u) => u.id === gestor.id)!.roles.length).toBeGreaterThan(0);
    expect((await searchUsers(gestor, { q: "Zuleica" }, db)).items.map((u) => u.id)).toEqual([gestor.id]);
    expect(await searchUsers(gestor, { q: "ninguém com este nome" }, db)).toMatchObject({ total: 0, page: 1, pages: 1, items: [] });
  });

  it("auditoria: total pelo filtro e páginas sem repetição", async () => {
    const gestor = await createAdmin(db, ["gestor_acessos"]);
    for (let i = 0; i < 7; i++) await audit(db, { actorId: gestor.id, action: "teste_paginacao", objectType: "teste", objectId: `obj-${i}` });
    const filter = { action: "teste_paginacao" };
    expect(await countAudit(filter, db)).toBe(7);
    const a = await searchAudit(filter, 3, db);
    const b = await searchAudit(filter, 3, db, 3);
    const c = await searchAudit(filter, 3, db, 6);
    expect([a.length, b.length, c.length]).toEqual([3, 3, 1]);
    expect(new Set([...a, ...b, ...c].map((r) => r.id)).size).toBe(7);
    // Mais recentes primeiro, continuando de onde a página anterior parou.
    expect(a[0].id).toBeGreaterThan(a[2].id);
    expect(a[2].id).toBeGreaterThan(b[0].id);
    expect(await countAudit({ action: "acao_inexistente" }, db)).toBe(0);
  });
});

describe("Sessão com o nome de exibição (uma consulta a menos por página)", () => {
  it("validateSession devolve o nome social quando existe, senão o nome civil", async () => {
    const c = await createCitizen(db);
    const token = await createSession(db, c.id, { mfaVerified: true, ipHash: "ip", userAgent: "vitest" });
    expect(await validateSession(token, db)).toMatchObject({ userId: c.id, kind: "cidadao", name: c.fullName });
    await db.update(users).set({ socialName: "Nome Social" }).where(eq(users.id, c.id));
    expect((await validateSession(token, db))!.name).toBe("Nome Social");
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, c.id));
    expect(await validateSession(token, db)).toBeNull();
  });
});
