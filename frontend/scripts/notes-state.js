function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createDefaultSetupDraft() {
  return {
    title: "",
    scriptId: "",
    playerCount: 10,
    selfSeat: 1,
    mode: "player",
  };
}

function createNotesUiState() {
  return {
    screen: "home",
    activeTab: "overview",
    selectedPlayerId: "",
    overviewExpandedPlayerId: "",
    overviewExpandedExtraPlayerId: "",
    creatingGame: false,
    setupDraft: createDefaultSetupDraft(),
    playerDrafts: {},
  };
}

function createDefaultInference() {
  return {
    summary: "",
    goodTeam: "",
    evilTeam: "",
    plan: "",
  };
}

function createDefaultStorytellerState() {
  return {
    bluffs: [],
    setupNotes: "",
    publicNotes: "",
  };
}

function createDefaultPlayer(seat) {
  return {
    id: createId("player"),
    seat,
    name: "",
    claim: "",
    alignment: "unknown",
    status: "alive",
    condition: "unknown",
    tags: [],
    extraInfo: "",
    notes: "",
    roleInfo: createEmptyRoleInfo(),
    externalReports: [],
    trueRole: "",
    trueAlignment: "unknown",
    storytellerNotes: "",
  };
}

function createEmptyRoleInfo(roleId = "") {
  return {
    version: 2,
    roleId,
    targetEntries: [],
    resultEntries: [],
  };
}

function cloneRoleInfoEntries(entries) {
  return Array.isArray(entries)
    ? entries.map((entry) => ({ ...(entry || {}) }))
    : [];
}

function cloneRoleInfo(roleInfo) {
  const info = roleInfo || {};
  return {
    version: Number(info.version) === 2 ? 2 : info.version || 2,
    roleId: info.roleId || "",
    targetEntries: cloneRoleInfoEntries(info.targetEntries),
    resultEntries: cloneRoleInfoEntries(info.resultEntries),
    profile: info.profile || "",
    entries: cloneRoleInfoEntries(info.entries),
  };
}

function cloneExternalReports(reports) {
  return Array.isArray(reports)
    ? reports.map((report) => ({
        seat: String(report?.seat ?? ""),
        note: String(report?.note ?? ""),
      }))
    : [];
}

function clonePlayerForDraft(player) {
  return {
    ...player,
    tags: [...(player.tags || [])],
    roleInfo: cloneRoleInfo(player.roleInfo),
    externalReports: cloneExternalReports(player.externalReports),
  };
}

function createPlayersForCount(playerCount) {
  return Array.from({ length: playerCount }, (_, index) =>
    createDefaultPlayer(index + 1),
  );
}

function createGameFromSetup(setup, nextIndex = 1) {
  const script = state.scripts.find((item) => item.id === setup.scriptId) || null;
  const playerCount = clampNumber(Number(setup.playerCount) || 10, 5, 15);
  const selfSeat = clampNumber(Number(setup.selfSeat) || 1, 1, playerCount);
  const title = String(setup.title || "").trim() || `第 ${nextIndex} 局`;

  return {
    id: createId("game"),
    title,
    scriptId: script?.id || "",
    scriptName: script?.name || "",
    playerCount,
    selfSeat,
    mode: noteModeOptions.some((option) => option.value === setup.mode)
      ? setup.mode
      : "player",
    phaseType: "day",
    phaseNumber: 1,
    createdAt: new Date().toISOString(),
    players: createPlayersForCount(playerCount),
    timeline: [],
    inference: createDefaultInference(),
    storyteller: createDefaultStorytellerState(),
  };
}

function parseLegacyPhase(game) {
  const storedType = phaseTypeOptions.some(
    (option) => option.value === game?.phaseType,
  )
    ? game.phaseType
    : "";
  const storedNumber = Number.parseInt(game?.phaseNumber, 10);

  if (storedType && Number.isFinite(storedNumber) && storedNumber > 0) {
    return {
      phaseType: storedType,
      phaseNumber: clampNumber(storedNumber, 1, 99),
    };
  }

  const rawPhase = String(game?.phase || "").trim();
  const parsedNumber = Number.parseInt(rawPhase.match(/\d+/)?.[0] || "1", 10);
  const phaseNumber = clampNumber(
    Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1,
    1,
    99,
  );

  if (/夜/.test(rawPhase)) {
    return { phaseType: "night", phaseNumber };
  }

  if (/白|昼|天/.test(rawPhase)) {
    return { phaseType: "day", phaseNumber };
  }

  return { phaseType: "day", phaseNumber: 1 };
}

function normalizePlayer(player, index) {
  const validTags = new Set(noteTagOptions.map((tag) => tag.value));
  const tags = Array.isArray(player?.tags)
    ? player.tags.filter((tag) => validTags.has(tag))
    : [];
  const rawStatus = player?.status === "dead" ? "night-dead" : player?.status;
  const status = noteStatusOptions.some((option) => option.value === rawStatus)
    ? rawStatus
    : "alive";
  const normalizedCondition =
    player?.condition === "drunk" ? "poisoned" : player?.condition;
  const condition = noteConditionOptions.some(
    (option) => option.value === normalizedCondition,
  )
    ? normalizedCondition
    : "unknown";
  const alignment = noteAlignmentOptions.some(
    (option) => option.value === player?.alignment,
  )
    ? player.alignment
    : "unknown";
  const trueAlignment = noteAlignmentOptions.some(
    (option) => option.value === player?.trueAlignment,
  )
    ? player.trueAlignment
    : "unknown";
  const seat = clampNumber(Number(player?.seat) || index + 1, 1, 15);
  const notesParts = [String(player?.notes || "").trim()];

  if (player?.votes) {
    notesParts.push(`投票/提名：${String(player.votes).trim()}`);
  }

  return {
    id: player?.id || createId("player"),
    seat,
    name: player?.name || "",
    claim: player?.claim || "",
    alignment,
    status,
    condition,
    tags,
    extraInfo: player?.extraInfo || player?.summary || "",
    notes: notesParts.filter(Boolean).join("\n"),
    roleInfo: cloneRoleInfo(player?.roleInfo),
    externalReports: cloneExternalReports(player?.externalReports),
    trueRole: player?.trueRole || "",
    trueAlignment,
    storytellerNotes: player?.storytellerNotes || "",
  };
}

function normalizeTimelineEntry(entry, game) {
  const type = timelineTypeOptions.some((option) => option.value === entry?.type)
    ? entry.type
    : "info";
  const phaseState = parseLegacyPhase(game);

  return {
    id: entry?.id || createId("note"),
    type,
    phase: entry?.phase || `${getOptionLabel(phaseTypeOptions, phaseState.phaseType)} ${phaseState.phaseNumber}`,
    text: entry?.text || "",
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function normalizeInference(inference) {
  return {
    summary: inference?.summary || "",
    goodTeam: inference?.goodTeam || "",
    evilTeam: inference?.evilTeam || "",
    plan: inference?.plan || "",
  };
}

function normalizeStorytellerState(storyteller) {
  return {
    ...createDefaultStorytellerState(),
    ...(storyteller || {}),
    bluffs: Array.isArray(storyteller?.bluffs)
      ? storyteller.bluffs.slice(0, 3).map((value) => String(value || ""))
      : [],
  };
}

function normalizeGame(game, index) {
  const fallbackSetup = createDefaultSetupDraft();
  const fallbackPhase = parseLegacyPhase(game);
  const rawPlayerCount =
    Number(game?.playerCount) ||
    (Array.isArray(game?.players) ? game.players.length : 0) ||
    fallbackSetup.playerCount;
  const playerCount = clampNumber(rawPlayerCount, 5, 15);
  const players = Array.isArray(game?.players)
    ? game.players.map(normalizePlayer)
    : createPlayersForCount(playerCount);

  while (players.length < playerCount) {
    players.push(createDefaultPlayer(players.length + 1));
  }

  const normalizedPlayers = players
    .slice(0, playerCount)
    .map((player, playerIndex) => ({
      ...player,
      seat: playerIndex + 1,
    }));

  const selfSeat = clampNumber(Number(game?.selfSeat) || 1, 1, playerCount);
  const mode = noteModeOptions.some((option) => option.value === game?.mode)
    ? game.mode
    : "player";

  return {
    id: game?.id || createId("game"),
    title: game?.title || `第 ${index + 1} 局`,
    scriptId: game?.scriptId || "",
    scriptName: game?.scriptName || "",
    playerCount,
    selfSeat,
    mode,
    phaseType: fallbackPhase.phaseType,
    phaseNumber: fallbackPhase.phaseNumber,
    createdAt: game?.createdAt || new Date().toISOString(),
    players: normalizedPlayers,
    timeline: Array.isArray(game?.timeline)
      ? game.timeline
          .map((entry) => normalizeTimelineEntry(entry, game))
          .filter((entry) => entry.text)
      : [],
    inference: normalizeInference(game?.inference),
    storyteller: normalizeStorytellerState(game?.storyteller),
  };
}

function loadNotesState() {
  const fallback = {
    activeGameId: "",
    games: [],
    loaded: true,
    ui: createNotesUiState(),
  };

  try {
    const raw = window.localStorage.getItem(notesStorageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const games = Array.isArray(parsed.games) ? parsed.games.map(normalizeGame) : [];

    return {
      activeGameId: parsed.activeGameId || "",
      games,
      loaded: true,
      ui: {
        ...createNotesUiState(),
      },
    };
  } catch (error) {
    console.warn("Failed to load game notes", error);
    return fallback;
  }
}

function getNotesGameCount() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  return state.notes.games.length;
}

function saveNotesState() {
  try {
    window.localStorage.setItem(
      notesStorageKey,
      JSON.stringify({
        activeGameId: state.notes.activeGameId,
        games: state.notes.games,
      }),
    );
  } catch (error) {
    console.warn("Failed to save game notes", error);
  }
}

function ensureNotesState() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  if (!state.notes.ui) {
    state.notes.ui = createNotesUiState();
  }

  if (!state.notes.ui.setupDraft) {
    state.notes.ui.setupDraft = createDefaultSetupDraft();
  }

  if (!state.notes.ui.playerDrafts) {
    state.notes.ui.playerDrafts = {};
  }

  if (typeof state.notes.ui.overviewExpandedPlayerId !== "string") {
    state.notes.ui.overviewExpandedPlayerId = "";
  }

  if (typeof state.notes.ui.overviewExpandedExtraPlayerId !== "string") {
    state.notes.ui.overviewExpandedExtraPlayerId = "";
  }

  if (!state.notes.games.length) {
    state.notes.activeGameId = "";
    state.notes.ui.screen = state.notes.ui.creatingGame ? "setup" : "home";
    return state.notes;
  }

  const activeGame = state.notes.games.find(
    (game) => game.id === state.notes.activeGameId,
  );

  if (!activeGame) {
    state.notes.activeGameId = state.notes.games[0].id;
  }

  if (!state.notes.ui.selectedPlayerId) {
    const game = state.notes.games.find((item) => item.id === state.notes.activeGameId);
    const selectedSeat = clampNumber(Number(game?.selfSeat) || 1, 1, game?.playerCount || 1);
    state.notes.ui.selectedPlayerId =
      game?.players.find((player) => player.seat === selectedSeat)?.id ||
      game?.players[0]?.id ||
      "";
  }

  return state.notes;
}

function getActiveGame() {
  const notes = ensureNotesState();
  if (!notes.activeGameId) {
    return null;
  }

  return notes.games.find((game) => game.id === notes.activeGameId) || null;
}

function getPlayerDraft(playerId) {
  ensureNotesState();
  return state.notes.ui.playerDrafts[playerId] || null;
}

function setPlayerDraft(playerId, draft) {
  ensureNotesState();
  state.notes.ui.playerDrafts[playerId] = draft;
}

function clearPlayerDraft(playerId) {
  ensureNotesState();
  delete state.notes.ui.playerDrafts[playerId];
}

function getDraftOrPlayer(player) {
  return getPlayerDraft(player.id) || player;
}

function getNoteTagLabel(value) {
  return getOptionLabel(noteTagOptions, value);
}

function renderGameSelectOptions(notes) {
  return notes.games
    .map(
      (game, index) =>
        `<option value="${escapeHtml(game.id)}"${game.id === notes.activeGameId ? " selected" : ""}>${escapeHtml(game.title || `第 ${index + 1} 局`)}</option>`,
    )
    .join("");
}
