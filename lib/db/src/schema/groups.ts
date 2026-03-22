import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  certName: text("cert_name").notNull().unique(),
  issuerId: text("issuer_id").notNull(),
  keyId: text("key_id").notNull(),
  privateKey: text("private_key").notNull(),
  email: text("email").notNull().default(""),
  // ─── Local stats cache (Primary Reference) ─────────────────────────────
  // Updated instantly when a device is registered (+1) or removed (-1)
  // Synced against Apple API manually or via daily cron at 4 AM
  iphoneOfficialCount: integer("iphone_official_count").notNull().default(0),
  iphoneMacCount: integer("iphone_mac_count").notNull().default(0),
  ipadCount: integer("ipad_count").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncNote: text("last_sync_note").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Group = typeof groupsTable.$inferSelect;
export type InsertGroup = typeof groupsTable.$inferInsert;
