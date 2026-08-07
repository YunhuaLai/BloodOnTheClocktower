import { saveNotesState } from "../notes-state.js";
import {
  addTravellerToGame,
  exportActiveGame,
  handleDeleteGame,
  removeTravellerFromGame,
} from "./notes-game-actions.js";
import { renderNotesPage } from "./notes-shell.js";

export function handleRoomAction(action, button, notes, game) {
  if (action === "delete-game") {
    handleDeleteGame(notes, game);
    return true;
  }

  if (action === "export-game") {
    exportActiveGame();
    return true;
  }

  if (action === "add-traveller") {
    if (addTravellerToGame(document.querySelector("#travellerRoleInput")?.value || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "remove-traveller") {
    if (removeTravellerFromGame(button.dataset.playerId || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "save-game") {
    saveNotesState({ immediate: true, touch: false });
    renderNotesPage();
    return true;
  }

  if (action === "switch-tab") {
    notes.ui.activeTab = button.dataset.tab || "overview";
    notes.ui.scriptSheetOpen = false;
    renderNotesPage();
    return true;
  }

  if (action === "toggle-script-sheet") {
    notes.ui.scriptSheetOpen = !notes.ui.scriptSheetOpen;
    renderNotesPage();
    return true;
  }

  if (action === "close-script-sheet") {
    notes.ui.scriptSheetOpen = false;
    renderNotesPage();
    return true;
  }

  return false;
}
