CREATE INDEX "audience_criteria_consultation_idx" ON "audience_criteria" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "audit_log_object_idx" ON "audit_log" USING btree ("object_id","action");--> statement-breakpoint
CREATE INDEX "citizen_proposals_author_idx" ON "citizen_proposals" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "incidents_consultation_idx" ON "incidents" USING btree ("consultation_id","status");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "outcome_entries_outcome_idx" ON "outcome_entries" USING btree ("outcome_id");--> statement-breakpoint
CREATE INDEX "outcomes_consultation_idx" ON "outcomes" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "participations_citizen_idx" ON "participations" USING btree ("citizen_id");