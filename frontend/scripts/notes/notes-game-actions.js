import { clampNumber, cloneSuspectedRoles, createDefaultSetupDraft, createDefaultStorytellerState, createGameFromSetup, ensureNotesState, getActiveGame, saveNotesState } from "../notes-state.js";
import { findCatalogRole } from "../notes-claims.js";
import { createNominationRecord, getDayRecord, normalizeSeatValue, syncAutoExecutionStatuses } from "./notes-day-records.js";
import { phaseTypeOptions, state } from "../state.js";
import { createId } from "../utils.js";
import { formatPhaseLabel } from "./notes-core.js";
import { renderNotesPage } from "./notes-shell.js";

export function getSelectedPlayerIdForGame(game) {
  return (
    game?.players.find((player) => player.seat === game.selfSeat)?.id ||
    game?.players[0]?.id ||
    ""
  );
}

export function updateSetupDraftField(field, value) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const nextDraft = { ...draft };

  if (field === "playerCount") {
    nextDraft.playerCount = clampNumber(Number(value) || draft.playerCount, 5, 15);
    nextDraft.selfSeat = clampNumber(nextDraft.selfSeat, 1, nextDraft.playerCount);
  } else if (field === "selfSeat") {
    nextDraft.selfSeat = clampNumber(
      Number(value) || draft.selfSeat,
      1,
      draft.playerCount,
    );
  } else if (field === "mode") {
    nextDraft.mode = value;
    if (value === "storyteller") {
      nextDraft.selfSeat = 1;
    }
  } else if (field === "scriptMode") {
    nextDraft.scriptMode = value === "custom" ? "custom" : "script";
    if (nextDraft.scriptMode === "custom") {
      nextDraft.scriptId = "";
    } else {
      nextDraft.customRoleQuery = "";
    }
  } else if (field === "customRoleQuery") {
    nextDraft.customRoleQuery = value;
  } else {
    nextDraft[field] = value;
  }

  state.notes.ui.setupDraft = nextDraft;
  return ["playerCount", "mode", "scriptMode"].includes(field);
}

export function addSetupCustomRole(value) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const role = findCatalogRole(value || draft.customRoleQuery);

  if (!role) {
    window.alert("没有找到这个已录入角色。");
    return false;
  }

  const customRoleIds = Array.isArray(draft.customRoleIds)
    ? draft.customRoleIds
    : [];
  if (customRoleIds.includes(role.id)) {
    state.notes.ui.setupDraft = {
      ...draft,
      customRoleQuery: "",
    };
    return true;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    scriptMode: "custom",
    customRoleIds: [...customRoleIds, role.id],
    customRoleQuery: "",
  };
  return true;
}

export function removeSetupCustomRole(roleId) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const roleIdText = String(roleId || "").trim();
  if (!roleIdText) {
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    customRoleIds: (Array.isArray(draft.customRoleIds) ? draft.customRoleIds : []).filter(
      (id) => id !== roleIdText,
    ),
  };
  return true;
}

export function updateGameField(field, value) {
  const game = getActiveGame();
  if (!game || !(field in game)) {
    return false;
  }

  if (field === "phaseType") {
    game.phaseType = phaseTypeOptions.some((option) => option.value === value)
      ? value
      : "day";
  } else if (field === "phaseNumber") {
    game.phaseNumber = clampNumber(Number(value) || 1, 1, 99);
  } else {
    game[field] = value;
  }

  saveNotesState();
  return ["title", "phaseType", "phaseNumber", "mode", "scriptName"].includes(field);
}

export function updateInferenceField(field, value) {
  const game = getActiveGame();
  if (!game || !(field in game.inference)) {
    return;
  }

  game.inference[field] = value;
  saveNotesState();
}

export function updateStorytellerField(field, value) {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  game.storyteller = {
    ...createDefaultStorytellerState(),
    ...(game.storyteller || {}),
  };

  if (field === "setupNotes" || field === "publicNotes") {
    game.storyteller[field] = value;
    saveNotesState();
  }
}

export function updateStorytellerBluff(index, value) {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  game.storyteller = {
    ...createDefaultStorytellerState(),
    ...(game.storyteller || {}),
  };
  const bluffs = Array.isArray(game.storyteller.bluffs)
    ? [...game.storyteller.bluffs]
    : [];
  while (bluffs.length <= index) {
    bluffs.push("");
  }
  bluffs[index] = value;
  game.storyteller.bluffs = bluffs.slice(0, 3);
  saveNotesState();
}

export function updateSuspectedRole(index, field, value) {
  const game = getActiveGame();
  if (!game || !["role", "note"].includes(field)) {
    return;
  }

  const safeIndex = Math.max(Number(index) || 0, 0);
  game.suspectedRoles = cloneSuspectedRoles(game.suspectedRoles);
  while (game.suspectedRoles.length <= safeIndex) {
    game.suspectedRoles.push({ role: "", note: "" });
  }

  game.suspectedRoles[safeIndex] = {
    ...game.suspectedRoles[safeIndex],
    [field]: value,
  };
  saveNotesState();
}

export function adjustSuspectedRoles(step) {
  const game = getActiveGame();
  if (!game || !step) {
    return;
  }

  game.suspectedRoles = cloneSuspectedRoles(game.suspectedRoles);
  if (step > 0) {
    game.suspectedRoles.push({ role: "", note: "" });
  } else if (game.suspectedRoles.length) {
    game.suspectedRoles.pop();
  }

  saveNotesState();
}

export function addTimelineEntry() {
  const game = getActiveGame();
  const typeInput = document.querySelector("#timelineType");
  const textInput = document.querySelector("#timelineText");
  const text = textInput?.value.trim() || "";

  if (!game || !text) {
    textInput?.focus();
    return;
  }

  game.timeline.unshift({
    id: createId("note"),
    type: typeInput?.value || "info",
    phase: formatPhaseLabel(game.phaseType, game.phaseNumber),
    text,
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
  renderNotesPage();
}

function findNomination(game, dayNumber, nominationId) {
  const record = getDayRecord(game, dayNumber);
  return (
    record?.nominations.find((nomination) => nomination.id === nominationId) ||
    null
  );
}

export function addNominationRecord(dayNumber) {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  const record = getDayRecord(game, dayNumber, true);
  record.nominations.push(createNominationRecord());
  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function deleteNominationRecord(dayNumber, nominationId) {
  const game = getActiveGame();
  const record = getDayRecord(game, dayNumber);
  if (!game || !record) {
    return;
  }

  record.nominations = record.nominations.filter(
    (nomination) => nomination.id !== nominationId,
  );
  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function updateNominationRecordField(dayNumber, nominationId, field, value) {
  const game = getActiveGame();
  const nomination = findNomination(game, dayNumber, nominationId);
  if (!game || !nomination) {
    return;
  }

  if (field === "nominatorSeat" || field === "nomineeSeat") {
    nomination[field] = normalizeSeatValue(value, game.playerCount);
  } else if (field === "note") {
    nomination.note = value;
  }

  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function updateNominationVoter(dayNumber, nominationId, seat, checked) {
  const game = getActiveGame();
  const nomination = findNomination(game, dayNumber, nominationId);
  const voterSeat = normalizeSeatValue(seat, game?.playerCount || 15);
  if (!game || !nomination || !voterSeat) {
    return;
  }

  const voters = new Set((nomination.voterSeats || []).map(String));
  if (checked) {
    voters.add(voterSeat);
  } else {
    voters.delete(voterSeat);
  }

  nomination.voterSeats = [...voters].sort((left, right) => Number(left) - Number(right));
  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function updateDayExecutionOverride(dayNumber, value) {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  const record = getDayRecord(game, dayNumber, true);
  record.executionOverride = value === "none"
    ? "none"
    : normalizeSeatValue(value, game.playerCount);
  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function saveDayPublicRecord(dayNumber) {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  const record = getDayRecord(game, dayNumber, true);
  record.publicRecordSavedAt = new Date().toISOString();
  syncAutoExecutionStatuses(game);
  saveNotesState();
  renderNotesPage();
}

export function exportActiveGame() {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  const safeTitle = (game.title || "botc-notes")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const blob = new Blob([JSON.stringify(game, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle || "botc-notes"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function shiftGamePhase(game, step) {
  if (!game || !step) {
    return;
  }

  const previousPhaseType = game.phaseType;
  let phaseType = game.phaseType;
  let phaseNumber = clampNumber(Number(game.phaseNumber) || 1, 1, 99);

  if (step > 0) {
    for (let index = 0; index < step; index += 1) {
      if (phaseType === "day") {
        phaseType = "night";
      } else {
        phaseType = "day";
        phaseNumber = clampNumber(phaseNumber + 1, 1, 99);
      }
    }
  } else {
    for (let index = 0; index < Math.abs(step); index += 1) {
      if (phaseType === "night") {
        phaseType = "day";
      } else {
        phaseType = "night";
        phaseNumber = clampNumber(phaseNumber - 1 || 1, 1, 99);
      }
    }
  }

  game.phaseType = phaseType;
  game.phaseNumber = phaseNumber;
  if (previousPhaseType === "night" && phaseType === "day") {
    game.players.forEach((player) => {
      player.newRoleFirstNight = false;
    });
  }
}

export function openGameById(gameId) {
  const notes = ensureNotesState();
  const nextGame =
    notes.games.find((item) => item.id === gameId) ||
    notes.games.find((item) => item.id === notes.activeGameId) ||
    notes.games[0] ||
    null;

  if (!nextGame) {
    notes.ui.screen = "home";
    renderNotesPage();
    return;
  }

  notes.activeGameId = nextGame.id;
  notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(nextGame);
  notes.ui.activeTab = "overview";
  notes.ui.creatingGame = false;
  notes.ui.screen = "game";
  saveNotesState();
  renderNotesPage();
}

export function toggleGameFavorite(notes, gameId) {
  const game = notes.games.find((item) => item.id === gameId);
  if (!game) {
    return;
  }

  game.favorite = !game.favorite;
  saveNotesState();
  renderNotesPage();
}

export function toggleSavedGameSelection(notes, gameId, checked) {
  const selected = new Set(notes.ui.selectedSavedGameIds || []);
  if (checked) {
    selected.add(gameId);
  } else {
    selected.delete(gameId);
  }

  notes.ui.selectedSavedGameIds = [...selected].filter((id) =>
    notes.games.some((game) => game.id === id),
  );
  renderNotesPage();
}

export function selectAllSavedGames(notes) {
  notes.ui.selectedSavedGameIds = notes.games.map((game) => game.id);
  renderNotesPage();
}

export function clearSavedGameSelection(notes) {
  notes.ui.selectedSavedGameIds = [];
  renderNotesPage();
}

export function deleteSavedGames(notes, gameIds, confirmMessage = "删除已选择的对局记录？这只会清除本机保存。") {
  const ids = new Set(gameIds.filter(Boolean));
  if (!ids.size || !window.confirm(confirmMessage)) {
    return;
  }

  notes.games = notes.games.filter((item) => !ids.has(item.id));
  notes.ui.selectedSavedGameIds = (notes.ui.selectedSavedGameIds || []).filter(
    (id) => !ids.has(id),
  );

  if (!notes.games.length) {
    notes.activeGameId = "";
    notes.ui.selectedPlayerId = "";
    notes.ui.screen = "home";
  } else if (!notes.games.some((item) => item.id === notes.activeGameId)) {
    notes.activeGameId = notes.games[0].id;
    notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(notes.games[0]);
    notes.ui.activeTab = "overview";
    notes.ui.screen = "home";
  } else {
    notes.ui.screen = "home";
  }

  saveNotesState();
  renderNotesPage();
}

export function handleCreateGame() {
  const form = document.querySelector("#notesSetupForm");
  if (!form || !form.reportValidity()) {
    return;
  }

  const formData = new FormData(form);
  const setup = {
    title: String(formData.get("title") || ""),
    scriptMode: String(formData.get("scriptMode") || "script"),
    scriptId: String(formData.get("scriptId") || ""),
    scriptName: String(formData.get("scriptName") || ""),
    playerCount: Number(formData.get("playerCount") || 10),
    mode: String(formData.get("mode") || "player"),
  };
  setup.customRoleIds =
    setup.scriptMode === "custom"
      ? [...(state.notes.ui.setupDraft?.customRoleIds || [])]
      : [];
  if (setup.scriptMode === "custom" && !setup.customRoleIds.length) {
    window.alert("先给自定义角色池添加至少一个角色。");
    return;
  }
  setup.selfSeat = setup.mode === "storyteller" ? 1 : Number(formData.get("selfSeat") || 1);
  const game = createGameFromSetup(setup, state.notes.games.length + 1);

  state.notes.games.unshift(game);
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = game.mode === "storyteller" ? "storyteller" : "overview";
  state.notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(game);
  state.notes.ui.creatingGame = false;
  state.notes.ui.screen = "game";
  state.notes.ui.setupDraft = createDefaultSetupDraft();
  saveNotesState();
  renderNotesPage();
}

export function handleDeleteGame(notes, game) {
  if (!window.confirm("删除当前局次记录？这只会清除本机保存。")) {
    return;
  }

  notes.games = notes.games.filter((item) => item.id !== game.id);
  if (!notes.games.length) {
    notes.activeGameId = "";
    notes.ui.selectedPlayerId = "";
    notes.ui.screen = "home";
  } else {
    notes.activeGameId = notes.games[0].id;
    notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(notes.games[0]);
    notes.ui.activeTab = "overview";
    notes.ui.screen = "home";
  }
  saveNotesState();
  renderNotesPage();
}
