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
  const { buildRoleInfoForm } = await load("notes/notes-role-info-form.js");
  const player = { status: "alive" };
  const ability = (phaseTiming, usagePattern = "once_per_night") => ({
    abilityMeta: { phaseTiming, usagePattern, recordable: true },
    interactionSchema: { result: { repeatMode: "sequence", defaultRows: 3, fields: [{ key: "count", type: "number" }] } },
  });
  const rows = (abilityData, game, roleInfo = { records: [] }) =>
    buildRoleInfoForm({ abilityData, roleInfo, player, game }).rows;
  // Phases: night 1, day 1, night 2, day 2, night 3, day 3. A day row only appears once that day starts.
  const cases = [
    { data: ability("each_night"), counts: [1, 1, 2, 2, 3, 3] },
    { data: ability("each_night_star"), counts: [0, 0, 1, 1, 2, 2] },
    { data: ability("night"), counts: [0, 0, 1, 1, 2, 2] },
    { data: ability("special"), counts: [1, 1, 2, 2, 3, 3] },
    { data: ability("first_night", "once"), counts: [1, 1, 1, 1, 1, 1] },
    { data: ability("each_day", "once_per_day"), counts: [0, 1, 1, 2, 2, 3] },
  ];
  for (const { data, counts } of cases) {
    let phase = { phaseType: "night", phaseNumber: 1 };
    for (const count of counts) {
      assert.equal(rows(data, phase).length, count, JSON.stringify({ meta: data.abilityMeta, phase }));
      phase = getShiftedPhase(phase.phaseType, phase.phaseNumber, 1);
    }
  }

  const recorded = {
    records: [0, 1, 2].map((index) => ({
      phaseType: "night", phaseNumber: index + 1, targetEntries: [], resultEntries: [{ count: String(index) }],
    })),
  };
  for (const phaseType of ["night", "day"]) {
    const values = rows(ability("each_night"), { phaseType, phaseNumber: 2 }, recorded).map((row) => row.cells[0].value);
    assert.deepEqual(values, ["0", "1", "2"], "existing information must survive the automatic row count");
  }
});
