const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("acquired abilities preserve identity, phased history, drafts, backups and source separation", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-acquired-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const storage = new Map();
  global.window = { clearTimeout, setTimeout, localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  } };
  global.document = { querySelector: () => null };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const { state } = await load("state.js");
  const notes = await load("notes-state.js");
  const actions = await load("notes/notes-acquired-actions.js");
  const playerActions = await load("notes/notes-player-actions.js");
  const model = await load("notes/notes-acquired-abilities.js");
  const { renderAcquiredAbilities } = await load("notes/notes-acquired-render.js");
  t.after(() => {
    notes.flushNotesState();
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const role = (id, name, result, target = []) => ({
    id, name, type: "townsfolk", ability: "测试能力",
    abilityData: {
      abilityMeta: { recordable: true, phaseTiming: "each_night", usagePattern: "once_per_night" },
      interactionSchema: {
        target: { repeatMode: target.length ? "sequence" : "none", defaultRows: target.length ? 1 : 0, fields: target },
        result: { repeatMode: "sequence", defaultRows: 3, fields: result },
      },
    },
  });
  state.roles = [
    role("philosopher", "哲学家", []), role("pixie", "小精灵", []), role("cannibal", "食人族", []),
    role("empath", "共情者", [{ key: "count", type: "number", label: "数量" }]),
    role("fortune", "占卜师", [{ key: "answer", type: "boolean", label: "结果" }], [
      { key: "first", type: "seat", label: "玩家一" }, { key: "second", type: "seat", label: "玩家二" },
    ]),
  ];
  notes.ensureNotesState();
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 5 });
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "players";
  const player = game.players[0];
  player.claim = "哲学家";
  const ability = actions.addAcquiredAbility(player.id);
  assert.equal(ability.status, "pending");
  actions.updateAcquiredAbility(player.id, "player", ability.id, "role", "占卜师");
  assert.equal(actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 1, "result", 0, "answer", "yes"), false);
  game.phaseNumber = 2;
  actions.updateAcquiredAbility(player.id, "player", ability.id, "status", "active");
  assert.equal(ability.startPhaseNumber, 2);
  assert.equal((renderAcquiredAbilities(notes.getPlayerDraft(player.id), game).match(/data-notes-action="cycle-roleinfo-field"/g) || []).length, 1);
  actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 2, "target", 0, "first", "2");
  actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 2, "target", 0, "second", "5");
  actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 2, "result", 0, "answer", "", true);
  assert.equal(actions.updateAcquiredAbility(player.id, "player", ability.id, "role", "共情者"), false);
  assert.equal(actions.updateAcquiredAbility(player.id, "player", ability.id, "status", "pending"), false);
  playerActions.savePlayerDraft(player.id);
  assert.equal(player.claim, "哲学家");
  assert.equal(player.acquiredAbilities[0].records[0].roleInfo.resultEntries[0].answer, "yes");
  assert.equal(game.dayRecords.find((day) => day.dayNumber === 2).abilityRecords.filter((item) => item.acquiredAbilityId).length, 1);

  // Cancelled edits must not mutate the persisted nested records.
  actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 2, "result", 0, "answer", "no");
  notes.clearPlayerDraft(player.id);
  assert.equal(player.acquiredAbilities[0].records[0].roleInfo.resultEntries[0].answer, "yes");
  game.phaseNumber = 3;
  actions.updateAcquiredRecord(player.id, "player", ability.id, "night", 3, "result", 0, "answer", "no");
  playerActions.persistPlayerDraft(player.id);
  assert.equal(player.acquiredAbilities[0].records.length, 2);
  assert.equal(game.dayRecords.find((day) => day.dayNumber === 2).abilityRecords.filter((item) => item.acquiredAbilityId).length, 1);
  assert.equal(game.dayRecords.find((day) => day.dayNumber === 3).abilityRecords.filter((item) => item.acquiredAbilityId).length, 1);

  const pixie = game.players[1];
  pixie.claim = "小精灵";
  const pending = actions.addAcquiredAbility(pixie.id);
  actions.updateAcquiredAbility(pixie.id, "player", pending.id, "role", "共情者");
  const pendingDraft = notes.getPlayerDraft(pixie.id);
  assert.match(model.getAcquiredAbilitySummary(pendingDraft, game), /待获得共情者/);
  assert.doesNotMatch(renderAcquiredAbilities(pendingDraft, game), /data-acquired-phase-type=/);
  actions.updateAcquiredAbility(pixie.id, "player", pending.id, "status", "active");
  assert.match(renderAcquiredAbilities(pendingDraft, game), /data-roleinfo-field="count"/);

  const cannibal = game.players[2];
  cannibal.claim = "食人族";
  const first = actions.addAcquiredAbility(cannibal.id);
  assert.equal(first.kind, "replaceable");
  assert.equal(first.certainty, "unknown");
  actions.updateAcquiredAbility(cannibal.id, "player", first.id, "role", "共情者");
  assert.equal(first.certainty, "suspected");
  actions.updateAcquiredAbility(cannibal.id, "player", first.id, "status", "active");
  actions.updateAcquiredRecord(cannibal.id, "player", first.id, "night", 3, "result", 0, "count", "1");
  game.phaseNumber = 4;
  const second = actions.addAcquiredAbility(cannibal.id);
  assert.equal(first.status, "active", "a pending replacement must not end the existing ability");
  actions.updateAcquiredAbility(cannibal.id, "player", second.id, "role", "占卜师");
  actions.updateAcquiredAbility(cannibal.id, "player", second.id, "status", "active");
  assert.equal(first.status, "ended");
  assert.equal(first.endPhaseNumber, 4);
  assert.equal(first.records[0].roleInfo.resultEntries[0].count, "1");
  assert.equal(model.isAcquiredAbilityActive(first, game), false);
  assert.equal(model.isAcquiredAbilityActive(first, { phaseType: "night", phaseNumber: 3 }), true);
  assert.equal(actions.updateAcquiredRecord(cannibal.id, "player", first.id, "night", 4, "result", 0, "count", "2"), false);
  playerActions.savePlayerDraft(cannibal.id);
  const historic = game.dayRecords.find((day) => day.dayNumber === 3).abilityRecords.find((item) => item.acquiredAbilityId === first.id);
  assert.match(historic.roleName, /食人族 · 共情者（推测）/);
  assert.match(historic.text, /1/);

  // Storyteller abilities never appear in the player ability panel or summary.
  assert.equal(actions.addAcquiredAbility(player.id, "storyteller"), null);
  game.mode = "storyteller";
  state.notes.ui.activeTab = "storyteller";
  player.trueRole = "哲学家";
  const actual = actions.addAcquiredAbility(player.id, "storyteller");
  actions.updateAcquiredAbility(player.id, "storyteller", actual.id, "role", "共情者");
  actions.updateAcquiredAbility(player.id, "storyteller", actual.id, "status", "active");
  playerActions.persistPlayerDraft(player.id);
  assert.doesNotMatch(model.getAcquiredAbilitySummary(player, game), /共情者/);
  assert.match(model.getAcquiredAbilitySummary(player, game, "storyteller"), /共情者/);
  assert.doesNotMatch(renderAcquiredAbilities(player, game), new RegExp(`data-acquired-id="${actual.id}"`));

  notes.saveNotesState({ immediate: true });
  const backup = notes.createActiveGameBackup();
  state.notes.loaded = false;
  const restored = notes.ensureNotesState().games[0];
  assert.deepEqual(restored.players[0].acquiredAbilities, player.acquiredAbilities);
  assert.ok(restored.dayRecords.some((day) => day.abilityRecords.some((item) => item.acquiredAbilityId === first.id)));
  notes.importNotesBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(notes.getActiveGame().players[2].acquiredAbilities, cannibal.acquiredAbilities);
  notes.importNotesBackup({ players: [{ claim: "哲学家" }] });
  assert.deepEqual(notes.getActiveGame().players[0].acquiredAbilities, []);
});
