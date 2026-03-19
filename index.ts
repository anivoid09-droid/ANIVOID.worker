import TelegramBot from "node-telegram-bot-api";
import {
  findAnime,
  findAnimeById,
  addAnime,
  updateAnimePoster,
  updateAnimeDetails,
  updateAnimeEpisodes,
  deleteAnime,
  saveRequest,
  sortedEpisodes,
  type Episodes,
} from "./db.js";
import { getState, setState, clearState } from "./session.js";
import { episodeKeyboard, editMenuKeyboard } from "./keyboards.js";

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS_RAW = process.env.ADMIN_IDS ?? "";

if (!TOKEN) {
  throw new Error("TELEGRAM_TOKEN is required");
}

const ADMIN_IDS = new Set(
  ADMIN_IDS_RAW.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
);

function isAdmin(userId: number): boolean {
  return ADMIN_IDS.has(userId);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log("ANIVOID WORKER online.");

function parseCaption(caption: string): {
  name: string;
  details: string;
  episodes: Episodes;
} | null {
  const nameMatch = caption.match(/Anime\s*Name\s*:\s*(.+)/i);
  const detailsMatch = caption.match(/Details\s*:\s*(.+?)(?=\n\d+\s*:|$)/is);

  if (!nameMatch || !detailsMatch) return null;

  const name = nameMatch[1].trim();
  const details = detailsMatch[1].trim();

  const episodes: Episodes = {};
  const epRegex = /^(\d+)\s*:\s*(https?:\/\/\S+)/gm;
  let match;
  while ((match = epRegex.exec(caption)) !== null) {
    episodes[match[1]] = match[2].trim();
  }

  return { name, details, episodes };
}

function greetings(text: string): boolean {
  return /^(hi|hello|hey|sup|yo|hiya|good\s*(morning|afternoon|evening|night)|assalamu|salaam|salam)/i.test(
    text.trim()
  );
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "ANIVOID WORKER online. Tell me which anime you need.");
});

bot.onText(/\/addanime/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId || !isAdmin(userId)) {
    await bot.sendMessage(chatId, "Access denied. Admin only command.");
    return;
  }

  setState(userId, { step: "awaiting_photo" });

  await bot.sendMessage(
    chatId,
    `Send anime prototype in this format:

Step 1: Send Poster Image.
Step 2: In caption write:

Anime Name: 
Details:
1: episode_link
2: episode_link
3: episode_link

Example:

Anime Name: Jujutsu Kaisen
Details: Dark fantasy anime about cursed energy and sorcerers.

1: https://examplelink1
2: https://examplelink2
3: https://examplelink3`
  );
});

bot.onText(/\/edit(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId || !isAdmin(userId)) {
    await bot.sendMessage(chatId, "Access denied. Admin only command.");
    return;
  }

  const animeName = match?.[1]?.trim();
  if (!animeName) {
    await bot.sendMessage(chatId, "Usage: /edit Anime Name");
    return;
  }

  const anime = await findAnime(animeName);
  if (!anime) {
    await bot.sendMessage(chatId, "Anime not found in database.");
    return;
  }

  setState(userId, { step: "editing_choice", animeId: anime.id, animeName: anime.name });
  await bot.sendMessage(
    chatId,
    `Editing: ${anime.name}\n\nChoose what to update:`,
    { reply_markup: editMenuKeyboard(anime.id) }
  );
});

bot.onText(/\/roa(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const animeName = match?.[1]?.trim();

  if (!animeName) {
    await bot.sendMessage(chatId, "Usage: /roa Anime Name");
    return;
  }

  if (userId) {
    await saveRequest(animeName, userId, msg.from?.username);
  }

  await bot.sendMessage(
    chatId,
    `Your request for '${animeName}' has been received.\nANIVOID team will review it soon.`
  );

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.sendMessage(
        adminId,
        `📥 New Request\n\nAnime: ${animeName}\nFrom: @${msg.from?.username ?? "unknown"} (ID: ${userId})`
      );
    } catch {
    }
  }
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  const state = getState(userId);

  if (state.step === "awaiting_photo") {
    const caption = msg.caption ?? "";
    const parsed = parseCaption(caption);

    if (!parsed || !parsed.name || !parsed.details) {
      await bot.sendMessage(
        chatId,
        "Invalid format. Please resend using the correct format:\n\nAnime Name:\nDetails:\n1: link\n2: link"
      );
      return;
    }

    const fileId = msg.photo![msg.photo!.length - 1].file_id;

    try {
      await addAnime({
        name: parsed.name,
        details: parsed.details,
        posterFileId: fileId,
        episodes: parsed.episodes,
      });

      clearState(userId);
      await bot.sendMessage(chatId, `${parsed.name} successfully added to ANIVOID database.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("unique")) {
        await bot.sendMessage(chatId, `An anime named "${parsed.name}" already exists. Use /edit to update it.`);
      } else {
        await bot.sendMessage(chatId, `Failed to save. Error: ${message}`);
      }
    }
    return;
  }

  if (state.step === "edit_poster") {
    const fileId = msg.photo![msg.photo!.length - 1].file_id;
    await updateAnimePoster(state.animeId, fileId);
    clearState(userId);
    await bot.sendMessage(chatId, "Update successful.");
    return;
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const userId = query.from.id;
  const data = query.data ?? "";

  if (!chatId) return;

  await bot.answerCallbackQuery(query.id);

  if (data.startsWith("anime_page_")) {
    const parts = data.split("_");
    const animeId = parseInt(parts[2], 10);
    const page = parseInt(parts[3], 10);

    if (isNaN(animeId) || isNaN(page)) return;

    const anime = await findAnimeById(animeId);
    if (!anime) return;

    await bot.editMessageReplyMarkup(
      episodeKeyboard(animeId, anime.episodes as Episodes, page),
      { chat_id: chatId, message_id: messageId }
    );
    return;
  }

  if (data.startsWith("edit:") && isAdmin(userId)) {
    const parts = data.split(":");
    const action = parts[1];
    const animeId = parseInt(parts[2], 10);

    const anime = await findAnimeById(animeId);
    if (!anime) {
      await bot.sendMessage(chatId, "Anime not found.");
      return;
    }

    switch (action) {
      case "poster":
        setState(userId, { step: "edit_poster", animeId });
        await bot.sendMessage(chatId, "Send the new poster image.");
        break;

      case "details":
        setState(userId, { step: "edit_details", animeId });
        await bot.sendMessage(chatId, "Send the new details text.");
        break;

      case "addep":
        setState(userId, { step: "edit_add_episode", animeId });
        await bot.sendMessage(chatId, "Send in format:\nEpisodeNumber: link");
        break;

      case "removep":
        setState(userId, { step: "edit_remove_episode", animeId });
        await bot.sendMessage(chatId, "Send the episode number to remove.");
        break;

      case "replacep":
        setState(userId, { step: "edit_replace_episode", animeId });
        await bot.sendMessage(chatId, "Send in format:\nEpisodeNumber: new_link");
        break;

      case "delete":
        setState(userId, { step: "edit_confirm_delete", animeId, animeName: anime.name });
        await bot.sendMessage(chatId, `Type CONFIRM to delete "${anime.name}" permanently.`);
        break;
    }
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text?.trim() ?? "";

  if (!userId) return;
  if (msg.photo) return;
  if (!text || text.startsWith("/")) return;

  const state = getState(userId);

  if (isAdmin(userId) && state.step !== "idle" && state.step !== "awaiting_photo") {
    switch (state.step) {
      case "edit_details": {
        await updateAnimeDetails(state.animeId, text);
        clearState(userId);
        await bot.sendMessage(chatId, "Update successful.");
        return;
      }

      case "edit_add_episode": {
        const m = text.match(/^(\d+)\s*:\s*(https?:\/\/\S+)/);
        if (!m) {
          await bot.sendMessage(chatId, "Invalid format. Use:\nEpisodeNumber: link");
          return;
        }
        const anime = await findAnimeById(state.animeId);
        if (!anime) return;
        const episodes = { ...(anime.episodes as Episodes), [m[1]]: m[2] };
        await updateAnimeEpisodes(state.animeId, episodes);
        clearState(userId);
        await bot.sendMessage(chatId, "Update successful.");
        return;
      }

      case "edit_remove_episode": {
        const num = text.match(/^\d+/)?.[0];
        if (!num) {
          await bot.sendMessage(chatId, "Please send a valid episode number.");
          return;
        }
        const anime = await findAnimeById(state.animeId);
        if (!anime) return;
        const episodes = { ...(anime.episodes as Episodes) };
        delete episodes[num];
        await updateAnimeEpisodes(state.animeId, episodes);
        clearState(userId);
        await bot.sendMessage(chatId, "Update successful.");
        return;
      }

      case "edit_replace_episode": {
        const m = text.match(/^(\d+)\s*:\s*(https?:\/\/\S+)/);
        if (!m) {
          await bot.sendMessage(chatId, "Invalid format. Use:\nEpisodeNumber: new_link");
          return;
        }
        const anime = await findAnimeById(state.animeId);
        if (!anime) return;
        const episodes = { ...(anime.episodes as Episodes), [m[1]]: m[2] };
        await updateAnimeEpisodes(state.animeId, episodes);
        clearState(userId);
        await bot.sendMessage(chatId, "Update successful.");
        return;
      }

      case "edit_confirm_delete": {
        if (text === "CONFIRM") {
          const name = state.animeName;
          await deleteAnime(state.animeId);
          clearState(userId);
          await bot.sendMessage(chatId, `"${name}" has been removed from ANIVOID database.`);
        } else {
          await bot.sendMessage(chatId, "Deletion cancelled.");
          clearState(userId);
        }
        return;
      }
    }
  }

  if (greetings(text)) {
    await bot.sendMessage(chatId, "ANIVOID WORKER online. Tell me which anime you need.");
    return;
  }

  const anime = await findAnime(text);
  if (!anime) {
    await bot.sendMessage(
      chatId,
      `This anime is not available right now.\nYou can request it using:\n/roa ${text}`
    );
    return;
  }

  const episodes = anime.episodes as Episodes;
  const sorted = sortedEpisodes(episodes);

  const caption = `*${anime.name}*\n${anime.details}\n\nSelect Episode:`;

  if (sorted.length === 0) {
    await bot.sendPhoto(chatId, anime.posterFileId, {
      caption,
      parse_mode: "Markdown",
    });
    return;
  }

  await bot.sendPhoto(chatId, anime.posterFileId, {
    caption,
    parse_mode: "Markdown",
    reply_markup: episodeKeyboard(anime.id, episodes, 0),
  });
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});
