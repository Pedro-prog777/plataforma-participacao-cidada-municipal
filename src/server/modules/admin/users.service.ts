/** Gestão de usuários (RF046) e de papéis e permissões (RF047); RN20, RN21, RN22, RN28. */
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { organs, roles, userRoles, users } from "../../db/schema";
import { clock } from "../../lib/clock";
import { randomToken } from "../../lib/crypto";
import { DomainError, NotFoundError, ValidationError, type FieldErrors } from "../../lib/errors";
import { hashPassword } from "../../lib/password";
import { invalidateSettingsCache, SETTINGS, writeSetting, type SettingKey } from "../../lib/settings";
import { ALL_PERMISSIONS, FORBIDDEN_COMBINATIONS, type Permission } from "@/lib/permissions";
import { normalizeSearch, sanitizePlainText, slugify } from "@/lib/text";
import { audit } from "../audit/audit.service";
import { assertPermission, type Actor } from "../access/access.service";
import { createInvite, emailSchema } from "../auth/auth.service";
import { revokeAllSessions } from "../auth/session.service";
import { notifyUser } from "../notifications/notifications.service";

/** Pesquisa de contas — sem senhas nem votos (RF046). */
export const USERS_PAGE_SIZE = 25;

export async function searchUsers(actor: Actor, filter: { q?: string; kind?: string; status?: string; page?: number }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "usuarios.gerenciar", {}, db);
  const conds = [];
  if (filter.q) {
    const q = `%${filter.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(users.fullName, q), ilike(users.email, q), ilike(users.registration, q)));
  }
  if (filter.kind === "cidadao" || filter.kind === "admin") conds.push(eq(users.kind, filter.kind));
  if (filter.status) conds.push(eq(users.status, filter.status as "ativa"));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1) || 1), pages);
  const rows = await db
    .select({ id: users.id, kind: users.kind, name: users.fullName, email: users.email, status: users.status, verificationLevel: users.verificationLevel, registration: users.registration, organ: organs.acronym, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, cpfMasked: users.cpfMasked })
    .from(users)
    .leftJoin(organs, eq(organs.id, users.organId))
    .where(where)
    .orderBy(asc(users.fullName), asc(users.id))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);
  // Papéis só das contas desta página.
  const ids = rows.map((r) => r.id);
  const rs = ids.length ? await db.select({ userId: userRoles.userId, name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(inArray(userRoles.userId, ids)) : [];
  return { total, page, pages, items: rows.map((r) => ({ ...r, roles: rs.filter((x) => x.userId === r.id).map((x) => x.name) })) };
}

/** Cria conta administrativa por convite válido por 72 h (RF046). */
export async function inviteAdmin(actor: Actor, input: { name: string; registration: string; email: string; organId: string; roleIds: string[] }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "usuarios.gerenciar", {}, db);
  const errors: FieldErrors = {};
  const name = sanitizePlainText(input.name ?? "");
  const registration = sanitizePlainText(input.registration ?? "");
  const emailR = emailSchema.safeParse(input.email);
  if (name.length < 3) errors.name = ["Informe o nome."];
  if (!registration) errors.registration = ["Informe a matrícula."];
  if (!emailR.success) errors.email = ["E-mail institucional inválido."];
  const [organ] = input.organId ? await db.select().from(organs).where(eq(organs.id, input.organId)) : [];
  if (!organ) errors.organId = ["Selecione o órgão."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const email = emailR.data!;
  const [dup] = await db.select({ id: users.id }).from(users).where(or(and(eq(users.kind, "admin"), eq(users.email, email)), eq(users.registration, registration)));
  if (dup) throw new ValidationError({ email: ["Já existe conta administrativa com este e-mail ou matrícula."] });
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [u] = await tx
      .insert(users)
      .values({ kind: "admin", fullName: name, email, registration, organId: organ.id, passwordHash: await hashPassword(randomToken(24)), status: "pendente", verificationLevel: "verificado", createdAt: now, updatedAt: now })
      .returning();
    const validRoles = input.roleIds.length ? await tx.select().from(roles).where(inArray(roles.id, input.roleIds)) : [];
    for (const r of validRoles) await tx.insert(userRoles).values({ userId: u.id, roleId: r.id, assignedBy: actor.id });
    await createInvite(tx, u.id, email);
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "conta_administrativa_convidada", objectType: "usuario", objectId: u.id, details: { papeis: validRoles.map((r) => r.key) } });
    return u;
  });
}

async function gestorRoleIds(db: DbOrTx) {
  const rs = await db.select().from(roles);
  return rs.filter((r) => r.permissions.includes("usuarios.gerenciar")).map((r) => r.id);
}

async function activeGestores(db: DbOrTx) {
  const ids = await gestorRoleIds(db);
  if (!ids.length) return [];
  return db.selectDistinct({ id: users.id }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).where(and(inArray(userRoles.roleId, ids), eq(users.status, "ativa")));
}

/** Bloquear, desbloquear ou desativar com justificativa (RF046). Atos anteriores permanecem válidos. */
export async function setAccountStatus(actor: Actor, userId: string, action: "bloquear" | "desbloquear" | "desativar", justification: string, db: DbOrTx = getDb()) {
  await assertPermission(actor, "usuarios.gerenciar", { objectType: "usuario", objectId: userId }, db);
  const j = sanitizePlainText(justification ?? "");
  if (!j) throw new ValidationError({ justification: ["Informe a justificativa."] });
  if (userId === actor.id && action !== "desbloquear") throw new DomainError("Não é permitido bloquear ou desativar a própria conta.", "auto_bloqueio");
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!u) throw new NotFoundError();
    if (action !== "desbloquear") {
      const gestores = await activeGestores(tx);
      if (gestores.some((g) => g.id === userId) && gestores.length <= 1) throw new DomainError("Não é possível remover o último gestor de acessos.", "ultimo_gestor");
    }
    const status = action === "bloquear" ? "bloqueada" : action === "desbloquear" ? "ativa" : "desativada";
    if (action === "desbloquear" && u.status !== "bloqueada") throw new DomainError("A conta não está bloqueada.");
    await tx.update(users).set({ status, updatedAt: clock.now(), deactivatedAt: status === "desativada" ? clock.now() : u.deactivatedAt, lockedUntil: null, failedLoginCount: 0 }).where(eq(users.id, userId));
    if (action !== "desbloquear") await revokeAllSessions(tx, userId);
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: `conta_${action === "bloquear" ? "bloqueada" : action === "desbloquear" ? "desbloqueada" : "desativada"}`, objectType: "usuario", objectId: userId, justification: j, details: { anterior: u.status, novo: status } });
    if (action !== "desativar") await notifyUser(tx, userId, { type: "conta", title: action === "bloquear" ? "Sua conta foi bloqueada" : "Sua conta foi desbloqueada", body: `Justificativa: ${j}` });
  });
}

/* ------------------------------ Papéis (RF047) ------------------------------ */
export async function listRoles(db: DbOrTx = getDb()) {
  const rs = await db.select().from(roles).orderBy(asc(roles.name));
  const counts = await db.select({ roleId: userRoles.roleId, n: count() }).from(userRoles).groupBy(userRoles.roleId);
  return rs.map((r) => ({ ...r, members: counts.find((c) => c.roleId === r.id)?.n ?? 0 }));
}

function validatePermissions(perms: string[]) {
  const invalid = perms.filter((p) => !ALL_PERMISSIONS.includes(p as Permission));
  if (invalid.length) throw new ValidationError({ permissions: [`Permissões inválidas: ${invalid.join(", ")}`] });
  for (const [a, b, why] of FORBIDDEN_COMBINATIONS) {
    if (perms.includes(a) && perms.includes(b)) throw new ValidationError({ permissions: [`Combinação vedada no mesmo papel: ${why} (RN20).`] });
  }
}

export async function saveRole(actor: Actor, input: { id?: string; name: string; description: string; permissions: string[] }, db: DbOrTx = getDb()) {
  await assertPermission(actor, "papeis.gerenciar", {}, db);
  const name = sanitizePlainText(input.name ?? "");
  if (name.length < 3) throw new ValidationError({ name: ["Informe o nome do papel."] });
  validatePermissions(input.permissions);
  return db.transaction(async (tx) => {
    if (input.id) {
      const [before] = await tx.select().from(roles).where(eq(roles.id, input.id)).for("update");
      if (!before) throw new NotFoundError();
      // Ao editar, a combinação também é verificada contra outros papéis de cada membro? Não: RN20 é aplicada por consulta (RF061).
      const [after] = await tx.update(roles).set({ name, description: sanitizePlainText(input.description ?? ""), permissions: input.permissions }).where(eq(roles.id, input.id)).returning();
      await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "papel_alterado", objectType: "papel", objectId: input.id, details: { antes: before.permissions, depois: after.permissions } });
      return after;
    }
    const [r] = await tx
      .insert(roles)
      .values({ key: `${slugify(name)}-${randomToken(3).toLowerCase()}`, name, description: sanitizePlainText(input.description ?? ""), permissions: input.permissions })
      .returning();
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "papel_criado", objectType: "papel", objectId: r.id, details: { depois: r.permissions } });
    return r;
  });
}

export async function deleteRole(actor: Actor, id: string, db: DbOrTx = getDb()) {
  await assertPermission(actor, "papeis.gerenciar", { objectType: "papel", objectId: id }, db);
  const [{ n }] = await db.select({ n: count() }).from(userRoles).where(eq(userRoles.roleId, id));
  if (n > 0) throw new DomainError(`Papel em uso por ${n} conta(s). Migre as contas antes de excluir.`, "papel_em_uso");
  const [r] = await db.select().from(roles).where(eq(roles.id, id));
  if (!r) throw new NotFoundError();
  if (r.system) throw new DomainError("Papéis previstos no documento não podem ser excluídos.");
  await db.transaction(async (tx) => {
    await tx.delete(roles).where(eq(roles.id, id));
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "papel_excluido", objectType: "papel", objectId: id, details: { antes: r.permissions } });
  });
}

export async function setUserRoles(actor: Actor, userId: string, roleIds: string[], db: DbOrTx = getDb()) {
  await assertPermission(actor, "papeis.gerenciar", { objectType: "usuario", objectId: userId }, db);
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u || u.kind !== "admin") throw new DomainError("Papéis só se aplicam a contas administrativas (RN22).");
    const before = (await tx.select({ id: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.id);
    const gestorIds = await gestorRoleIds(tx);
    const losingGestor = before.some((r) => gestorIds.includes(r)) && !roleIds.some((r) => gestorIds.includes(r));
    if (losingGestor && (await activeGestores(tx)).length <= 1) throw new DomainError("Não é possível remover o último gestor de acessos.", "ultimo_gestor");
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    const valid = roleIds.length ? await tx.select().from(roles).where(inArray(roles.id, roleIds)) : [];
    for (const r of valid) await tx.insert(userRoles).values({ userId, roleId: r.id, assignedBy: actor.id });
    // Aplicado na próxima requisição (permissões são lidas a cada requisição).
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "papeis_da_conta_alterados", objectType: "usuario", objectId: userId, details: { antes: before, depois: valid.map((r) => r.id) } });
  });
}

export async function userRoleIds(userId: string, db: DbOrTx = getDb()) {
  return (await db.select({ id: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.id);
}

/* ------------------------------ Parâmetros (RNF12) ------------------------------ */
export async function updateSettings(actor: Actor, values: Record<string, string>, db: DbOrTx = getDb()) {
  await assertPermission(actor, "configuracoes.gerenciar", {}, db);
  const errors: FieldErrors = {};
  const changes: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTINGS)) {
    if (!(key in values) && def.kind !== "boolean") continue;
    const raw = values[key];
    let v: unknown;
    if (def.kind === "boolean") v = raw === "on" || raw === "true";
    else if (def.kind === "number") {
      v = Number(raw);
      if (!Number.isFinite(v) || (v as number) < 0) errors[key] = ["Valor numérico inválido."];
    } else if (def.kind === "select") {
      if (!def.options?.includes(raw)) errors[key] = ["Opção inválida."];
      v = raw;
    } else v = sanitizePlainText(raw ?? "");
    changes[key] = v;
  }
  if (changes["recursos.apoios"] === true && (!(Number(changes["apoios.meta"]) > 0) || !(Number(changes["apoios.prazo_dias"]) > 0))) {
    errors["recursos.apoios"] = ["Defina meta e prazo de apoios antes de habilitar (os valores do portal federal não foram adotados — RF067)."];
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  await db.transaction(async (tx) => {
    for (const [k, v] of Object.entries(changes)) await writeSetting(tx, k as SettingKey, v, actor.id);
    await audit(tx, { actorId: actor.id, actorRole: "gestor_acessos", action: "parametros_alterados", objectType: "configuracao", objectId: "parametros", details: { chaves: Object.keys(changes) } });
  });
  invalidateSettingsCache();
}

export { normalizeSearch };
