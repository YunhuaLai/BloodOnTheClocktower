const test = require("node:test");
const assert = require("node:assert/strict");
const { generateWorlds } = require("../backend/deduction/worlds");
const { validateDeductionGame } = require("../backend/deduction/validation");

function makeGame(playerCount, overrides = {}) {
  return {
    playerCount,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      seat: index + 1,
      status: "alive",
    })),
    timeline: [],
    dayRecords: [],
    ...overrides,
  };
}

test("accepts a standard 5 to 15 player game", () => {
  assert.deepEqual(validateDeductionGame(makeGame(5)), []);
  assert.deepEqual(validateDeductionGame(makeGame(15)), []);
});

test("rejects oversized and inconsistent player payloads", () => {
  assert.match(validateDeductionGame(makeGame(16)).join("\n"), /playerCount/);

  const duplicateSeatGame = makeGame(7);
  duplicateSeatGame.players[6].seat = 1;
  assert.match(validateDeductionGame(duplicateSeatGame).join("\n"), /seats/);

  const missingPlayerGame = makeGame(7, { players: makeGame(6).players });
  assert.match(validateDeductionGame(missingPlayerGame).join("\n"), /must match/);
});

test("allows a bounded number of travellers without adding deduction seats", () => {
  const game = makeGame(10);
  game.players.push({
    id: "traveller-1",
    seat: 11,
    isTraveller: true,
    seatType: "traveller",
  });
  assert.deepEqual(validateDeductionGame(game), []);
});

test("rejects oversized nested observation collections", () => {
  const game = makeGame(10);
  game.players[0].roleInfo = {
    targetEntries: Array.from({ length: 31 }, () => ({})),
    resultEntries: [],
  };
  game.dayRecords = [{ nominations: Array.from({ length: 31 }, () => ({})) }];
  const errors = validateDeductionGame(game).join("\n");
  assert.match(errors, /roleInfo/);
  assert.match(errors, /nominations/);
});

test("largest standard setup keeps world generation bounded", () => {
  const game = makeGame(15);
  const { worlds } = generateWorlds(game, game.players);
  assert.equal(worlds.length, 5460);
});
