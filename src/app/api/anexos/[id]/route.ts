/**
 * Download de anexos com controle de acesso (RF023, RF004, RS012):
 *  - consulta/proposta municipal: público apenas se a consulta estiver em situação pública; senão só administração;
 *  - proposta cidadã: autor ou administração com permissão de análise;
 *  - documentos de identidade: titular ou quem tem "identidade.analisar".
 */
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { citizenProposals, consultations, identityVerifications } from "@/server/db/schema";
import { getCurrentActor } from "@/server/auth/current";
import { can } from "@/server/modules/access/access.service";
import { getAttachment } from "@/server/modules/attachments/attachments.service";
import { readStoredFile } from "@/server/lib/files";
import { PUBLIC_STATUSES } from "@/lib/labels";

const deny = () => NextResponse.json({ erro: "Acesso negado." }, { status: 403 });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAttachment(id).catch(() => null);
  if (!a || !a.storagePath) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  const actor = await getCurrentActor();
  const db = getDb();
  let allowed = false;
  if (a.ownerType === "consultation" || a.ownerType === "municipal_proposal") {
    const col = a.ownerType === "consultation" ? consultations.id : consultations.municipalProposalId;
    const [c] = await db.select({ id: consultations.id }).from(consultations).where(and(eq(col, a.ownerId), inArray(consultations.status, PUBLIC_STATUSES)));
    allowed = !!c || actor?.kind === "admin";
  } else if (a.ownerType === "citizen_proposal") {
    const [p] = await db.select({ authorId: citizenProposals.authorId }).from(citizenProposals).where(eq(citizenProposals.id, a.ownerId));
    allowed = !!p && (p.authorId === actor?.id || can(actor, "propostas_cidadas.analisar") || can(actor, "moderacao.moderar"));
  } else if (a.ownerType === "identity") {
    const [v] = await db.select({ userId: identityVerifications.userId }).from(identityVerifications).where(eq(identityVerifications.id, a.ownerId));
    allowed = !!v && (v.userId === actor?.id || can(actor, "identidade.analisar"));
  }
  if (!allowed) return deny();
  const buf = await readStoredFile(a.storagePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": a.mime ?? "application/octet-stream",
      // Imagens/mídias abrem no navegador; demais arquivos são baixados.
      "Content-Disposition": `${/^(image|audio|video)\//.test(a.mime ?? "") ? "inline" : "attachment"}; filename="${encodeURIComponent(a.filename ?? "anexo")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": a.ownerType === "identity" ? "no-store" : "private, max-age=300",
    },
  });
}
