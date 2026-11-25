const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadFrontend(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-overview-layout-"));
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
  const appStub = { innerHTML: "" };
  // getElementById: the overview's worldline analysis looks its panel up again once the async request settles.
  global.document = {
    title: "",
    querySelector: (selector) => (selector === "#app" ? appStub : null),
    getElementById: () => null,
  };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = {
    app: appStub,
    directory,
    state: (await load("state.js")).state,
    notes: await load("notes-state.js"),
    shell: await load("notes/notes-shell.js"),
  };
  t.after(() => {
    modules.notes.flushNotesState();
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  modules.state.roles = [];
  modules.notes.ensureNotesState();
  return modules;
}

function openGame(modules, tab) {
  const { notes, state } = modules;
  const game = notes.createGameFromSetup({ scriptMode: "free", playerCount: 7 });
  state.notes.games = [game];
  state.notes.activeGameId = game.id;
  state.notes.ui.screen = "game";
  state.notes.ui.activeTab = tab;
  return game;
}

// Opening tag of the first element whose class list contains `className`.
function openingTag(html, className) {
  return html.match(new RegExp(`<[a-z]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`))?.[0] || "";
}

test("the game card renders as a collapsed, keyed <details> so each tab starts with its own content", async (t) => {
  const modules = await loadFrontend(t);
  const game = openGame(modules, "overview");
  modules.shell.renderNotesPage();
  const html = modules.app.innerHTML;

  const details = openingTag(html, "notes-game-meta-details");
  assert.match(details, /^<details/);
  assert.match(details, /data-details-key="game-meta"/);
  assert.doesNotMatch(details, /\bopen\b/);

  // The one-line summary carries the title and player count; traveller tools sit inside the collapsed body.
  const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
  assert.ok(summary.includes(game.title));
  assert.ok(summary.includes("7 人"));
  assert.ok(!summary.includes("travellerRoleInput"));
  assert.ok(html.indexOf("travellerRoleInput") > html.indexOf("</summary>"));
  assert.ok(html.indexOf("travellerRoleInput") < html.indexOf("</details>"));
});

test("the script button stays outside the collapsible summary and only shows on the overview tab", async (t) => {
  const modules = await loadFrontend(t);
  openGame(modules, "overview");
  modules.shell.renderNotesPage();
  let html = modules.app.innerHTML;
  const button = html.indexOf('data-notes-action="toggle-script-sheet"');
  assert.ok(button > html.indexOf("</details>"), "a button nested in <summary> would toggle the card when tapped");

  modules.state.notes.ui.activeTab = "timeline";
  modules.shell.renderNotesPage();
  html = modules.app.innerHTML;
  assert.ok(!html.includes('data-notes-action="toggle-script-sheet"'));
  assert.ok(html.includes('data-details-key="game-meta"'));
});

test("overview rows mark empty summary / extra cells so the phone layout can drop them", async (t) => {
  const modules = await loadFrontend(t);
  const game = openGame(modules, "overview");
  game.players[1].extraInfo = "首夜报 3/8";
  modules.shell.renderNotesPage();
  const rows = modules.app.innerHTML.split('<article class="notes-overview-item').slice(1);
  assert.equal(rows.length, 7);

  assert.match(openingTag(rows[0], "notes-overview-cell--extra"), /is-empty/);
  assert.match(openingTag(rows[0], "notes-overview-cell--summary"), /is-empty/);
  assert.doesNotMatch(openingTag(rows[1], "notes-overview-cell--extra"), /is-empty/);
  assert.ok(rows[1].includes("首夜报 3/8"));
});

test("deleting the game is a separate control from the save / back / export row", async (t) => {
  const modules = await loadFrontend(t);
  openGame(modules, "overview");
  modules.shell.renderNotesPage();
  const html = modules.app.innerHTML;
  const actions = html.slice(html.indexOf('class="notes-overview-actions"'));
  const deleteButton = actions.match(/<button[^>]*data-notes-action="delete-game"[^>]*>/)[0];
  assert.match(deleteButton, /class="notes-overview-delete"/);
  assert.doesNotMatch(deleteButton, /secondary-link|primary-link/);
  for (const action of ["save-game", "go-home", "export-game"]) {
    assert.ok(actions.indexOf(`data-notes-action="${action}"`) < actions.indexOf('data-notes-action="delete-game"'));
  }
});

test("the player editor is a sheet: closed until a seat is tapped, and closing it saves the draft", async (t) => {
  const modules = await loadFrontend(t);
  const game = openGame(modules, "players");
  const { handlePlayerUiAction } = await import(
    pathToFileURL(path.join(modules.directory, "notes/notes-player-ui-actions.js")).href
  );
  const { ensurePlayerDraftForId } = await import(
    pathToFileURL(path.join(modules.directory, "notes/notes-player-actions.js")).href
  );
  const notes = modules.state.notes;
  const player = game.players[2];
  const button = { dataset: { playerId: player.id } };

  modules.shell.renderNotesPage();
  assert.ok(modules.app.innerHTML.includes("player-roundtable-board"));
  assert.ok(!modules.app.innerHTML.includes("notes-player-sheet"), "no editor before a seat is picked");

  handlePlayerUiAction("select-player", button, notes);
  assert.equal(notes.ui.playerSheetOpen, true);
  assert.match(modules.app.innerHTML, new RegExp(`data-scroll-key="player-sheet:${player.id}"`));

  ensurePlayerDraftForId(player.id).extraInfo = "首夜报 3/8";
  handlePlayerUiAction("close-player-sheet", button, notes);
  assert.equal(notes.ui.playerSheetOpen, false);
  assert.equal(notes.ui.activeTab, "players");
  assert.equal(player.extraInfo, "首夜报 3/8");
  assert.equal(modules.notes.getPlayerDraft(player.id), null);
  assert.ok(!modules.app.innerHTML.includes("notes-player-sheet"));

  // 取消 drops the edits and also closes the sheet.
  handlePlayerUiAction("select-player", button, notes);
  ensurePlayerDraftForId(player.id).extraInfo = "写错了";
  handlePlayerUiAction("discard-player", button, notes);
  assert.equal(notes.ui.playerSheetOpen, false);
  assert.equal(player.extraInfo, "首夜报 3/8");
});

test("closing an untouched seat does not add a timeline entry", async (t) => {
  const modules = await loadFrontend(t);
  const game = openGame(modules, "players");
  const { handlePlayerUiAction } = await import(
    pathToFileURL(path.join(modules.directory, "notes/notes-player-ui-actions.js")).href
  );
  const button = { dataset: { playerId: game.players[0].id } };
  const before = game.timeline.length;
  handlePlayerUiAction("select-player", button, modules.state.notes);
  handlePlayerUiAction("close-player-sheet", button, modules.state.notes);
  assert.equal(game.timeline.length, before);
});

test("the notes pages link out to the encyclopedia, since the site top bar is hidden there", async (t) => {
  const modules = await loadFrontend(t);
  modules.shell.renderNotesPage();
  assert.match(modules.app.innerHTML, /<a href="\/roles" data-link>角色<\/a>/);

  openGame(modules, "timeline");
  modules.shell.renderNotesPage();
  assert.match(modules.app.innerHTML, /<a class="notes-stagebar-link" href="\/roles" data-link/);
});
