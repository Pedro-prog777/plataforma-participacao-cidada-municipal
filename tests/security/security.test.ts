/**
 * Testes de segurança de entrada (OWASP A01/A03/A10): SSRF em links externos (RF023),
 * injeção em buscas, conteúdo executável em texto livre e redirecionamento aberto.
 * O sigilo do voto e o voto único ficam em tests/integration/voting.test.ts;
 * autenticação e bloqueios, em tests/integration/auth.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import { assign, createAdmin, createCitizen, createOpenConsultation } from "../helpers/fixtures";
import type { Db } from "@/server/db/client";
import { attachments, districts, notifications, themes, users } from "@/server/db/schema";
import { addAttachment, checkExternalLinks } from "@/server/modules/attachments/attachments.service";
import { createMunicipalProposal } from "@/server/modules/proposals/municipal-proposals.service";
import { submitCitizenProposal } from "@/server/modules/proposals/citizen-proposals.service";
import { listAdminConsultations, listPublicConsultations } from "@/server/modules/consultations/queries.service";
import { clock } from "@/server/lib/clock";
import { resetRateLimits } from "@/server/lib/rate-limit";
import { isPublicHttpsUrl, safeInternalPath } from "@/lib/text";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);
beforeEach(() => {
  resetRateLimits();
  clock.set(null);
});

describe("Links externos (RF023) e proteção contra SSRF", () => {
  it("recusa endereços internos; link fora do ar muda a situação e avisa o responsável uma única vez", async () => {
    expect(isPublicHttpsUrl("https://videos.prefeitura-ficticia.org/audiencia")).toBe(true);
    for (const bad of ["http://site.org/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://localhost/x", "https://servidor.local/x", "https://[::1]/x", "https://usuario:senha@site.org/x", "ftp://site.org/x", "javascript:alert(1)"]) {
      expect(isPublicHttpsUrl(bad), bad).toBe(false);
    }
    const elab = await createAdmin(db, ["elaborador"]);
    const mp = await createMunicipalProposal(elab, { title: "Proposta com link" }, db);
    await expect(addAttachment(elab, { ownerType: "municipal_proposal", ownerId: mp.id, title: "Vídeo", url: "https://169.254.169.254/latest/meta-data", transcript: "resumo" }, db)).rejects.toThrow(/link público seguro/);
    await expect(addAttachment(elab, { ownerType: "municipal_proposal", ownerId: mp.id, title: "Vídeo", url: "https://videos.prefeitura-ficticia.org/a" }, db)).rejects.toThrow(/resumo ou transcrição/);

    const responsavel = await createAdmin(db, ["responsavel"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    await assign(db, consultation.id, responsavel.id, "responsavel");
    const [link] = await db
      .insert(attachments)
      .values({ ownerType: "consultation", ownerId: consultation.id, kind: "link", mediaType: "link", title: "Gravação da audiência", url: "https://videos.prefeitura-ficticia.org/gravacao", transcript: "Resumo da audiência." })
      .returning();
    const calls: { url: string; redirect?: string; method?: string }[] = [];
    const fora = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), redirect: init?.redirect, method: init?.method });
      return new Response(null, { status: 404 });
    }) as typeof fetch;
    expect(await checkExternalLinks(db, fora)).toBeGreaterThanOrEqual(1);
    // Só HEAD e sem seguir redirecionamentos (um redirecionamento poderia apontar para a rede interna).
    expect(calls.every((c) => c.method === "HEAD" && c.redirect === "manual")).toBe(true);
    expect((await db.select().from(attachments).where(eq(attachments.id, link.id)))[0].linkStatus).toBe("http_404");
    const avisos = async () => (await db.select().from(notifications).where(and(eq(notifications.userId, responsavel.id), eq(notifications.title, "Link de material indisponível")))).length;
    expect(await avisos()).toBe(1);
    await checkExternalLinks(db, fora);
    expect(await avisos()).toBe(1);
    await checkExternalLinks(db, (async () => new Response(null, { status: 200 })) as typeof fetch);
    expect((await db.select().from(attachments).where(eq(attachments.id, link.id)))[0].linkStatus).toBe("ok");
  });
});

describe("Entradas maliciosas (OWASP A01/A03)", () => {
  it("busca com sintaxe de SQL é tratada como texto e não altera o banco", async () => {
    for (const q of ["' OR 1=1 --", "\"; DROP TABLE votes; --", "%' UNION SELECT password_hash FROM users --"]) {
      const r = await listPublicConsultations({ q }, null, db);
      expect(r.total, q).toBe(0);
    }
    await createCitizen(db);
    expect((await db.select().from(users).limit(1)).length).toBe(1);
  });

  it("filtros de URL fora do formato não derrubam a listagem (antes: erro 500 em /consultas?tema=abc)", async () => {
    const elab = await createAdmin(db, ["elaborador"]);
    const { consultation } = await createOpenConsultation(db, { createdBy: elab.id });
    // Identificador inválido não corresponde a nenhuma consulta.
    for (const f of [{ themeId: "abc" }, { regionId: "1' OR '1'='1" }]) expect((await listPublicConsultations(f, null, db)).total).toBe(0);
    // Data inválida é ignorada: a consulta aberta continua aparecendo.
    for (const f of [{ from: "xyz" }, { to: "2026-13-45" }, { from: "2026-02-30" }, { year: "abc", archive: false }]) {
      expect((await listPublicConsultations(f, null, db)).items.some((i) => i.id === consultation.id), JSON.stringify(f)).toBe(true);
    }
    expect((await listAdminConsultations({ status: "xyz" }, db)).length).toBeGreaterThan(0);
    expect((await listAdminConsultations({ status: "toString" }, db)).length).toBeGreaterThan(0);
  });

  it("marcação executável é removida do texto livre antes de gravar", async () => {
    const c = await createCitizen(db);
    const [tema] = await db.select().from(themes).limit(1);
    const [bairro] = await db.select().from(districts).limit(1);
    const p = await submitCitizenProposal(
      c.id,
      { title: "<script>alert(1)</script>Praça limpa", problem: 'A praça está suja <img src=x onerror="alert(1)"> todos os dias.', solution: "Colocar lixeiras e <b>varrição</b> diária na praça.", themeId: tema.id, districtId: bairro.id, authorizePublication: "sim" },
      [],
      db,
    );
    expect(p.title).toBe("Praça limpa");
    expect(p.problem).not.toMatch(/<|onerror/);
    expect(p.solution).toBe("Colocar lixeiras e varrição diária na praça.");
  });

  it("redirecionamento pós-login só aceita caminho interno", () => {
    expect(safeInternalPath("/consultas?situacao=aberta", "/conta")).toBe("/consultas?situacao=aberta");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "", "/conta\n/x"]) {
      expect(safeInternalPath(bad, "/conta"), JSON.stringify(bad)).toBe("/conta");
    }
  });
});
