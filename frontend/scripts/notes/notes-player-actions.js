// Split from notes-actions.js. Keep script order in index.html.

function ensurePlayerDraftForId(playerId) {
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
  draft.roleInfo = ensureRoleInfoMatchesClaim(draft, game);
  setPlayerDraft(playerId, draft);
  return draft;
}

function trimRoleInfoEntry(entry) {
  return Object.fromEntries(
    Object.entries(entry || {}).filter(([, value]) => {
      if (typeof value === "number") {
        return true;
      }

      return String(value ?? "").trim();
    }),
  );
}

function trimRoleInfoEntries(roleInfo) {
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

function updatePlayerDraftField(playerId, field, value) {
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft || !(field in draft)) {
    return false;
  }

  if (field === "condition") {
    const normalizedValue = value === "drunk" ? "poisoned" : value;
    draft.condition = noteConditionOptions.some((option) => option.value === normalizedValue)
      ? normalizedValue
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
    draft.trueRole = value;
    const role = getRoleByLooseName(value, getActiveGame());
    if (role) {
      draft.trueAlignment = getRoleAlignmentValue(role);
    }
  } else {
    draft[field] = value;
  }

  if (field === "claim") {
    draft.roleInfo = ensureRoleInfoMatchesClaim(draft, getActiveGame());
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
  ].includes(field);
}

function getRoleInfoSectionKey(section) {
  return section === "result" ? "resultEntries" : "targetEntries";
}

function getRoleInfoMinimumRows(node) {
  return node.repeatMode === "once"
    ? Math.max(node.defaultRows || 0, 1)
    : Math.max(node.defaultRows || 0, 1);
}

function getLinkedRoleInfoSections(draft, requestedSection, game) {
  const abilityData = getRoleAbilityData(draft, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const targetRepeatable = ["sequence", "variable"].includes(targetNode.repeatMode);
  const resultRepeatable = ["sequence", "variable"].includes(resultNode.repeatMode);

  if (targetRepeatable && resultRepeatable) {
    return ["target", "result"];
  }

  return [requestedSection];
}

function updatePlayerDraftRoleInfo(playerId, section, index, field, value) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(draft, game);
  const entryKey = getRoleInfoSectionKey(section);
  while (draft.roleInfo[entryKey].length <= index) {
    draft.roleInfo[entryKey].push({});
  }

  draft.roleInfo[entryKey][index] = {
    ...draft.roleInfo[entryKey][index],
    [field]: value,
  };
}

function updatePlayerDraftExternalReport(playerId, index, field, value) {
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

function adjustPlayerDraftExternalReports(playerId, step) {
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

function getRoleInfoFieldCycleValues(field) {
  if (field?.type === "boolean") {
    return ["", "yes", "no"];
  }

  return [];
}

function cyclePlayerDraftRoleInfoField(playerId, section, index, fieldKey) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(draft, game);
  const abilityData = getRoleAbilityData(draft, game);
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

function adjustPlayerDraftRoleInfoRows(playerId, section, step) {
  const draft = ensurePlayerDraftForId(playerId);
  const game = getActiveGame();
  if (!draft || !game || !step) {
    return;
  }

  draft.roleInfo = ensureRoleInfoMatchesClaim(draft, game);
  const abilityData = getRoleAbilityData(draft, game);
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

function buildPlayerSaveSummary(player, game = getActiveGame()) {
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

function savePlayerDraft(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  const draft = getPlayerDraft(playerId);
  if (!player || !draft) {
    return;
  }

  const savedDraft = clonePlayerForDraft(draft);
  savedDraft.roleInfo = trimRoleInfoEntries(
    ensureRoleInfoMatchesClaim(savedDraft, game),
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

function persistPlayerDraft(playerId) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  const draft = getPlayerDraft(playerId);
  if (!player || !draft) {
    return;
  }

  const savedDraft = clonePlayerForDraft(draft);
  savedDraft.roleInfo = ensureRoleInfoMatchesClaim(savedDraft, game);
  Object.assign(player, savedDraft);
  setPlayerDraft(playerId, clonePlayerForDraft(savedDraft));
  saveNotesState();
}

function updatePlayerField(playerId, field, value) {
  return updatePlayerDraftField(playerId, field, value);
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

function cyclePlayerFieldValue(playerId, field) {
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
