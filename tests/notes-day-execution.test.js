const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadFrontend(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-day-execution-"));
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
  return (name) => import(pathToFileURL(path.join(directory, name)).href);
}

function createGame(playerCount) {
  return {
    playerCount,
    phaseType: "day",
    phaseNumber: 1,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`,
      seat: index + 1,
      status: "alive",
    })),
    dayRecords: [],
    autoExecutionApplied: [],
  };
}

function nomination(nomineeSeat, voterSeats) {
  return { id: `n-${nomineeSeat}`, nominatorSeat: "1", nomineeSeat: String(nomineeSeat), voterSeats: voterSeats.map(String) };
}

test("a tie for the most votes executes nobody", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const game = createGame(7); // threshold 4
  const record = days.getDayRecord(game, 1, true);
  record.nominations.push(nomination(2, [1, 3, 4, 5]), nomination(6, [1, 2, 3, 7]));

  const tied = days.resolveDayExecution(game, record);
  assert.equal(tied.seat, "");
  assert.equal(tied.tied, true);
  assert.equal(tied.votes, 4);
  days.syncAutoExecutionStatuses(game);
  assert.deepEqual(game.players.map((player) => player.status), Array(7).fill("alive"));

  // A later nomination with more votes breaks the tie.
  record.nominations.push(nomination(7, [1, 2, 3, 4, 5]));
  const winner = days.resolveDayExecution(game, record);
  assert.equal(winner.seat, "7");
  assert.equal(winner.tied, false);

  // Votes below the threshold never create a tie.
  const lowRecord = days.getDayRecord(game, 2, true);
  lowRecord.nominations.push(nomination(3, [1, 2, 4, 5]), nomination(4, [1, 2]));
  assert.equal(days.resolveDayExecution(game, lowRecord).seat, "3");
});

test("a past day's threshold does not move when players die later", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const { shiftGamePhase } = await load("notes/notes-game-actions.js");
  const game = createGame(7);

  // Day 1: 7 alive, threshold 4; 4 votes on seat 2 executes them.
  const dayOne = days.getDayRecord(game, 1, true);
  dayOne.nominations.push(nomination(2, [1, 3, 4, 5]));
  days.syncAutoExecutionStatuses(game);
  assert.equal(game.players[1].status, "executed");

  // Moving into night 2 freezes day 1 at 7 alive.
  shiftGamePhase(game, 1);
  assert.equal(game.phaseNumber, 2);
  assert.equal(days.getDayRecord(game, 1).aliveCount, 7);

  // Night 2 and night 3 deaths would drop the live count to 4 (threshold 2).
  game.players[2].status = "night-dead";
  game.players[3].status = "night-dead";
  shiftGamePhase(game, 1);
  shiftGamePhase(game, 1);
  game.players[4].status = "night-dead";
  days.syncAutoExecutionStatuses(game);

  const result = days.resolveDayExecution(game, days.getDayRecord(game, 1));
  assert.equal(result.threshold, 4);
  assert.equal(result.seat, "2");
  assert.equal(game.players[1].status, "executed");

  // Going back does not refreeze; a manual correction does.
  shiftGamePhase(game, -3);
  assert.equal(days.getDayRecord(game, 1).aliveCount, 7);
  days.getDayRecord(game, 1).aliveCount = 9;
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 1)).threshold, 5);
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 1)).seat, "");
});

test("days without a frozen count still count players executed that day or later", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const game = createGame(7);
  days.getDayRecord(game, 1, true).nominations.push(nomination(2, [1, 3, 4, 5]));
  days.getDayRecord(game, 2, true).nominations.push(nomination(3, [1, 4, 5]));
  days.syncAutoExecutionStatuses(game);

  // Day 1: everyone alive (7). Day 2: seat 2 gone (6), threshold 3.
  assert.equal(days.countAliveForDay(game, 1), 7);
  assert.equal(days.countAliveForDay(game, 2), 6);
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 1)).threshold, 4);
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 2)).seat, "3");
  assert.deepEqual(game.players.map((player) => player.status).slice(0, 3), ["alive", "executed", "executed"]);
});

test("frozen alive counts survive normalisation and old records stay unfrozen", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const normalized = days.normalizeDayRecords([
    { dayNumber: 1, nominations: [], aliveCount: 8 },
    { dayNumber: 2, nominations: [] },
    { dayNumber: 3, nominations: [], aliveCount: "abc" },
  ], 10);
  assert.deepEqual(normalized.map((record) => record.aliveCount), [8, null, null]);
});
