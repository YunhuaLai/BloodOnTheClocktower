// Split from notes-actions.js. Keep script order in index.html.

function getSelectedPlayerIdForGame(game) {
  return (
    game?.players.find((player) => player.seat === game.selfSeat)?.id ||
    game?.players[0]?.id ||
    ""
  );
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

function updateStorytellerField(field, value) {
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

function updateStorytellerBluff(index, value) {
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
    scriptName: String(formData.get("scriptName") || ""),
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
