import { saveNotesState } from "../notes-state.js";
import {
  addNominationRecord,
  addTimelineEntry,
  adjustSuspectedRoles,
  deleteNominationRecord,
  saveDayPublicRecord,
  shiftGamePhase,
} from "./notes-game-actions.js";
import { renderNotesPage } from "./notes-shell.js";

export function handleTimelineAction(action, button, game) {
  if (action === "add-suspected-role" || action === "remove-suspected-role") {
    adjustSuspectedRoles(action === "add-suspected-role" ? 1 : -1);
    renderNotesPage();
    return true;
  }

  if (action === "add-nomination") {
    addNominationRecord(Number(button.dataset.dayNumber || game.phaseNumber || 1));
    return true;
  }

  if (action === "delete-nomination") {
    deleteNominationRecord(
      Number(button.dataset.dayNumber || game.phaseNumber || 1),
      button.dataset.nominationId || "",
    );
    return true;
  }

  if (action === "save-day-public-record") {
    saveDayPublicRecord(Number(button.dataset.dayNumber || game.phaseNumber || 1));
    return true;
  }

  if (action === "add-timeline") {
    addTimelineEntry();
    return true;
  }

  if (action === "delete-timeline") {
    game.timeline = game.timeline.filter(
      (entry) => entry.id !== button.dataset.entryId,
    );
    saveNotesState();
    renderNotesPage();
    return true;
  }

  if (action === "advance-phase") {
    shiftGamePhase(game, Number(button.dataset.step) || 1);
    saveNotesState();
    renderNotesPage();
    return true;
  }

  return false;
}
