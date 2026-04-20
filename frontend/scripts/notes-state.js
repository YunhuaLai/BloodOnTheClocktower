function createDefaultPlayer(number) {
  return {
    id: createId("player"),
    name: `玩家 ${number}`,
    claim: "",
    alignment: "unknown",
    status: "alive",
    tags: [],
    notes: "",
    votes: "",
    trueRole: "",
    trueAlignment: "unknown",
    storytellerNotes: "",
  };
}

function createDefaultGame() {
  return {
    id: createId("game"),
    title: "新的一局",
    scriptName: "",
    phase: "第 1 天",
    mode: "player",
    createdAt: new Date().toISOString(),
    players: Array.from({ length: 7 }, (_, index) => createDefaultPlayer(index + 1)),
    timeline: [],
  };
}

function normalizePlayer(player, index) {
  const validTags = new Set(noteTagOptions.map((tag) => tag.value));
  const tags = Array.isArray(player?.tags)
    ? player.tags.filter((tag) => validTags.has(tag))
    : [];

  return {
    id: player?.id || createId("player"),
    name: player?.name || `玩家 ${index + 1}`,
    claim: player?.claim || "",
    alignment: noteAlignmentOptions.some((option) => option.value === player?.alignment)
      ? player.alignment
      : "unknown",
    status: noteStatusOptions.some((option) => option.value === player?.status)
      ? player.status
      : "alive",
    tags,
    notes: player?.notes || "",
    votes: player?.votes || "",
    trueRole: player?.trueRole || "",
    trueAlignment: noteAlignmentOptions.some((option) => option.value === player?.trueAlignment)
      ? player.trueAlignment
      : "unknown",
    storytellerNotes: player?.storytellerNotes || "",
  };
}

function normalizeTimelineEntry(entry) {
  const type = timelineTypeOptions.some((option) => option.value === entry?.type)
    ? entry.type
    : "info";

  return {
    id: entry?.id || createId("note"),
    type,
    phase: entry?.phase || "未标记阶段",
    text: entry?.text || "",
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function normalizeGame(game, index) {
  const fallback = createDefaultGame();
  const mode = noteModeOptions.some((option) => option.value === game?.mode)
    ? game.mode
    : "player";

  return {
    id: game?.id || fallback.id,
    title: game?.title || `第 ${index + 1} 局`,
    scriptName: game?.scriptName || "",
    phase: game?.phase || "第 1 天",
    mode,
    createdAt: game?.createdAt || fallback.createdAt,
    players: Array.isArray(game?.players)
      ? game.players.map(normalizePlayer)
      : fallback.players,
    timeline: Array.isArray(game?.timeline)
      ? game.timeline.map(normalizeTimelineEntry).filter((entry) => entry.text)
      : [],
  };
}

function loadNotesState() {
  const fallback = {
    activeGameId: "",
    games: [],
    loaded: true,
  };

  try {
    const raw = window.localStorage.getItem(notesStorageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      activeGameId: parsed.activeGameId || "",
      games: Array.isArray(parsed.games) ? parsed.games.map(normalizeGame) : [],
      loaded: true,
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

  if (!state.notes.games.length) {
    const game = createDefaultGame();
    state.notes.games = [game];
    state.notes.activeGameId = game.id;
    saveNotesState();
    return state.notes;
  }

  const activeGame = state.notes.games.find(
    (game) => game.id === state.notes.activeGameId,
  );
  if (!activeGame) {
    state.notes.activeGameId = state.notes.games[0].id;
    saveNotesState();
  }

  return state.notes;
}

function getActiveGame() {
  const notes = ensureNotesState();
  return notes.games.find((game) => game.id === notes.activeGameId) || notes.games[0];
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
