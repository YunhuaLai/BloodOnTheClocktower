const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function importFrontendModule(relativePath) {
  const source = fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
  const encoded = Buffer.from(source).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("new game phase order advances from first night", async () => {
  const { getShiftedPhase } = await importFrontendModule(
    "frontend/scripts/notes/notes-phase.js",
  );

  assert.deepEqual(getShiftedPhase("night", 1, 1), {
    phaseType: "day",
    phaseNumber: 1,
  });
  assert.deepEqual(getShiftedPhase("day", 1, 1), {
    phaseType: "night",
    phaseNumber: 2,
  });
  assert.deepEqual(getShiftedPhase("night", 2, -1), {
    phaseType: "day",
    phaseNumber: 1,
  });
  assert.deepEqual(getShiftedPhase("night", 1, -1), {
    phaseType: "night",
    phaseNumber: 1,
  });
});

test("backup envelopes are versioned and legacy game exports remain importable", async () => {
  const {
    NOTES_SCHEMA_VERSION,
    createGameBackupEnvelope,
    createNotesBackupEnvelope,
    getImportableGames,
  } = await importFrontendModule("frontend/scripts/notes/notes-backup.js");
  const game = { id: "game-1", players: [] };
  const exportedAt = "2026-08-07T00:00:00.000Z";

  const singleBackup = createGameBackupEnvelope(game, exportedAt);
  assert.equal(singleBackup.schemaVersion, NOTES_SCHEMA_VERSION);
  assert.deepEqual(getImportableGames(singleBackup), [game]);

  const allBackup = createNotesBackupEnvelope([game], game.id, exportedAt);
  assert.equal(allBackup.activeGameId, game.id);
  assert.deepEqual(getImportableGames(allBackup), [game]);
  assert.deepEqual(getImportableGames(game), [game]);

  assert.throws(
    () => getImportableGames({ schemaVersion: NOTES_SCHEMA_VERSION + 1, games: [game] }),
    /更新版本/,
  );
  assert.throws(() => getImportableGames({ games: [] }), /没有可恢复的对局/);
  assert.throws(() => getImportableGames({ games: [{}] }), /没有可恢复的对局/);
});
