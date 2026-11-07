/** Dados agregados para as telas administrativas de uma consulta. */
import { asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "../../db/client";
import { alternatives, audienceCriteria, consultationEvents, consultations, municipalProposals, organs, reviewChecklists, themes, users } from "../../db/schema";
import { NotFoundError } from "../../lib/errors";
import { getAssignments } from "./lifecycle.service";
import { listVersions } from "./common";

export const getAdminConsultation = cache(async (id: string) => {
  const db = getDb();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundError();
  const [row] = await db
    .select({ c: consultations, theme: themes.name, organ: organs.name, proposal: municipalProposals.title, author: users.fullName })
    .from(consultations)
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .leftJoin(organs, eq(organs.id, consultations.organId))
    .leftJoin(municipalProposals, eq(municipalProposals.id, consultations.municipalProposalId))
    .leftJoin(users, eq(users.id, consultations.createdBy))
    .where(eq(consultations.id, id));
  if (!row) throw new NotFoundError();
  const [alts, criteria, assignments, reviews, events, versions] = await Promise.all([
    db.select().from(alternatives).where(eq(alternatives.consultationId, id)).orderBy(asc(alternatives.position)),
    db.select().from(audienceCriteria).where(eq(audienceCriteria.consultationId, id)),
    getAssignments(id),
    db.select({ r: reviewChecklists, reviewer: users.fullName }).from(reviewChecklists).leftJoin(users, eq(users.id, reviewChecklists.reviewerId)).where(eq(reviewChecklists.consultationId, id)).orderBy(desc(reviewChecklists.createdAt)),
    db.select().from(consultationEvents).where(eq(consultationEvents.consultationId, id)).orderBy(asc(consultationEvents.occurredAt)),
    listVersions(db, "consulta", id),
  ]);
  return { ...row, alternatives: alts, criteria, assignments, reviews, events, versions };
});
