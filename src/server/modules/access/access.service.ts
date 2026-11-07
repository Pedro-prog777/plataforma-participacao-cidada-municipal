/**
 * Controle de acesso por perfil, papel e permissão (RF009, RF047, RF061, RN20, RN21, RN22, RN36).
 * Toda operação protegida passa por aqui no servidor; a interface apenas esconde ações.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { consultationAssignments, roles, userRoles, users } from "../../db/schema";
import { ForbiddenError } from "../../lib/errors";
import { CONSULTATION_ROLES, type ConsultationRole, type Permission } from "@/lib/permissions";
import { audit } from "../audit/audit.service";

export type Actor = {
  id: string;
  kind: "cidadao" | "admin";
  name: string;
  permissions: Set<Permission>;
  roleNames: string[];
};

export async function loadActor(userId: string, db: DbOrTx = getDb()): Promise<Actor | null> {
  const [u] = await db.select({ id: users.id, kind: users.kind, fullName: users.fullName, socialName: users.socialName }).from(users).where(eq(users.id, userId));
  if (!u) return null;
  const rs =
    u.kind === "admin"
      ? await db.select({ name: roles.name, permissions: roles.permissions }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId))
      : [];
  const permissions = new Set<Permission>();
  rs.forEach((r) => r.permissions.forEach((p) => permissions.add(p as Permission)));
  return { id: u.id, kind: u.kind, name: u.socialName || u.fullName, permissions, roleNames: rs.map((r) => r.name) };
}

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  return !!actor && actor.kind === "admin" && actor.permissions.has(permission);
}

/** Lança ForbiddenError e audita a tentativa negada (RF009, RF057). */
export async function assertPermission(actor: Actor | null, permission: Permission, ctx: { objectType?: string; objectId?: string } = {}, db: DbOrTx = getDb()) {
  if (can(actor, permission)) return;
  await audit(db, {
    actorId: actor?.id ?? null,
    action: "acesso_negado",
    result: "negado",
    objectType: ctx.objectType ?? "permissao",
    objectId: ctx.objectId ?? permission,
    details: { permissao: permission },
  });
  throw new ForbiddenError();
}

export async function assertAdmin(actor: Actor | null, db: DbOrTx = getDb()) {
  if (actor?.kind === "admin") return;
  await audit(db, { actorId: actor?.id ?? null, action: "acesso_negado", result: "negado", objectType: "area", objectId: "administracao" });
  throw new ForbiddenError();
}

export async function consultationRolesOf(userId: string, consultationId: string, db: DbOrTx = getDb()): Promise<ConsultationRole[]> {
  const rows = await db
    .select({ role: consultationAssignments.role })
    .from(consultationAssignments)
    .where(and(eq(consultationAssignments.userId, userId), eq(consultationAssignments.consultationId, consultationId), eq(consultationAssignments.active, true)));
  return rows.map((r) => r.role as ConsultationRole);
}

/**
 * Exige a permissão global correspondente E a designação para o papel naquela consulta (RF061).
 * Ex.: aprovar exige a permissão "consultas.aprovar" e ser o aprovador designado.
 */
export async function assertConsultationRole(actor: Actor | null, consultationId: string, role: ConsultationRole, db: DbOrTx = getDb()) {
  const permission = CONSULTATION_ROLES[role].permission as Permission;
  const assigned = actor ? (await consultationRolesOf(actor.id, consultationId, db)).includes(role) : false;
  if (can(actor, permission) && assigned) return;
  await audit(db, {
    actorId: actor?.id ?? null,
    action: "acesso_negado",
    result: "negado",
    objectType: "consulta",
    objectId: consultationId,
    details: { papel: role },
  });
  throw new ForbiddenError(assigned ? "Seu perfil não tem a permissão exigida para este papel." : `Você não está designado(a) como "${CONSULTATION_ROLES[role].label}" nesta consulta.`);
}

export async function usersWithPermission(permission: Permission, db: DbOrTx = getDb()) {
  const rs = await db.select({ id: roles.id, permissions: roles.permissions }).from(roles);
  const roleIds = rs.filter((r) => r.permissions.includes(permission)).map((r) => r.id);
  if (!roleIds.length) return [];
  const rows = await db
    .selectDistinct({ id: users.id, name: users.fullName, email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(inArray(userRoles.roleId, roleIds), eq(users.status, "ativa"), eq(users.kind, "admin")));
  return rows;
}
