import { clampNumber, cloneSuspectedRoles, createActiveGameBackup, createAllGamesBackup, createDefaultPlayer, createDefaultSetupDraft, createDefaultStorytellerState, createGameFromSetup, ensureNotesState, getActiveGame, importNotesBackup, saveNotesState } from "../notes-state.js";
import { filterRoleOptions, findCatalogRole, getAvailableTravellerOptions, getBaseRoleOptions, getGameScript, getSetupFabledRoleOptions, isFabledRole, isTravellerRole } from "../notes-claims.js";
import { createNominationRecord, getDayRecord, normalizeSeatValue, syncAutoExecutionStatuses } from "./notes-day-records.js";
import { phaseTypeOptions, state } from "../state.js";
import { createId } from "../utils.js";
import { formatPhaseLabel, getMaxSeatNumber, isTravellerPlayer } from "./notes-core.js";
import { getShiftedPhase } from "./notes-phase.js";
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
  } else if (field === "fabledRoleQuery") {
    nextDraft.fabledRoleQuery = value;
  } else {
    nextDraft[field] = value;
  }

  state.notes.ui.setupDraft = nextDraft;
  return ["playerCount", "mode", "scriptMode", "customRoleType"].includes(field);
}

export function addSetupCustomRole(value) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const role = findCatalogRole(value || draft.customRoleQuery, getBaseRoleOptions());

  if (!role) {
    window.alert("基础角色不存在。");
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

export function toggleSetupCustomRole(roleId) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const role = getBaseRoleOptions().find((item) => item.id === roleId);
  if (!role) {
    return false;
  }

  const selected = new Set(draft.customRoleIds || []);
  if (selected.has(role.id)) {
    selected.delete(role.id);
  } else {
    selected.add(role.id);
  }
  state.notes.ui.setupDraft = {
    ...draft,
    scriptMode: "custom",
    customRoleIds: [...selected],
  };
  return true;
}

export function addFilteredSetupCustomRoles() {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const matches = filterRoleOptions(
    getBaseRoleOptions(),
    draft.customRoleQuery,
    draft.customRoleType,
  ).slice(0, 60);
  if (!matches.length) {
    window.alert("当前筛选没有可添加的角色。");
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    scriptMode: "custom",
    customRoleIds: [
      ...new Set([...(draft.customRoleIds || []), ...matches.map((role) => role.id)]),
    ],
  };
  return true;
}

export function clearSetupCustomRoles() {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  if (!(draft.customRoleIds || []).length || !window.confirm("清空已选基础角色？")) {
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    customRoleIds: [],
  };
  return true;
}

export function copySetupRolesFromScript() {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const script = getGameScript({
    scriptMode: "script",
    scriptName: draft.sourceScriptName,
  });
  if (!script) {
    window.alert("没有找到要复制的剧本。");
    return false;
  }

  const baseRoleIds = new Set(getBaseRoleOptions().map((role) => role.id));
  const fabledRoleIds = new Set(
    getSetupFabledRoleOptions({ scriptMode: "script", scriptId: script.id }).map(
      (role) => role.id,
    ),
  );
  const customRoleIds = (script.roleIds || []).filter((roleId) =>
    baseRoleIds.has(roleId),
  );
  if (!customRoleIds.length) {
    window.alert("这个剧本没有可复制的基础角色。");
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    scriptMode: "custom",
    scriptName: draft.scriptName || `${script.name} 副本`,
    sourceScriptName: script.name,
    customRoleIds,
    fabledRoleIds: (script.fabledIds || []).filter((roleId) =>
      fabledRoleIds.has(roleId),
    ),
  };
  return true;
}

export function addSetupFabledRole(value) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const candidates = getSetupFabledRoleOptions(draft);
  const role = candidates.length
    ? findCatalogRole(value || draft.fabledRoleQuery, candidates)
    : null;

  if (!role || !isFabledRole(role)) {
    window.alert("传奇角色不存在。");
    return false;
  }

  const fabledRoleIds = Array.isArray(draft.fabledRoleIds)
    ? draft.fabledRoleIds
    : [];
  if (fabledRoleIds.includes(role.id)) {
    state.notes.ui.setupDraft = {
      ...draft,
      fabledRoleQuery: "",
    };
    return true;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    fabledRoleIds: [...fabledRoleIds, role.id],
    fabledRoleQuery: "",
  };
  return true;
}

export function removeSetupFabledRole(roleId) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const roleIdText = String(roleId || "").trim();
  if (!roleIdText) {
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    fabledRoleIds: (Array.isArray(draft.fabledRoleIds) ? draft.fabledRoleIds : []).filter(
      (id) => id !== roleIdText,
    ),
  };
  return true;
}

export function toggleSetupFabledRole(roleId) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const role = getSetupFabledRoleOptions(draft).find((item) => item.id === roleId);
  if (!role) {
    return false;
  }

  const selected = new Set(draft.fabledRoleIds || []);
  if (selected.has(role.id)) {
    selected.delete(role.id);
  } else {
    selected.add(role.id);
  }
  state.notes.ui.setupDraft = {
    ...draft,
    fabledRoleIds: [...selected],
  };
  return true;
}

export function addFilteredSetupFabledRoles() {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const matches = filterRoleOptions(
    getSetupFabledRoleOptions(draft),
    draft.fabledRoleQuery,
  ).slice(0, 40);
  if (!matches.length) {
    window.alert("当前筛选没有可添加的传奇角色。");
    return false;
  }

  state.notes.ui.setupDraft = {
    ...draft,
    fabledRoleIds: [
      ...new Set([...(draft.fabledRoleIds || []), ...matches.map((role) => role.id)]),
    ],
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
    nomination[field] = normalizeSeatValue(value, getMaxSeatNumber(game));
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
    : normalizeSeatValue(value, getMaxSeatNumber(game));
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

function normalizeTravellerSeats(game) {
  const residentCount = game.players.filter((player) => !isTravellerPlayer(player)).length;
  game.players.filter(isTravellerPlayer).forEach((player, index) => {
    player.seat = residentCount + index + 1;
    player.isTraveller = true;
    player.seatType = "traveller";
  });
}

function syncTravellerRoleIds(game) {
  const roleIds = new Set();
  game.players.filter(isTravellerPlayer).forEach((player) => {
    const role = findCatalogRole(player.trueRole || player.claim);
    if (isTravellerRole(role)) {
      roleIds.add(role.id);
    }
  });
  game.travellerRoleIds = [...roleIds];
}

export function addTravellerToGame(value) {
  const game = getActiveGame();
  if (!game) {
    return false;
  }

  const role = findCatalogRole(value, getAvailableTravellerOptions(game));
  if (!role || !isTravellerRole(role)) {
    window.alert("旅行者不存在。");
    return false;
  }

  const nextSeat = getMaxSeatNumber(game) + 1;
  const traveller = createDefaultPlayer(nextSeat, {
    isTraveller: true,
    claim: role.name,
    trueRole: role.name,
    trueAlignment: "unknown",
    newRoleFirstNight: true,
  });
  game.players.push(traveller);
  game.travellerRoleIds = [...new Set([...(game.travellerRoleIds || []), role.id])];
  state.notes.ui.selectedPlayerId = traveller.id;
  state.notes.ui.activeTab = game.mode === "storyteller" ? "storyteller" : "players";
  game.timeline.unshift({
    id: createId("note"),
    type: "info",
    phase: formatPhaseLabel(game.phaseType, game.phaseNumber),
    text: `旅行者加入：${nextSeat}号 ${role.name}`,
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
  return true;
}

export function removeTravellerFromGame(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  if (!game || !player || !isTravellerPlayer(player)) {
    return false;
  }

  if (!window.confirm(`移除 ${player.seat}号旅行者？`)) {
    return false;
  }

  game.players = game.players.filter((item) => item.id !== playerId);
  normalizeTravellerSeats(game);
  syncTravellerRoleIds(game);
  if (state.notes.ui.selectedPlayerId === playerId) {
    state.notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(game);
  }
  syncAutoExecutionStatuses(game);
  game.timeline.unshift({
    id: createId("note"),
    type: "info",
    phase: formatPhaseLabel(game.phaseType, game.phaseNumber),
    text: `旅行者离场：${player.seat}号 ${player.claim || player.trueRole || ""}`.trim(),
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
  return true;
}

export function exportActiveGame() {
  const backup = createActiveGameBackup();
  if (!backup) {
    return;
  }

  const safeTitle = (backup.game.title || "botc-notes")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  downloadJson(backup, `${safeTitle || "botc-notes"}.json`);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportAllGames() {
  const backup = createAllGamesBackup();
  if (!backup.games.length) {
    window.alert("暂无可备份的对局。");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  downloadJson(backup, `血染钟楼-对局备份-${date}.json`);
}

export async function importNotesBackupFile(file) {
  if (!file) {
    return false;
  }

  if (file.size > 20 * 1024 * 1024) {
    window.alert("备份文件超过 20 MB，无法导入。");
    return false;
  }

  try {
    const payload = JSON.parse(await file.text());
    const importedCount = importNotesBackup(payload);
    renderNotesPage();
    window.alert(`已恢复 ${importedCount} 个对局。原有对局未被覆盖。`);
    return true;
  } catch (error) {
    console.warn("Failed to import game notes", error);
    window.alert(error instanceof Error ? error.message : "备份导入失败。");
    return false;
  }
}

export function shiftGamePhase(game, step) {
  if (!game || !step) {
    return;
  }

  const previousPhaseType = game.phaseType;
  const { phaseType, phaseNumber } = getShiftedPhase(
    game.phaseType,
    game.phaseNumber,
    step,
  );

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
  saveNotesState({ touch: false });
  renderNotesPage();
}

export function toggleGameFavorite(notes, gameId) {
  const game = notes.games.find((item) => item.id === gameId);
  if (!game) {
    return;
  }

  game.favorite = !game.favorite;
  game.updatedAt = new Date().toISOString();
  saveNotesState({ touch: false });
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

export function deleteSavedGames(notes, gameIds, confirmMessage = "删除所选对局？") {
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

  saveNotesState({ touch: false });
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
  setup.fabledRoleIds =
    setup.scriptMode === "custom"
      ? [...(state.notes.ui.setupDraft?.fabledRoleIds || [])]
      : [];
  if (setup.scriptMode === "custom" && !setup.customRoleIds.length) {
    window.alert("自定义池为空。");
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
  saveNotesState({ touch: false });
  renderNotesPage();
}

export function handleDeleteGame(notes, game) {
  if (!window.confirm("删除当前对局？")) {
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
  saveNotesState({ touch: false });
  renderNotesPage();
}
