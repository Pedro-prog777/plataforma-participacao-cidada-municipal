import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, destroyTestDb } from "../helpers/db";
import type { Db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { audit, verifyAuditChain } from "@/server/modules/audit/audit.service";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(destroyTestDb);

describe("Banco de dados e trilha de auditoria (RF057, RF058, RS013)", () => {
  it("aplica as migrations e os dados de referência", async () => {
    const r = await db.execute(sql`select count(*)::int as n from districts`);
    expect((r.rows[0] as { n: number }).n).toBeGreaterThan(5);
  });

  it("encadeia os registros por hash e detecta adulteração", async () => {
    await audit(db, { action: "teste_1", objectType: "x", objectId: "1" });
    await audit(db, { action: "teste_2", objectType: "x", objectId: "2", details: { campo: "a", senha: "nao-deve-ser-gravada" } });
    const ok = await verifyAuditChain(db);
    expect(ok.ok).toBe(true);
    expect(ok.total).toBe(2);
    const rows = await db.select().from(auditLog);
    expect(JSON.stringify(rows)).not.toContain("nao-deve-ser-gravada");
  });

  it("recusa UPDATE, DELETE e TRUNCATE na trilha (somente acréscimo)", async () => {
    await expect(db.execute(sql`update audit_log set action = 'x'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from audit_log`)).rejects.toThrow();
    await expect(db.execute(sql`truncate audit_log`)).rejects.toThrow();
  });

  it("detecta o primeiro registro inconsistente quando o gatilho é contornado", async () => {
    // Simula um ataque com privilégio de superusuário que desliga o gatilho.
    await db.execute(sql`alter table audit_log disable trigger audit_log_somente_acrescimo`);
    await db.execute(sql`update audit_log set action = 'adulterado' where action = 'teste_2'`);
    await db.execute(sql`alter table audit_log enable trigger audit_log_somente_acrescimo`);
    const r = await verifyAuditChain(db);
    expect(r.ok).toBe(false);
    expect(r.firstInvalidId).toBe(2);
  });
});
