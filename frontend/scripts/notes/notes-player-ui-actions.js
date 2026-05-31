import { clearPlayerDraft } from "../notes-state.js";
import { state } from "../state.js";
import {
  adjustPlayerDraftRoleInfoRows,
  cyclePlayerDraftRoleInfoField,
  cyclePlayerFieldValue,
  ensurePlayerDraftForId,
  persistPlayerDraft,
  savePlayerDraft,
} from "./notes-player-actions.js";
import { renderNotesPage } from "./notes-shell.js";

function shouldPersistInline() {
  return ["overview", "storyteller"].includes(state.notes.ui.activeTab);
}

export function handlePlayerUiAction(action, button, notes) {
  if (action === "open-player" || action === "select-player") {
    notes.ui.selectedPlayerId = button.dataset.playerId || "";
    notes.ui.activeTab = "players";
    renderNotesPage();
    return true;
  }

  if (action === "toggle-overview-player") {
    const playerId = button.dataset.playerId || "";
    const wasExpanded = notes.ui.overviewExpandedPlayerId === playerId;
    notes.ui.selectedPlayerId = playerId;
    notes.ui.overviewExpandedPlayerId = wasExpanded ? "" : playerId;
    if (wasExpanded || notes.ui.overviewExpandedExtraPlayerId !== playerId) {
      notes.ui.overviewExpandedExtraPlayerId = "";
    }
    renderNotesPage();
    return true;
  }

  if (action === "toggle-overview-extra") {
    const playerId = button.dataset.playerId || "";
    notes.ui.selectedPlayerId = playerId;
    notes.ui.overviewExpandedPlayerId = playerId;
    notes.ui.overviewExpandedExtraPlayerId =
      notes.ui.overviewExpandedExtraPlayerId === playerId ? "" : playerId;
    renderNotesPage();
    return true;
  }

  if (action === "cycle-player-field") {
    cyclePlayerFieldValue(button.dataset.playerId, button.dataset.field);
    if (shouldPersistInline()) {
      persistPlayerDraft(button.dataset.playerId);
    }
    renderNotesPage();
    return true;
  }

  if (action === "cycle-roleinfo-field") {
    const playerId =
      button.dataset.playerId ||
      button.closest(".notes-player-detail, .notes-overview-editor, .story-night-detail")?.dataset.playerId ||
      "";
    cyclePlayerDraftRoleInfoField(
      playerId,
      button.dataset.section || "result",
      Number(button.dataset.row || 0),
      button.dataset.field || "",
    );
    if (shouldPersistInline() && playerId) {
      persistPlayerDraft(playerId);
    }
    renderNotesPage();
    return true;
  }

  if (action === "toggle-tag") {
    const draft = ensurePlayerDraftForId(button.dataset.playerId);
    if (!draft) {
      return true;
    }

    const tag = button.dataset.tag;
    draft.tags = draft.tags.includes(tag)
      ? draft.tags.filter((item) => item !== tag)
      : [...draft.tags, tag];
    renderNotesPage();
    return true;
  }

  if (action === "add-roleinfo-row" || action === "remove-roleinfo-row") {
    adjustPlayerDraftRoleInfoRows(
      button.dataset.playerId,
      button.dataset.section || "target",
      action === "add-roleinfo-row" ? 1 : -1,
    );
    if (shouldPersistInline()) {
      persistPlayerDraft(button.dataset.playerId);
    }
    renderNotesPage();
    return true;
  }

  if (action === "save-player") {
    savePlayerDraft(button.dataset.playerId);
    notes.ui.activeTab = "overview";
    renderNotesPage();
    return true;
  }

  if (action === "discard-player") {
    clearPlayerDraft(button.dataset.playerId);
    renderNotesPage();
    return true;
  }

  return false;
}
