/** Exportação CSV da trilha de auditoria (RF058). A própria consulta é auditada. */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentActor } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { audit, searchAudit } from "@/server/modules/audit/audit.service";
import { getDb } from "@/server/db/client";
import { toCsv } from "@/server/lib/export-formats";

export async function GET(req: NextRequest) {
  const actor = await getCurrentActor();
  if (!can(actor, "auditoria.consultar")) {
    await audit(getDb(), { actorId: actor?.id ?? null, action: "acesso_negado", result: "negado", objectType: "auditoria", objectId: "exportacao" });
    return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const filter = { from: sp.get("de") ?? undefined, to: sp.get("ate") ?? undefined, actorId: sp.get("usuario") ?? undefined, action: sp.get("acao") ?? undefined, objectType: sp.get("objeto") ?? undefined };
  const rows = await searchAudit(filter, 5000);
  await audit(getDb(), { actorId: actor!.id, actorRole: "gestor_acessos", action: "auditoria_exportada", objectType: "auditoria", objectId: "csv", details: { registros: rows.length } });
  const csv = toCsv(
    rows.map((r) => ({ id: r.id, data_hora: r.occurredAt.toISOString(), autor: r.actorId ?? "sistema", papel: r.actorRole ?? "", acao: r.action, objeto: r.objectType ?? "", objeto_id: r.objectId ?? "", resultado: r.result, justificativa: r.justification ?? "", detalhes: r.details ? JSON.stringify(r.details) : "", hash_anterior: r.prevHash, hash: r.hash })),
  );
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="auditoria-ppcm.csv"', "Cache-Control": "no-store" } });
}
