import { ZodError } from "zod";

export type FieldErrors = Record<string, string[]>;

/** Erro de regra de negócio com mensagem segura para exibir ao usuário. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "regra",
    public readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(fieldErrors: FieldErrors, message?: string) {
    const all = Object.values(fieldErrors).flat();
    super(message ?? (all.length === 1 ? all[0] : "Verifique os campos destacados."), "validacao", fieldErrors);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message, "proibido");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Registro não encontrado.") {
    super(message, "nao_encontrado");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "conflito");
    this.name = "ConflictError";
  }
}

export function zodToFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Valida com Zod e lança ValidationError com TODOS os erros por campo (RF002). */
export function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(zodToFieldErrors(r.error));
  return r.data;
}

/** Código SQLSTATE de violação de unicidade (PostgreSQL). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
