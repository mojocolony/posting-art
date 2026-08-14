import { text, sqliteTable } from "drizzle-orm/sqlite-core";

export const postingRecords = sqliteTable("posting_records", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  format: text("format").notNull(),
  createdAt: text("created_at").notNull(),
  thumbnailKey: text("thumbnail_key").notNull(),
  instagramAt: text("instagram_at"),
  facebookAt: text("facebook_at"),
});
