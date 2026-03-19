import TelegramBot from "node-telegram-bot-api";
import { sortedEpisodes } from "./db.js";
import type { Episodes } from "./db.js";

export const PAGE_SIZE = 10;

export function episodeKeyboard(
  animeId: number,
  episodes: Episodes,
  page = 0
): TelegramBot.InlineKeyboardMarkup {
  const sorted = sortedEpisodes(episodes);
  const total = sorted.length;
  const start = page * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  const buttons: TelegramBot.InlineKeyboardButton[][] = pageItems.map(([num, link]) => [
    { text: `🎬 EPISODE ${num}`, url: link },
  ]);

  const nav: TelegramBot.InlineKeyboardButton[] = [];
  if (page > 0) {
    nav.push({ text: "⬅️ Previous", callback_data: `anime_page_${animeId}_${page - 1}` });
  }
  if (start + PAGE_SIZE < total) {
    nav.push({ text: "Next ➡️", callback_data: `anime_page_${animeId}_${page + 1}` });
  }
  if (nav.length > 0) {
    buttons.push(nav);
  }

  return { inline_keyboard: buttons };
}

export function editMenuKeyboard(animeId: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "1. Update Poster", callback_data: `edit:poster:${animeId}` }],
      [{ text: "2. Update Details", callback_data: `edit:details:${animeId}` }],
      [{ text: "3. Add Episode", callback_data: `edit:addep:${animeId}` }],
      [{ text: "4. Remove Episode", callback_data: `edit:removep:${animeId}` }],
      [{ text: "5. Replace Episode Link", callback_data: `edit:replacep:${animeId}` }],
      [{ text: "6. Delete Anime", callback_data: `edit:delete:${animeId}` }],
    ],
  };
}
