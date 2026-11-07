/** Comprovante em PDF (RF038): título, data e código — sem a alternativa. Apenas o titular. */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/server/auth/current";
import { myParticipations } from "@/server/modules/voting/voting.service";
import { buildPdf } from "@/server/lib/export-formats";
import { env } from "@/server/lib/env";
import { fmtDate, fmtDateTime } from "@/lib/labels";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "cidadao") return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = (await params).id;
  // Busca restrita às participações do próprio titular (RF009).
  const part = (await myParticipations(actor.id)).find((x) => x.id === id);
  if (!part) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  const pdf = await buildPdf(
    [
      { type: "title", text: "Comprovante de participação" },
      { type: "text", text: `${env.municipio} — Plataforma de Participação Cidadã` },
      { type: "space" },
      { type: "table", head: ["Campo", "Valor"], rows: [["Consulta", part.title], ["Data da participação", fmtDate(part.date)], ["Código do comprovante", part.receipt]] },
      { type: "space" },
      { type: "text", text: "Este comprovante prova a participação, mas não informa a alternativa escolhida. O voto é secreto e irretratável." },
      { type: "text", text: `Verifique a autenticidade em ${env.appUrl}/comprovante informando o código acima.` },
    ],
    `Emitido em ${fmtDateTime(new Date())}`,
  );
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="comprovante-${part.receipt}.pdf"`, "Cache-Control": "no-store" } });
}
