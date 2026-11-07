import QRCode from "qrcode";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { acceptInviteAction } from "@/server/actions/auth";
import { inspectInvite, newTotpEnrollment } from "@/server/modules/auth/auth.service";
import { otpauthUrl } from "@/server/lib/totp";

export const metadata = { title: "Ativar conta administrativa" };

export default async function ConvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const invite = await inspectInvite(token);
  if (!invite) {
    return (
      <MainContainer>
        <Alert tone="danger" title="Convite inválido ou expirado">
          O convite vale por 72 horas e só pode ser usado uma vez. Peça um novo ao gestor de acessos.
        </Alert>
      </MainContainer>
    );
  }
  const secret = newTotpEnrollment();
  const qr = await QRCode.toString(otpauthUrl(secret, invite.email), { type: "svg", margin: 1 });
  return (
    <MainContainer>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Ativar conta administrativa" description={`${invite.name} — ${invite.organ ?? ""}`} />
        <Card>
          <ActionForm action={acceptInviteAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="totpSecret" value={secret} />
            <Field label="Senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
            <Field label="Confirme a senha" name="confirm" type="password" required autoComplete="new-password" />
            <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-[10rem_1fr]">
              <div className="w-40 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR Code para cadastrar o segundo fator no aplicativo autenticador" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Segundo fator obrigatório</p>
                <p>Leia o QR Code com um aplicativo autenticador (TOTP) ou digite a chave manualmente:</p>
                <code className="block break-all rounded bg-brand-50 p-2">{secret}</code>
              </div>
            </div>
            <Field label="Código gerado pelo aplicativo" name="totpCode" required inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="max-w-48" />
            <SubmitButton>Ativar conta</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </MainContainer>
  );
}
