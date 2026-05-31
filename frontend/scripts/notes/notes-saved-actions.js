import {
  clearSavedGameSelection,
  deleteSavedGames,
  openGameById,
  selectAllSavedGames,
  toggleGameFavorite,
  toggleSavedGameSelection,
} from "./notes-game-actions.js";

export function handleSavedGameAction(action, button, notes) {
  if (action === "open-current-game" || action === "open-game") {
    openGameById(button.dataset.gameId || notes.activeGameId);
    return true;
  }

  if (action === "view-saved") {
    document.querySelector("#notesSavedSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return true;
  }

  if (action === "toggle-game-favorite") {
    toggleGameFavorite(notes, button.dataset.gameId || "");
    return true;
  }

  if (action === "toggle-saved-selection") {
    toggleSavedGameSelection(
      notes,
      button.dataset.gameId || "",
      Boolean(button.checked),
    );
    return true;
  }

  if (action === "select-all-saved-games") {
    selectAllSavedGames(notes);
    return true;
  }

  if (action === "clear-saved-selection") {
    clearSavedGameSelection(notes);
    return true;
  }

  if (action === "delete-saved-game") {
    deleteSavedGames(notes, [button.dataset.gameId || ""], "删除这个对局记录？这只会清除本机保存。");
    return true;
  }

  if (action === "delete-selected-games") {
    deleteSavedGames(notes, notes.ui.selectedSavedGameIds || []);
    return true;
  }

  return false;
}
