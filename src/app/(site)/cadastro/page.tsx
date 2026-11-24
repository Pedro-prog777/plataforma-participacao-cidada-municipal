import Link from "next/link";
import { redirect } from "next/navigation";
import { MainContainer } from "@/components/layout/site-chrome";
import { ActionForm, Checkbox, Field, SelectField, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { registerAction } from "@/server/actions/auth";
import { getCurrentActor } from "@/server/auth/current";
import { referenceData } from "@/server/modules/consultations/queries.service";
import { env } from "@/server/lib/env";

export const metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getCurrentActor()) redirect("/conta");
  const ref = await referenceData();
  const regionName = (id: string) => ref.regions.find((r) => r.id === id)?.name ?? "";
  return (
    <MainContainer>
      <PageHeader title="Criar conta de cidadão" description="Com a conta você poderá votar nas consultas (após verificar a identidade), enviar propostas e acompanhar resultados." breadcrumbs={[{ href: "/", label: "Início" }, { label: "Criar conta" }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <Card>
          <ActionForm action={registerAction}>
            <p className="text-sm text-muted">
              Leva poucos minutos. Os campos com <span className="font-semibold text-bad-700">*</span> são obrigatórios; a pontuação do CPF, da data, do celular e do CEP entra sozinha.
            </p>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold text-brand-900">Identificação</legend>
              <Field label="Nome completo" name="fullName" required autoComplete="name" maxLength={150} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF" name="cpf" required mask="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" hint="Usado só para garantir uma conta por pessoa e verificar sua identidade. Nunca é exibido." />
                <Field label="Data de nascimento" name="birthDate" required mask="data" placeholder="DD/MM/AAAA" inputMode="numeric" autoComplete="bday" hint="Usada apenas em consultas com critério de idade justificado." />
              </div>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold text-brand-900">Contato</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-mail" name="email" type="email" required autoComplete="email" />
                <Field label="Celular" name="phone" mask="celular" inputMode="tel" autoComplete="tel-national" placeholder="(00) 00000-0000" />
              </div>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold text-brand-900">Endereço no município</legend>
              <p className="-mt-2 text-sm text-muted">Usado para consultas restritas a bairros ou regiões.</p>
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <Field label="CEP" name="cep" required mask="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
                <Field label="Logradouro" name="street" required autoComplete="address-line1" />
              </div>
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
                <Field label="Número" name="number" required />
                <Field label="Complemento" name="complement" autoComplete="address-line2" />
                <SelectField
                  label="Bairro"
                  name="district"
                  required
                  placeholder="Selecione"
                  options={[...ref.districts.map((d) => ({ value: d.id, label: `${d.name} (${regionName(d.regionId)})` })), { value: "fora", label: `Moro fora de ${env.municipio.replace(/^Município de /, "")}` }]}
                />
              </div>
              {/* Só aparece quando a pessoa escolhe “Moro fora” no bairro (regra em globals.css, sem JavaScript). */}
              <div className="so-quem-mora-fora">
                <Field label="Município e UF onde você mora" name="externalCity" required hint="O cadastro é aceito; quem pode participar é definido em cada consulta." />
              </div>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold text-brand-900">Senha</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números. Não use seu CPF, data de nascimento ou e-mail." />
                <Field label="Confirme a senha" name="passwordConfirm" type="password" required autoComplete="new-password" />
              </div>
            </fieldset>
            <Checkbox
              name="acceptTerms"
              required
              label={
                <>
                  Li e aceito os{" "}
                  <Link href="/termos" target="_blank" className="font-semibold text-brand-700 underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">
                    Política de Privacidade
                  </Link>
                  .
                </>
              }
            />
            <SubmitButton>Criar conta</SubmitButton>
          </ActionForm>
        </Card>
        <aside className="space-y-3 text-sm">
          <Card>
            <p className="font-semibold text-brand-900">Depois do cadastro</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Confirme o e-mail pelo link enviado (vale 24 h).</li>
              <li>Confirme sua identidade com a conta gov.br ou enviando documentos.</li>
              <li>Pronto: você pode votar nas consultas do seu público-alvo.</li>
            </ol>
          </Card>
          <p>
            Já tem conta?{" "}
            <Link href="/entrar" className="font-semibold text-brand-700 underline">
              Entrar
            </Link>
          </p>
        </aside>
      </div>
    </MainContainer>
  );
}
