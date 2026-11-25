const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const scripts = [
  { id: "s1", name: "暗流涌动", status: "published" },
  { id: "s2", name: "黯月初升" }, // no status counts as published
  { id: "s3", name: "自制板子甲", status: "draft" },
  { id: "s4", name: "自制板子乙", status: "draft" },
];

const roles = [
  { id: "r1", name: "占卜师", type: "townsfolk", ability: "每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。", scriptIds: ["s3", "s1", "s4"], scriptNames: ["自制板子甲", "暗流涌动", "自制板子乙"] },
  { id: "r2", name: "投毒者", type: "minion", ability: "每个夜晚，你要选择一名玩家：他中毒。", scriptIds: ["s1"], scriptNames: ["暗流涌动"] },
  { id: "r3", name: "自制毒师", type: "minion", ability: "首个夜晚，你选择的玩家中毒。", scriptIds: ["s3"], scriptNames: ["自制板子甲"] },
  { id: "r4", name: "旧数据角色", type: "townsfolk", summary: "只有摘要的旧数据。", scriptId: "s2", scriptNames: ["黯月初升"] },
  { id: "r5", name: "无主角色", type: "townsfolk", ability: "没有板子。", scriptIds: [], scriptNames: [] },
];

async function loadCatalog(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-catalog-roles-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const elements = new Map();
  const element = () => ({ innerHTML: "", textContent: "", hidden: false, value: "", attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
  for (const selector of ["#app", "#roleGrid", "#roleResultCount", "#roleScopeToggle", "#searchInput"]) {
    elements.set(selector, element());
  }
  global.window = { clearTimeout, setTimeout, localStorage: { getItem: () => null, setItem: () => {} } };
  global.document = {
    title: "",
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: () => [],
  };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = { state: (await load("state.js")).state, indexes: await load("catalog-indexes.js"), elements };
  t.after(() => {
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  modules.state.scripts = scripts;
  modules.state.roles = roles;
  modules.state.activeFilter = "all";
  modules.state.roleScope = "published";
  return modules;
}

const names = (list) => list.map((role) => role.name).sort();

test("the role index lists only roles from published scripts until the scope is widened", async (t) => {
  const { state, indexes } = await loadCatalog(t);

  let matches = indexes.getRoleMatches("");
  assert.deepEqual(names(matches.visible), ["占卜师", "投毒者", "旧数据角色"]);
  assert.equal(matches.hiddenCount, 2);

  state.roleScope = "all";
  matches = indexes.getRoleMatches("");
  assert.equal(matches.visible.length, 5);
  assert.equal(matches.hiddenCount, 0);
});

test("role search matches ability text, and reports matches hidden by the scope", async (t) => {
  const { state, indexes } = await loadCatalog(t);

  const matches = indexes.getRoleMatches("中毒");
  assert.deepEqual(names(matches.visible), ["投毒者"]);
  assert.equal(matches.hiddenCount, 1);

  // Roles that only carry the legacy `summary` field stay searchable.
  assert.deepEqual(names(indexes.getRoleMatches("旧数据").visible), ["旧数据角色"]);

  state.activeFilter = "townsfolk";
  assert.deepEqual(names(indexes.getRoleMatches("中毒").visible), []);
});

test("role cards show the ability and a short script line with published scripts first", async (t) => {
  const { indexes, elements } = await loadCatalog(t);

  assert.equal(indexes.getRoleScriptSummary(roles[0]), "暗流涌动、自制板子甲 等 3 个板子");
  assert.equal(indexes.getRoleScriptSummary(roles[1]), "暗流涌动");
  assert.equal(indexes.getRoleScriptSummary(roles[4]), "未归属板子");
  assert.equal(indexes.getRoleAbilityText(roles[3]), "只有摘要的旧数据。");

  indexes.renderRoles();
  const html = elements.get("#roleGrid").innerHTML;
  assert.ok(html.includes("你会得知他们之中是否有恶魔"));
  assert.ok(!html.includes("undefined"));
  assert.ok(!html.includes("自制毒师"));
  assert.equal(elements.get("#roleResultCount").textContent, "3 个角色");
  const toggle = elements.get("#roleScopeToggle");
  assert.equal(toggle.hidden, false);
  assert.match(toggle.textContent, /另有 2 个/);
  assert.equal(toggle.attributes["aria-pressed"], "false");
});

test("a search that only matches draft-script roles explains why the list is empty", async (t) => {
  const { indexes, elements } = await loadCatalog(t);
  elements.get("#searchInput").value = "自制毒师";
  indexes.renderRoles();
  assert.match(elements.get("#roleGrid").innerHTML, /已上架板子里没有匹配的角色/);
  assert.match(elements.get("#roleScopeToggle").textContent, /另有 1 个/);
});
