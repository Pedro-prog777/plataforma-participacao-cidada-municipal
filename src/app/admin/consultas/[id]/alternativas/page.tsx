import { RefText } from "@/components/requisitos/ref-text";
import { AlternativesEditor } from "@/components/admin/alternatives-editor";
import { Alert, Card } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/current";
import { getAdminConsultation } from "@/server/modules/consultations/admin-view";
import { alternativesAction } from "@/server/actions/admin";

export const metadata = { title: "Alternativas" };

export default async function AlternativasPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getAdminConsultation(id);
  const editable = ["rascunho", "rejeitada"].includes(data.c.status);
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Alternativas de resposta</h2>
        <p className="text-sm text-muted"><RefText>De 2 a 10 alternativas, equilibradas e mutuamente exclusivas, com explicação em linguagem simples. Após a publicação não podem ser alteradas (RN12).</RefText></p>
      </div>
      {!editable && <Alert tone="info">Alternativas bloqueadas nesta situação.</Alert>}
      <AlternativesEditor action={alternativesAction.bind(null, id)} initial={data.alternatives.map((a) => ({ label: a.label, explanation: a.explanation }))} allowAbstention={data.c.allowAbstention} disabled={!editable} />
    </Card>
  );
}
