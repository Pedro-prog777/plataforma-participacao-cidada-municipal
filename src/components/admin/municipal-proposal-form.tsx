"use client";
import { ActionForm, Field, SelectField, SubmitButton, TextArea, type FormState } from "../ui/form";

type Opt = { value: string; label: string };

export function MunicipalProposalForm({ action, themes, organs, d = {}, disabled }: { action: (s: FormState, fd: FormData) => Promise<FormState>; themes: Opt[]; organs: Opt[]; d?: Record<string, string | undefined>; disabled?: boolean }) {
  return (
    <ActionForm action={action}>
      <fieldset disabled={disabled} className="space-y-4">
        {d.version && <input type="hidden" name="version" value={d.version} />}
        <Field label="Título" name="title" required maxLength={200} defaultValue={d.title} />
        <TextArea label="Resumo" name="summary" required rows={2} defaultValue={d.summary} />
        <TextArea label="Descrição" name="description" required rows={4} defaultValue={d.description} />
        <TextArea label="Justificativa" name="justification" required rows={3} defaultValue={d.justification} />
        <TextArea label="Objetivos" name="objectives" required rows={3} defaultValue={d.objectives} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Tema" name="themeId" required placeholder="Selecione" options={themes} defaultValue={d.themeId} />
          <Field label="Abrangência" name="scope" required defaultValue={d.scope} placeholder="Ex.: Todo o município" />
          <SelectField label="Órgão responsável" name="organId" required placeholder="Selecione" options={organs} defaultValue={d.organId} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Custo estimado (R$)" name="estimatedCost" inputMode="decimal" defaultValue={d.estimatedCost} />
          <Field label="Fonte de recursos" name="fundingSource" defaultValue={d.fundingSource} />
          <Field label="Prazo de execução" name="executionDeadline" defaultValue={d.executionDeadline} />
        </div>
        <p className="text-xs text-muted">Rascunhos incompletos podem ser salvos; a validação completa ocorre no envio da consulta para revisão (RF028). Conteúdo executável (HTML/scripts) é removido.</p>
        {!disabled && <SubmitButton>Salvar</SubmitButton>}
      </fieldset>
    </ActionForm>
  );
}
