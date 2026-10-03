const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("nightly role records grow once per night and remain stable through the following day", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "botc-role-timing-"));
  const previousDocument = global.document;
  global.document = { querySelector: () => null };
  t.after(() => {
    global.document = previousDocument;
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  fs.cpSync(path.resolve(__dirname, "../frontend/scripts"), directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
  const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
  const { getShiftedPhase } = await load("notes/notes-phase.js");
  const { getRoleInfoRowLimit, getDisplayedRoleInfoEntries } = await load("notes/notes-role-info.js");
  const player = { status: "alive" };
  const ability = (phaseTiming, usagePattern = "once_per_night") => ({
    abilityMeta: { phaseTiming, usagePattern },
  });
  const cases = [
    { data: ability("each_night"), counts: [1, 1, 2, 2, 3, 3] },
    { data: ability("each_night_star"), counts: [0, 0, 1, 1, 2, 2] },
    { data: ability("night"), counts: [0, 0, 1, 1, 2, 2] },
    { data: ability("special"), counts: [1, 1, 2, 2, 3, 3] },
    { data: ability("first_night", "once"), counts: [1, 1, 1, 1, 1, 1] },
    { data: ability("each_day", "once_per_day"), counts: [1, 1, 2, 2, 3, 3] },
  ];
  const node = { repeatMode: "sequence", defaultRows: 3, fields: [{ key: "count" }] };
  for (const { data, counts } of cases) {
    let phase = { phaseType: "night", phaseNumber: 1 };
    for (const count of counts) {
      assert.equal(getRoleInfoRowLimit(data, player, phase), count, JSON.stringify({ meta: data.abilityMeta, phase }));
      assert.equal(getDisplayedRoleInfoEntries({}, node, "result", { abilityData: data, player, game: phase }).length, count);
      phase = getShiftedPhase(phase.phaseType, phase.phaseNumber, 1);
    }
  }

  const recorded = { resultEntries: [{ count: "0" }, { count: "1" }, { count: "2" }] };
  for (const phaseType of ["night", "day"]) {
    const entries = getDisplayedRoleInfoEntries(recorded, node, "result", {
      abilityData: ability("each_night"), player, game: { phaseType, phaseNumber: 2 },
    });
    assert.deepEqual(entries, recorded.resultEntries, "existing information must survive the corrected automatic row count");
  }
});
