/** Dados abertos (RF045, RNF13): CSV, JSON e PDF, apenas agregados. */
import { NextResponse, type NextRequest } from "next/server";
import { ensureDatabase } from "@/server/db/bootstrap";
import { exportDataset } from "@/server/modules/results/open-data.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  await ensureDatabase();
  const { dataset } = await params;
  if (dataset !== "resultados" && dataset !== "encaminhamentos") return NextResponse.json({ erro: "Conjunto inexistente." }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato") ?? "csv";
  if (!["csv", "json", "pdf"].includes(formato)) return NextResponse.json({ erro: "Formato inválido." }, { status: 400 });
  const out = await exportDataset(dataset, formato as "csv", { consultationId: sp.get("consulta") ?? undefined, from: sp.get("de") ?? undefined, to: sp.get("ate") ?? undefined });
  if (out.empty && formato !== "json") {
    return new NextResponse("Sem dados no período selecionado.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(out.body as BodyInit, {
    headers: { "Content-Type": out.contentType, "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "no-store" },
  });
}
