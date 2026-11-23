const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const yaml = require("js-yaml");
const { extractObservations } = require("../backend/deduction/observations");
const { checkObservation } = require("../backend/deduction/checkers");

// Real role data (deduction templates and form fields) for the roles exercised below.
const ROLE_DIR = path.resolve(__dirname, "../backend/data/library/roles");
const ROLE_IDS = [
  "r001", "r002", "r003", "r004", "r005", "r006", "r007", "r009", "r015", "r016", "r017", "r018", "r021",
  "r023", "r028", "r048", "r049", "r051", "r054", "r055", "r056", "r058", "r062", "r063", "r085", "r100", "r121", "r197",
];
const roleFiles = fs.readdirSync(ROLE_DIR);
const roles = ROLE_IDS.map((id) => {
  const file = roleFiles.find((name) => name.startsWith(`${id}-`));
  return yaml.load(fs.readFileSync(path.join(ROLE_DIR, file), "utf8"));
});
const roleByName = (name) => roles.find((role) => role.name === name);
const resolveRole = (value) => {
  const query = String(value || "").trim().toLowerCase();
  return query ? roles.find((role) => [role.name, role.id, role.englishName].some((item) => String(item || "").toLowerCase() === query)) || null : null;
};

async function loadTruth(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-truth-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const storage = new Map();
  global.window = {
    clearTimeout,
    setTimeout,
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  };
  const appStub = { innerHTML: "" };
  global.document = { title: "", querySelector: (selector) => (selector === "#app" ? appStub : null) };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = {
    state: (await load("state.js")).state,
    notes: await load("notes-state.js"),
    truth: await load("notes/notes-storyteller-truth.js"),
    truthRender: await load("notes/notes-storyteller-truth-render.js"),
    storyRender: await load("notes/notes-storyteller-render.js"),
    acquiredRender: await load("notes/notes-acquired-render.js"),
    fields: await load("notes/notes-role-info-fields.js"),
    form: await load("notes/notes-role-info-form.js"),
    playerActions: await load("notes/notes-player-actions.js"),
    panel: await load("notes/notes-role-info-panel.js"),
    actions: await load("notes-actions.js"),
  };
  t.after(() => {
    modules.notes.flushNotesState();
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return modules;
}

// Seat -> true role. Default grimoire: 4 = 小恶魔, 5 = 投毒者 (evil), the rest good.
const BASE = { 1: "共情者", 2: "厨师", 3: "占卜师", 4: "小恶魔", 5: "投毒者", 6: "洗衣妇", 7: "送葬者" };

function makeGame(seatRoles = BASE, extra = {}) {
  const seats = Object.keys(seatRoles).map(Number).sort((a, b) => a - b);
  return {
    mode: "storyteller",
    playerCount: seats.length,
    phaseType: "night",
    phaseNumber: 2,
    timeline: [],
    dayRecords: [],
    players: seats.map((seat) => {
      const role = roleByName(seatRoles[seat]);
      return {
        id: `p${seat}`,
        seat,
        status: "alive",
        condition: "sober",
        trueRole: seatRoles[seat] || "",
        trueAlignment: role ? (["minion", "demon"].includes(role.type) ? "evil" : "good") : "unknown",
        storytellerNotes: "",
        ...(extra[seat] || {}),
      };
    }),
  };
}

function compute(truth, game, sourceSeat, roleName, row = {}, rows = null) {
  const role = roleByName(roleName);
  return truth.computeRoleInfoTruth({
    abilityData: role.abilityData,
    sourceRole: role,
    source: game.players.find((player) => player.seat === sourceSeat),
    players: game.players,
    game,
    row: { phaseType: "night", phaseNumber: 2, target: {}, result: {}, ...row },
    rows,
    resolveRole,
  });
}

// Backend agreement: the true world built from the grimoire must accept the suggested record and
// (for exact answers) reject a different value.
function backendAccepts(game, sourceSeat, roleName, row) {
  const role = roleByName(roleName);
  const players = game.players.map((player) => ({
    ...player,
    claim: player.seat === sourceSeat ? role.name : "",
    roleInfo:
      player.seat === sourceSeat
        ? { version: 3, roleId: role.id, records: [{ phaseType: row.phaseType || "night", phaseNumber: row.phaseNumber || 2, targetEntries: [row.target || {}], resultEntries: [row.result || {}] }] }
        : null,
  }));
  const backendGame = { ...game, scriptMode: "free", players };
  const { observations } = extractObservations(backendGame, { roles });
  assert.ok(observations.length, `backend built an observation for ${roleName}`);
  const evil = game.players.filter((player) => player.trueAlignment === "evil").map((player) => player.seat);
  const demonSeat = game.players.find((player) => roleByName(player.trueRole)?.type === "demon")?.seat;
  const minionSeats = evil.filter((seat) => seat !== demonSeat);
  const world = { demonSeat, minionSeats, evilSeats: evil, evilSeatSet: new Set(evil), minionSeatSet: new Set(minionSeats) };
  return observations.every((observation) => checkObservation(observation, world, { game: backendGame, players }));
}

function onlyFill(result) {
  assert.equal(result.status, "ok", result.reason);
  assert.equal(result.suggestions.length, 1);
  return result.suggestions[0].fill;
}

const flipped = (value) => (value === "yes" ? "no" : value === "no" ? "yes" : String(Number(value) + 1));

test("exact answers for every supported template agree with the backend checker", async (t) => {
  const { truth } = await loadTruth(t);
  const game = makeGame(BASE, { 7: { status: "night-dead" } });
  game.dayRecords = [
    { dayNumber: 1, executionOverride: "5", nominations: [{ id: "n1", nominatorSeat: "5", nomineeSeat: "1", voterSeats: ["2", "4", "5"] }], abilityRecords: [] },
  ];
  game.players.find((player) => player.seat === 5).status = "executed";

  const cases = [
    // [label, source seat, role, row, expected fill]
    ["chef adjacent evil pairs (4-5)", 2, "厨师", {}, { count: "1" }],
    ["empath alive neighbours of 1 skip dead 7", 1, "共情者", {}, { count: "0" }],
    ["empath of 3 sees 4", 3, "共情者", {}, { count: "1" }],
    ["fortune teller hits the demon", 3, "占卜师", { target: { seat1: "4", seat2: "6" } }, { has_demon: "yes" }],
    ["fortune teller misses", 3, "占卜师", { target: { seat1: "5", seat2: "6" } }, { has_demon: "no" }],
    ["undertaker sees day 1 execution", 7, "送葬者", {}, { role: "投毒者" }],
    ["ravenkeeper sees target role", 7, "守鸦人", { target: { seat: "4" } }, { role: "小恶魔" }],
    ["seamstress same team", 6, "女裁缝", { target: { seat1: "4", seat2: "5" } }, { same_team: "yes" }],
    ["seamstress different team", 6, "女裁缝", { target: { seat1: "4", seat2: "6" } }, { same_team: "no" }],
    ["clockmaker distance", 1, "钟表匠", {}, { distance: "1" }],
    ["oracle dead evil", 1, "神谕者", {}, { count: "1" }],
    ["gambler correct", 1, "赌徒", { target: { seat: "4", role: "小恶魔" } }, { correct: "yes" }],
    ["gambler wrong", 1, "赌徒", { target: { seat: "4", role: "投毒者" } }, { correct: "no" }],
    ["flowergirl: demon voted", 1, "卖花女孩", {}, { voted: "yes" }],
    ["town crier: minion nominated", 1, "城镇公告员", {}, { nominated: "yes" }],
    ["shugenja nearest evil", 2, "修行者", {}, { direction: "clockwise" }],
    ["clockwise evil count between 1 and 6", 1, "提夫林", { target: { seat: "6" } }, { count: "2" }],
  ];

  for (const [label, seat, roleName, row, expected] of cases) {
    const result = compute(truth, game, seat, roleName, row);
    const fill = onlyFill(result);
    assert.deepEqual(fill, expected, label);
    assert.equal(result.exact, true, label);
    const recorded = { phaseType: "night", phaseNumber: 2, target: row.target || {}, result: fill };
    assert.equal(backendAccepts(game, seat, roleName, recorded), true, `${label}: backend accepts the truth`);
    const [key, value] = Object.entries(fill)[0];
    if (!/role/.test(key) && key !== "direction") {
      assert.equal(
        backendAccepts(game, seat, roleName, { ...recorded, result: { [key]: flipped(value) } }),
        false,
        `${label}: backend rejects a different value`,
      );
    }
  }
});

test("juggler counts correct guesses across the recorded guesses", async (t) => {
  const { truth } = await loadTruth(t);
  const game = makeGame();
  const rows = [
    { phaseType: "day", phaseNumber: 1, target: { seat: "4", role: "小恶魔" }, result: {} },
    { phaseType: "day", phaseNumber: 1, target: { seat: "5", role: "间谍" }, result: {} },
    { phaseType: "day", phaseNumber: 1, target: { seat: "1", role: "共情者" }, result: {} },
  ];
  const result = compute(truth, game, 2, "杂耍艺人", { phaseType: "night", phaseNumber: 2 }, rows);
  assert.deepEqual(onlyFill(result), { correct_count: "2" });
});

test("tie for the nearest evil gives the storyteller both directions", async (t) => {
  const { truth } = await loadTruth(t);
  const game = makeGame({ 1: "小恶魔", 2: "共情者", 3: "厨师", 4: "投毒者", 5: "洗衣妇" });
  // Seat 5: evil at 1 (one step clockwise) and 4 (one step counter-clockwise) -> tie.
  // Seat 2: evil at 1 is one step counter-clockwise, 4 is two steps clockwise.
  const tie = compute(truth, game, 5, "修行者");
  assert.equal(tie.exact, false);
  assert.deepEqual(tie.suggestions.map((item) => item.fill.direction), ["clockwise", "counterclockwise"]);
  assert.deepEqual(onlyFill(compute(truth, game, 2, "修行者")), { direction: "counterclockwise" });
});

test("storyteller-picked results give legal options, not one answer", async (t) => {
  const { truth } = await loadTruth(t);
  const game = makeGame();

  const washer = compute(truth, game, 6, "洗衣妇");
  assert.equal(washer.status, "ok");
  assert.equal(washer.exact, false);
  assert.deepEqual(washer.suggestions.map((item) => item.fill), [
    { seat1: "1", role: "共情者" },
    { seat1: "2", role: "厨师" },
    { seat1: "3", role: "占卜师" },
    { seat1: "7", role: "送葬者" },
  ], "townsfolk other than the washerwoman herself");
  assert.equal(compute(truth, game, 6, "洗衣妇", { result: { seat1: "4", seat2: "5", role: "共情者" } }).mismatch, true);
  assert.equal(compute(truth, game, 6, "洗衣妇", { result: { seat1: "4", seat2: "1", role: "共情者" } }).mismatch, false);

  const librarian = compute(truth, game, 1, "图书管理员");
  assert.deepEqual(onlyFill(librarian), { seat1: "", seat2: "", role: "", no_outsider: "yes" }, "no outsiders in play");

  const investigator = compute(truth, game, 1, "调查员");
  assert.deepEqual(investigator.suggestions.map((item) => item.fill), [{ seat1: "5", role: "投毒者", no_minion: "" }]);

  const dreamer = compute(truth, game, 1, "筑梦师", { target: { seat: "5" } });
  assert.equal(dreamer.exact, false);
  assert.deepEqual(dreamer.suggestions.map((item) => item.fill), [{ evil_role: "投毒者" }]);
  assert.equal(compute(truth, game, 1, "筑梦师", { target: { seat: "5" }, result: { good_role: "厨师", evil_role: "小恶魔" } }).mismatch, true);

  const grandmother = compute(truth, game, 1, "祖母");
  assert.ok(grandmother.suggestions.every((item) => !["4", "5", "1"].includes(item.fill.seat)));

  const savant = compute(truth, game, 1, "贤者");
  assert.deepEqual(savant.suggestions.map((item) => item.fill), [{ seat1: "4" }]);

  const knight = compute(truth, game, 1, "骑士", { result: { seat1: "4", seat2: "2" } });
  assert.equal(knight.mismatch, true);

  const noble = compute(truth, game, 1, "贵族", { result: { seat1: "4", seat2: "5", seat3: "2" } });
  assert.equal(noble.mismatch, true, "two evil among three");
});

test("reports why nothing can be computed", async (t) => {
  const { truth } = await loadTruth(t);
  const game = makeGame({ ...BASE, 5: "" });

  const noTarget = compute(truth, game, 3, "占卜师", { target: { seat1: "4" } });
  assert.equal(noTarget.status, "unavailable");
  assert.match(noTarget.reason, /目标未填完/);

  const missingRole = compute(truth, game, 3, "占卜师", { target: { seat1: "5", seat2: "6" } });
  assert.equal(missingRole.status, "unavailable");
  assert.match(missingRole.reason, /5号未设置真实身份/);

  const chef = compute(truth, game, 2, "厨师");
  assert.equal(chef.status, "unavailable");
  assert.match(chef.reason, /5号/);

  const undertaker = compute(truth, makeGame(), 7, "送葬者");
  assert.equal(undertaker.status, "unavailable");
  assert.match(undertaker.reason, /第1天没有记录处决/);

  const firstNightUndertaker = compute(truth, makeGame(), 7, "送葬者", { phaseNumber: 1 });
  assert.equal(firstNightUndertaker.status, "unavailable");

  const noVotes = compute(truth, makeGame(), 1, "卖花女孩");
  assert.match(noVotes.reason, /没有记录投票/);

  const unsupported = compute(truth, makeGame(), 1, "投毒者");
  assert.equal(unsupported.status, "unsupported");
});

test("poisoned or drunk actors are flagged while still showing the true value", async (t) => {
  const { truth } = await loadTruth(t);
  const poisoned = compute(truth, makeGame(BASE, { 2: { condition: "poisoned" } }), 2, "厨师");
  assert.equal(poisoned.misinfo, true);
  assert.deepEqual(onlyFill(poisoned), { count: "1" });

  const drunkCondition = compute(truth, makeGame(BASE, { 2: { condition: "drunk" } }), 2, "厨师");
  assert.equal(drunkCondition.misinfo, true);

  const isDrunk = compute(truth, makeGame(BASE, { 2: { storytellerNotes: "是酒鬼" } }), 2, "厨师");
  assert.equal(isDrunk.misinfo, true, "the Drunk thinks they are the Chef");

  assert.equal(compute(truth, makeGame(), 2, "厨师").misinfo, false);
});

test("misregistration reminders: red herring, recluse, spy, drunk target", async (t) => {
  const { truth } = await loadTruth(t);
  const redHerring = compute(truth, makeGame(BASE, { 6: { storytellerNotes: "干扰项" } }), 3, "占卜师", { target: { seat1: "6", seat2: "1" } });
  assert.deepEqual(onlyFill(redHerring), { has_demon: "yes" }, "the red herring registers as the demon");
  assert.match(redHerring.notes.join(), /6号是干扰项/);

  const recluse = compute(truth, makeGame({ ...BASE, 6: "陌客" }), 3, "占卜师", { target: { seat1: "6", seat2: "1" } });
  assert.deepEqual(onlyFill(recluse), { has_demon: "no" });
  assert.match(recluse.notes.join(), /6号陌客可被当作邪恶/);

  const spy = compute(truth, makeGame({ ...BASE, 5: "间谍" }), 6, "洗衣妇");
  assert.match(spy.notes.join(), /5号间谍可被当作善良/);

  // A drunk "empath" at seat 1 really is the Drunk: the ravenkeeper learns 酒鬼.
  const drunkTarget = compute(truth, makeGame(BASE, { 1: { storytellerNotes: "是酒鬼" } }), 7, "守鸦人", { target: { seat: "1" } });
  assert.deepEqual(onlyFill(drunkTarget), { role: "酒鬼" });
});

test("rendering: chips only fill on tap, mismatch is a soft flag, player mode renders nothing", async (t) => {
  const { truthRender, state, notes, storyRender, playerActions } = await loadTruth(t);
  state.roles = roles;
  notes.ensureNotesState();
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7, mode: "storyteller" });
  game.mode = "storyteller";
  game.phaseType = "night";
  game.phaseNumber = 2;
  Object.entries(BASE).forEach(([seat, roleName]) => {
    const player = game.players.find((item) => item.seat === Number(seat));
    player.trueRole = roleName;
    player.trueAlignment = ["小恶魔", "投毒者"].includes(roleName) ? "evil" : "good";
  });
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "storyteller";

  // Night 2: the empath (seat 1, neighbours 2 and 7) acts; the chef is first-night only.
  const empath = game.players.find((player) => player.seat === 1);
  const html = storyRender.renderStorytellerTab(game);
  assert.match(html, /data-notes-action="apply-roleinfo-suggestion"/);
  assert.match(html, /data-truth-fill="count=0"/);
  assert.doesNotMatch(html, /autofill-story-result/);
  assert.equal(empath.roleInfo?.records?.length || 0, 0, "rendering never writes a result");

  // The storyteller gave 1 on purpose: the value is kept and only flagged.
  assert.equal(playerActions.updatePlayerDraftRoleInfo(empath.id, "result", 0, "count", "1"), true);
  playerActions.persistPlayerDraft(empath.id);
  const flagged = storyRender.renderStorytellerTab(game);
  assert.match(flagged, /story-truth--mismatch/);
  assert.equal(empath.roleInfo.records[0].resultEntries[0].count, "1");

  assert.deepEqual(truthRender.decodeTruthFill(truthRender.encodeTruthFill({ seat1: "3", role: "共情者" })), { seat1: "3", role: "共情者" });

  // Player mode: the renderer refuses to exist, so no truth reaches the page.
  assert.equal(truthRender.createTruthRowRenderer({ abilityData: roleByName("共情者").abilityData, source: empath, game: { ...game, mode: "player" }, resolveRole, getEntries: () => ({}) }), null);
});

test("player-facing forms never show the truth strip", async (t) => {
  const { state, notes, panel, acquiredRender } = await loadTruth(t);
  state.roles = roles;
  notes.ensureNotesState();
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  game.phaseType = "night";
  game.phaseNumber = 2;
  game.players.forEach((player) => {
    player.trueRole = BASE[player.seat];
    player.claim = BASE[player.seat];
  });
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "players";
  const empath = game.players[0];
  empath.acquiredAbilities = [{ id: "a1", role: "厨师", status: "active", kind: "continuous", certainty: "known", startPhaseType: "night", startPhaseNumber: 1, records: [] }];
  assert.doesNotMatch(panel.renderRoleInfoInputs(empath, game), /story-truth|apply-roleinfo-suggestion/);
  assert.doesNotMatch(acquiredRender.renderAcquiredAbilities(empath, game, "player"), /story-truth|apply-roleinfo-suggestion/);
});

test("tapping a suggestion writes it to the main record and to an acquired-ability record", async (t) => {
  const modules = await loadTruth(t);
  const { state, notes } = modules;
  state.roles = roles;
  notes.ensureNotesState();
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  game.mode = "storyteller";
  game.phaseType = "night";
  game.phaseNumber = 2;
  Object.entries(BASE).forEach(([seat, roleName]) => {
    const player = game.players.find((item) => item.seat === Number(seat));
    player.trueRole = roleName;
    player.trueAlignment = ["小恶魔", "投毒者"].includes(roleName) ? "evil" : "good";
  });
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "storyteller";
  const { handleNotesAction } = modules.actions;

  const empath = game.players[0];
  const button = (dataset, containers) => ({
    dataset: { notesAction: "apply-roleinfo-suggestion", ...dataset },
    closest: (selector) => containers[selector] || null,
  });
  handleNotesAction(button(
    { truthFill: "count=0", roleinfoRow: "0", roleinfoPhaseType: "night", roleinfoPhaseNumber: "2" },
    { ".story-night-detail": { dataset: { playerId: empath.id } } },
  ));
  assert.equal(empath.roleInfo.records.length, 1);
  assert.equal(empath.roleInfo.records[0].resultEntries[0].count, "0");

  // Seat 2 (chef) has learnt the fortune teller ability (e.g. philosopher-style acquisition).
  const chef = game.players[1];
  chef.acquiredAbilities = [{ id: "acq1", source: "storyteller", role: "占卜师", status: "active", kind: "continuous", startPhaseType: "night", startPhaseNumber: 2, endPhaseType: "", endPhaseNumber: 0, ownerRole: "厨师", sourceSeat: "", note: "", certainty: "known", records: [] }];
  const panel = { dataset: { playerId: chef.id, acquiredSource: "storyteller" } };
  handleNotesAction(button(
    { truthFill: "has_demon=yes", roleinfoRow: "0", roleinfoPhaseType: "night", roleinfoPhaseNumber: "2" },
    {
      ".notes-acquired-panel": panel,
      "[data-acquired-id]": { dataset: { acquiredId: "acq1" } },
      "[data-acquired-phase-type]": { dataset: { acquiredPhaseType: "night", acquiredPhaseNumber: "2" } },
    },
  ));
  assert.equal(chef.acquiredAbilities[0].records[0].roleInfo.resultEntries[0].has_demon, "yes");
});

test("review fixes: ties, juggler, overlays, travellers, edge targets, inferred templates", async (t) => {
  const { truth } = await loadTruth(t);

  // Shugenja tie: the backend accepts either direction the storyteller picks.
  const tieGame = makeGame({ 1: "小恶魔", 2: "共情者", 3: "厨师", 4: "投毒者", 5: "修行者" });
  for (const suggestion of compute(truth, tieGame, 5, "修行者").suggestions) {
    assert.equal(backendAccepts(tieGame, 5, "修行者", { result: suggestion.fill }), true, suggestion.label);
  }

  // Juggler: guesses on day 1, count learnt on night 2 -> the backend reads the count from the later row.
  const game = makeGame({ ...BASE, 2: "杂耍艺人" });
  const juggler = roleByName("杂耍艺人");
  const rows = [
    { phaseType: "day", phaseNumber: 1, target: { seat: "4", role: "小恶魔" }, result: {} },
    { phaseType: "day", phaseNumber: 1, target: { seat: "5", role: "间谍" }, result: {} },
  ];
  const fill = onlyFill(compute(truth, game, 2, "杂耍艺人", { phaseType: "night", phaseNumber: 2 }, rows));
  assert.deepEqual(fill, { correct_count: "1" });
  const players = game.players.map((player) => ({
    ...player,
    claim: player.seat === 2 ? juggler.name : "",
    roleInfo: player.seat === 2 ? { version: 3, roleId: juggler.id, records: [
      { phaseType: "day", phaseNumber: 1, targetEntries: rows.map((row) => row.target), resultEntries: [] },
      { phaseType: "night", phaseNumber: 2, targetEntries: [], resultEntries: [fill] },
    ] } : null,
  }));
  const { observations } = extractObservations({ ...game, scriptMode: "free", players }, { roles });
  assert.equal(observations.length, 1, "juggler observation is built");
  assert.equal(observations[0].value, 1);

  // A Marionette who believes they are the Empath has no real ability: false info is allowed.
  assert.equal(compute(truth, makeGame(BASE, { 1: { storytellerNotes: "是提线木偶" } }), 1, "共情者").misinfo, true);

  // Recluse reminder also for whole-circle templates.
  const recluseGame = makeGame({ ...BASE, 6: "陌客" });
  assert.match(compute(truth, recluseGame, 1, "钟表匠").notes.join(), /6号陌客/);
  assert.match(compute(truth, recluseGame, 2, "修行者").notes.join(), /6号陌客/);

  // A seated traveller with no alignment set is treated as good (what the inspector shows), not "unknown".
  const travellerGame = makeGame(BASE);
  travellerGame.players.push({ id: "p8", seat: 8, status: "alive", trueRole: "旅行者测试", trueAlignment: "unknown", isTraveller: true, storytellerNotes: "" });
  const chef = compute(truth, travellerGame, 2, "厨师");
  assert.equal(chef.status, "ok", chef.reason);

  // Tiefling-style target next to the actor: nothing in between.
  assert.equal(compute(truth, makeGame(), 1, "提夫林", { target: { seat: "2" } }).status, "unavailable");
  assert.match(compute(truth, makeGame(), 1, "提夫林", { target: { seat: "5" } }).reason, /须给错误信息/);

  // Librarian "no outsider" chip clears the seat/role fields.
  assert.deepEqual(onlyFill(compute(truth, makeGame(), 1, "图书管理员")), { seat1: "", seat2: "", role: "", no_outsider: "yes" });

  // Auto-inferred templates are not presented as the truth.
  const inferred = { ...roleByName("城镇公告员").abilityData, deduction: { ...roleByName("城镇公告员").abilityData.deduction, source: "inferred" } };
  assert.equal(truth.computeRoleInfoTruth({ abilityData: inferred, source: game.players[0], players: game.players, game, row: {}, resolveRole }).status, "unsupported");
});

test("strip only on rows with result inputs; a stale chip does not write", async (t) => {
  const modules = await loadTruth(t);
  const { truthRender, state, notes } = modules;
  const game = makeGame();
  const renderer = truthRender.createTruthRowRenderer({
    abilityData: roleByName("占卜师").abilityData,
    sourceRole: roleByName("占卜师"),
    source: game.players[2],
    game,
    resolveRole,
    getEntries: () => ({ target: { seat1: "4", seat2: "6" }, result: {} }),
  });
  const targetCell = { section: "target", field: { key: "seat1" } };
  const resultCell = { section: "result", field: { key: "has_demon" } };
  assert.equal(renderer({ phaseType: "night", phaseNumber: 2, entryIndex: 1, cells: [targetCell] }), "", "guess-only row");
  const html = renderer({ phaseType: "night", phaseNumber: 2, entryIndex: 0, cells: [targetCell, resultCell] });
  assert.match(html, /data-truth-fill="has_demon=yes"/);
  assert.match(html, /data-truth-basis="seat1=4&amp;seat2=6"/);

  // Real game: the stored target is 5/6 but the chip was drawn for 4/6 -> tapping writes nothing.
  state.roles = roles;
  notes.ensureNotesState();
  const live = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  live.mode = "storyteller";
  live.phaseType = "night";
  live.phaseNumber = 2;
  Object.entries(BASE).forEach(([seat, roleName]) => {
    live.players[Number(seat) - 1].trueRole = roleName;
  });
  state.notes.games = [live];
  state.notes.activeGameId = live.id;
  state.notes.ui.activeTab = "storyteller";
  const teller = live.players[2];
  modules.playerActions.updatePlayerDraftRoleInfo(teller.id, "target", 0, "seat1", "5");
  modules.playerActions.updatePlayerDraftRoleInfo(teller.id, "target", 0, "seat2", "6");
  modules.playerActions.persistPlayerDraft(teller.id);
  const tap = (basis) => modules.actions.handleNotesAction({
    dataset: { notesAction: "apply-roleinfo-suggestion", truthFill: "has_demon=yes", truthBasis: basis, roleinfoRow: "0", roleinfoPhaseType: "night", roleinfoPhaseNumber: "2" },
    closest: (selector) => (selector === ".story-night-detail" ? { dataset: { playerId: teller.id } } : null),
  });
  tap("seat1=4&seat2=6");
  assert.equal(teller.roleInfo.records[0].resultEntries?.[0]?.has_demon, undefined, "stale chip ignored");
  tap("seat1=5&seat2=6");
  assert.equal(teller.roleInfo.records[0].resultEntries[0].has_demon, "yes");
});
