import { db, animeTable, requestsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import type { Anime, InsertAnime } from "@workspace/db";

export type Episodes = Record<string, string>;

export async function findAnime(name: string): Promise<Anime | null> {
  const results = await db
    .select()
    .from(animeTable)
    .where(ilike(animeTable.nameLower, name.toLowerCase().trim()))
    .limit(1);
  return results[0] ?? null;
}

export async function findAnimeById(id: number): Promise<Anime | null> {
  const results = await db.select().from(animeTable).where(eq(animeTable.id, id)).limit(1);
  return results[0] ?? null;
}

export async function addAnime(data: {
  name: string;
  details: string;
  posterFileId: string;
  episodes: Episodes;
}): Promise<Anime> {
  const [anime] = await db
    .insert(animeTable)
    .values({
      name: data.name,
      nameLower: data.name.toLowerCase(),
      details: data.details,
      posterFileId: data.posterFileId,
      episodes: data.episodes,
    })
    .returning();
  return anime;
}

export async function updateAnimePoster(id: number, posterFileId: string): Promise<void> {
  await db.update(animeTable).set({ posterFileId }).where(eq(animeTable.id, id));
}

export async function updateAnimeDetails(id: number, details: string): Promise<void> {
  await db.update(animeTable).set({ details }).where(eq(animeTable.id, id));
}

export async function updateAnimeEpisodes(id: number, episodes: Episodes): Promise<void> {
  await db.update(animeTable).set({ episodes }).where(eq(animeTable.id, id));
}

export async function deleteAnime(id: number): Promise<void> {
  await db.delete(animeTable).where(eq(animeTable.id, id));
}

export async function saveRequest(animeName: string, userId: number, username?: string): Promise<void> {
  await db.insert(requestsTable).values({
    animeName,
    userId,
    username: username ?? null,
    requestedAt: new Date().toISOString(),
  });
}

export function sortedEpisodes(episodes: Episodes): [number, string][] {
  return Object.entries(episodes)
    .map(([k, v]) => [parseInt(k, 10), v] as [number, string])
    .sort((a, b) => a[0] - b[0]);
}
