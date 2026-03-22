import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plansTable } from "./plans";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  udid: text("udid"),
  phone: text("phone"),
  deviceType: text("device_type"),
  subscriberName: text("subscriber_name"),
  groupName: text("group_name"),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  applePlatform: text("apple_platform").default("IOS"),
  appleStatus: text("apple_status").default("PROCESSING"),
  isActive: text("is_active").notNull().default("true"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
