import { getClaimRoleOptions } from "../notes-claims.js";
import { clearPlayerDraft, clonePlayerForDraft, getActiveGame, getPlayerDraft, saveNotesState, setPlayerDraft } from "../notes-state.js";
import { noteAlignmentOptions, noteConditionOptions, noteStatusOptions, state } from "../state.js";
import { createId, getOptionLabel } from "../utils.js";
import { syncAbilityRecordsForPlayer } from "./notes-ability-records.js";
import { formatPhaseLabel, getPlayerLabel } from "./notes-core.js";
import { ensureRoleInfoMatchesClaim, getRoleAbilityData, getRoleInfoNode, getRoleInfoSummary } from "./notes-role-info.js";
import { buildRoleInfoForm } from "./notes-role-info-form.js";
import { ensureRoleInfoRecord, findRoleInfoRecord, getGamePhase, isPhased, normalizeRecordPhase, phaseOrderIndex, trimRoleInfoRecords } from "./notes-role-info-records.js";
import { getRoleAlignmentValue, getRoleByLooseName } from "./notes-storyteller-actions.js";

function getRoleInfoSubject(player, game = getActiveGame()) {
  if (game?.mode === "storyteller" && state.notes.ui.activeTab === "storyteller" && player?.trueRole) {
    return {
      ...player,
      claim: player.trueRole,
    };
  }

  return player;
}

function getAbilityRecordSource(game) {
  return game?.mode === "storyteller" && state.notes.ui.activeTab === "storyteller"
    ? "storyteller"
    : "player";
}

export function ensurePlayerDraftForId(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }

  const existingDraft = getPlayerDraft(playerId);
  if (existingDraft) {
    return existingDraft;
  }

  const draft = clonePlayerForDraft(player);
  draft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(draft, game), game);
  setPlayerDraft(playerId, draft);
  return draft;
}

function trimRoleInfoEntries(roleInfo) {
  return {
    version: 3,
    roleId: roleInfo?.roleId || "",
    records: trimRoleInfoRecords(roleInfo?.records),
  };
}

function updatePlayerDraftField(playerId, field, value) {
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft || !(field in draft)) {
    return false;
  }

  if (field === "condition") {
    draft.condition = noteConditionOptions.some((option) => option.value === value)
      ? value
      : "unknown";
  } else if (field === "status") {
    draft.status = noteStatusOptions.some((option) => option.value === value)
      ? value
      : "alive";
  } else if (field === "alignment" || field === "trueAlignment") {
    draft[field] = noteAlignmentOptions.some((option) => option.value === value)
      ? value
      : "unknown";
  } else if (field === "trueRole") {
    const previousRole = getRoleByLooseName(draft.trueRole, getActiveGame());
    draft.trueRole = value;
    const role = getRoleByLooseName(value, getActiveGame());
    if (role) {
      draft.trueAlignment = getRoleAlignmentValue(role);
    }
    if (!role) {
      draft.newRoleFirstNight = false;
    }
    if ((getActiveGame()?.phaseNumber || 1) > 1 && role?.id !== previousRole?.id) {
      draft.newRoleFirstNight = Boolean(role);
    }
  } else if (field === "newRoleFirstNight") {
    draft.newRoleFirstNight = Boolean(value);
  } else {
    draft[field] = value;
  }

  if (field === "claim") {
    draft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(draft, getActiveGame()), getActiveGame());
  }

  return [
    "claim",
    "name",
    "status",
    "alignment",
    "condition",
    "extraInfo",
    "trueRole",
    "trueAlignment",
    "newRoleFirstNight",
  ].includes(field);
}

function getRoleInfoSectionKey(section) {
  return section === "result" ? "resultEntries" : "targetEntries";
}

function resolveRoleInfoPhase(phase, game) {
  if (phase && (phase.phaseType !== undefined || phase.phaseNumber !== undefined)) {
    return normalizeRecordPhase(phase.phaseType, phase.phaseNumber);
  }

  return getGamePhase(game);
}

// Records can be written for any phase that has started (or an existing record, e.g. a migrated
// record whose phase is unknown). Future phases are rejected.
function getWritableRoleInfoRecord(roleInfo, phase, game) {
  const existing = findRoleInfoRecord(roleInfo, phase.phaseType, phase.phaseNumber);
  if (existing) {
    return existing;
  }

  const current = getGamePhase(game);
  if (
    !isPhased(phase.phaseType) ||
    phaseOrderIndex(phase.phaseType, phase.phaseNumber) > phaseOrderIndex(current.phaseType, current.phaseNumber)
  ) {
    return null;
  }

  return ensureRoleInfoRecord(roleInfo, phase.phaseType, phase.phaseNumber);
}

function prepareRoleInfoDraft(playerId) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game) {
    return null;
  }

  const subject = getRoleInfoSubject(draft, game);
  draft.roleInfo = ensureRoleInfoMatchesClaim(subject, game);
  const abilityData = getRoleAbilityData(subject, game);
  if (!abilityData?.abilityMeta?.recordable) {
    return null;
  }

  return { draft, game, subject, abilityData };
}

export function updatePlayerDraftRoleInfo(playerId, section, index, field, value, phase = null) {
  const context = prepareRoleInfoDraft(playerId);
  if (!context || !["target", "result"].includes(section) || !field) {
    return false;
  }

  const { draft, game } = context;
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), 98);
  const record = getWritableRoleInfoRecord(draft.roleInfo, resolveRoleInfoPhase(phase, game), game);
  if (!record) {
    return false;
  }

  const entries = record[getRoleInfoSectionKey(section)];
  while (entries.length <= safeIndex) {
    entries.push({});
  }

  entries[safeIndex] = {
    ...entries[safeIndex],
    [field]: value,
  };
  return true;
}

function getRoleInfoFieldCycleValues(field) {
  if (field?.type === "boolean") {
    return ["", "yes", "no"];
  }

  return [];
}

export function cyclePlayerDraftRoleInfoField(playerId, section, index, fieldKey, phase = null) {
  const context = prepareRoleInfoDraft(playerId);
  if (!context) {
    return false;
  }

  const { draft, game, abilityData } = context;
  const node = getRoleInfoNode(abilityData, section);
  const field = node.fields.find((item) => item.key === fieldKey);
  const values = getRoleInfoFieldCycleValues(field);
  if (!field || !values.length) {
    return false;
  }

  const resolvedPhase = resolveRoleInfoPhase(phase, game);
  const record = findRoleInfoRecord(draft.roleInfo, resolvedPhase.phaseType, resolvedPhase.phaseNumber);
  const currentValue = String(record?.[getRoleInfoSectionKey(section)]?.[Number(index) || 0]?.[fieldKey] ?? "");
  const currentIndex = values.indexOf(currentValue);
  const nextValue = values[(currentIndex + 1 + values.length) % values.length];
  return updatePlayerDraftRoleInfo(playerId, section, index, fieldKey, nextValue, resolvedPhase);
}

export function adjustPlayerDraftRoleInfoRows(playerId, section, step, phase = null) {
  const context = prepareRoleInfoDraft(playerId);
  if (!context || !step) {
    return false;
  }

  const { draft, game, subject, abilityData } = context;
  const resolvedPhase = resolveRoleInfoPhase(phase, game);
  const scope = game.mode === "storyteller" && state.notes.ui.activeTab === "storyteller" ? "current" : "all";
  const form = buildRoleInfoForm({ abilityData, roleInfo: draft.roleInfo, player: subject, game, scope });
  const actions = form.actions;
  if (
    !actions ||
    actions.phaseType !== resolvedPhase.phaseType ||
    actions.phaseNumber !== resolvedPhase.phaseNumber ||
    (step > 0 && !actions.canAdd) ||
    (step < 0 && !actions.canRemove)
  ) {
    return false;
  }

  const record = getWritableRoleInfoRecord(draft.roleInfo, resolvedPhase, game);
  if (!record) {
    return false;
  }

  const displayed = form.rows.filter(
    (row) => row.phaseType === resolvedPhase.phaseType && row.phaseNumber === resolvedPhase.phaseNumber,
  ).length;
  const linkedSections = form.sections
    .filter((item) => ["sequence", "variable"].includes(item.repeatMode))
    .map((item) => item.key);
  const sections = linkedSections.length > 1 ? linkedSections : [section];
  sections.forEach((sectionKey) => {
    const entries = record[getRoleInfoSectionKey(sectionKey)];
    while (entries.length < displayed) {
      entries.push({});
    }
    if (step > 0) {
      entries.push({});
    } else {
      entries.length = Math.max(displayed - 1, 0);
    }
  });
  return true;
}

function buildPlayerSaveSummary(player, game = getActiveGame()) {
  const parts = [];
  if (player.claim) {
    parts.push(`自称 ${player.claim}`);
  }

  // The saved update keeps every record (the overview shows only the latest few).
  const roleInfoSummary = getRoleInfoSummary(player, game, { limit: 0 });
  if (roleInfoSummary && roleInfoSummary !== "--") {
    parts.push(`信息 ${roleInfoSummary}`);
  }

  if (player.extraInfo) {
    parts.push(player.extraInfo);
  }

  parts.push(`判断 ${getOptionLabel(noteAlignmentOptions, player.alignment)}`);
  parts.push(`状态 ${getOptionLabel(noteStatusOptions, player.status)}`);
  parts.push(`状态词 ${getOptionLabel(noteConditionOptions, player.condition)}`);
  return parts.join("；");
}

export function savePlayerDraft(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  const draft = getPlayerDraft(playerId);
  if (!player || !draft) {
    return;
  }

  const savedDraft = clonePlayerForDraft(draft);
  savedDraft.roleInfo = trimRoleInfoEntries(
    ensureRoleInfoMatchesClaim(getRoleInfoSubject(savedDraft, game), game),
  );
  Object.assign(player, savedDraft);
  syncAbilityRecordsForPlayer(game, player, getAbilityRecordSource(game));
  clearPlayerDraft(playerId);

  game.timeline.unshift({
    id: createId("note"),
    type: "info",
    phase: formatPhaseLabel(game.phaseType, game.phaseNumber),
    text: `${getPlayerLabel(player, game)} 更新：${buildPlayerSaveSummary(player, game)}`,
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
}

export function persistPlayerDraft(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  const draft = getPlayerDraft(playerId);
  if (!player || !draft) {
    return;
  }

  const savedDraft = clonePlayerForDraft(draft);
  savedDraft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(savedDraft, game), game);
  Object.assign(player, savedDraft);
  syncAbilityRecordsForPlayer(game, player, getAbilityRecordSource(game));
  setPlayerDraft(playerId, clonePlayerForDraft(savedDraft));
  saveNotesState();
}

export function updatePlayerField(playerId, field, value) {
  return updatePlayerDraftField(playerId, field, value);
}

export function togglePlayerStoryMarker(playerId, marker) {
  const draft = ensurePlayerDraftForId(playerId);
  const token = String(marker || "").trim();
  if (!draft || !token) {
    return false;
  }

  const markers = String(draft.storytellerNotes || "")
    .split(/[，,、；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const nextMarkers = markers.includes(token)
    ? markers.filter((item) => item !== token)
    : [...markers, token];

  draft.storytellerNotes = nextMarkers.join("、");
  return true;
}

function getSeatFromRoleInfoEntry(entry) {
  const value = entry?.seat || entry?.player || entry?.number || "";
  const seat = Number.parseInt(value, 10);
  return Number.isFinite(seat) && seat > 0 ? seat : 0;
}

function getRoleAlignmentGroup(role) {
  if (["townsfolk", "outsider"].includes(role?.type)) {
    return "good";
  }

  if (["minion", "demon"].includes(role?.type)) {
    return "evil";
  }

  return "";
}

function pickRoleByAlignment(game, alignment, excludedRoleId = "") {
  return getClaimRoleOptions(game).find(
    (role) =>
      role.type !== "fabled" &&
      role.type !== "traveller" &&
      role.type !== "traveler" &&
      role.id !== excludedRoleId &&
      getRoleAlignmentGroup(role) === alignment,
  );
}

export function autoFillStorytellerRoleInfoResult(playerId) {
  const game = getActiveGame();
  const draft = ensurePlayerDraftForId(playerId);
  if (!game || !draft) {
    return false;
  }

  const subject = getRoleInfoSubject(draft, game);
  const abilityData = getRoleAbilityData(subject, game);
  const resultNode = getRoleInfoNode(abilityData, "result");
  if (!resultNode.fields.some((field) => field.type === "role")) {
    return false;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(subject, game);
  const current = getGamePhase(game);
  const currentIndex = phaseOrderIndex(current.phaseType, current.phaseNumber);
  // Latest record (up to the current phase) whose target names a seat.
  const record = [...draft.roleInfo.records]
    .reverse()
    .find(
      (item) =>
        phaseOrderIndex(item.phaseType, item.phaseNumber) <= currentIndex &&
        item.targetEntries.some((entry) => getSeatFromRoleInfoEntry(entry)),
    );
  if (!record) {
    return false;
  }

  const targetEntries = record.targetEntries;
  const targetIndex = targetEntries.findLastIndex((entry) => getSeatFromRoleInfoEntry(entry));
  const targetSeat = getSeatFromRoleInfoEntry(targetEntries[targetIndex]);
  const targetPlayer = game.players.find((player) => player.seat === targetSeat);
  const targetRole = getRoleByLooseName(targetPlayer?.trueRole, game);
  const targetAlignment = getRoleAlignmentGroup(targetRole);
  if (!targetRole || !targetAlignment) {
    return false;
  }

  while (record.resultEntries.length <= targetIndex) {
    record.resultEntries.push({});
  }

  const resultEntry = { ...(record.resultEntries[targetIndex] || {}) };
  resultNode.fields.forEach((field) => {
    if (field.type !== "role" || resultEntry[field.key]) {
      return;
    }

    const keyLabel = `${field.key} ${field.label || ""}`.toLowerCase();
    const wantsGood = /good|好|善/.test(keyLabel);
    const wantsEvil = /evil|bad|坏|恶|邪/.test(keyLabel);
    const desiredAlignment = wantsGood ? "good" : wantsEvil ? "evil" : targetAlignment;

    if (desiredAlignment === targetAlignment) {
      resultEntry[field.key] = targetRole.name;
      return;
    }

    const fakeRole = pickRoleByAlignment(game, desiredAlignment, targetRole.id);
    if (fakeRole) {
      resultEntry[field.key] = fakeRole.name;
    }
  });

  record.resultEntries[targetIndex] = resultEntry;
  return true;
}

function getPlayerFieldCycleValues(field) {
  if (field === "status") {
    return ["alive", "night-dead", "executed", "unclear"];
  }

  if (field === "alignment") {
    return ["unknown", "good", "evil", "suspect"];
  }

  if (field === "condition") {
    return ["unknown", "sober", "poisoned"];
  }

  return [];
}

export function cyclePlayerFieldValue(playerId, field) {
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft) {
    return false;
  }

  const values = getPlayerFieldCycleValues(field);
  if (!values.length) {
    return false;
  }

  const currentValue =
    field === "condition" && draft[field] === "drunk" ? "poisoned" : draft[field];
  const currentIndex = values.indexOf(currentValue);
  const nextValue = values[(currentIndex + 1 + values.length) % values.length];
  return updatePlayerDraftField(playerId, field, nextValue);
}
