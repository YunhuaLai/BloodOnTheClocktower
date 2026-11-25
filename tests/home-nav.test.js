const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadHome(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-home-nav-"));
  const previousDocument = global.document;
  const previousWindow = global.window;
  const storage = new Map();
  const navLinks = ["notes", "roles", "scripts", "terms"].map((nav) => ({
    dataset: { nav },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  }));
  // router.js registers its listeners on import; they are never fired here.
  global.window = {
    clearTimeout,
    setTimeout,
    addEventListener: () => {},
    location: { pathname: "/", search: "", hash: "" },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  global.document = {
    title: "",
    addEventListener: () => {},
    querySelector: (selector) => (selector === "#app" ? { innerHTML: "" } : null),
    querySelectorAll: (selector) => (selector === ".nav a[data-nav]" ? navLinks : []),
    getElementById: () => null,
  };
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const modules = { home: await load("catalog-home.js"), router: await load("router.js"), navLinks };
  t.after(() => {
    global.document = previousDocument;
    global.window = previousWindow;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return modules;
}

const game = (id, updatedAt, extra = {}) => ({
  id,
  title: `对局 ${id}`,
  scriptName: "暗流涌动",
  phaseType: "night",
  phaseNumber: 2,
  playerCount: 7,
  players: Array.from({ length: 7 }, (_, index) => ({ id: `${id}-p${index}`, seat: index + 1, status: index ? "alive" : "executed" })),
  updatedAt,
  ...extra,
});

test("home lists starred games first, then the most recently updated, capped at three", async (t) => {
  const { home } = await loadHome(t);
  const games = [
    game("a", "2026-01-01T00:00:00Z"),
    game("b", "2026-03-01T00:00:00Z"),
    game("c", "2026-02-01T00:00:00Z", { favorite: true }),
    game("d", "2026-04-01T00:00:00Z"),
  ];
  assert.deepEqual(home.getRecentGames(games).map((item) => item.id), ["c", "d", "b"]);
  assert.equal(games[0].id, "a", "the saved list itself is not reordered");
});

test("each recent game links straight into that game, with its script, phase and alive count", async (t) => {
  const { home } = await loadHome(t);
  const games = [game("g<1>", "2026-01-01T00:00:00Z"), game("b", "2026-01-02T00:00:00Z")];
  const html = home.renderHomeRecentGames(games);

  assert.ok(html.includes('href="/notes?game=g%3C1%3E" data-link'));
  assert.ok(html.includes("对局 g&lt;1&gt;"));
  assert.match(html, /暗流涌动 · [^<]*2[^<]* · 存活 6 \/ 7/);
  assert.ok(!html.includes("home-recent-all"), "no 'all games' link when everything is already listed");

  const many = ["a", "b", "c", "d"].map((id, index) => game(id, `2026-01-0${index + 1}T00:00:00Z`));
  assert.match(home.renderHomeRecentGames(many), /全部 4 个对局/);
  assert.equal(home.renderHomeRecentGames([]), "");
});

test("the nav marks the current section and clears it elsewhere", async (t) => {
  const { router, navLinks } = await loadHome(t);
  const current = () => navLinks.filter((link) => link.attributes["aria-current"] === "page").map((link) => link.dataset.nav);

  router.syncNavCurrent("roles");
  assert.deepEqual(current(), ["roles"]);
  router.syncNavCurrent("scripts");
  assert.deepEqual(current(), ["scripts"]);
  router.syncNavCurrent("");
  assert.deepEqual(current(), []);
});
