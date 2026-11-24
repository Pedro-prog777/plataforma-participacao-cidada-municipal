import { notFound } from "next/navigation";
import { isUuid } from "@/lib/text";
import { AttachmentForm } from "@/components/admin/attachment-form";
import { AttachmentList } from "@/components/attachments";
import { Alert, Card, Section } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { listAttachments } from "@/server/modules/attachments/attachments.service";
import { attachmentAction } from "@/server/actions/admin";

export const metadata = { title: "Anexos" };

export default async function AnexosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getAdminConsultation(id);
  const items = await listAttachments("consultation", id);
  const draft = ["rascunho", "rejeitada"].includes(data.c.status);
  const published = ["agendada", "aberta", "suspensa"].includes(data.c.status);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <Section title="Documentos e materiais" description="Cada arquivo é verificado (formato real, tamanho e antivírus) e guardado com hash SHA-256. Limite de 10 anexos.">
        <AttachmentList items={items} />
      </Section>
      <Card className="space-y-3">
        <h2 className="font-bold">Novo anexo</h2>
        {draft || published ? <AttachmentForm action={attachmentAction.bind(null, "consultation", id, `/admin/consultas/${id}/anexos`)} published={published} /> : <Alert tone="info">Não é possível anexar nesta situação (RN12).</Alert>}
      </Card>
    </div>
  );
}
