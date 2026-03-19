import { pgTable, text, serial, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const requestsTable = pgTable("anime_requests", {
  id: serial("id").primaryKey(),
  animeName: text("anime_name").notNull(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  username: text("username"),
  requestedAt: text("requested_at").notNull().default("now()"),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type AnimeRequest = typeof requestsTable.$inferSelect;
