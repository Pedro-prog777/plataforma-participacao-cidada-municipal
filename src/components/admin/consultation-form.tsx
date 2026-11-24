"use client";
/** Formulário de dados da consulta (RF025) — usado na criação e na edição (RF024). */
import { RefText } from "@/components/requisitos/ref-text";
import { Checkbox, Field, SelectField, TextArea } from "../ui/form";
import { CharCounter } from "../layout/client-bits";

type Opt = { value: string; label: string };
type Defaults = Partial<Record<string, string | boolean>>;

export function ConsultationFields({ themes, regions, organs, d = {}, prazo }: { themes: Opt[]; regions: Opt[]; organs: Opt[]; d?: Defaults; prazo: { padrao: number; excepcional: number } }) {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  return (
    <>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold text-brand-900">Identificação</legend>
        <Field label="Título" name="title" id="title" required maxLength={200} defaultValue={s("title")} />
        <TextArea label="Resumo" name="summary" id="summary" required rows={2} maxLength={600} defaultValue={s("summary")} hint="Uma ou duas frases em linguagem simples." />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Tema" name="themeId" required placeholder="Selecione" options={themes} defaultValue={s("themeId")} />
          <SelectField label="Região (abrangência)" name="regionId" placeholder="Todo o município" options={regions} defaultValue={s("regionId")} />
          <SelectField label="Unidade responsável" name="organId" required placeholder="Selecione" options={organs} defaultValue={s("organId")} />
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold text-brand-900">Contexto</legend>
        <TextArea label="Problema" name="problem" id="problem" required defaultValue={s("problem")} />
        <TextArea label="Objetivo" name="objective" id="objective" required defaultValue={s("objective")} />
        <TextArea label="Justificativa" name="justification" id="justification" required defaultValue={s("justification")} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold text-brand-900">Participação</legend>
        <SelectField label="Forma de participação" name="participationForm" required options={[{ value: "votacao", label: "Votação consultiva" }]} defaultValue="votacao" />
        <div>
          <TextArea label="Pergunta" name="question" id="question" required rows={2} maxLength={300} defaultValue={s("question")} hint="Clara e neutra, sem induzir a resposta. Até 300 caracteres." />
          <CharCounter targetId="question" max={300} />
        </div>
        <TextArea label="Orientações de participação" name="guidance" id="guidance" required defaultValue={s("guidance")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Abertura (horário de Brasília)" name="opensAt" id="opensAt" type="datetime-local" required defaultValue={s("opensAt")} />
          <Field label="Encerramento (horário de Brasília)" name="closesAt" id="closesAt" type="datetime-local" required defaultValue={s("closesAt")} hint={`Período padrão: ${prazo.padrao} dias. Se vazio, o sistema sugere ${prazo.padrao} dias após a abertura.`} />
        </div>
        <Checkbox name="exceptionalDeadline" label={`Pedir prazo excepcional de ${prazo.excepcional} dias (emergência)`} hint="Exige justificativa e autorização de quem tem o papel “autorizar prazo excepcional” (*)." defaultChecked={d.exceptionalDeadline === true} />
        <TextArea label="Justificativa da emergência" name="emergencyJustification" id="emergencyJustification" rows={2} defaultValue={s("emergencyJustification")} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold text-brand-900">Apuração e próximos passos</legend>
        <p className="text-sm text-muted"><RefText>Regra de apuração: maioria simples dos votos válidos (padrão, RN18). A natureza é sempre consultiva (RN34).</RefText></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Quórum de referência"
            name="quorumType"
            options={[
              { value: "nenhum", label: "Não adotar" },
              { value: "absoluto", label: "Número de participações" },
              { value: "percentual", label: "Percentual dos elegíveis estimados" },
            ]}
            defaultValue={s("quorumType") ?? "nenhum"}
          />
          <Field label="Valor do quórum" name="quorumValue" id="quorumValue" inputMode="decimal" defaultValue={s("quorumValue")} />
        </div>
        <TextArea label="O que acontecerá após o encerramento" name="nextSteps" id="nextSteps" required defaultValue={s("nextSteps")} />
        <Checkbox name="ownRite" label="Tema com rito próprio (ex.: Plano Diretor)" defaultChecked={d.ownRite === true} />
        <Checkbox name="ownRiteConfirmed" label="Confirmo que a norma aplicável foi verificada" defaultChecked={d.ownRiteConfirmed === true} />
      </fieldset>
    </>
  );
}
