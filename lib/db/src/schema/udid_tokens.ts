import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const udidTokensTable = pgTable("udid_tokens", {
  token: text("token").primaryKey(),
  udid: text("udid").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
