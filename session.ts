export type AdminState =
  | { step: "idle" }
  | { step: "awaiting_photo" }
  | { step: "editing_choice"; animeId: number; animeName: string }
  | { step: "edit_poster"; animeId: number }
  | { step: "edit_details"; animeId: number }
  | { step: "edit_add_episode"; animeId: number }
  | { step: "edit_remove_episode"; animeId: number }
  | { step: "edit_replace_episode"; animeId: number }
  | { step: "edit_confirm_delete"; animeId: number; animeName: string };

const sessions = new Map<number, AdminState>();

export function getState(userId: number): AdminState {
  return sessions.get(userId) ?? { step: "idle" };
}

export function setState(userId: number, state: AdminState): void {
  sessions.set(userId, state);
}

export function clearState(userId: number): void {
  sessions.set(userId, { step: "idle" });
}
