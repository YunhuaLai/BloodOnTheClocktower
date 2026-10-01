const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const backendClaims = require("../backend/deduction/claims");

test("free mode opens the catalog independently of stale script and custom pool selections", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-free-mode-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const storage = new Map();
  global.window = { clearTimeout, localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  } };
  global.document = { querySelector: () => null };
  t.after(() => {
    global.document = previousDocument;
    global.window = previousWindow;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const { state } = await load("state.js");
  const claims = await load("notes-claims.js");
  const { createGameFromSetup, importNotesBackup, ensureNotesState } = await load("notes-state.js");
  state.roles = [
    { id: "town", name: "镇民甲", type: "townsfolk" },
    { id: "demon", name: "恶魔甲", type: "demon" },
    { id: "fabled", name: "传奇甲", type: "fabled" },
    { id: "traveller", name: "旅行者甲", type: "traveller" },
    { id: "token", name: "标记甲", type: "token" },
  ];
  state.scripts = [{ id: "fixed", name: "固定剧本", roleIds: ["town"] }];
  const setup = {
    scriptMode: "free", scriptId: "fixed", scriptName: "固定剧本",
    customRoleIds: ["town"], fabledRoleIds: ["fabled"], travellerRoleIds: ["traveller"],
    playerCount: 5,
  };
  const game = createGameFromSetup(setup);
  assert.equal(game.scriptMode, "free");
  assert.equal(game.scriptId, "");
  assert.equal(game.scriptName, "自由模式");
  assert.deepEqual(game.customRoleIds, []);
  assert.deepEqual(claims.getClaimRoleOptions(game).map((role) => role.id).sort(), ["demon", "town", "traveller"]);
  assert.deepEqual(claims.getRoomFabledRoleOptions(game).map((role) => role.id), ["fabled"]);
  assert.equal(claims.getGameScript(setup), null);
  assert.equal(backendClaims.getGameScript(setup, state), null);
  assert.equal(backendClaims.getClaimedRole("恶魔甲", setup, state)?.id, "demon");
  assert.equal(importNotesBackup(game), 1);
  state.notes.loaded = false;
  const restoredGame = ensureNotesState().games[0];
  assert.equal(restoredGame.scriptMode, "free");
  assert.equal(restoredGame.scriptId, "");
  assert.deepEqual(claims.getClaimRoleOptions(restoredGame).map((role) => role.id).sort(), ["demon", "town", "traveller"]);
  assert.deepEqual(restoredGame.fabledRoleIds, ["fabled"]);
  assert.deepEqual(claims.getClaimRoleOptions({ ...setup, scriptMode: "custom" }).map((role) => role.id).sort(), ["town", "traveller"]);
  assert.deepEqual(claims.getClaimRoleOptions({ ...setup, scriptMode: "script", travellerRoleIds: [] }).map((role) => role.id), ["town"]);
});
