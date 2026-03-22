import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { plansTable } from "./plans";

export const enrollmentRequestsTable = pgTable("enrollment_requests", {
  id: serial("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  udid: text("udid").notNull(),
  deviceName: text("device_name"),
  deviceType: text("device_type"),
  planId: integer("plan_id").references(() => plansTable.id),
  notes: text("notes"),
  // pending | approved | rejected
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EnrollmentRequest = typeof enrollmentRequestsTable.$inferSelect;
