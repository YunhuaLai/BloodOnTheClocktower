import {
  autoFillStorytellerRoleInfoResult,
  persistPlayerDraft,
  togglePlayerStoryMarker,
} from "./notes-player-actions.js";
import { renderNotesPage } from "./notes-shell.js";
import {
  assignRandomStorytellerRoles,
  clearStorytellerAssignments,
} from "./notes-storyteller-actions.js";
import { createDefaultStorytellerState, getActiveGame, saveNotesState } from "../notes-state.js";

export function handleStorytellerAction(action, button, notes) {
  if (action === "toggle-story-privacy") {
    const game = getActiveGame();
    if (game) {
      game.storyteller = {
        ...createDefaultStorytellerState(),
        ...(game.storyteller || {}),
        privacyShield: !game.storyteller?.privacyShield,
      };
      saveNotesState();
      renderNotesPage();
    }
    return true;
  }

  if (action === "random-assign-roles") {
    assignRandomStorytellerRoles();
    return true;
  }

  if (action === "clear-assignments") {
    clearStorytellerAssignments();
    return true;
  }

  if (action === "select-story-player") {
    notes.ui.selectedPlayerId = button.dataset.playerId || "";
    renderNotesPage();
    return true;
  }

  if (action === "toggle-story-marker") {
    const playerId = button.dataset.playerId || "";
    if (togglePlayerStoryMarker(playerId, button.dataset.marker || "")) {
      persistPlayerDraft(playerId);
    }
    renderNotesPage();
    return true;
  }

  if (action === "autofill-story-result") {
    const playerId = button.dataset.playerId || "";
    if (autoFillStorytellerRoleInfoResult(playerId)) {
      persistPlayerDraft(playerId);
    }
    renderNotesPage();
    return true;
  }

  return false;
}
