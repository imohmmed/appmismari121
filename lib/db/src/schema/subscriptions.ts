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
  applePlatform: text("apple_platform").default("IOS"),  // IOS | MAC | IPAD_OS (our internal)
  appleStatus: text("apple_status").default("PROCESSING"),
  // Apple's returned device ID after successful registration
  // Required for deletion: DELETE /v1/devices/{appleDeviceId}
  // Apple does NOT accept UDID for deletion — only their own ID
  appleDeviceId: text("apple_device_id"),
  email: text("email"),
  // "subscription_code" | "enrollment_request"
  sourceType: text("source_type").notNull().default("subscription_code"),
  isActive: text("is_active").notNull().default("true"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
