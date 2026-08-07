import { createDefaultSetupDraft } from "../notes-state.js";
import {
  addSetupCustomRole,
  addSetupFabledRole,
  exportAllGames,
  handleCreateGame,
  removeSetupCustomRole,
  removeSetupFabledRole,
} from "./notes-game-actions.js";
import { renderNotesPage } from "./notes-shell.js";

export function handleSetupAction(action, button, notes) {
  if (action === "export-all-games") {
    exportAllGames();
    return true;
  }

  if (action === "import-games") {
    document.querySelector("[data-notes-import]")?.click();
    return true;
  }

  if (action === "create-game") {
    handleCreateGame();
    return true;
  }

  if (action === "add-custom-role") {
    if (addSetupCustomRole(document.querySelector("#customRoleInput")?.value || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "remove-custom-role") {
    if (removeSetupCustomRole(button.dataset.roleId || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "add-fabled-role") {
    if (addSetupFabledRole(document.querySelector("#fabledRoleInput")?.value || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "remove-fabled-role") {
    if (removeSetupFabledRole(button.dataset.roleId || "")) {
      renderNotesPage();
    }
    return true;
  }

  if (action === "new-game") {
    notes.ui.creatingGame = true;
    notes.ui.screen = "setup";
    notes.ui.setupDraft = createDefaultSetupDraft();
    renderNotesPage();
    return true;
  }

  if (action === "cancel-create" || action === "go-home") {
    notes.ui.creatingGame = false;
    notes.ui.screen = "home";
    renderNotesPage();
    return true;
  }

  return false;
}
