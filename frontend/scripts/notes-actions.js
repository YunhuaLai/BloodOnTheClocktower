function getSelectedPlayerIdForGame(game) {
  return (
    game?.players.find((player) => player.seat === game.selfSeat)?.id ||
    game?.players[0]?.id ||
    ""
  );
}

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
  } else {
    draft[field] = value;
  }

  if (field === "claim") {
    draft.roleInfo = ensureRoleInfoMatchesClaim(draft, getActiveGame());
  }

  return ["claim", "name", "status", "alignment", "condition", "extraInfo"].includes(field);
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

function updateSetupDraftField(field, value) {
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
  } else {
    nextDraft[field] = value;
  }

  state.notes.ui.setupDraft = nextDraft;
  return field === "playerCount";
}

function updateGameField(field, value) {
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

function updateInferenceField(field, value) {
  const game = getActiveGame();
  if (!game || !(field in game.inference)) {
    return;
  }

  game.inference[field] = value;
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

function handleNotesFieldChange(target, refreshInterface = false) {
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

  const playerField = target.closest("[data-player-id][data-field]");
  if (playerField) {
    const shouldRerender = updatePlayerField(
      playerField.dataset.playerId,
      playerField.dataset.field,
      target.value,
    );
    if (shouldRerender && refreshInterface) {
      renderNotesPage();
    }
    return;
  }

  const roleInfoField = target.closest(
    "[data-roleinfo-section][data-roleinfo-row][data-roleinfo-field]",
  );
  const playerCard = target.closest(".notes-player-detail");
  if (roleInfoField && playerCard) {
    const playerId = playerCard.dataset.playerId;
    updatePlayerDraftRoleInfo(
      playerId,
      roleInfoField.dataset.roleinfoSection,
      Number(roleInfoField.dataset.roleinfoRow),
      roleInfoField.dataset.roleinfoField,
      target.value,
    );
  }
}

function addTimelineEntry() {
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

function exportActiveGame() {
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

function shiftGamePhase(game, step) {
  if (!game || !step) {
    return;
  }

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
}

function openGameById(gameId) {
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

function handleCreateGame() {
  const form = document.querySelector("#notesSetupForm");
  if (!form || !form.reportValidity()) {
    return;
  }

  const formData = new FormData(form);
  const setup = {
    title: String(formData.get("title") || ""),
    scriptId: String(formData.get("scriptId") || ""),
    playerCount: Number(formData.get("playerCount") || 10),
    selfSeat: Number(formData.get("selfSeat") || 1),
    mode: String(formData.get("mode") || "player"),
  };
  const game = createGameFromSetup(setup, state.notes.games.length + 1);

  state.notes.games.unshift(game);
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "overview";
  state.notes.ui.selectedPlayerId = getSelectedPlayerIdForGame(game);
  state.notes.ui.creatingGame = false;
  state.notes.ui.screen = "game";
  state.notes.ui.setupDraft = createDefaultSetupDraft();
  saveNotesState();
  renderNotesPage();
}

function handleDeleteGame(notes, game) {
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

function handleNotesAction(button) {
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

  if (action === "save-game") {
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "switch-tab") {
    notes.ui.activeTab = button.dataset.tab || "overview";
    renderNotesPage();
    return;
  }

  if (action === "open-player" || action === "select-player") {
    notes.ui.selectedPlayerId = button.dataset.playerId || "";
    notes.ui.activeTab = "players";
    renderNotesPage();
    return;
  }

  if (action === "cycle-player-field") {
    cyclePlayerFieldValue(button.dataset.playerId, button.dataset.field);
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
