import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { appsTable } from "./apps";
import { plansTable } from "./plans";

export const appPlansTable = pgTable("app_plans", {
  appId: integer("app_id").notNull().references(() => appsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.appId, t.planId] })]);

export type AppPlan = typeof appPlansTable.$inferSelect;
