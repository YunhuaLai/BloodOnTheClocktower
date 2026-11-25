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
  const { applyStatusChange } = await load("notes/notes-death.js");
  const game = createGame(7);

  // Day 1: 7 alive, threshold 4; 4 votes on seat 2 executes them.
  const dayOne = days.getDayRecord(game, 1, true);
  dayOne.nominations.push(nomination(2, [1, 3, 4, 5]));
  days.syncAutoExecutionStatuses(game);
  assert.equal(game.players[1].status, "executed");
  assert.deepEqual(game.players[1].death, { phaseType: "day", phaseNumber: 1, cause: "execution" });

  // Deaths are dated by the phase they are marked in.
  game.phaseType = "day";
  game.phaseNumber = 2;
  applyStatusChange(game.players[2], "night-dead", game);
  applyStatusChange(game.players[3], "night-dead", game);
  game.phaseType = "night";
  game.phaseNumber = 3;
  applyStatusChange(game.players[4], "night-dead", game);
  assert.deepEqual(game.players[4].death, { phaseType: "night", phaseNumber: 3, cause: "night" });
  days.syncAutoExecutionStatuses(game);

  const result = days.resolveDayExecution(game, days.getDayRecord(game, 1));
  assert.equal(result.threshold, 4);
  assert.equal(result.seat, "2");
  assert.equal(game.players[1].status, "executed");
  assert.equal(days.countAliveForDay(game, 2), 4);
  assert.equal(days.countAliveForDay(game, 3), 3);

  // A manual count overrides the derived one.
  days.getDayRecord(game, 1).aliveCount = 9;
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 1)).threshold, 5);
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 1)).seat, "");
});

test("status changes fill in death phase and cause", async (t) => {
  const load = await loadFrontend(t);
  const death = await load("notes/notes-death.js");
  const game = { phaseType: "night", phaseNumber: 3 };
  const player = { seat: 4, status: "alive", death: null, ghostVoteUsed: false };

  // Marked executed during night 3: executed at the end of day 2.
  death.applyStatusChange(player, "executed", game);
  assert.deepEqual(player.death, { phaseType: "day", phaseNumber: 2, cause: "execution" });
  assert.equal(death.getDeathBadge(player), "处2");

  // Switching to a non-execution death resets the cause and phase.
  death.applyStatusChange(player, "night-dead", game);
  assert.deepEqual(player.death, { phaseType: "night", phaseNumber: 3, cause: "night" });

  // Day deaths keep the night-dead status but show their own badge; a night
  // phase does not fit a day death, so it moves to the latest day (day 2).
  death.applyDeathCause(player, "day", game);
  assert.equal(player.status, "night-dead");
  assert.deepEqual(player.death, { phaseType: "day", phaseNumber: 2, cause: "day" });
  assert.equal(death.getDeathBadge(player), "白2");
  // "Unknown" fits any phase and keeps it.
  death.applyDeathCause(player, "unknown", game);
  assert.deepEqual(player.death, { phaseType: "day", phaseNumber: 2, cause: "unknown" });
  death.applyDeathCause(player, "day", game);
  death.applyStatusChange(player, "night-dead", game);
  assert.equal(player.death.cause, "day");

  death.applyDeathPhase(player, "day-2");
  assert.deepEqual(player.death, { phaseType: "day", phaseNumber: 2, cause: "day" });
  death.applyDeathPhase(player, "");
  assert.equal(death.getDeathBadge(player), "白");

  // Choosing execution as the cause also sets the status.
  death.applyDeathCause(player, "execution", game);
  assert.equal(player.status, "executed");

  player.ghostVoteUsed = true;
  death.applyStatusChange(player, "alive", game);
  assert.equal(player.death, null);
  assert.equal(player.ghostVoteUsed, false);

  // Legacy dead players without a record get a cause from their status.
  assert.deepEqual(death.normalizeDeath(undefined, "night-dead"), { phaseType: "", phaseNumber: null, cause: "night" });
  assert.deepEqual(death.normalizeDeath({ phaseType: "day", phaseNumber: 2 }, "executed"), { phaseType: "day", phaseNumber: 2, cause: "execution" });
  assert.equal(death.normalizeDeath({ phaseType: "day", phaseNumber: 2 }, "alive"), null);

  assert.deepEqual(
    death.getDeathPhaseChoices({ phaseType: "day", phaseNumber: 2 }).map((choice) => choice.value),
    ["night-1", "day-1", "night-2", "day-2"],
  );
});

test("an executed player who survives stays alive", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const game = createGame(7);
  const record = days.getDayRecord(game, 1, true);
  record.nominations.push(nomination(2, [1, 3, 4, 5]));
  record.executedSurvived = true;
  days.syncAutoExecutionStatuses(game);
  assert.equal(game.players[1].status, "alive");
  assert.equal(days.resolveDayExecution(game, record).seat, "2");

  // Syncing re-normalizes records, so fetch the live one before each change.
  days.getDayRecord(game, 1).executedSurvived = false;
  days.syncAutoExecutionStatuses(game);
  assert.equal(game.players[1].status, "executed");

  days.getDayRecord(game, 1).executedSurvived = true;
  days.syncAutoExecutionStatuses(game);
  assert.equal(game.players[1].status, "alive");
  assert.equal(game.players[1].death, null);
  assert.equal(days.getDayRecord(game, 1).executedSurvived, true);
});

test("votes cast after death mark the dead vote as used", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const death = await load("notes/notes-death.js");
  const game = createGame(7);
  days.getDayRecord(game, 1, true).nominations.push(nomination(2, [1, 3, 4, 5]));
  days.syncAutoExecutionStatuses(game);

  // Seat 2 voted on day 1 while alive: the dead vote is still there.
  assert.equal(death.isGhostVoteUsed(game, game.players[1]), false);

  days.getDayRecord(game, 2, true).nominations.push(nomination(6, [2, 3]));
  assert.deepEqual(death.getGhostVoteDays(game, game.players[1]), [2]);
  assert.equal(death.isGhostVoteUsed(game, game.players[1]), true);

  // Without a death phase nothing can be derived, only the manual flag counts.
  const unknown = { seat: 3, status: "night-dead", death: { phaseType: "", phaseNumber: null, cause: "night" } };
  assert.equal(death.isGhostVoteUsed(game, unknown), false);
  unknown.ghostVoteUsed = true;
  assert.equal(death.isGhostVoteUsed(game, unknown), true);
});

test("backend day records follow the same execution rules", () => {
  const backend = require("../backend/deduction/day-records");
  const game = createGame(7);
  game.dayRecords = [{ dayNumber: 1, nominations: [nomination(2, [1, 3, 4, 5]), nomination(6, [1, 2, 3, 7])] }];
  assert.equal(backend.getDayExecutionSeat(game, 1), 0);

  game.dayRecords = [
    { dayNumber: 1, nominations: [nomination(2, [1, 3, 4, 5])] },
    { dayNumber: 2, nominations: [nomination(3, [1, 4, 5])] },
  ];
  game.players[1].status = "executed";
  game.players[1].death = { phaseType: "day", phaseNumber: 1, cause: "execution" };
  game.players[5].status = "night-dead";
  game.players[5].death = { phaseType: "night", phaseNumber: 3, cause: "night" };
  assert.equal(backend.countAliveForDay(game, 1), 7);
  assert.equal(backend.countAliveForDay(game, 2), 6);
  assert.equal(backend.getDayExecutionSeat(game, 1), 2);
  assert.equal(backend.getDayExecutionSeat(game, 2), 3);
});

test("deaths without a phase fall back to execution records", async (t) => {
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

test("manual alive counts survive normalisation", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const normalized = days.normalizeDayRecords([
    { dayNumber: 1, nominations: [], aliveCount: 8 },
    { dayNumber: 2, nominations: [] },
    { dayNumber: 3, nominations: [], aliveCount: "abc" },
  ], 10);
  assert.deepEqual(normalized.map((record) => record.aliveCount), [8, null, null]);
});

test("executing an already-dead player keeps their original death", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const game = createGame(7);
  days.getDayRecord(game, 1, true).nominations.push(nomination(2, [1, 3, 4, 5]));
  days.getDayRecord(game, 2, true).nominations.push(nomination(2, [1, 3, 4]));
  days.syncAutoExecutionStatuses(game);

  assert.deepEqual(game.players[1].death, { phaseType: "day", phaseNumber: 1, cause: "execution" });
  // Day 2: 6 alive, threshold 3, so the second execution still resolves.
  assert.equal(days.resolveDayExecution(game, days.getDayRecord(game, 2)).threshold, 3);
  assert.equal(days.getDayExecutionSeat(game, 2), 2);
  // Re-syncing is stable.
  days.syncAutoExecutionStatuses(game);
  assert.deepEqual(game.players[1].death, { phaseType: "day", phaseNumber: 1, cause: "execution" });
  // Nobody died by execution on day 2.
  assert.equal(days.getDayExecutionDeathSeat(game, 1), 2);
  assert.equal(days.getDayExecutionDeathSeat(game, 2), 0);
});

test("a same-day vote before a daytime death is not a dead vote", async (t) => {
  const load = await loadFrontend(t);
  const death = await load("notes/notes-death.js");
  const game = createGame(7);
  game.dayRecords = [
    { dayNumber: 2, nominations: [nomination(5, [3, 4])] },
    { dayNumber: 3, nominations: [nomination(6, [3])] },
  ];
  const slain = { seat: 3, status: "night-dead", death: { phaseType: "day", phaseNumber: 2, cause: "day" } };
  assert.deepEqual(death.getGhostVoteDays(game, slain), [3]);
  game.dayRecords.pop();
  assert.equal(death.isGhostVoteUsed(game, slain), false);

  // A night death on night 2 precedes day 2, so a day-2 vote is a dead vote.
  const killed = { seat: 4, status: "night-dead", death: { phaseType: "night", phaseNumber: 2, cause: "night" } };
  assert.deepEqual(death.getGhostVoteDays(game, killed), [2]);
});

test("surviving executions do not count as death by execution", async (t) => {
  const load = await loadFrontend(t);
  const days = await load("notes/notes-day-records.js");
  const backend = require("../backend/deduction/day-records");
  const game = createGame(7);
  days.getDayRecord(game, 1, true).nominations.push(nomination(2, [1, 3, 4, 5]));
  days.getDayRecord(game, 1).executedSurvived = true;
  days.syncAutoExecutionStatuses(game);

  assert.equal(days.getDayExecutionSeat(game, 1), 2);
  assert.equal(days.getDayExecutionDeathSeat(game, 1), 0);
  assert.equal(backend.getDayExecutionSeat(game, 1), 2);
  assert.equal(backend.getDayExecutionDeathSeat(game, 1), 0);

  days.getDayRecord(game, 1).executedSurvived = false;
  days.syncAutoExecutionStatuses(game);
  assert.equal(days.getDayExecutionDeathSeat(game, 1), 2);
  assert.equal(backend.getDayExecutionDeathSeat(game, 1), 2);
});
