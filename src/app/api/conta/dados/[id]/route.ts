/** Download da cópia dos dados pessoais (RF015). Apenas o titular, por 48 horas. */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/server/auth/current";
import { getDataExport } from "@/server/modules/profile/profile.service";
import { isUuid } from "@/lib/text";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = (await params).id;
  const e = isUuid(id) ? await getDataExport(actor.id, id) : null;
  if (!e) return NextResponse.json({ erro: "Não encontrado ou expirado." }, { status: 404 });
  const isPdf = e.format === "pdf";
  return new NextResponse(isPdf ? new Uint8Array(Buffer.from(e.content, "base64")) : e.content, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados.${e.format}"`,
      "Cache-Control": "no-store",
    },
  });
}
