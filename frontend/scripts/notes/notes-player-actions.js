import { getClaimRoleOptions } from "../notes-claims.js";
import { clearPlayerDraft, cloneExternalReports, clonePlayerForDraft, cloneRoleInfo, getActiveGame, getPlayerDraft, saveNotesState, setPlayerDraft } from "../notes-state.js";
import { noteAlignmentOptions, noteConditionOptions, noteStatusOptions, state } from "../state.js";
import { createId, getOptionLabel } from "../utils.js";
import { formatPhaseLabel, getPlayerLabel } from "./notes-core.js";
import { ensureRoleInfoMatchesClaim, getRoleAbilityData, getRoleInfoNode, getRoleInfoSummary, isRoleInfoEntryFilled } from "./notes-role-info.js";
import { getRoleAlignmentValue, getRoleByLooseName } from "./notes-storyteller-actions.js";

// Split from notes-actions.js. Keep script order in index.html.

function getRoleInfoSubject(player, game = getActiveGame()) {
  if (game?.mode === "storyteller" && state.notes.ui.activeTab === "storyteller" && player?.trueRole) {
    return {
      ...player,
      claim: player.trueRole,
    };
  }

  return player;
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

export function trimRoleInfoEntry(entry) {
  return Object.fromEntries(
    Object.entries(entry || {}).filter(([, value]) => {
      if (typeof value === "number") {
        return true;
      }

      return String(value ?? "").trim();
    }),
  );
}

export function trimRoleInfoEntries(roleInfo) {
  const info = cloneRoleInfo(roleInfo);
  const nextTargetEntries = [];
  const nextResultEntries = [];
  const rowCount = Math.max(info.targetEntries.length, info.resultEntries.length);

  for (let index = 0; index < rowCount; index += 1) {
    const targetEntry = trimRoleInfoEntry(info.targetEntries[index]);
    const resultEntry = trimRoleInfoEntry(info.resultEntries[index]);
    if (!isRoleInfoEntryFilled(targetEntry) && !isRoleInfoEntryFilled(resultEntry)) {
      continue;
    }

    nextTargetEntries.push(targetEntry);
    nextResultEntries.push(resultEntry);
  }

  return {
    version: 2,
    roleId: info.roleId || "",
    targetEntries: nextTargetEntries,
    resultEntries: nextResultEntries,
  };
}

export function updatePlayerDraftField(playerId, field, value) {
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

export function getRoleInfoSectionKey(section) {
  return section === "result" ? "resultEntries" : "targetEntries";
}

export function getRoleInfoMinimumRows(node) {
  return node.repeatMode === "once"
    ? Math.max(node.defaultRows || 0, 1)
    : Math.max(node.defaultRows || 0, 1);
}

export function getLinkedRoleInfoSections(draft, requestedSection, game) {
  const abilityData = getRoleAbilityData(getRoleInfoSubject(draft, game), game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const targetRepeatable = ["sequence", "variable"].includes(targetNode.repeatMode);
  const resultRepeatable = ["sequence", "variable"].includes(resultNode.repeatMode);

  if (targetRepeatable && resultRepeatable) {
    return ["target", "result"];
  }

  return [requestedSection];
}

export function updatePlayerDraftRoleInfo(playerId, section, index, field, value) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(draft, game), game);
  const entryKey = getRoleInfoSectionKey(section);
  while (draft.roleInfo[entryKey].length <= index) {
    draft.roleInfo[entryKey].push({});
  }

  draft.roleInfo[entryKey][index] = {
    ...draft.roleInfo[entryKey][index],
    [field]: value,
  };
}

export function updatePlayerDraftExternalReport(playerId, index, field, value) {
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft || !["seat", "note"].includes(field)) {
    return;
  }

  draft.externalReports = cloneExternalReports(draft.externalReports);
  while (draft.externalReports.length <= index) {
    draft.externalReports.push({ seat: "", note: "" });
  }

  draft.externalReports[index] = {
    ...draft.externalReports[index],
    [field]: value,
  };
}

export function adjustPlayerDraftExternalReports(playerId, step) {
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft || !step) {
    return;
  }

  draft.externalReports = cloneExternalReports(draft.externalReports);
  if (step > 0) {
    draft.externalReports.push({ seat: "", note: "" });
    return;
  }

  if (draft.externalReports.length) {
    draft.externalReports.pop();
  }
}

export function getRoleInfoFieldCycleValues(field) {
  if (field?.type === "boolean") {
    return ["", "yes", "no"];
  }

  return [];
}

export function cyclePlayerDraftRoleInfoField(playerId, section, index, fieldKey) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(draft, game), game);
  const abilityData = getRoleAbilityData(getRoleInfoSubject(draft, game), game);
  const node = getRoleInfoNode(abilityData, section);
  const field = node.fields.find((item) => item.key === fieldKey);
  const values = getRoleInfoFieldCycleValues(field);
  if (!field || !values.length) {
    return;
  }

  const entryKey = getRoleInfoSectionKey(section);
  while (draft.roleInfo[entryKey].length <= index) {
    draft.roleInfo[entryKey].push({});
  }

  const currentValue = String(draft.roleInfo[entryKey][index]?.[fieldKey] ?? "");
  const currentIndex = values.indexOf(currentValue);
  const nextValue = values[(currentIndex + 1 + values.length) % values.length];
  updatePlayerDraftRoleInfo(playerId, section, index, fieldKey, nextValue);
}

export function adjustPlayerDraftRoleInfoRows(playerId, section, step) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game || !step) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(getRoleInfoSubject(draft, game), game);
  const abilityData = getRoleAbilityData(getRoleInfoSubject(draft, game), game);
  const sections = getLinkedRoleInfoSections(draft, section, game);

  if (step > 0) {
    sections.forEach((sectionKey) => {
      const node = getRoleInfoNode(abilityData, sectionKey);
      if (!["sequence", "variable"].includes(node.repeatMode)) {
        return;
      }

      draft.roleInfo[getRoleInfoSectionKey(sectionKey)].push({});
    });
    return;
  }

  sections.forEach((sectionKey) => {
    const node = getRoleInfoNode(abilityData, sectionKey);
    if (!["sequence", "variable"].includes(node.repeatMode)) {
      return;
    }

    const entryKey = getRoleInfoSectionKey(sectionKey);
    const minimumRows = getRoleInfoMinimumRows(node);
    if (draft.roleInfo[entryKey].length > minimumRows) {
      draft.roleInfo[entryKey].pop();
    }
  });
}

export function buildPlayerSaveSummary(player, game = getActiveGame()) {
  const parts = [];
  if (player.claim) {
    parts.push(`自称 ${player.claim}`);
  }

  const roleInfoSummary = getRoleInfoSummary(player, game);
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
  const targetEntries = draft.roleInfo.targetEntries || [];
  const targetIndex = Math.max(
    targetEntries.findLastIndex((entry) => getSeatFromRoleInfoEntry(entry)),
    0,
  );
  const targetSeat = getSeatFromRoleInfoEntry(targetEntries[targetIndex]);
  const targetPlayer = game.players.find((player) => player.seat === targetSeat);
  const targetRole = getRoleByLooseName(targetPlayer?.trueRole, game);
  const targetAlignment = getRoleAlignmentGroup(targetRole);
  if (!targetRole || !targetAlignment) {
    return false;
  }

  while (draft.roleInfo.resultEntries.length <= targetIndex) {
    draft.roleInfo.resultEntries.push({});
  }

  const resultEntry = { ...(draft.roleInfo.resultEntries[targetIndex] || {}) };
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

  draft.roleInfo.resultEntries[targetIndex] = resultEntry;
  return true;
}

export function getPlayerFieldCycleValues(field) {
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
