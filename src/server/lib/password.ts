/**
 * Senhas com Argon2id (RNF05, RF001 "guardada só como hash").
 * Parâmetros recomendados pela OWASP: m = 19 MiB, t = 2, p = 1.
 * O algoritmo padrão de @node-rs/argon2 é Argon2id.
 */
import { hash, verify } from "@node-rs/argon2";
import { onlyDigits } from "@/lib/cpf";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

/** Hash fixo usado para equalizar o tempo de resposta quando a conta não existe. */
let dummyHash: Promise<string> | null = null;
export async function dummyVerify(password: string) {
  dummyHash ??= hashPassword("ppcm-dummy-password-1");
  await verifyPassword(await dummyHash, password);
}

/**
 * Política de senha (RN23): mínimo de 8 caracteres, com letra e número,
 * diferente do CPF, da data de nascimento e do e-mail.
 */
export function passwordPolicyErrors(password: string, ctx: { cpf?: string; birthDate?: string; email?: string }): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("A senha deve ter pelo menos 8 caracteres.");
  if (password.length > 128) errors.push("A senha deve ter no máximo 128 caracteres.");
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) errors.push("A senha deve ter letras e números.");
  const pw = password.toLowerCase();
  const cpf = ctx.cpf ? onlyDigits(ctx.cpf) : "";
  if (cpf && onlyDigits(password) === cpf && cpf.length === 11) errors.push("A senha não pode ser igual ao CPF.");
  if (ctx.birthDate) {
    const [y, m, d] = ctx.birthDate.split("-");
    const forms = [`${d}${m}${y}`, `${d}/${m}/${y}`, `${y}-${m}-${d}`, `${y}${m}${d}`];
    if (forms.some((f) => pw === f.toLowerCase() || onlyDigits(password) === onlyDigits(f))) {
      errors.push("A senha não pode ser a data de nascimento.");
    }
  }
  if (ctx.email && pw === ctx.email.toLowerCase()) errors.push("A senha não pode ser igual ao e-mail.");
  return errors;
}
