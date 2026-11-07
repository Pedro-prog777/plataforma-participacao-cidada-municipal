"use server";
import { unsubscribeFromToken } from "@/server/actions/citizen";
import type { FormState } from "@/server/actions/helpers";

export async function unsubscribeAction(token: string, _: FormState): Promise<FormState> {
  const ok = await unsubscribeFromToken(token);
  return ok ? { ok: true, message: "Pronto: você não receberá mais esse tipo de aviso por e-mail." } : { ok: false, message: "Link inválido ou tipo de aviso obrigatório." };
}
