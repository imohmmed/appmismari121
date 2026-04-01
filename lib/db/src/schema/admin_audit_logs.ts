import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id:            serial("id").primaryKey(),
  adminId:       integer("admin_id"),
  adminUsername: text("admin_username").notNull(),
  action:        text("action").notNull(),
  resource:      text("resource").notNull(),
  resourceId:    text("resource_id"),
  details:       text("details"),
  ipAddress:     text("ip_address"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAuditLog    = typeof adminAuditLogsTable.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogsTable.$inferInsert;
