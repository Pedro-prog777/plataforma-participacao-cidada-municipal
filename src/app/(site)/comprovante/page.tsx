import { MainContainer } from "@/components/layout/site-chrome";
import { ReceiptChecker } from "@/components/receipt-checker";
import { Card, PageHeader } from "@/components/ui/primitives";
import { verifyReceiptAction } from "@/server/actions/citizen";

export const metadata = { title: "Verificar comprovante" };

export default function ComprovantePage() {
  return (
    <MainContainer>
      <PageHeader
        title="Verificar comprovante de participação"
        description="Informe o código de 12 caracteres para confirmar que a participação consta e foi contabilizada. A verificação nunca revela a alternativa escolhida nem quem votou."
        breadcrumbs={[{ href: "/", label: "Início" }, { label: "Verificar comprovante" }]}
      />
      <Card className="max-w-xl">
        <ReceiptChecker action={verifyReceiptAction} />
      </Card>
    </MainContainer>
  );
}
