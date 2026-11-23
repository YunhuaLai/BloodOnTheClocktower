const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const seatField = (key, label = key) => ({ key, type: "seat", label });
const abilityRole = (id, name, meta, target, result, extra = {}) => ({
  id,
  name,
  englishName: name,
  type: "townsfolk",
  ability: "测试能力",
  ...extra,
  abilityData: {
    abilityMeta: { recordable: true, eventTiming: null, ...meta },
    interactionSchema: {
      target: { repeatMode: target.length ? "sequence" : "none", defaultRows: 0, fields: target },
      result: { repeatMode: result.length ? (meta.resultMode || "sequence") : "none", defaultRows: 0, fields: result },
    },
    ...(extra.abilityData || {}),
  },
});

const roles = [
  abilityRole("r005", "共情者", { phaseTiming: "each_night", usagePattern: "once_per_night" }, [], [
    { key: "count", type: "number", label: "邻座邪恶数", min: 0, max: 2 },
  ]),
  abilityRole("r006", "占卜师", { phaseTiming: "each_night", usagePattern: "once_per_night" },
    [seatField("seat1"), seatField("seat2")],
    [{ key: "has_demon", type: "boolean", label: "是否含恶魔", options: ["yes", "no"] }]),
  abilityRole("r007", "送葬者", { phaseTiming: "each_night_star", usagePattern: "once_per_night" }, [], [
    { key: "role", type: "role", label: "处决玩家身份" },
  ]),
  abilityRole("r900", "刺客测试", { phaseTiming: "each_night_star", usagePattern: "once_per_game" }, [seatField("seat")], []),
  abilityRole("r901", "守鸦测试", { phaseTiming: null, eventTiming: "on_death", usagePattern: "once", resultMode: "once" }, [], [
    { key: "role", type: "role", label: "身份" },
  ]),
  abilityRole("r902", "白天测试", { phaseTiming: "each_day", usagePattern: "once_per_day" }, [seatField("seat")], []),
  abilityRole("r910", "哲学家", { phaseTiming: "each_night", usagePattern: "once_per_game" }, [], [], {
    ability: "每局游戏限一次，在夜晚时，你可以选择一个善良角色：你获得该角色的能力。如果这个角色在场，他会醉酒。",
  }),
  { id: "r100", name: "小恶魔", englishName: "imp", type: "demon", ability: "", abilityData: null },
];

async function loadFrontend(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-roleinfo-display-"));
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
    fields: await load("notes/notes-role-info-fields.js"),
    panel: await load("notes/notes-role-info-panel.js"),
    overview: await load("notes/notes-overview-render.js"),
    abilityRecords: await load("notes/notes-ability-records.js"),
    playerActions: await load("notes/notes-player-actions.js"),
    playerUiActions: await load("notes/notes-player-ui-actions.js"),
    abilityMeta: await load("ability-meta.js"),
    catalog: await load("catalog-helpers.js"),
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

const nightRecord = (phaseNumber, targetEntries, resultEntries, phaseType = "night") => ({ phaseType, phaseNumber, targetEntries, resultEntries });

test("summaries tag every record with its phase, as plain text and as structured items", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri, records } = modules;
  const game = createGame(modules, "day", 2);

  assert.equal(records.formatRoleInfoPhaseShortLabel("night", 1), "N1");
  assert.equal(records.formatRoleInfoPhaseShortLabel("day", 2), "D2");
  assert.equal(records.formatRoleInfoPhaseShortLabel("", 0), "");
  assert.equal(records.formatRoleInfoPhaseLabel("night", 1), "第 1 夜");

  const fortune = {
    claim: "占卜师",
    status: "alive",
    roleInfo: {
      version: 3,
      roleId: "r006",
      records: [
        nightRecord(2, [{ seat1: "2", seat2: "4" }], [{ has_demon: "no" }]),
        nightRecord(1, [{ seat1: "3", seat2: "5" }], [{ has_demon: "yes" }]),
      ],
    },
  };
  const data = ri.getRoleInfoSummaryData(fortune, game);
  assert.deepEqual(
    data.items.map((item) => [item.phase, item.phaseTitle, item.text]),
    [["N1", "第 1 夜", "3,5→是"], ["N2", "第 2 夜", "2,4→否"]],
  );
  assert.equal(data.total, 2);
  assert.equal(data.hiddenCount, 0);
  assert.equal(ri.getRoleInfoSummary(fortune, game), "N1 3,5→是，N2 2,4→否");

  // Result-only and target-only rows have no arrow; unknown phases use the event label or "?".
  const empath = { claim: "共情者", roleInfo: { version: 3, roleId: "r005", records: [nightRecord(1, [], [{ count: "1" }])] } };
  assert.equal(ri.getRoleInfoSummary(empath, game), "N1 1");
  const raven = { claim: "守鸦测试", status: "night-dead", roleInfo: { version: 3, roleId: "r901", records: [nightRecord(0, [], [{ role: "小恶魔" }], "")] } };
  const ravenItem = ri.getRoleInfoSummaryData(raven, game).items[0];
  assert.deepEqual([ravenItem.phase, ravenItem.phaseTitle], ["死亡时", "死亡时"]);
  const assassin = { claim: "刺客测试", roleInfo: { version: 3, roleId: "r900", records: [nightRecord(0, [{ seat: "4" }], [], "")] } };
  assert.equal(ri.getRoleInfoSummary(assassin, game), "? 4");

  // Nothing recorded / no recordable role.
  assert.equal(ri.getRoleInfoSummary({ claim: "共情者" }, game), "--");
  assert.equal(ri.getRoleInfoSummary({ claim: "小恶魔" }, game), "--");

  // The timeline and the summary share the same row formatter.
  assert.equal(ri.formatRoleInfoPairText("3,5", "是"), "3,5→是");
  assert.equal(ri.formatRoleInfoPairText("3,5", "是", { target: "目标", result: "结果" }), "目标 3,5 / 结果 是");
  assert.equal(ri.formatRoleInfoPairText("", "是", { target: "目标", result: "结果" }), "结果 是");
  const player = game.players[0];
  Object.assign(player, fortune);
  modules.abilityRecords.syncAbilityRecordsForPlayer(game, player, "player");
  const texts = game.dayRecords.flatMap((day) => day.abilityRecords.map((item) => item.text));
  assert.deepEqual(texts.sort(), ["目标 2,4 / 结果 否", "目标 3,5 / 结果 是"]);
});

test("long summaries keep the latest records and report the total", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri, overview } = modules;
  const game = createGame(modules, "day", 5);
  const player = {
    claim: "共情者",
    status: "alive",
    roleInfo: { version: 3, roleId: "r005", records: [1, 2, 3, 4, 5].map((n) => nightRecord(n, [], [{ count: String(n % 3) }])) },
  };

  const data = ri.getRoleInfoSummaryData(player, game);
  assert.equal(ri.ROLE_INFO_SUMMARY_LIMIT, 3);
  assert.deepEqual(data.items.map((item) => item.phase), ["N3", "N4", "N5"]);
  assert.equal(data.total, 5);
  assert.equal(data.hiddenCount, 2);
  assert.equal(ri.getRoleInfoSummary(player, game), "N3 0，N4 1，N5 2（共 5 条）");
  assert.equal(ri.getRoleInfoSummaryData(player, game, { limit: 0 }).items.length, 5);
  assert.equal(ri.getRoleInfoSummary(player, game, { limit: 0 }), "N1 1，N2 2，N3 0，N4 1，N5 2");

  const html = overview.renderOverviewSummary(player, game);
  assert.match(html, /notes-summary-tag--more">共 5 条</);
  assert.equal((html.match(/class="notes-summary-tag"/g) || []).length, 3);
  assert.match(html, /title="第 5 夜"/);
  assert.match(html, /<b>N5<\/b>2/);
  assert.equal(overview.renderOverviewSummary({ claim: "共情者" }, game), "--");
});

test("the saved update line keeps every record and its own separators", async (t) => {
  const modules = await loadFrontend(t);
  const game = createGame(modules, "day", 5);
  const player = game.players[0];
  Object.assign(player, {
    claim: "共情者",
    roleInfo: { version: 3, roleId: "r005", records: [1, 2, 3, 4, 5].map((n) => nightRecord(n, [], [{ count: String(n % 3) }])) },
  });
  modules.playerActions.ensurePlayerDraftForId(player.id);
  modules.playerActions.savePlayerDraft(player.id);
  const text = game.timeline[0].text;
  assert.match(text, /；信息 N1 1，N2 2，N3 0，N4 1，N5 2；/);
  assert.doesNotMatch(text, /共 5 条/);
});

test("acquired abilities are summarised with the same phase tags", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri, overview } = modules;
  const game = createGame(modules, "night", 3);
  const player = {
    claim: "哲学家",
    status: "alive",
    acquiredAbilities: [{
      id: "acq-1",
      source: "player",
      ownerRole: "哲学家",
      role: "共情者",
      status: "active",
      certainty: "known",
      kind: "continuous",
      startPhaseType: "night",
      startPhaseNumber: 2,
      endPhaseType: "",
      endPhaseNumber: 0,
      records: [
        { phaseType: "night", phaseNumber: 2, roleInfo: { targetEntries: [], resultEntries: [{ count: "0" }] } },
        { phaseType: "night", phaseNumber: 3, roleInfo: { targetEntries: [], resultEntries: [{ count: "2" }] } },
      ],
    }],
  };

  const data = ri.getRoleInfoSummaryData(player, game);
  assert.deepEqual(data.items, []);
  assert.deepEqual(data.acquiredItems.map((item) => [item.roleName, item.phase, item.text]), [["共情者", "N3", "2"]]);
  assert.equal(ri.getRoleInfoSummary(player, game), "能力：共情者 · 共情者 N3 2");
  assert.match(overview.renderOverviewSummary(player, game), /notes-summary-tag--acquired/);
});

test("abilities that cannot be recorded yet show a greyed placeholder row without inputs", async (t) => {
  const modules = await loadFrontend(t);
  const { roleInfo: ri, form, fields } = modules;
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

  // "每晚*" on the first night: next chance is night 2.
  const undertaker = build("送葬者", "night", 1);
  assert.deepEqual(undertaker.rows, []);
  assert.deepEqual(undertaker.pending, { phaseType: "night", phaseNumber: 2, label: "第 2 夜", text: "第 2 夜起可录入" });
  assert.equal(undertaker.emptyReason, "未到记录时机。");
  // Once per game from night 2.
  assert.equal(build("刺客测试", "day", 1).pending.label, "第 2 夜");
  // Every placeholder label fits the narrow phase column: no longer than "第 2 夜" (3 characters without spaces).
  for (const model of [build("送葬者", "night", 1), build("守鸦测试", "night", 3), build("共情者", "night", 3, { status: "executed" })]) {
    assert.ok(model.pending.label.replace(/\s/g, "").length <= 3, model.pending.label);
  }
  // Each day during night 1.
  assert.equal(build("白天测试", "night", 1).pending.text, "第 1 天起可录入");
  // on_death while alive, nightly ability after death.
  assert.deepEqual(build("守鸦测试", "night", 3).pending, { phaseType: "", phaseNumber: 0, label: "死亡后", text: "死亡后可录入" });
  assert.equal(build("共情者", "night", 3, { status: "executed" }).pending.label, "已死亡");
  // Rows available -> no placeholder.
  assert.equal(build("送葬者", "night", 2).pending, null);
  assert.equal(build("守鸦测试", "day", 2, { status: "night-dead" }).pending, null);

  const html = fields.renderRoleInfoForm(undertaker, { game: { phaseType: "night", phaseNumber: 1 } });
  assert.match(html, /notes-roleinfo-row--pending/);
  assert.match(html, /第 2 夜起可录入/);
  assert.doesNotMatch(html, /<input|<select|<button/);

  // Storyteller (current phase) and acquired forms never carry a placeholder.
  const storyteller = form.buildRoleInfoForm({
    abilityData: ri.getRoleAbilityData({ claim: "送葬者" }, {}),
    roleInfo: { version: 3, roleId: "r007", records: [] },
    player: { status: "alive" },
    game: { phaseType: "night", phaseNumber: 2 },
    scope: "current",
  });
  assert.equal(storyteller.pending, null);
  const acquired = form.buildAcquiredRecordForm({
    abilityData: ri.getRoleAbilityData({ claim: "共情者" }, {}),
    record: { phaseType: "night", phaseNumber: 2, roleInfo: {} },
    game: { phaseType: "night", phaseNumber: 2 },
  });
  assert.equal(acquired.pending, null);
});

test("detail panel shows the ability text instead of repeating the tags", async (t) => {
  const modules = await loadFrontend(t);
  const game = createGame(modules, "night", 1);
  const html = modules.panel.renderRoleInfoInputs({ id: "p1", claim: "送葬者", status: "alive" }, game);
  assert.match(html, /<p class="notes-roleinfo-ability">测试能力<\/p>/);
  assert.doesNotMatch(html, /只记结果 \/|选择并记录 \//);
  assert.match(html, /第 2 夜起可录入/);

  // Long texts get a toggle; the clamp itself is CSS for narrow screens only.
  const longText = roles.find((role) => role.id === "r910").ability;
  const collapsed = modules.panel.renderRoleAbilityText(longText);
  assert.match(collapsed, /class="notes-roleinfo-ability notes-roleinfo-ability--long"/);
  assert.match(collapsed, /data-notes-action="toggle-ability-text"[\s\S]*aria-expanded="false"[\s\S]*展开全文/);
  assert.doesNotMatch(collapsed, /<details/);
  const expanded = modules.panel.renderRoleAbilityText(longText, true);
  assert.match(expanded, /notes-roleinfo-ability--long is-expanded/);
  assert.match(expanded, /aria-expanded="true"[\s\S]*收起/);
  assert.equal(modules.panel.renderRoleAbilityText(""), "");

  // The expanded state lives in notes.ui, so it survives the re-render after every field edit.
  const { state } = modules;
  assert.equal(state.notes.ui.abilityTextExpanded, false);
  const philosopher = { id: "p2", claim: "哲学家", status: "alive" };
  assert.match(modules.panel.renderRoleInfoInputs(philosopher, game), /aria-expanded="false"/);
  state.notes.ui.abilityTextExpanded = true;
  assert.match(modules.panel.renderRoleInfoInputs(philosopher, game), /is-expanded[\s\S]*aria-expanded="true"/);
});

test("encyclopedia ability tags come from abilityMeta and flag unreviewed classifications", async (t) => {
  const modules = await loadFrontend(t);
  const { abilityMeta, catalog } = modules;
  const empathData = {
    tags: ["每晚", "信息型", "数字"],
    abilitySemantics: { reviewStatus: "source_changed", confidence: 0.45 },
    abilityMeta: { phaseTiming: "each_night", eventTiming: null, usagePattern: "once_per_night", activationMode: "passive" },
  };
  const result = abilityMeta.getAbilityMetaTags(empathData);
  assert.deepEqual(result.tags.map((tag) => [tag.kind, tag.label]), [
    ["timing", "每晚"],
    ["usage", "每晚一次"],
    ["activation", "被动"],
    ["tag", "信息型"],
    ["tag", "数字"],
  ]);
  assert.equal(result.reviewed, false);
  assert.equal(result.hint, "自动识别，可能有误");

  // Event timing wins over phase timing; duplicate labels are dropped; reviewed data has no hint.
  const reviewed = abilityMeta.getAbilityMetaTags({
    abilitySemantics: { reviewStatus: "reviewed" },
    abilityMeta: { phaseTiming: "passive", eventTiming: "on_death", usagePattern: "passive", activationMode: "passive" },
  });
  assert.deepEqual(reviewed.tags.map((tag) => tag.label), ["死亡时", "被动"]);
  assert.equal(reviewed.hint, "");
  assert.deepEqual(abilityMeta.getAbilityMetaTags(null), { tags: [], reviewed: false, hint: "" });

  const html = catalog.renderAbilityMetaTags(empathData);
  assert.match(html, /ability-meta-tag--timing">每晚</);
  assert.match(html, /ability-meta-hint/);
  assert.equal(catalog.renderAbilityMetaTags(null), "");

  // The notes module re-exports the shared labels instead of keeping its own copy.
  assert.equal(modules.roleInfo.getAbilityTimingText, abilityMeta.getAbilityTimingText);
  assert.equal(modules.roleInfo.getAbilityMetaSummary, undefined);
});
