import { ensureNotesState, getActiveGame, saveNotesState } from "./notes-state.js";
import {
  getSelectedPlayerIdForGame,
  updateDayExecutionOverride,
  updateGameField,
  updateInferenceField,
  importNotesBackupFile,
  updateNominationRecordField,
  updateNominationVoter,
  updateSetupDraftField,
  updateStorytellerBluff,
  updateStorytellerField,
  updateSuspectedRole,
} from "./notes/notes-game-actions.js";
import {
  persistPlayerDraft,
  updatePlayerDraftRoleInfo,
  updatePlayerField,
} from "./notes/notes-player-actions.js";
import { handlePlayerUiAction } from "./notes/notes-player-ui-actions.js";
import { handleRoomAction } from "./notes/notes-room-actions.js";
import { handleSavedGameAction } from "./notes/notes-saved-actions.js";
import { handleSetupAction } from "./notes/notes-setup-actions.js";
import { renderNotesPage } from "./notes/notes-shell.js";
import { handleStorytellerAction } from "./notes/notes-storyteller-ui-actions.js";
import { handleTimelineAction } from "./notes/notes-timeline-actions.js";
import { state } from "./state.js";

export async function handleNotesImportFile(target) {
  const file = target?.files?.[0];
  if (!file) {
    return;
  }

  await importNotesBackupFile(file);
  target.value = "";
}

export function handleNotesFieldChange(target, refreshInterface = false) {
  if (target.id === "gameSelect") {
    const notes = ensureNotesState();
    notes.activeGameId = target.value;
    notes.ui.creatingGame = false;
    const game = getActiveGame();
    notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(game);
    saveNotesState({ touch: false });
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
    } else if (refreshInterface && setupField.dataset.setupField === "scriptName") {
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

  const executionOverride = target.closest("[data-day-execution-override]");
  if (executionOverride) {
    updateDayExecutionOverride(
      Number(executionOverride.dataset.dayExecutionOverride || 1),
      target.value,
    );
    return;
  }

  const nominationVoter = target.closest(
    "[data-day-number][data-nomination-id][data-voter-seat]",
  );
  if (nominationVoter && target.type === "checkbox") {
    if (!refreshInterface) {
      return;
    }

    updateNominationVoter(
      Number(nominationVoter.dataset.dayNumber || 1),
      nominationVoter.dataset.nominationId || "",
      nominationVoter.dataset.voterSeat || "",
      target.checked,
    );
    return;
  }

  const nominationField = target.closest(
    "[data-day-number][data-nomination-id][data-nomination-field]",
  );
  if (nominationField) {
    updateNominationRecordField(
      Number(nominationField.dataset.dayNumber || 1),
      nominationField.dataset.nominationId || "",
      nominationField.dataset.nominationField || "",
      target.value,
    );
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

  const suspectedRoleField = target.closest(
    "[data-suspected-role-row][data-suspected-role-field]",
  );
  if (suspectedRoleField) {
    updateSuspectedRole(
      Number(suspectedRoleField.dataset.suspectedRoleRow),
      suspectedRoleField.dataset.suspectedRoleField,
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
  const playerCard = target.closest(".notes-player-detail, .notes-overview-editor, .story-night-detail");
  if (roleInfoField && playerCard) {
    const playerId = playerCard.dataset.playerId;
    updatePlayerDraftRoleInfo(
      playerId,
      roleInfoField.dataset.roleinfoSection,
      Number(roleInfoField.dataset.roleinfoRow),
      roleInfoField.dataset.roleinfoField,
      target.value,
    );
    if (["overview", "storyteller"].includes(state.notes.ui.activeTab)) {
      persistPlayerDraft(playerId);
    }
  }
}

export function handleNotesAction(button) {
  const action = button.dataset.notesAction;
  const notes = ensureNotesState();
  const game = getActiveGame();

  if (handleSetupAction(action, button, notes)) {
    return;
  }

  if (handleSavedGameAction(action, button, notes)) {
    return;
  }

  if (!game) {
    return;
  }

  if (handleRoomAction(action, button, notes, game)) {
    return;
  }

  if (handleStorytellerAction(action, button, notes)) {
    return;
  }

  if (handlePlayerUiAction(action, button, notes)) {
    return;
  }

  handleTimelineAction(action, button, game);
}
