import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { requireCitizen } from "@/server/auth/current";
import { getProfile } from "@/server/modules/profile/profile.service";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { updateProfileAction } from "@/server/actions/citizen";

export const metadata = { title: "Atualizar dados" };

export default async function EditarPerfilPage() {
  const a = await requireCitizen();
  const [p, ref] = await Promise.all([getProfile(a.id), referenceData()]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title="Atualizar dados do perfil" breadcrumbs={[{ href: "/conta", label: "Meu perfil" }, { label: "Atualizar dados" }]} />
      <Alert tone="info" className="mb-6">
        O CPF não pode ser alterado. Nome civil e data de nascimento só mudam após verificação documental — use a página de <Link href="/conta/verificacao">verificação</Link> para pedir a correção. Um novo e-mail só passa a valer após a confirmação; um novo endereço exige nova comprovação de domicílio.
      </Alert>
      <Card>
        <ActionForm action={updateProfileAction}>
          <Field label="Nome social" name="socialName" defaultValue={p.socialName ?? ""} maxLength={150} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" name="email" type="email" required defaultValue={p.pendingEmail ?? p.email} autoComplete="email" />
            <Field label="Celular" name="phone" mask="celular" defaultValue={p.phone ?? ""} inputMode="tel" placeholder="(00) 00000-0000" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Field label="CEP" name="cep" required mask="cep" defaultValue={p.cep ?? ""} inputMode="numeric" placeholder="00000-000" />
            <Field label="Logradouro" name="street" required defaultValue={p.street ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Número" name="number" required defaultValue={p.number ?? ""} />
            <Field label="Complemento" name="complement" defaultValue={p.complement ?? ""} />
            <SelectField label="Bairro" name="district" required defaultValue={p.districtId ?? "fora"} options={[...ref.districts.map((d) => ({ value: d.id, label: d.name })), { value: "fora", label: "Moro fora do município" }]} />
          </div>
          <Field label="Município (se mora fora)" name="externalCity" defaultValue={p.externalCity ?? ""} />
          <Field label="Confirme com sua senha atual" name="currentPassword" type="password" required autoComplete="current-password" className="max-w-sm" />
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
