import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const appsTable = pgTable("apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  icon: text("icon").notNull(),
  ipaPath: text("ipa_path"),
  iconPath: text("icon_path"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  tag: text("tag").notNull(),
  version: text("version"),
  bundleId: text("bundle_id"),
  size: text("size"),
  downloadUrl: text("download_url"),
  downloads: integer("downloads").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isHot: boolean("is_hot").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  isTestMode: boolean("is_test_mode").notNull().default(false),
  skipDylib: boolean("skip_dylib").notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppSchema = createInsertSchema(appsTable).omit({ id: true, createdAt: true });
export type InsertApp = z.infer<typeof insertAppSchema>;
export type App = typeof appsTable.$inferSelect;
