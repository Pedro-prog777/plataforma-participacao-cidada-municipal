import path from "node:path";
import { getDb, getDbKind, type Db, type DbKind } from "./client";

export async function runMigrations(db: Db = getDb(), kind: DbKind = getDbKind()) {
  const migrationsFolder = path.resolve(process.cwd(), "database", "migrations");
  if (kind === "pg") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder });
  }
}
