"use client";
import { ActionForm, Field, SubmitButton, TextArea, type FormState } from "../ui/form";

export function AttachmentForm({ action, published }: { action: (s: FormState, fd: FormData) => Promise<FormState>; published: boolean }) {
  return (
    <ActionForm action={action}>
      <Field label="Título do material" name="title" required />
      <div className="space-y-1.5">
        <label htmlFor="file" className="block text-sm font-semibold">
          Arquivo <span className="font-normal text-muted">(PDF, ODS, XLSX, CSV, imagem, áudio ou vídeo — até 20 MB)</span>
        </label>
        <input id="file" name="file" type="file" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:font-semibold file:text-brand-800" />
      </div>
      <Field label="Ou link (transmissão, gravação ou página oficial)" name="url" type="url" placeholder="https://" />
      <Field label="Texto alternativo (obrigatório para imagens)" name="altText" />
      <TextArea label="Transcrição ou resumo (obrigatório para áudio, vídeo e links de vídeo)" name="transcript" rows={3} />
      <Field label="Link das legendas (vídeo com fala)" name="captionsUrl" type="url" />
      {published && <TextArea label="Justificativa do acréscimo (consulta publicada)" name="justification" required rows={2} />}
      <SubmitButton>Anexar</SubmitButton>
    </ActionForm>
  );
}
