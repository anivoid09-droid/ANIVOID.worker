import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const animeTable = pgTable("anime", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  nameLower: text("name_lower").notNull().unique(),
  details: text("details").notNull(),
  posterFileId: text("poster_file_id").notNull(),
  episodes: jsonb("episodes").notNull().default({}),
});

export const insertAnimeSchema = createInsertSchema(animeTable).omit({ id: true });
export type InsertAnime = z.infer<typeof insertAnimeSchema>;
export type Anime = typeof animeTable.$inferSelect;
