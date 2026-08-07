import { isBaseRole, isFabledRole, isTravellerRole, normalizeMatchText } from "./notes-claims.js";
import { normalizeAutoExecutionApplied, normalizeDayRecords, syncAutoExecutionStatuses } from "./notes/notes-day-records.js";
import { isTravellerPlayer } from "./notes/notes-core.js";
import { noteAlignmentOptions, noteConditionOptions, noteModeOptions, noteStatusOptions, noteTagOptions, notesStorageKey, phaseTypeOptions, scriptModeOptions, state, timelineTypeOptions } from "./state.js";
import { createId, getOptionLabel } from "./utils.js";

const NOTES_SAVE_DELAY_MS = 250;
let notesSaveTimer = null;

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createDefaultSetupDraft() {
  return {
    title: "",
    scriptMode: "script",
    scriptId: "",
    scriptName: "",
    customRoleIds: [],
    customRoleQuery: "",
    fabledRoleIds: [],
    fabledRoleQuery: "",
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
    selectedSavedGameIds: [],
    overviewExpandedPlayerId: "",
    overviewExpandedExtraPlayerId: "",
    scriptSheetOpen: false,
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

export function createDefaultStorytellerState() {
  return {
    bluffs: [],
    setupNotes: "",
    publicNotes: "",
  };
}

export function createDefaultPlayer(seat, options = {}) {
  const isTraveller = Boolean(options.isTraveller || options.seatType === "traveller");
  return {
    id: createId("player"),
    seat,
    isTraveller,
    seatType: isTraveller ? "traveller" : "player",
    name: "",
    claim: options.claim || "",
    alignment: "unknown",
    status: "alive",
    condition: "unknown",
    tags: [],
    extraInfo: "",
    notes: "",
    roleInfo: createEmptyRoleInfo(),
    trueRole: options.trueRole || "",
    trueAlignment: options.trueAlignment || "unknown",
    storytellerNotes: "",
    newRoleFirstNight: Boolean(options.newRoleFirstNight),
  };
}

export function createEmptyRoleInfo(roleId = "") {
  return {
    version: 2,
    roleId,
    targetEntries: [],
    resultEntries: [],
  };
}

export function cloneRoleInfoEntries(entries) {
  return Array.isArray(entries)
    ? entries.map((entry) => ({ ...(entry || {}) }))
    : [];
}

export function cloneRoleInfo(roleInfo) {
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

export function cloneSuspectedRoles(records) {
  return Array.isArray(records)
    ? records.map((record) => ({
        role: String(record?.role ?? ""),
        note: String(record?.note ?? ""),
      }))
    : [];
}

export function clonePlayerForDraft(player) {
  return {
    ...player,
    tags: [...(player.tags || [])],
    roleInfo: cloneRoleInfo(player.roleInfo),
  };
}

function createPlayersForCount(playerCount) {
  return Array.from({ length: playerCount }, (_, index) =>
    createDefaultPlayer(index + 1),
  );
}

function findScriptFromSetup(setup) {
  const query = normalizeMatchText(setup?.scriptName);
  if (query) {
    const script =
      state.scripts.find((item) =>
        [item.name, item.en, item.id, item.englishName].some(
          (value) => normalizeMatchText(value) === query,
        ),
      ) ||
      state.scripts.find((item) =>
        [item.name, item.en, item.id, item.englishName].some((value) =>
          normalizeMatchText(value).includes(query),
        ),
      );

    if (script) {
      return script;
    }
  }

  const scriptId = String(setup?.scriptId || "").trim();
  return state.scripts.find((item) => item.id === scriptId) || null;
}

function getValidScriptMode(value) {
  return scriptModeOptions.some((option) => option.value === value)
    ? value
    : "script";
}

function normalizeRoleIds(roleIds, predicate = () => true) {
  const rolesById = new Map(state.roles.map((role) => [role.id, role]));
  return [
    ...new Set(
      (Array.isArray(roleIds) ? roleIds : [])
        .map((roleId) => String(roleId || "").trim())
        .filter(Boolean),
    ),
  ].filter((roleId) => {
    const role = rolesById.get(roleId);
    return !rolesById.size || (role && predicate(role));
  });
}

function normalizeCustomRoleIds(roleIds) {
  return normalizeRoleIds(roleIds, isBaseRole);
}

function normalizeFabledRoleIds(roleIds) {
  return normalizeRoleIds(roleIds, isFabledRole);
}

function normalizeTravellerRoleIds(roleIds) {
  return normalizeRoleIds(roleIds, isTravellerRole);
}

export function createGameFromSetup(setup, nextIndex = 1) {
  const scriptMode = getValidScriptMode(setup.scriptMode);
  const customRoleIds =
    scriptMode === "custom" ? normalizeCustomRoleIds(setup.customRoleIds) : [];
  const fabledRoleIds = normalizeFabledRoleIds(setup.fabledRoleIds);
  const travellerRoleIds = normalizeTravellerRoleIds(setup.travellerRoleIds);
  const script = scriptMode === "script" ? findScriptFromSetup(setup) : null;
  const playerCount = clampNumber(Number(setup.playerCount) || 10, 5, 15);
  const mode = noteModeOptions.some((option) => option.value === setup.mode)
    ? setup.mode
    : "player";
  const selfSeat =
    mode === "storyteller"
      ? 1
      : clampNumber(Number(setup.selfSeat) || 1, 1, playerCount);
  const title = String(setup.title || "").trim() || `第 ${nextIndex} 局`;
  const scriptName = String(setup.scriptName || "").trim();
  const customScriptName = scriptName || "自定义角色池";

  return {
    id: createId("game"),
    title,
    scriptMode,
    scriptId: scriptMode === "script" ? script?.id || "" : "",
    scriptName: scriptMode === "custom" ? customScriptName : script?.name || scriptName,
    customRoleIds,
    fabledRoleIds,
    travellerRoleIds,
    playerCount,
    selfSeat,
    mode,
    favorite: false,
    phaseType: "day",
    phaseNumber: 1,
    createdAt: new Date().toISOString(),
    players: createPlayersForCount(playerCount),
    timeline: [],
    suspectedRoles: [],
    dayRecords: [],
    autoExecutionApplied: [],
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

function normalizePlayer(player, index, options = {}) {
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
  const isTraveller = Boolean(
    options.isTraveller ||
      player?.isTraveller ||
      player?.seatType === "traveller",
  );
  const seat = clampNumber(Number(player?.seat) || index + 1, 1, 25);
  const notesParts = [String(player?.notes || "").trim()];

  if (player?.votes) {
    notesParts.push(`投票/提名：${String(player.votes).trim()}`);
  }

  return {
    id: player?.id || createId("player"),
    seat,
    isTraveller,
    seatType: isTraveller ? "traveller" : "player",
    name: player?.name || "",
    claim: player?.claim || "",
    alignment,
    status,
    condition,
    tags,
    extraInfo: player?.extraInfo || player?.summary || "",
    notes: notesParts.filter(Boolean).join("\n"),
    roleInfo: cloneRoleInfo(player?.roleInfo),
    trueRole: player?.trueRole || "",
    trueAlignment,
    storytellerNotes: player?.storytellerNotes || "",
    newRoleFirstNight: Boolean(player?.newRoleFirstNight),
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
  const scriptMode = getValidScriptMode(
    game?.scriptMode ||
      (Array.isArray(game?.customRoleIds) && game.customRoleIds.length
        ? "custom"
        : "script"),
  );
  const customRoleIds =
    scriptMode === "custom" ? normalizeCustomRoleIds(game?.customRoleIds) : [];
  const fabledRoleIds = normalizeFabledRoleIds([
    ...(Array.isArray(game?.fabledRoleIds) ? game.fabledRoleIds : []),
    ...(Array.isArray(game?.customRoleIds) ? game.customRoleIds : []),
  ]);
  const storedTravellerRoleIds = normalizeTravellerRoleIds(game?.travellerRoleIds);
  const rawPlayerCount =
    Number(game?.playerCount) ||
    (Array.isArray(game?.players) ? game.players.length : 0) ||
    fallbackSetup.playerCount;
  const playerCount = clampNumber(rawPlayerCount, 5, 15);
  const players = Array.isArray(game?.players)
    ? game.players.map((player, playerIndex) =>
        normalizePlayer(player, playerIndex, {
          isTraveller: isTravellerPlayer(player) || playerIndex >= playerCount,
        }),
      )
    : createPlayersForCount(playerCount);

  const residentPlayers = players.filter((player) => !isTravellerPlayer(player));
  const travellerPlayers = players.filter(isTravellerPlayer);

  while (residentPlayers.length < playerCount) {
    residentPlayers.push(createDefaultPlayer(residentPlayers.length + 1));
  }

  const normalizedResidents = residentPlayers
    .slice(0, playerCount)
    .map((player, playerIndex) => ({
      ...player,
      seat: playerIndex + 1,
      isTraveller: false,
      seatType: "player",
    }));
  const normalizedTravellers = travellerPlayers.map((player, travellerIndex) => ({
    ...player,
    seat: playerCount + travellerIndex + 1,
    isTraveller: true,
    seatType: "traveller",
  }));
  const normalizedPlayers = [...normalizedResidents, ...normalizedTravellers];
  const travellerRoleIds = [
    ...new Set([
      ...storedTravellerRoleIds,
      ...normalizedTravellers
        .map((player) => {
          const role = state.roles.find((item) =>
            [item.name, item.en, item.id, item.englishName].some(
              (value) => normalizeMatchText(value) === normalizeMatchText(player.trueRole || player.claim),
            ),
          );
          return isTravellerRole(role) ? role.id : "";
        })
        .filter(Boolean),
    ]),
  ];

  const selfSeat = clampNumber(Number(game?.selfSeat) || 1, 1, normalizedPlayers.length || playerCount);
  const mode = noteModeOptions.some((option) => option.value === game?.mode)
    ? game.mode
    : "player";

  const normalizedGame = {
    id: game?.id || createId("game"),
    title: game?.title || `第 ${index + 1} 局`,
    scriptMode,
    scriptId: scriptMode === "custom" ? "" : game?.scriptId || "",
    scriptName:
      scriptMode === "custom"
        ? game?.scriptName || "自定义角色池"
        : game?.scriptName || "",
    customRoleIds,
    fabledRoleIds,
    travellerRoleIds,
    playerCount,
    selfSeat,
    mode,
    favorite: Boolean(game?.favorite),
    phaseType: fallbackPhase.phaseType,
    phaseNumber: fallbackPhase.phaseNumber,
    createdAt: game?.createdAt || new Date().toISOString(),
    players: normalizedPlayers,
    timeline: Array.isArray(game?.timeline)
      ? game.timeline
          .map((entry) => normalizeTimelineEntry(entry, game))
          .filter((entry) => entry.text)
      : [],
    suspectedRoles: cloneSuspectedRoles(game?.suspectedRoles),
    dayRecords: normalizeDayRecords(game?.dayRecords, playerCount),
    autoExecutionApplied: normalizeAutoExecutionApplied(
      game?.autoExecutionApplied,
      playerCount,
    ),
    inference: normalizeInference(game?.inference),
    storyteller: normalizeStorytellerState(game?.storyteller),
  };

  syncAutoExecutionStatuses(normalizedGame);
  return normalizedGame;
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

export function getNotesGameCount() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  return state.notes.games.length;
}

function writeNotesState() {
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

export function saveNotesState({ immediate = false } = {}) {
  window.clearTimeout(notesSaveTimer);
  notesSaveTimer = null;

  if (immediate) {
    writeNotesState();
    return;
  }

  notesSaveTimer = window.setTimeout(() => {
    notesSaveTimer = null;
    writeNotesState();
  }, NOTES_SAVE_DELAY_MS);
}

export function flushNotesState() {
  if (notesSaveTimer === null) {
    return;
  }

  window.clearTimeout(notesSaveTimer);
  notesSaveTimer = null;
  writeNotesState();
}

export function ensureNotesState() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  if (!state.notes.ui) {
    state.notes.ui = createNotesUiState();
  }

  if (!state.notes.ui.setupDraft) {
    state.notes.ui.setupDraft = createDefaultSetupDraft();
  } else {
    state.notes.ui.setupDraft = {
      ...createDefaultSetupDraft(),
      ...state.notes.ui.setupDraft,
      customRoleIds: Array.isArray(state.notes.ui.setupDraft.customRoleIds)
        ? state.notes.ui.setupDraft.customRoleIds
        : [],
      fabledRoleIds: Array.isArray(state.notes.ui.setupDraft.fabledRoleIds)
        ? state.notes.ui.setupDraft.fabledRoleIds
        : [],
    };
  }

  if (!state.notes.ui.playerDrafts) {
    state.notes.ui.playerDrafts = {};
  }

  if (!Array.isArray(state.notes.ui.selectedSavedGameIds)) {
    state.notes.ui.selectedSavedGameIds = [];
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
    const selectedSeat = clampNumber(
      Number(game?.selfSeat) || 1,
      1,
      game?.players?.length || game?.playerCount || 1,
    );
    state.notes.ui.selectedPlayerId =
      game?.players.find((player) => player.seat === selectedSeat)?.id ||
      game?.players[0]?.id ||
      "";
  }

  return state.notes;
}

export function getActiveGame() {
  const notes = ensureNotesState();
  if (!notes.activeGameId) {
    return null;
  }

  return notes.games.find((game) => game.id === notes.activeGameId) || null;
}

export function getPlayerDraft(playerId) {
  ensureNotesState();
  return state.notes.ui.playerDrafts[playerId] || null;
}

export function setPlayerDraft(playerId, draft) {
  ensureNotesState();
  state.notes.ui.playerDrafts[playerId] = draft;
}

export function clearPlayerDraft(playerId) {
  ensureNotesState();
  delete state.notes.ui.playerDrafts[playerId];
}

export function getDraftOrPlayer(player) {
  return getPlayerDraft(player.id) || player;
}
