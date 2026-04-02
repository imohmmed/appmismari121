import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const dylibEventsTable = pgTable("dylib_events", {
  id:        serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  subType:   text("sub_type").notNull().default(""),
  ip:        text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  bundleId:  text("bundle_id").notNull().default(""),
  appVersion:text("app_version").notNull().default(""),
  extra:     text("extra").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DylibEvent = typeof dylibEventsTable.$inferSelect;
