import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { subscriptionsTable } from "./subscriptions";
import { adminsTable } from "./admins";

export const balanceTransactionsTable = pgTable("balance_transactions", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "credit" | "debit" | "purchase"
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  note: text("note"),
  adminId: integer("admin_id").references(() => adminsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
