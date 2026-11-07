import { SYSTEM_ROLES } from "@/server/db/seed-reference";

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, r.name]));
