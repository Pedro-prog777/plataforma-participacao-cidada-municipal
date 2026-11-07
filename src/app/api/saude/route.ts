/** Verificação de saúde para monitoramento de disponibilidade (RNF10). */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getDbKind } from "@/server/db/client";
import { ensureDatabase } from "@/server/db/bootstrap";

export async function GET() {
  try {
    await ensureDatabase();
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", banco: getDbKind(), horarioServidor: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "erro" }, { status: 503 });
  }
}
