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
  getPlayerDraftRoleInfoEntry,
  moveOnceRoleInfoPhase,
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
import { applyAcquiredSuggestion, handleAcquiredAction, handleAcquiredFieldChange } from "./notes/notes-acquired-actions.js";
import { decodeTruthFill, encodeTruthBasis } from "./notes/notes-storyteller-truth-render.js";
import { getSteppedNumberValue, parsePhaseChoiceValue } from "./notes/notes-role-info-fields.js";
import { setOpenSeatPickerKey } from "./notes/notes-role-info-seat-picker.js";

export async function handleNotesImportFile(target) {
  const file = target?.files?.[0];
  if (!file) {
    return;
  }

  await importNotesBackupFile(file);
  target.value = "";
}

export function handleNotesFieldChange(target, refreshInterface = false) {
  if (handleAcquiredFieldChange(target, refreshInterface)) return;
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

  const phasePicker = target.closest("[data-roleinfo-phase-picker]");
  const pickerCard = target.closest(".notes-player-detail, .notes-overview-editor");
  if (phasePicker && pickerCard) {
    const playerId = pickerCard.dataset.playerId;
    const changed = moveOnceRoleInfoPhase(
      playerId,
      readRoleInfoPhase(phasePicker.dataset, "roleinfoPhase"),
      parsePhaseChoiceValue(target.value),
    );
    if (changed && ["overview", "storyteller"].includes(state.notes.ui.activeTab)) {
      persistPlayerDraft(playerId);
    }
    if (refreshInterface) {
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
      readRoleInfoPhase(roleInfoField.dataset, "roleinfoPhase"),
    );
    if (["overview", "storyteller"].includes(state.notes.ui.activeTab)) {
      persistPlayerDraft(playerId);
    }
    if (refreshInterface) {
      renderNotesPage();
    }
  }
}

function readRoleInfoPhase(dataset, prefix) {
  const phaseType = dataset[`${prefix}Type`];
  const phaseNumber = dataset[`${prefix}Number`];
  if (phaseType === undefined && phaseNumber === undefined) {
    return null;
  }

  return { phaseType: phaseType || "", phaseNumber: Number(phaseNumber) || 0 };
}

// Storyteller "应给" chip: writes the suggested result values of one row (only on tap, never automatically).
function applyRoleInfoSuggestion(button) {
  const fill = decodeTruthFill(button.dataset.truthFill);
  if (!Object.keys(fill).length) {
    return;
  }

  if (button.closest(".notes-acquired-panel")) {
    applyAcquiredSuggestion(button, fill, encodeTruthBasis);
    return;
  }

  const playerId = button.closest(".story-night-detail")?.dataset.playerId;
  if (!playerId) {
    return;
  }

  const phase = readRoleInfoPhase(button.dataset, "roleinfoPhase");
  const index = Number(button.dataset.roleinfoRow) || 0;
  const target = getPlayerDraftRoleInfoEntry(playerId, "target", index, phase);
  if (encodeTruthBasis(target) !== (button.dataset.truthBasis || "")) {
    renderNotesPage(); // the target changed since the chip was drawn: show the fresh suggestion instead
    return;
  }
  Object.entries(fill).forEach(([key, value]) => {
    updatePlayerDraftRoleInfo(playerId, "result", index, key, value, phase);
  });
  persistPlayerDraft(playerId);
  renderNotesPage();
}

// Segment and stepper buttons write through the same path as the role-info inputs and selects,
// so the player panel, overview, storyteller night and acquired-ability forms all share it.
function handleRoleInfoButtonAction(action, button) {
  if (action === "set-roleinfo-field") {
    handleNotesFieldChange(button, true);
    return true;
  }

  // Seat picker: open / close, then pick (writes like a segment button and opens the next seat field).
  if (action === "toggle-seat-picker") {
    setOpenSeatPickerKey(button.dataset.seatPickerKey || "");
    renderNotesPage();
    return true;
  }

  if (action === "pick-seat") {
    handleNotesFieldChange(button, false);
    setOpenSeatPickerKey(button.dataset.nextPickerKey || "");
    renderNotesPage();
    return true;
  }

  if (action === "apply-roleinfo-suggestion") {
    applyRoleInfoSuggestion(button);
    return true;
  }

  if (action === "step-roleinfo-field") {
    const input = button.closest(".notes-roleinfo-stepper")?.querySelector("input[data-roleinfo-field]");
    if (input) {
      input.value = getSteppedNumberValue(input.value, Number(button.dataset.step) || 0, {
        min: input.getAttribute("min"),
        max: input.getAttribute("max"),
      });
      handleNotesFieldChange(input, true);
    }
    return true;
  }

  return false;
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

  if (handleRoleInfoButtonAction(action, button)) return;

  // A picker left open would reappear when the same player is opened again.
  if (["switch-tab", "toggle-overview-player", "go-home"].includes(action)) {
    setOpenSeatPickerKey("");
  }

  if (handleAcquiredAction(action, button)) return;

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
