import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signJobsTable = pgTable("sign_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  subscriberCode: text("subscriber_code").notNull(),
  status: text("status").notNull().default("pending"), // pending|processing|done|error
  sourceType: text("source_type").notNull().default("url"), // url|upload
  sourceUrl: text("source_url"),
  originalName: text("original_name"),
  originalBundleId: text("original_bundle_id"),
  originalVersion: text("original_version"),
  fileSize: integer("file_size").default(0),
  customName: text("custom_name"),
  customBundleId: text("custom_bundle_id"),
  signedToken: text("signed_token"),
  signedExpiresAt: timestamp("signed_expires_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignJobSchema = createInsertSchema(signJobsTable).omit({ id: true, createdAt: true });
export type InsertSignJob = z.infer<typeof insertSignJobSchema>;
export type SignJob = typeof signJobsTable.$inferSelect;
