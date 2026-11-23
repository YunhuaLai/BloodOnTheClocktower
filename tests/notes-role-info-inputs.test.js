const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const abilityRole = (id, name, result, target = [], type = "townsfolk") => ({
  id,
  name,
  type,
  ability: "测试能力",
  abilityData: {
    abilityMeta: { recordable: true, eventTiming: null, phaseTiming: "each_night", usagePattern: "once_per_night" },
    interactionSchema: {
      target: { repeatMode: target.length ? "sequence" : "none", defaultRows: target.length ? 3 : 0, fields: target },
      result: { repeatMode: "sequence", defaultRows: 3, fields: result },
    },
  },
});

const roles = [
  abilityRole("r005", "共情者", [{ key: "count", type: "number", label: "邻座邪恶数", min: 0, max: 2 }]),
  abilityRole("r053", "数学家", [{ key: "count", type: "number", label: "异常人数", min: 0, max: 15 }]),
  abilityRole("r006", "占卜师", [{ key: "has_demon", type: "boolean", label: "是否含恶魔", options: ["yes", "no"] }], [
    { key: "seat1", type: "seat", label: "号码1" },
    { key: "seat2", type: "seat", label: "号码2" },
  ]),
  abilityRole("r051", "筑梦师", [
    { key: "good_role", type: "role", label: "好身份" },
    { key: "evil_role", type: "role", label: "坏身份" },
  ], [{ key: "seat", type: "seat", label: "号码" }]),
  { id: "r002", name: "洗衣妇", type: "townsfolk", ability: "", abilityData: null },
  { id: "r020", name: "管家", type: "outsider", ability: "", abilityData: null },
  { id: "r100", name: "小恶魔", type: "demon", ability: "", abilityData: null },
  { id: "r101", name: "投毒者", type: "minion", ability: "", abilityData: null },
];

async function loadFrontend(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-roleinfo-inputs-"));
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
  // `#app` is a plain object so renderNotesPage can run after a click; nothing reads it back.
  const appStub = { innerHTML: "" };
  global.document = { title: "", querySelector: (selector) => (selector === "#app" ? appStub : null) };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = {
    state: (await load("state.js")).state,
    notes: await load("notes-state.js"),
    fields: await load("notes/notes-role-info-fields.js"),
    panel: await load("notes/notes-role-info-panel.js"),
    overview: await load("notes/notes-role-info-overview.js"),
    playerActions: await load("notes/notes-player-actions.js"),
    actions: await load("notes-actions.js"),
    acquiredActions: await load("notes/notes-acquired-actions.js"),
    acquiredRender: await load("notes/notes-acquired-render.js"),
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

function createGame(modules) {
  const { notes, state } = modules;
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  game.phaseType = "night";
  game.phaseNumber = 1;
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.activeTab = "players";
  return game;
}

// Read the attributes of every button carrying `action` for `field`, the way the click delegation sees them.
function findButtons(html, field, action = "set-roleinfo-field") {
  const buttons = html.match(/<button[\s\S]*?<\/button>/g) || [];
  return buttons
    .filter((button) => button.includes(`data-notes-action="${action}"`) && button.includes(`data-roleinfo-field="${field}"`))
    .map((button) => {
      const attr = (name) => button.match(new RegExp(`${name}="([^"]*)"`))?.[1];
      return {
        text: button.replace(/<button[\s\S]*?>/, "").replace("</button>", "").trim(),
        value: attr("value"),
        pressed: attr("aria-pressed") === "true",
        section: attr("data-roleinfo-section"),
        row: Number(attr("data-roleinfo-row")),
        phase: { phaseType: attr("data-roleinfo-phase-type"), phaseNumber: Number(attr("data-roleinfo-phase-number")) },
      };
    });
}

function click(modules, playerId, button) {
  modules.playerActions.updatePlayerDraftRoleInfo(playerId, button.section, button.row, "has_demon", button.value, button.phase);
}

test("boolean fields render yes/no segments that select, switch and clear with the stored value", async (t) => {
  const modules = await loadFrontend(t);
  const game = createGame(modules);
  const player = game.players[0];
  player.claim = "占卜师";
  const render = () => modules.panel.renderRoleInfoInputs(modules.notes.getPlayerDraft(player.id) || player, game);
  const draftValue = () => modules.notes.getPlayerDraft(player.id).roleInfo.records[0].resultEntries[0].has_demon;

  let buttons = findButtons(render(), "has_demon");
  assert.deepEqual(buttons.map((button) => button.text), ["是", "否"]);
  assert.deepEqual(buttons.map((button) => button.value), ["yes", "no"]);
  assert.ok(buttons.every((button) => !button.pressed));
  assert.deepEqual(buttons[0].phase, { phaseType: "night", phaseNumber: 1 });
  assert.doesNotMatch(render(), /cycle-roleinfo-field/);
  assert.doesNotMatch(render(), /<label class="notes-roleinfo-field">\s*<span>是否含恶魔/, "button groups must not sit inside a label");

  click(modules, player.id, buttons[0]);
  assert.equal(draftValue(), "yes");
  buttons = findButtons(render(), "has_demon");
  assert.deepEqual(buttons.map((button) => button.pressed), [true, false]);
  assert.equal(buttons[0].value, "", "tapping the selected segment clears it");
  assert.equal(buttons[1].value, "no");

  click(modules, player.id, buttons[1]);
  assert.equal(draftValue(), "no");
  click(modules, player.id, findButtons(render(), "has_demon")[1]);
  assert.equal(draftValue(), "");

  // Custom options and stored values outside them.
  const { fields } = modules;
  assert.deepEqual(fields.getBooleanFieldOptions({ type: "boolean", options: ["yes", "no", "unknown"] }).map((option) => option.value), ["yes", "no", "unknown"]);
  assert.deepEqual(fields.getBooleanFieldOptions({ type: "boolean" }).map((option) => option.label), ["是", "否"]);
  const legacy = fields.renderRoleInfoFieldElement("result", 0, { key: "x", type: "boolean", label: "结果" }, "maybe", game, 7);
  assert.match(legacy, /aria-pressed="true"[^>]*>maybe<\/button>/);
  assert.equal(fields.getSegmentNextValue("yes", "yes"), "");
  assert.equal(fields.getSegmentNextValue("", "no"), "no");
});

test("number fields use buttons for small hand-set ranges and a stepper input otherwise", async (t) => {
  const modules = await loadFrontend(t);
  const { fields } = modules;
  const game = createGame(modules);

  assert.deepEqual(fields.getNumberButtonValues({ type: "number", min: 0, max: 2 }), ["0", "1", "2"]);
  assert.deepEqual(fields.getNumberButtonValues({ type: "number", min: 0, max: 5 }), ["0", "1", "2", "3", "4", "5"]);
  assert.equal(fields.getNumberButtonValues({ type: "number", min: 0, max: 6 }), null, "7 values is over the limit");
  assert.equal(fields.getNumberButtonValues({ type: "number", min: 0, max: 15 }), null, "generated 0..15 stays an input");
  assert.equal(fields.getNumberButtonValues({ type: "number", min: 0 }), null);
  assert.equal(fields.getNumberButtonValues({ type: "number", min: null, max: 2 }), null);
  assert.equal(fields.getNumberButtonValues({ type: "number", min: 3, max: 1 }), null);
  assert.equal(fields.getNumberButtonValues({ type: "number", min: 0.5, max: 2 }), null);

  const empath = game.players[0];
  empath.claim = "共情者";
  empath.roleInfo = { version: 3, roleId: "r005", records: [{ phaseType: "night", phaseNumber: 1, targetEntries: [], resultEntries: [{ count: "1" }] }] };
  const empathHtml = modules.panel.renderRoleInfoInputs(empath, game);
  const countButtons = findButtons(empathHtml, "count");
  assert.deepEqual(countButtons.map((button) => button.text), ["0", "1", "2"]);
  assert.deepEqual(countButtons.map((button) => button.value), ["0", "", "2"]);
  assert.doesNotMatch(empathHtml, /type="number"/);

  // An out-of-range stored number stays visible as a selected button.
  const odd = fields.renderRoleInfoFieldElement("result", 0, { key: "count", type: "number", label: "数", min: 0, max: 2 }, "4", game, 7);
  assert.match(odd, /aria-pressed="true"[^>]*>4<\/button>/);

  const mathematician = game.players[1];
  mathematician.claim = "数学家";
  const stepperHtml = modules.overview.renderOverviewRoleInfoInputs(mathematician, game);
  assert.match(stepperHtml, /type="number"\s+inputmode="numeric"/);
  assert.equal(findButtons(stepperHtml, "count").length, 0);
  assert.equal((stepperHtml.match(/data-notes-action="step-roleinfo-field"/g) || []).length, 2);
  assert.match(stepperHtml, /data-roleinfo-phase-type="night"/);

  assert.equal(fields.getSteppedNumberValue("", 1, { min: 0 }), "0");
  assert.equal(fields.getSteppedNumberValue("3", 1, { min: 0 }), "4");
  assert.equal(fields.getSteppedNumberValue("0", -1, { min: 0 }), "0");
  assert.equal(fields.getSteppedNumberValue("2", -1, { min: "1" }), "1");
  assert.equal(fields.getSteppedNumberValue("1", -1, { min: null }), "0");

  // Narrow-screen column caps: wide controls get fewer columns.
  assert.equal(fields.getFieldGridSize([{ type: "seat" }, { type: "seat" }, { type: "boolean" }]), 3);
  assert.equal(fields.getFieldGridSize([{ type: "seat" }, { type: "number", min: 0, max: 15 }]), 2);
  assert.equal(fields.getFieldGridSize([{ type: "seat" }, { type: "seat" }, { type: "seat" }]), 3);
});

test("role fields filter candidates by inferred or explicit type and keep stored values", async (t) => {
  const modules = await loadFrontend(t);
  const { fields } = modules;
  const game = createGame(modules);
  const filter = (field) => fields.getRoleFieldTypeFilter({ type: "role", ...field });

  assert.deepEqual(filter({ key: "good_role", label: "好身份" }), ["townsfolk", "outsider"]);
  assert.deepEqual(filter({ key: "evil_role", label: "坏身份" }), ["minion", "demon"]);
  assert.deepEqual(filter({ key: "good_role_1", label: "善良角色1" }), ["townsfolk", "outsider"]);
  assert.deepEqual(filter({ key: "minion_role", label: "说书人获得的爪牙能力" }), ["minion"]);
  assert.deepEqual(filter({ key: "demon_role", label: "恶魔角色" }), ["demon"]);
  assert.deepEqual(filter({ key: "role", label: "坏身份" }), ["minion", "demon"], "label is used when the key says nothing");
  assert.deepEqual(filter({ key: "role", label: "新邪恶身份" }), ["minion", "demon"]);
  assert.deepEqual(filter({ key: "role", label: "得知在场镇民" }), ["townsfolk"]);
  assert.equal(filter({ key: "role", label: "身份" }), null);
  assert.equal(filter({ key: "role", label: "处决玩家身份" }), null);
  assert.equal(filter({ key: "role", label: "猜测角色" }), null);
  assert.deepEqual(filter({ key: "role", label: "身份", roleTypes: ["evil", "traveller"] }), ["minion", "demon", "traveller"]);
  assert.equal(filter({ key: "evil_role", label: "坏身份", roleTypes: [] }), null, "explicit empty list turns inference off");
  assert.equal(fields.getRoleFieldTypeFilter({ type: "text", key: "good_role" }), null);

  const all = [{ name: "甲", type: "townsfolk" }, { name: "乙", type: "minion" }];
  assert.deepEqual(fields.getRoleFieldCandidates({ type: "role", key: "evil_role" }, all).map((role) => role.name), ["乙"]);
  assert.deepEqual(fields.getRoleFieldCandidates({ type: "role", key: "demon_role" }, all), all, "an empty filter result falls back to every role");

  const dreamer = game.players[0];
  dreamer.claim = "筑梦师";
  // 投毒者 under 好身份 is a mistaken record; it must still show and stay selected.
  dreamer.roleInfo = { version: 3, roleId: "r051", records: [{ phaseType: "night", phaseNumber: 1, targetEntries: [{ seat: "3" }], resultEntries: [{ good_role: "投毒者", evil_role: "小恶魔" }] }] };
  const html = modules.panel.renderRoleInfoInputs(dreamer, game);
  const select = (key) => html.match(new RegExp(`<select[^>]*data-roleinfo-field="${key}"[\\s\\S]*?</select>`))?.[0] || "";
  const goodSelect = select("good_role");
  const evilSelect = select("evil_role");
  assert.match(goodSelect, /<option value="洗衣妇">/);
  assert.match(goodSelect, /<option value="管家">/);
  assert.doesNotMatch(goodSelect, /<option value="小恶魔">/);
  assert.match(goodSelect, /<option value="投毒者" selected>投毒者<\/option>/, "stored value outside the filter is kept");
  assert.equal((goodSelect.match(/value="投毒者"/g) || []).length, 1);
  assert.match(evilSelect, /<option value="小恶魔" selected>小恶魔<\/option>/);
  assert.doesNotMatch(evilSelect, /洗衣妇/);

  // Over the select limit the filtered field gets its own datalist; a short filtered list stays a select.
  modules.state.roles = [...roles, ...Array.from({ length: 90 }, (_, index) => ({ id: `x${index}`, name: `填充${index}`, type: "townsfolk", ability: "", abilityData: null }))];
  fields.renderRoleInfoRoleDatalists(game); // drop anything registered by earlier renders
  const searchable = modules.panel.renderRoleInfoInputs(dreamer, game);
  assert.match(searchable, /<input[^>]*list="roleNameList-townsfolk-outsider"[^>]*value="投毒者"[^>]*data-roleinfo-field="good_role"/, "stored value kept in the search input");
  assert.match(searchable, /<select[^>]*data-roleinfo-field="evil_role"/);
  const lists = fields.renderRoleInfoRoleDatalists(game);
  assert.equal((lists.match(/<datalist /g) || []).length, 1, "one shared list per type set");
  assert.match(lists, /<datalist id="roleNameList-townsfolk-outsider">/);
  assert.match(lists, /<option value="填充1"/);
  assert.match(lists, /<option value="管家"/);
  assert.doesNotMatch(lists, /小恶魔|投毒者/);
  assert.equal(fields.renderRoleInfoRoleDatalists(game), "", "registry is cleared after emitting");
  modules.state.roles = roles;
});

// --- Real click path: handleNotesAction with element stubs built from the rendered HTML. ---

function toDataset(tag) {
  const dataset = {};
  for (const [, name, value] of tag.matchAll(/data-([a-z-]+)="([^"]*)"/g)) {
    dataset[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return dataset;
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
}

// Build an element stub; `ancestors` maps closest() selectors to stubs (self-matching handled here).
function makeElement(tag, ancestors = {}) {
  const element = {
    tagName: tag.startsWith("<input") ? "INPUT" : "BUTTON",
    id: "",
    type: attribute(tag, "type") || "",
    value: attribute(tag, "value") ?? "",
    dataset: toDataset(tag),
    getAttribute: (name) => attribute(tag, name),
    closest(selector) {
      if (selector === "[data-roleinfo-section][data-roleinfo-row][data-roleinfo-field]" && element.dataset.roleinfoField) {
        return element;
      }
      return ancestors[selector] || null;
    },
  };
  return element;
}

function buttonsWithText(html) {
  return [...html.matchAll(/(<button\b[^>]*>)([^<]*)<\/button>/g)].map(([, tag, text]) => ({ tag, text: text.trim() }));
}

function findTags(html, pattern) {
  return (html.match(/<(?:button|input)\b[^>]*>/g) || []).filter((tag) => pattern.test(tag));
}

test("segment and stepper clicks go through handleNotesAction into the player draft and acquired records", async (t) => {
  const modules = await loadFrontend(t);
  const { state, notes, actions } = modules;
  const game = createGame(modules);
  state.notes.ui.screen = "game";
  const card = (playerId) => ({ dataset: { playerId } });
  const playerSelectors = (playerId) => ({ ".notes-player-detail, .notes-overview-editor, .story-night-detail": card(playerId) });

  // Boolean segment in the player panel.
  const teller = game.players[0];
  teller.claim = "占卜师";
  const render = () => modules.panel.renderRoleInfoInputs(notes.getPlayerDraft(teller.id) || teller, game);
  const clickSegment = (html, field, text) => {
    const tag = buttonsWithText(html)
      .filter((button) => button.text === text && button.tag.includes('data-notes-action="set-roleinfo-field"'))
      .map((button) => button.tag)
      .find((item) => item.includes(`data-roleinfo-field="${field}"`));
    assert.ok(tag, `button ${text} for ${field}`);
    actions.handleNotesAction(makeElement(tag, playerSelectors(teller.id)));
  };
  // Buttons are rendered multi-line; normalise whitespace so the tag and its text are adjacent.
  const flat = (html) => html.replace(/\s+/g, " ").replace(/ >/g, ">");
  const tellerValue = () => notes.getPlayerDraft(teller.id).roleInfo.records[0].resultEntries[0].has_demon;

  clickSegment(flat(render()), "has_demon", "是");
  assert.equal(tellerValue(), "yes");
  assert.equal(notes.getPlayerDraft(teller.id).roleInfo.records[0].phaseNumber, 1, "phase attributes reached the update");
  clickSegment(flat(render()), "has_demon", "是");
  assert.equal(tellerValue(), "", "second tap clears");

  // Stepper: typed value in the input, − and + read it and respect min / max.
  const math = game.players[1];
  math.claim = "数学家";
  const mathHtml = flat(modules.panel.renderRoleInfoInputs(math, game));
  const inputTag = findTags(mathHtml, /type="number"[^>]*data-roleinfo-field="count"/)[0];
  assert.ok(inputTag);
  const input = makeElement(inputTag, playerSelectors(math.id));
  const stepper = { querySelector: (selector) => (selector === "input[data-roleinfo-field]" ? input : null) };
  const [minus, plus] = findTags(mathHtml, /step-roleinfo-field/).map((tag) =>
    makeElement(tag, { ".notes-roleinfo-stepper": stepper }),
  );
  assert.equal(minus.dataset.step, "-1");
  const mathValue = () => notes.getPlayerDraft(math.id).roleInfo.records[0].resultEntries[0].count;

  input.value = "5";
  actions.handleNotesAction(minus);
  assert.equal(mathValue(), "4");
  input.value = "15";
  actions.handleNotesAction(plus);
  assert.equal(mathValue(), "15", "+ stops at max");
  input.value = "0";
  actions.handleNotesAction(minus);
  assert.equal(mathValue(), "0", "− stops at min");
  input.value = "";
  actions.handleNotesAction(plus);
  assert.equal(mathValue(), "0", "blank steps to min");

  // Acquired-ability form: same set-roleinfo-field action, routed by the acquired panel.
  const holder = game.players[2];
  holder.claim = "共情者";
  const ability = modules.acquiredActions.addAcquiredAbility(holder.id);
  modules.acquiredActions.updateAcquiredAbility(holder.id, "player", ability.id, "role", "占卜师");
  modules.acquiredActions.updateAcquiredAbility(holder.id, "player", ability.id, "status", "active");
  const acquiredHtml = flat(modules.acquiredRender.renderAcquiredAbilities(notes.getPlayerDraft(holder.id), game));
  const panelTag = acquiredHtml.match(/<section class="notes-acquired-panel"[^>]*>/)[0];
  const cardTag = acquiredHtml.match(/<details class="notes-acquired-ability"[^>]*>/)[0];
  const recordTag = acquiredHtml.match(/<details class="notes-acquired-record"[^>]*>/)[0];
  const acquiredSelectors = {
    ".notes-acquired-panel": { dataset: toDataset(panelTag) },
    "[data-acquired-id]": { dataset: toDataset(cardTag) },
    "[data-acquired-phase-type]": { dataset: toDataset(recordTag) },
  };
  const noTag = buttonsWithText(acquiredHtml).find((button) => button.text === "否" && button.tag.includes("set-roleinfo-field"))?.tag;
  assert.ok(noTag);
  actions.handleNotesAction(makeElement(noTag, acquiredSelectors));
  const record = notes.getPlayerDraft(holder.id).acquiredAbilities[0].records[0];
  assert.equal(record.roleInfo.resultEntries[0].has_demon, "no");
});

test("accessible labels include the phase and the stepper buttons name their field", async (t) => {
  const modules = await loadFrontend(t);
  const { fields } = modules;
  const game = createGame(modules);
  assert.equal(fields.getFieldAccessibleLabel({ label: "邻座邪恶数" }, { phaseType: "night", phaseNumber: 2 }), "第2夜 邻座邪恶数");
  assert.equal(fields.getFieldAccessibleLabel({ label: "结果" }, { phaseType: "day", phaseNumber: 1 }), "第1天 结果");
  assert.equal(fields.getFieldAccessibleLabel({ label: "结果" }, { phaseType: "", phaseNumber: 0 }), "结果");
  assert.equal(fields.getFieldAccessibleLabel({ label: "结果" }, null), "结果");

  const stepper = fields.renderRoleInfoFieldElement("result", 0, { key: "count", type: "number", label: "异常人数", min: 0, max: 15 }, "", game, 7, { phaseType: "night", phaseNumber: 3 });
  assert.match(stepper, /aria-label="第3夜 异常人数 减一"/);
  assert.match(stepper, /aria-label="第3夜 异常人数 加一"/);
  assert.match(stepper, /role="group" aria-label="第3夜 异常人数"/);
  const segments = fields.renderRoleInfoFieldElement("result", 0, { key: "x", type: "boolean", label: "结果" }, "", game, 7, { phaseType: "night", phaseNumber: 1 });
  assert.match(segments, /role="group" aria-label="第1夜 结果"/);

  assert.equal(fields.getSteppedNumberValue("15", 1, { min: 0, max: 15 }), "15");
  assert.equal(fields.getSteppedNumberValue("14", 1, { min: "0", max: "15" }), "15");
  assert.equal(fields.getSteppedNumberValue("17", 1, { min: 0, max: 15 }), "17", "a value above max is not pulled down");
  assert.equal(fields.getSteppedNumberValue("17", -1, { min: 0, max: 15 }), "16");
  assert.equal(fields.getSteppedNumberValue("3", 1, { min: 0, max: null }), "4");
});

test("seat picker taps go through handleNotesAction: open, pick, move on to the next seat, close", async (t) => {
  const modules = await loadFrontend(t);
  const { state, notes, actions } = modules;
  const game = createGame(modules);
  state.notes.ui.screen = "game";
  const teller = game.players[0];
  teller.claim = "占卜师";
  const selectors = { ".notes-player-detail, .notes-overview-editor, .story-night-detail": { dataset: { playerId: teller.id } } };
  const flat = (html) => html.replace(/\s+/g, " ").replace(/ >/g, ">");
  const render = () => flat(modules.panel.renderRoleInfoInputs(notes.getPlayerDraft(teller.id) || teller, game));
  const target = () => notes.getPlayerDraft(teller.id)?.roleInfo.records[0]?.targetEntries[0] || {};
  const pick = (seat) => {
    const tag = findTags(render(), /data-notes-action="pick-seat"/).find((item) => item.includes(`aria-label="${seat}号`));
    assert.ok(tag, `seat ${seat} in the open picker`);
    actions.handleNotesAction(makeElement(tag, selectors));
  };

  const toggle = findTags(render(), /toggle-seat-picker/).find((tag) => tag.includes('aria-label="第1夜 号码1'));
  assert.ok(toggle);
  actions.handleNotesAction(makeElement(toggle));
  assert.match(render(), /notes-seat-picker-head"> <strong>号码1<\/strong>/);
  pick(3);
  assert.deepEqual(target(), { seat1: "3" });
  assert.match(render(), /<strong>号码2<\/strong>/, "moved on to the next seat field");
  pick(5);
  assert.deepEqual(target(), { seat1: "3", seat2: "5" });
  assert.doesNotMatch(render(), /notes-seat-picker"/, "closed after the last seat field");
});
