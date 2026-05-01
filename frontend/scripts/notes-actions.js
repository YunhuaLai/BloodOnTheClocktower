import { clearPlayerDraft, createDefaultSetupDraft, ensureNotesState, getActiveGame, saveNotesState } from "./notes-state.js";
import { addTimelineEntry, exportActiveGame, getSelectedPlayerIdForGame, handleCreateGame, handleDeleteGame, openGameById, shiftGamePhase, updateGameField, updateInferenceField, updateSetupDraftField, updateStorytellerBluff, updateStorytellerField } from "./notes/notes-game-actions.js";
import { adjustPlayerDraftExternalReports, adjustPlayerDraftRoleInfoRows, cyclePlayerDraftRoleInfoField, cyclePlayerFieldValue, ensurePlayerDraftForId, persistPlayerDraft, savePlayerDraft, updatePlayerDraftExternalReport, updatePlayerDraftRoleInfo, updatePlayerField } from "./notes/notes-player-actions.js";
import { renderNotesPage } from "./notes/notes-shell.js";
import { assignRandomStorytellerRoles, clearStorytellerAssignments } from "./notes/notes-storyteller-actions.js";
import { state } from "./state.js";

// Event dispatchers for the notes feature. Helper actions live in frontend/scripts/notes/*.js.

export function handleNotesFieldChange(target, refreshInterface = false) {
  if (target.id === "gameSelect") {
    const notes = ensureNotesState();
    notes.activeGameId = target.value;
    notes.ui.creatingGame = false;
    const game = getActiveGame();
    notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(game);
    saveNotesState();
    renderNotesPage();
    return;
  }

  const setupField = target.closest("[data-setup-field]");
  if (setupField) {
    const shouldRerender = updateSetupDraftField(
      setupField.dataset.setupField,
      target.value,
    );
    if (shouldRerender) {
      renderNotesPage();
    }
    return;
  }

  const gameField = target.closest("[data-game-field]");
  if (gameField) {
    const shouldRerender = updateGameField(
      gameField.dataset.gameField,
      target.value,
    );
    if (shouldRerender || refreshInterface) {
      renderNotesPage();
    }
    return;
  }

  const inferenceField = target.closest("[data-inference-field]");
  if (inferenceField) {
    updateInferenceField(inferenceField.dataset.inferenceField, target.value);
    return;
  }

  const storytellerField = target.closest("[data-storyteller-field]");
  if (storytellerField) {
    updateStorytellerField(storytellerField.dataset.storytellerField, target.value);
    return;
  }

  const storytellerBluff = target.closest("[data-storyteller-bluff]");
  if (storytellerBluff) {
    updateStorytellerBluff(
      Number(storytellerBluff.dataset.storytellerBluff || 0),
      target.value,
    );
    return;
  }

  const playerField = target.closest("[data-player-id][data-field]");
  if (playerField) {
    const playerId = playerField.dataset.playerId;
    const shouldRerender = updatePlayerField(
      playerId,
      playerField.dataset.field,
      target.type === "checkbox" ? target.checked : target.value,
    );
    const shouldPersistInline = ["overview", "storyteller"].includes(
      state.notes.ui.activeTab,
    );
    if (shouldPersistInline) {
      persistPlayerDraft(playerId);
    }
    if (shouldRerender && refreshInterface) {
      renderNotesPage();
    }
    return;
  }

  const roleInfoField = target.closest(
    "[data-roleinfo-section][data-roleinfo-row][data-roleinfo-field]",
  );
  const playerCard = target.closest(".notes-player-detail, .notes-overview-editor");
  if (roleInfoField && playerCard) {
    const playerId = playerCard.dataset.playerId;
    updatePlayerDraftRoleInfo(
      playerId,
      roleInfoField.dataset.roleinfoSection,
      Number(roleInfoField.dataset.roleinfoRow),
      roleInfoField.dataset.roleinfoField,
      target.value,
    );
    if (state.notes.ui.activeTab === "overview") {
      persistPlayerDraft(playerId);
    }
    return;
  }

  const externalReportField = target.closest(
    "[data-external-report-row][data-external-report-field]",
  );
  if (externalReportField && playerCard) {
    const playerId = playerCard.dataset.playerId;
    updatePlayerDraftExternalReport(
      playerId,
      Number(externalReportField.dataset.externalReportRow),
      externalReportField.dataset.externalReportField,
      target.value,
    );
    if (state.notes.ui.activeTab === "overview") {
      persistPlayerDraft(playerId);
    }
  }
}

export function handleNotesAction(button) {
  const action = button.dataset.notesAction;
  const notes = ensureNotesState();
  const game = getActiveGame();

  if (action === "create-game") {
    handleCreateGame();
    return;
  }

  if (action === "new-game") {
    notes.ui.creatingGame = true;
    notes.ui.screen = "setup";
    notes.ui.setupDraft = createDefaultSetupDraft();
    renderNotesPage();
    return;
  }

  if (action === "cancel-create" || action === "go-home") {
    notes.ui.creatingGame = false;
    notes.ui.screen = "home";
    renderNotesPage();
    return;
  }

  if (action === "open-current-game" || action === "open-game") {
    openGameById(button.dataset.gameId || notes.activeGameId);
    return;
  }

  if (action === "view-saved") {
    document.querySelector("#notesSavedSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return;
  }

  if (!game && action !== "open-current-game") {
    return;
  }

  if (action === "delete-game") {
    handleDeleteGame(notes, game);
    return;
  }

  if (action === "export-game") {
    exportActiveGame();
    return;
  }

  if (action === "random-assign-roles") {
    assignRandomStorytellerRoles();
    return;
  }

  if (action === "clear-assignments") {
    clearStorytellerAssignments();
    return;
  }

  if (action === "save-game") {
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "switch-tab") {
    notes.ui.activeTab = button.dataset.tab || "overview";
    notes.ui.scriptSheetOpen = false;
    renderNotesPage();
    return;
  }

  if (action === "select-story-player") {
    notes.ui.selectedPlayerId = button.dataset.playerId || "";
    renderNotesPage();
    return;
  }

  if (action === "open-player" || action === "select-player") {
    notes.ui.selectedPlayerId = button.dataset.playerId || "";
    notes.ui.activeTab = "players";
    renderNotesPage();
    return;
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
    return;
  }

  if (action === "toggle-overview-extra") {
    const playerId = button.dataset.playerId || "";
    notes.ui.selectedPlayerId = playerId;
    notes.ui.overviewExpandedPlayerId = playerId;
    notes.ui.overviewExpandedExtraPlayerId =
      notes.ui.overviewExpandedExtraPlayerId === playerId ? "" : playerId;
    renderNotesPage();
    return;
  }

  if (action === "toggle-script-sheet") {
    notes.ui.scriptSheetOpen = !notes.ui.scriptSheetOpen;
    renderNotesPage();
    return;
  }

  if (action === "close-script-sheet") {
    notes.ui.scriptSheetOpen = false;
    renderNotesPage();
    return;
  }

  if (action === "cycle-player-field") {
    cyclePlayerFieldValue(button.dataset.playerId, button.dataset.field);
    if (["overview", "storyteller"].includes(state.notes.ui.activeTab)) {
      persistPlayerDraft(button.dataset.playerId);
    }
    renderNotesPage();
    return;
  }

  if (action === "cycle-roleinfo-field") {
    const playerId =
      button.dataset.playerId ||
      button.closest(".notes-player-detail, .notes-overview-editor")?.dataset.playerId ||
      "";
    cyclePlayerDraftRoleInfoField(
      playerId,
      button.dataset.section || "result",
      Number(button.dataset.row || 0),
      button.dataset.field || "",
    );
    if (state.notes.ui.activeTab === "overview" && playerId) {
      persistPlayerDraft(playerId);
    }
    renderNotesPage();
    return;
  }

  if (action === "toggle-tag") {
    const draft = ensurePlayerDraftForId(button.dataset.playerId);
    if (!draft) {
      return;
    }

    const tag = button.dataset.tag;
    draft.tags = draft.tags.includes(tag)
      ? draft.tags.filter((item) => item !== tag)
      : [...draft.tags, tag];
    renderNotesPage();
    return;
  }

  if (action === "add-roleinfo-row" || action === "remove-roleinfo-row") {
    adjustPlayerDraftRoleInfoRows(
      button.dataset.playerId,
      button.dataset.section || "target",
      action === "add-roleinfo-row" ? 1 : -1,
    );
    if (state.notes.ui.activeTab === "overview") {
      persistPlayerDraft(button.dataset.playerId);
    }
    renderNotesPage();
    return;
  }

  if (action === "add-external-report" || action === "remove-external-report") {
    const playerId = button.dataset.playerId || "";
    adjustPlayerDraftExternalReports(
      playerId,
      action === "add-external-report" ? 1 : -1,
    );
    if (state.notes.ui.activeTab === "overview" && playerId) {
      persistPlayerDraft(playerId);
    }
    renderNotesPage();
    return;
  }

  if (action === "save-player") {
    savePlayerDraft(button.dataset.playerId);
    notes.ui.activeTab = "overview";
    renderNotesPage();
    return;
  }

  if (action === "discard-player") {
    clearPlayerDraft(button.dataset.playerId);
    renderNotesPage();
    return;
  }

  if (action === "add-timeline") {
    addTimelineEntry();
    return;
  }

  if (action === "delete-timeline") {
    game.timeline = game.timeline.filter(
      (entry) => entry.id !== button.dataset.entryId,
    );
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "advance-phase") {
    shiftGamePhase(game, Number(button.dataset.step) || 1);
    saveNotesState();
    renderNotesPage();
  }
}
