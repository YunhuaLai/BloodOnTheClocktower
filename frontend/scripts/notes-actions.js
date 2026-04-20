function updateGameField(field, value) {
  const game = getActiveGame();
  if (!game || !(field in game)) {
    return false;
  }

  game[field] = value;
  saveNotesState();
  return field === "mode";
}

function updatePlayerField(playerId, field, value) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  if (!player || !(field in player)) {
    return false;
  }

  player[field] = value;
  saveNotesState();
  return field === "status" || field === "alignment" || field === "trueAlignment";
}

function handleNotesFieldChange(target, refreshSummaries = false) {
  if (target.id === "gameSelect") {
    const notes = ensureNotesState();
    notes.activeGameId = target.value;
    saveNotesState();
    renderNotesPage();
    return;
  }

  const gameField = target.closest("[data-game-field]");
  if (gameField) {
    const field = gameField.dataset.gameField;
    const shouldRerender = updateGameField(field, gameField.value);
    if (shouldRerender || (refreshSummaries && ["title", "scriptName"].includes(field))) {
      renderNotesPage();
    }
    return;
  }

  const playerField = target.closest("[data-player-id][data-field]");
  if (playerField) {
    const field = playerField.dataset.field;
    const shouldRerender = updatePlayerField(
      playerField.dataset.playerId,
      field,
      playerField.value,
    );
    if (shouldRerender || (refreshSummaries && ["name", "claim"].includes(field))) {
      renderNotesPage();
    }
  }
}

function addTimelineEntry() {
  const game = getActiveGame();
  const phaseInput = document.querySelector("#timelinePhase");
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
    phase: phaseInput?.value.trim() || game.phase || "未标记阶段",
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

function handleNotesAction(button) {
  const action = button.dataset.notesAction;
  const notes = ensureNotesState();
  const game = getActiveGame();

  if (action === "new-game") {
    const newGame = createDefaultGame();
    notes.games.unshift(newGame);
    notes.activeGameId = newGame.id;
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (!game) {
    return;
  }

  if (action === "delete-game") {
    if (!window.confirm("删除当前局次记录？这只会清除本机保存。")) {
      return;
    }

    notes.games = notes.games.filter((item) => item.id !== game.id);
    if (!notes.games.length) {
      const newGame = createDefaultGame();
      notes.games = [newGame];
      notes.activeGameId = newGame.id;
    } else {
      notes.activeGameId = notes.games[0].id;
    }
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "export-game") {
    exportActiveGame();
    return;
  }

  if (action === "add-player") {
    game.players.push(createDefaultPlayer(game.players.length + 1));
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "delete-player") {
    game.players = game.players.filter(
      (player) => player.id !== button.dataset.playerId,
    );
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "toggle-tag") {
    const player = game.players.find((item) => item.id === button.dataset.playerId);
    if (!player) {
      return;
    }

    const tag = button.dataset.tag;
    player.tags = player.tags.includes(tag)
      ? player.tags.filter((item) => item !== tag)
      : [...player.tags, tag];
    saveNotesState();
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
  }
}
