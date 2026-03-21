import { pgTable, text, serial, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("IQD"),
  duration: text("duration").notNull(),
  features: text("features").array().notNull(),
  excludedFeatures: text("excluded_features").array(),
  isPopular: boolean("is_popular").notNull().default(false),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
