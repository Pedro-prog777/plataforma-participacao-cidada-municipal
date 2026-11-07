/** Comentários e perguntas (RF064 — recurso condicionado *) com denúncia (RF065). */
import { commentAction, helpfulAction, reportAction } from "@/server/actions/citizen";
import { listComments } from "@/server/modules/moderation/moderation.service";
import { ActionForm, RadioGroup, SelectField, SubmitButton, TextArea } from "./ui/form";
import { Badge, Section } from "./ui/primitives";
import { fmtDateTime, REPORT_REASONS } from "@/lib/labels";

export async function CommentsSection({ targetType, targetId, back, canPost }: { targetType: "consultation" | "citizen_proposal"; targetId: string; back: string; canPost: boolean }) {
  const rows = await listComments(targetType, targetId);
  const roots = rows.filter((r) => !r.c.parentId);
  const answers = rows.filter((r) => r.c.parentId);
  return (
    <Section id="comentarios" title="Comentários e perguntas" description="Recurso opcional, condicionado à validação com o cliente (*). Comentários não são votos e não entram na apuração.">
      {canPost ? (
        <ActionForm action={commentAction.bind(null, targetType, targetId, back)} className="rounded-xl border border-line bg-white p-4">
          <RadioGroup
            legend="Tipo"
            name="kind"
            defaultValue="comentario"
            options={[
              { value: "comentario", label: "Comentário" },
              { value: "pergunta", label: "Pergunta à Prefeitura" },
            ]}
          />
          <TextArea label="Sua mensagem" name="body" required maxLength={1000} hint="Até 1.000 caracteres. Seu nome de exibição aparece abreviado; CPF e e-mail nunca são mostrados." />
          <SubmitButton>Publicar</SubmitButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-muted">Entre com uma conta de cidadão para comentar.</p>
      )}
      <ul className="space-y-3">
        {roots.map(({ c, helpful }) => (
          <li key={c.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{c.displayName}</strong>
              {c.kind === "pergunta" && <Badge tone="info">Pergunta</Badge>}
              <span className="text-muted">{fmtDateTime(c.createdAt)}</span>
            </div>
            <p className="prose-civic mt-1">{c.body}</p>
            {answers
              .filter((a) => a.c.parentId === c.id)
              .map((a) => (
                <div key={a.c.id} className="mt-3 rounded-lg border-l-4 border-brand-600 bg-brand-50 p-3 text-sm">
                  <Badge tone="primary">Resposta oficial</Badge>
                  <p className="prose-civic mt-1">{a.c.body}</p>
                </div>
              ))}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              {canPost && (
                <form action={helpfulAction.bind(null, c.id, back)}>
                  <button className="font-semibold text-brand-700 hover:underline">Útil ({helpful})</button>
                </form>
              )}
              <details>
                <summary className="cursor-pointer font-semibold text-muted hover:text-bad-700">Denunciar</summary>
                <ActionForm action={reportAction.bind(null, "comment", c.id, back)} className="mt-2 max-w-md space-y-3">
                  <SelectField label="Motivo" name="reason" required placeholder="Selecione" options={Object.entries(REPORT_REASONS).map(([value, label]) => ({ value, label }))} />
                  <TextArea label="Detalhes" name="details" rows={2} />
                  <SubmitButton variant="secondary">Enviar denúncia</SubmitButton>
                </ActionForm>
              </details>
            </div>
          </li>
        ))}
        {!roots.length && <p className="text-sm text-muted">Nenhum comentário ainda.</p>}
      </ul>
    </Section>
  );
}
