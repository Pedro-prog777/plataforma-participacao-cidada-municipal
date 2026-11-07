"use client";
/** Campos da proposta cidadã (RF020), reutilizados no envio e no atendimento de ajuste. */
import { Field, RadioGroup, SelectField, TextArea } from "./ui/form";
import { CharCounter } from "./layout/client-bits";

type Opt = { value: string; label: string };

export function ProposalFields({ themes, districts, defaults, withFiles }: { themes: Opt[]; districts: Opt[]; defaults?: Partial<Record<"title" | "problem" | "solution" | "themeId" | "districtId" | "authorizePublication", string>>; withFiles?: boolean }) {
  return (
    <>
      <div>
        <Field label="Título" name="title" id="proposta-titulo" required maxLength={120} defaultValue={defaults?.title} hint="Resuma a ideia em até 120 caracteres." />
        <CharCounter targetId="proposta-titulo" max={120} />
      </div>
      <TextArea label="Descrição do problema" name="problem" required rows={5} defaultValue={defaults?.problem} hint="O que acontece hoje? Onde? Quem é afetado? Não inclua dados pessoais de terceiros." />
      <TextArea label="Solução sugerida" name="solution" required rows={5} defaultValue={defaults?.solution} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Área temática" name="themeId" required placeholder="Selecione" options={themes} defaultValue={defaults?.themeId} />
        <SelectField label="Região ou bairro" name="districtId" required placeholder="Selecione" options={districts} defaultValue={defaults?.districtId} />
      </div>
      {withFiles && (
        <div className="space-y-1.5">
          <label htmlFor="files" className="block text-sm font-semibold">
            Anexos <span className="font-normal text-muted">(opcional — até 3 arquivos PDF, JPG ou PNG)</span>
          </label>
          <input id="files" name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:font-semibold file:text-brand-800" />
        </div>
      )}
      <RadioGroup
        legend="Você autoriza a publicação do texto da proposta no portal?"
        name="authorizePublication"
        required
        defaultValue={defaults?.authorizePublication}
        hint="Seus dados pessoais nunca são publicados, mesmo com autorização. Sem autorização, a proposta é analisada e respondida apenas a você."
        options={[
          { value: "sim", label: "Sim, autorizo publicar o texto" },
          { value: "nao", label: "Não autorizo" },
        ]}
      />
    </>
  );
}
