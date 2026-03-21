import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featuredBannersTable = pgTable("featured_banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  image: text("image"),
  link: text("link"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFeaturedBannerSchema = createInsertSchema(featuredBannersTable).omit({ id: true, createdAt: true });
export type InsertFeaturedBanner = z.infer<typeof insertFeaturedBannerSchema>;
export type FeaturedBanner = typeof featuredBannersTable.$inferSelect;
