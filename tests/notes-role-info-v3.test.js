const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { extractObservations } = require("../backend/deduction/observations");
const { validateDeductionGame } = require("../backend/deduction/validation");

const seatField = (key, label = key) => ({ key, type: "seat", label });
const supported = (...templates) => ({ status: "supported", source: "manual", templates });
const abilityRole = (id, name, { englishName = "", deduction, ...meta }, target, result, type = "townsfolk") => ({
  id,
  name,
  englishName,
  type,
  ability: "测试能力",
  abilityData: {
    ...(deduction ? { deduction } : {}),
    abilityMeta: { recordable: true, eventTiming: null, ...meta },
    interactionSchema: {
      target: { repeatMode: target.length ? (meta.targetMode || "sequence") : "none", defaultRows: target.length ? 3 : 0, fields: target },
      result: { repeatMode: result.length ? (meta.resultMode || "sequence") : "none", defaultRows: result.length ? 3 : 0, fields: result },
    },
  },
});

// Shapes and deduction templates copied from the built catalog (empath r005, fortune teller r006, undertaker r007, investigator r003).
const roles = [
  abilityRole("r005", "共情者", { englishName: "empath", deduction: supported({ type: "evil_count_group", group: "source_alive_neighbors", value: { source: "result", keys: ["count"] } }), phaseTiming: "each_night", usagePattern: "once_per_night" }, [], [
    { key: "count", type: "number", label: "邻座邪恶数", min: 0, max: 2 },
  ]),
  abilityRole("r006", "占卜师", { englishName: "fortune-teller", deduction: supported({ type: "demon_in_group", seats: { source: "target", keys: ["seat1", "seat2"] }, value: { source: "result", keys: ["has_demon"] } }), phaseTiming: "each_night", usagePattern: "once_per_night" },
    [seatField("seat1", "号码1"), seatField("seat2", "号码2")],
    [{ key: "has_demon", type: "boolean", label: "是否含恶魔", options: ["yes", "no"] }]),
  abilityRole("r007", "送葬者", { englishName: "undertaker", deduction: supported({ type: "role_at_day_execution", role: { source: "result", keys: ["role"] } }), phaseTiming: "each_night_star", usagePattern: "once_per_night" }, [], [
    { key: "role", type: "role", label: "处决玩家身份" },
  ]),
  abilityRole("r003", "调查员", { englishName: "investigator", deduction: supported({ type: "role_in_group", seats: { source: "result", keys: ["seat1", "seat2"] }, role: { source: "result", keys: ["role"] } }), phaseTiming: "first_night", usagePattern: "once", resultMode: "once" }, [], [
    seatField("seat1", "号码1"), seatField("seat2", "号码2"), { key: "role", type: "role", label: "身份" },
  ]),
  abilityRole("r900", "刺客测试", { phaseTiming: "each_night_star", usagePattern: "once_per_game", targetMode: "once" }, [seatField("seat")], []),
  abilityRole("r901", "守鸦测试", { phaseTiming: null, eventTiming: "on_death", usagePattern: "once", resultMode: "once" }, [], [
    { key: "role", type: "role", label: "身份" },
  ]),
  abilityRole("r902", "被动测试", { phaseTiming: "passive", usagePattern: "passive" }, [], [{ key: "note", type: "text", label: "信息" }]),
  abilityRole("r903", "白天测试", { phaseTiming: "each_day", usagePattern: "once_per_day" }, [seatField("seat")], []),
  abilityRole("r904", "查验测试", { phaseTiming: "each_night", usagePattern: "once_per_night" }, [seatField("seat")], [
    { key: "role", type: "role", label: "身份" },
  ]),
  { id: "r100", name: "小恶魔", englishName: "imp", type: "demon", ability: "", abilityData: null },
  { id: "r101", name: "投毒者", englishName: "poisoner", type: "minion", ability: "", abilityData: null },
];

async function loadFrontend(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-roleinfo-v3-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const storage = new Map();
  global.window = {
    clearTimeout,
    setTimeout,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  global.document = { querySelector: () => null };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = {
    state: (await load("state.js")).state,
    notes: await load("notes-state.js"),
    roleInfo: await load("notes/notes-role-info.js"),
    records: await load("notes/notes-role-info-records.js"),
    form: await load("notes/notes-role-info-form.js"),
    playerActions: await load("notes/notes-player-actions.js"),
    abilityRecords: await load("notes/notes-ability-records.js"),
    panel: await load("notes/notes-role-info-panel.js"),
    overview: await load("notes/notes-role-info-overview.js"),
  };
  t.after(() => {
    modules.notes.flushNotesState();
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  modules.state.roles = roles;
  modules.notes.ensureNotesState();
  return modules;
}

function createGame(modules, phaseType = "night", phaseNumber = 1) {
  const { notes, state } = modules;
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  game.phaseType = phaseType;
  game.phaseNumber = phaseNumber;
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "players";
  return game;
}

const phasesOf = (info) => info.records.map((record) => `${record.phaseType}${record.phaseNumber}`);

test("v2 role records migrate to phase-tagged v3 records without losing data", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri } = modules;
  const game = createGame(modules, "day", 4);
  const migrate = (claim, roleInfo, extra = {}) => ri.ensureRoleInfoMatchesClaim({ claim, roleInfo, ...extra }, game);

  // each_night: row i -> night i + 1; an empty middle row keeps its slot.
  const empath = migrate("共情者", { version: 2, roleId: "r005", targetEntries: [], resultEntries: [{ count: "0" }, {}, { count: "2" }] });
  assert.equal(empath.version, 3);
  assert.deepEqual(phasesOf(empath), ["night1", "night3"]);
  assert.deepEqual(empath.records[1].resultEntries, [{ count: "2" }]);

  // each_night_star starts on night 2.
  const undertaker = migrate("送葬者", { version: 2, roleId: "r007", targetEntries: [], resultEntries: [{ role: "投毒者" }, { role: "小恶魔" }] });
  assert.deepEqual(phasesOf(undertaker), ["night2", "night3"]);

  // first night ability.
  const investigator = migrate("调查员", { version: 2, roleId: "", targetEntries: [], resultEntries: [{ seat1: "2", seat2: "5", role: "投毒者" }] });
  assert.deepEqual(phasesOf(investigator), ["night1"]);
  assert.equal(investigator.roleId, "r003");

  // Paired target/result rows stay together.
  const fortune = migrate("占卜师", {
    version: 2, roleId: "r006",
    targetEntries: [{ seat1: "1", seat2: "2" }, { seat1: "3", seat2: "4" }],
    resultEntries: [{ has_demon: "no" }, { has_demon: "yes" }],
  });
  assert.deepEqual(fortune.records.map((record) => [record.phaseType, record.phaseNumber, record.targetEntries[0].seat1, record.resultEntries[0].has_demon]),
    [["night", 1, "1", "no"], ["night", 2, "3", "yes"]]);

  // Once-per-game on a flexible night and on_death abilities keep their rows with an unknown phase.
  const once = migrate("刺客测试", { version: 2, roleId: "r900", targetEntries: [{ seat: "4" }], resultEntries: [] });
  assert.deepEqual(once.records.map((record) => [record.phaseType, record.phaseNumber, record.targetEntries]), [["", 0, [{ seat: "4" }]]]);
  const death = migrate("守鸦测试", { version: 2, roleId: "r901", targetEntries: [], resultEntries: [{ role: "小恶魔" }] }, { status: "night-dead" });
  assert.deepEqual(phasesOf(death), ["0"]);

  // The legacy profile format still migrates (via v2) into v3.
  const legacy = migrate("共情者", { profile: "digit-seq", entries: [{ value: 1 }, { value: 0 }] });
  assert.deepEqual(legacy.records.map((record) => [record.phaseNumber, record.resultEntries[0].count]), [[1, 1], [2, 0]]);

  // Mismatched role resets, v3 passes through unchanged.
  assert.deepEqual(migrate("共情者", { version: 2, roleId: "r006", targetEntries: [{ seat1: "1" }], resultEntries: [] }).records, []);
  assert.deepEqual(migrate("共情者", empath).records, empath.records);

  // Every filled v2 row survives.
  const filled = (rows) => rows.filter((row) => Object.values(row).some((value) => String(value).trim())).length;
  assert.equal(ri.getRoleInfoRows(empath).length, filled([{ count: "0" }, {}, { count: "2" }]));
});

test("form rows follow phases, deaths and timing instead of row numbers", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri, form } = modules;
  const build = (claim, phaseType, phaseNumber, player = {}) => {
    const game = { phaseType, phaseNumber };
    const subject = { claim, status: "alive", ...player };
    return form.buildRoleInfoForm({
      abilityData: ri.getRoleAbilityData(subject, game),
      roleInfo: ri.ensureRoleInfoMatchesClaim(subject, game),
      player: subject,
      game,
    });
  };
  const labels = (model) => model.rows.map((row) => row.label);

  assert.deepEqual(labels(build("共情者", "night", 1)), ["第 1 夜"]);
  assert.deepEqual(labels(build("共情者", "day", 2)), ["第 1 夜", "第 2 夜"]);
  assert.deepEqual(labels(build("送葬者", "night", 1)), []);
  assert.equal(build("送葬者", "day", 1).emptyReason, "未到记录时机。");
  assert.deepEqual(labels(build("送葬者", "night", 3)), ["第 2 夜", "第 3 夜"]);
  assert.deepEqual(labels(build("调查员", "night", 4)), ["第 1 夜"]);
  assert.deepEqual(labels(build("白天测试", "night", 2)), ["第 1 天"]);
  assert.deepEqual(labels(build("白天测试", "day", 2)), ["第 1 天", "第 2 天"]);
  // Once-per-game: every eligible night is offered until one is filled.
  assert.deepEqual(labels(build("刺客测试", "night", 3)), ["第 2 夜", "第 3 夜"]);
  const used = { version: 3, roleId: "r900", records: [{ phaseType: "night", phaseNumber: 2, targetEntries: [{ seat: "4" }], resultEntries: [] }] };
  assert.deepEqual(labels(build("刺客测试", "night", 4, { roleInfo: used })), ["第 2 夜"]);
  // on_death appears once the player is dead, on the night they died.
  assert.equal(build("守鸦测试", "night", 2).emptyReason, "死亡后可录入。");
  assert.deepEqual(labels(build("守鸦测试", "day", 2, { status: "night-dead" })), ["第 2 夜"]);
  // Untimed abilities record on the current phase.
  assert.deepEqual(labels(build("被动测试", "day", 3)), ["第 3 天"]);

  // A player who died mid-game keeps the nights they recorded and gets no new empty nights.
  const v2 = { version: 2, roleId: "r005", targetEntries: [], resultEntries: [{ count: "1" }, { count: "0" }] };
  const dead = build("共情者", "day", 4, { status: "night-dead", roleInfo: v2 });
  assert.deepEqual(labels(dead), ["第 1 夜", "第 2 夜"]);
  assert.deepEqual(dead.rows.map((row) => row.cells[0].value), ["1", "0"]);
  const alive = build("共情者", "night", 3, { roleInfo: v2 });
  assert.deepEqual(labels(alive), ["第 1 夜", "第 2 夜", "第 3 夜"]);
  assert.equal(build("共情者", "night", 3, { status: "executed" }).emptyReason, "已死亡，不再自动新增。");

  // Renderers use the phase labels and address inputs by phase.
  const game = createGame(modules, "night", 2);
  const player = game.players[0];
  player.claim = "共情者";
  player.roleInfo = v2;
  const panel = modules.panel.renderRoleInfoInputs(player, game);
  assert.match(panel, /第 2 夜/);
  assert.match(panel, /data-roleinfo-phase-type="night" data-roleinfo-phase-number="2"/);
  assert.match(modules.overview.renderOverviewRoleInfoInputs(player, game), /第 1 夜/);
});

test("edits land on their own phase, saves keep v3 and timeline items are not duplicated", async (t) => {
  const modules = await loadFrontend(t);
  const { notes, playerActions, state } = modules;
  const game = createGame(modules, "night", 1);
  const player = game.players[2];
  player.claim = "占卜师";

  const edit = (section, field, value, phase) => playerActions.updatePlayerDraftRoleInfo(player.id, section, 0, field, value, phase);
  assert.equal(edit("target", "seat1", "1", { phaseType: "night", phaseNumber: 1 }), true);
  assert.equal(edit("target", "seat2", "2", { phaseType: "night", phaseNumber: 1 }), true);
  assert.equal(edit("result", "has_demon", "no", { phaseType: "night", phaseNumber: 2 }), false, "future phase rejected");
  playerActions.savePlayerDraft(player.id);
  assert.equal(player.roleInfo.version, 3);
  assert.deepEqual(phasesOf(player.roleInfo), ["night1"]);

  // Advance to night 3 and record night 3 plus a late night 2 entry.
  game.phaseType = "night";
  game.phaseNumber = 3;
  edit("target", "seat1", "3", { phaseType: "night", phaseNumber: 3 });
  playerActions.cyclePlayerDraftRoleInfoField(player.id, "result", 0, "has_demon", { phaseType: "night", phaseNumber: 3 });
  edit("target", "seat1", "5", { phaseType: "night", phaseNumber: 2 });
  playerActions.savePlayerDraft(player.id);
  assert.deepEqual(phasesOf(player.roleInfo), ["night1", "night2", "night3"]);
  assert.equal(player.roleInfo.records[2].resultEntries[0].has_demon, "yes");

  // Save again on day 3: nothing should be copied into later days.
  game.phaseType = "day";
  playerActions.updatePlayerField(player.id, "name", "小明");
  playerActions.savePlayerDraft(player.id);
  const itemsByDay = Object.fromEntries(game.dayRecords.map((day) => [
    day.dayNumber,
    day.abilityRecords.filter((item) => item.playerId === player.id).map((item) => `${item.phaseType}:${item.text}`),
  ]));
  assert.deepEqual(itemsByDay[1], ["night:目标 1,2"]);
  assert.deepEqual(itemsByDay[2], ["night:目标 5"]);
  assert.deepEqual(itemsByDay[3], ["night:目标 3 / 结果 是"]);

  // Duplicates written by the previous version are cleaned up on the next sync.
  game.dayRecords.find((day) => day.dayNumber === 3).abilityRecords.push({
    id: "player:day:legacy", source: "player", phaseType: "day", order: 1, playerId: player.id, seat: "3",
    playerName: "", roleId: "r006", roleName: "占卜师", rowIndex: 1, text: "目标 1,2", updatedAt: "",
  });
  modules.abilityRecords.syncAbilityRecordsForPlayer(game, player, "player");
  assert.equal(game.dayRecords.find((day) => day.dayNumber === 3).abilityRecords.filter((item) => item.playerId === player.id).length, 1);

  // Export and import round trip keeps the v3 records.
  const backup = JSON.parse(JSON.stringify(notes.createActiveGameBackup()));
  notes.importNotesBackup(backup);
  const imported = notes.getActiveGame().players.find((item) => item.seat === player.seat);
  assert.deepEqual(imported.roleInfo, player.roleInfo);

  // An old v2 backup is migrated on read.
  const oldBackup = JSON.parse(JSON.stringify(backup));
  oldBackup.game.players[2].roleInfo = { version: 2, roleId: "r006", targetEntries: [{ seat1: "1", seat2: "2" }], resultEntries: [{ has_demon: "no" }] };
  notes.importNotesBackup(oldBackup);
  const oldGame = notes.getActiveGame();
  const oldPlayer = oldGame.players[2];
  assert.equal(oldPlayer.roleInfo.version, 2, "stored format is kept until the player is edited");
  assert.deepEqual(phasesOf(modules.roleInfo.ensureRoleInfoMatchesClaim(oldPlayer, oldGame)), ["night1"]);
  state.notes.ui.activeTab = "overview";
  playerActions.updatePlayerField(oldPlayer.id, "name", "旧数据");
  playerActions.persistPlayerDraft(oldPlayer.id);
  assert.equal(oldPlayer.roleInfo.version, 3);
  assert.equal(oldPlayer.roleInfo.records[0].resultEntries[0].has_demon, "no");
});

test("storyteller mode records the current night and autofills from the true role", async (t) => {
  const modules = await loadFrontend(t);
  const { playerActions, state, roleInfo: ri } = modules;
  const game = createGame(modules, "night", 2);
  game.mode = "storyteller";
  state.notes.ui.activeTab = "storyteller";
  const checker = game.players[0];
  checker.trueRole = "查验测试";
  checker.claim = "共情者";
  game.players[3].trueRole = "投毒者";

  assert.equal(playerActions.updatePlayerDraftRoleInfo(checker.id, "target", 0, "seat", "4"), true, "defaults to the current phase");
  assert.equal(playerActions.autoFillStorytellerRoleInfoResult(checker.id), true);
  playerActions.persistPlayerDraft(checker.id);
  assert.deepEqual(checker.roleInfo.records, [{ phaseType: "night", phaseNumber: 2, targetEntries: [{ seat: "4" }], resultEntries: [{ role: "投毒者" }] }]);
  assert.equal(ri.ensureRoleInfoMatchesClaim({ ...checker, claim: checker.trueRole }, game).roleId, "r904");
  const day2 = game.dayRecords.find((day) => day.dayNumber === 2);
  assert.deepEqual(day2.abilityRecords.map((item) => [item.source, item.phaseType, item.text]), [["storyteller", "night", "目标 4 / 结果 投毒"]]);
});

test("deduction reads v3 records and matches the observations of the v2 data it replaced", async (t) => {
  const modules = await loadFrontend(t);
  const catalog = { roles };
  const makeGame = (players) => ({
    playerCount: 7,
    phaseType: "day",
    phaseNumber: 3,
    players: Array.from({ length: 7 }, (_, index) => ({ id: `p${index + 1}`, seat: index + 1, status: "alive", claim: "", ...(players[index + 1] || {}) })),
    timeline: [],
    dayRecords: [
      { dayNumber: 1, nominations: [], executionOverride: "4", abilityRecords: [] },
      { dayNumber: 2, nominations: [], executionOverride: "6", abilityRecords: [] },
    ],
  });
  const v2Players = {
    1: { claim: "共情者", roleInfo: { version: 2, roleId: "r005", targetEntries: [], resultEntries: [{ count: "1" }, {}, { count: "0" }] } },
    2: { claim: "占卜师", roleInfo: { version: 2, roleId: "r006", targetEntries: [{ seat1: "3", seat2: "4" }, { seat1: "5", seat2: "6" }], resultEntries: [{ has_demon: "no" }, { has_demon: "yes" }] } },
    3: { claim: "送葬者", roleInfo: { version: 2, roleId: "r007", targetEntries: [], resultEntries: [{ role: "投毒者" }, { role: "小恶魔" }] } },
    5: { claim: "调查员", roleInfo: { version: 2, roleId: "r003", targetEntries: [], resultEntries: [{ seat1: "4", seat2: "7", role: "投毒者" }] } },
  };
  const v2Game = makeGame(v2Players);
  const v3Players = Object.fromEntries(Object.entries(v2Players).map(([seat, player]) => [
    seat,
    { ...player, roleInfo: modules.roleInfo.ensureRoleInfoMatchesClaim(player, v2Game) },
  ]));
  const v3Game = makeGame(v3Players);
  assert.deepEqual(validateDeductionGame(v2Game), []);
  assert.deepEqual(validateDeductionGame(v3Game), []);

  const semantic = (game) => extractObservations(game, catalog).observations
    .map(({ id, rowIndex, ...rest }) => rest)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const before = semantic(v2Game);
  assert.ok(before.length >= 5);
  assert.deepEqual(semantic(v3Game), before);
  assert.ok(before.some((item) => item.kind === "role_at_day_execution" && item.dayNumber === 2 && item.targetSeat === 6));

  // v3 records that skip a night keep the right day for the undertaker.
  const skipped = makeGame({ 3: { claim: "送葬者", roleInfo: { version: 3, roleId: "r007", records: [{ phaseType: "night", phaseNumber: 3, targetEntries: [], resultEntries: [{ role: "小恶魔" }] }] } } });
  const [undertaker] = extractObservations(skipped, catalog).observations;
  assert.equal(undertaker.dayNumber, 2);
  assert.equal(undertaker.targetSeat, 6);

  // Validation bounds v3 rows as well.
  const oversized = makeGame({ 1: { claim: "共情者", roleInfo: { version: 3, records: Array.from({ length: 31 }, (_, index) => ({ phaseType: "night", phaseNumber: index + 1, targetEntries: [], resultEntries: [{ count: "1" }] })) } } });
  assert.match(validateDeductionGame(oversized).join("\n"), /roleInfo/);
  assert.match(validateDeductionGame(makeGame({ 1: { roleInfo: { version: 3, records: "x" } } })).join("\n"), /records/);
});

test("seat fields render as seat selects and role fields as grouped selects with a search fallback", async (t) => {
  const modules = await loadFrontend(t);
  const { state } = modules;
  const game = createGame(modules, "night", 2);
  game.players[0].name = "阿杰";
  game.players[1].status = "night-dead";
  const player = game.players[2];
  player.claim = "占卜师";
  player.roleInfo = { version: 3, roleId: "r006", records: [{ phaseType: "night", phaseNumber: 1, targetEntries: [{ seat1: "1", seat2: "9" }], resultEntries: [] }] };

  const panel = modules.panel.renderRoleInfoInputs(player, game);
  assert.doesNotMatch(panel, /type="number"[^>]*data-roleinfo-field="seat1"/);
  assert.match(panel, /<option value="1" selected>1号 阿杰<\/option>/);
  assert.match(panel, /<option value="2">2号（死）<\/option>/);
  assert.match(panel, /<option value="9" selected>9<\/option>/, "out-of-range stored seat is kept");

  const checker = game.players[3];
  checker.claim = "送葬者";
  const grouped = modules.panel.renderRoleInfoInputs(checker, game);
  assert.match(grouped, /<optgroup label="镇民">/);
  assert.match(grouped, /<optgroup label="恶魔">[\s\S]*<option value="小恶魔">小恶魔<\/option>/);
  assert.doesNotMatch(grouped, /list="roleNameList"/);

  state.roles = [...roles, ...Array.from({ length: 90 }, (_, index) => ({ id: `x${index}`, name: `填充${index}`, type: "townsfolk", ability: "", abilityData: null }))];
  const searchable = modules.panel.renderRoleInfoInputs(checker, game);
  assert.match(searchable, /list="roleNameList"[\s\S]*data-roleinfo-field="role"/);
  state.roles = roles;
});
