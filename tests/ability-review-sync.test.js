const assert = require("node:assert/strict");
const test = require("node:test");

const { applyAbilityTermMetadata } = require("../scripts/lib/ability-term-metadata");
const {
  getGenericFieldLabels,
  hasReviewedSourceDrift,
  hasTextField,
  isRecordableWithoutFields,
  makeSourceAbilityHash,
} = require("../scripts/lib/ability-review");
const { syncRoleDeduction } = require("../scripts/sync-deduction-profiles");
const { syncRoleAbilitySemantics } = require("../scripts/sync-ability-semantics");
const { buildCoverage, describeRole } = require("../scripts/audit-ability-review");

const termsConfig = { terms: [], replacements: [] };

function seatField(key, label) {
  return { key, type: "seat", label, required: true, optionsSource: null, options: null, min: 1, max: 15, placeholder: null };
}

function roleField(key, label) {
  return { key, type: "role", label, required: true, optionsSource: "current_script_roles", options: null, min: null, max: null, placeholder: null };
}

// A "look at a player, learn their character" role the generators would profile as role_at_seat.
function makeRole(reviewStatus, overrides = {}) {
  const role = {
    id: "x900",
    name: "测试角色",
    englishName: "test-role",
    type: "townsfolk",
    ability: "每个夜晚，你要选择一名玩家：你会得知他的角色。",
    reminders: [],
    remindersGlobal: [],
    firstNightReminder: "",
    otherNightReminder: "",
  };
  role.abilityData = {
    schemaVersion: 2,
    generatedFromOfficial: true,
    sourceAbility: {
      source: "role-file",
      roleId: role.id,
      officialId: role.englishName,
      sourceHash: makeSourceAbilityHash(role),
      sourceHashFields: [],
    },
    tags: ["每晚"],
    termIds: [],
    abilityPattern: "manual_record",
    abilitySemantics: {
      schemaVersion: 1,
      reviewStatus,
      confidence: 0.9,
      timing: { phase: "each_night", event: null, frequency: "once_per_night" },
      actor: { drivenBy: "player" },
      operations: [{ kind: "choose_player", count: 1, source: "target" }],
    },
    abilityMeta: {
      pageType: "pick_and_record",
      phaseTiming: "each_night",
      eventTiming: null,
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
      recordable: true,
    },
    interactionSchema: {
      target: { repeatMode: "sequence", defaultRows: 3, fields: [seatField("seat", "查验对象")] },
      result: { repeatMode: "sequence", defaultRows: 3, fields: [roleField("role", "得知角色")] },
    },
    ...overrides,
  };
  return role;
}

test("term metadata keeps a reviewed abilityPattern but re-infers unreviewed ones", () => {
  const reviewed = makeRole("reviewed");
  const auto = makeRole("auto");

  assert.equal(applyAbilityTermMetadata(reviewed.abilityData, reviewed, termsConfig).abilityPattern, "manual_record");
  assert.equal(applyAbilityTermMetadata(auto.abilityData, auto, termsConfig).abilityPattern, "target_role_info");
});

test("deduction sync leaves reviewed roles alone, including a deliberately absent profile", () => {
  const reviewedWithout = makeRole("reviewed");
  const result = syncRoleDeduction(reviewedWithout);
  assert.equal(result.skipped, true);
  assert.equal(result.changed, false);
  assert.equal(result.abilityData.deduction, undefined);

  const handProfile = { status: "record_only", source: "manual", label: "只记录行动" };
  const reviewedWith = makeRole("reviewed", { deduction: handProfile });
  assert.deepEqual(syncRoleDeduction(reviewedWith).abilityData.deduction, handProfile);

  const auto = makeRole("needs_review", { deduction: handProfile });
  const autoResult = syncRoleDeduction(auto);
  assert.equal(autoResult.skipped, false);
  assert.equal(autoResult.changed, true);
  assert.equal(autoResult.abilityData.deduction.status, "candidate");
});

test("semantics sync neither adds a deduction to nor re-patterns a reviewed role", () => {
  const reviewed = makeRole("reviewed");
  const reviewedResult = syncRoleAbilitySemantics(reviewed, termsConfig);
  assert.equal(reviewedResult.abilityData.deduction, undefined);
  assert.equal(reviewedResult.abilityData.abilityPattern, "manual_record");
  assert.equal(reviewedResult.changed, false);

  const auto = makeRole("auto");
  const autoResult = syncRoleAbilitySemantics(auto, termsConfig);
  assert.equal(autoResult.abilityData.deduction.status, "candidate");
  assert.equal(autoResult.abilityData.abilityPattern, "target_role_info");
  assert.equal(autoResult.changed, true);
});

test("source drift is reported only for reviewed roles whose text changed", () => {
  const reviewed = makeRole("reviewed");
  assert.equal(hasReviewedSourceDrift(reviewed.abilityData, reviewed), false);

  const edited = { ...reviewed, ability: `${reviewed.ability}（改）` };
  assert.equal(hasReviewedSourceDrift(reviewed.abilityData, edited), true);

  const auto = makeRole("auto");
  assert.equal(hasReviewedSourceDrift(auto.abilityData, { ...auto, ability: "别的文本" }), false);
});

test("audit flags recordable roles without fields, free text and generic labels", () => {
  const empty = makeRole("auto");
  empty.abilityData.interactionSchema = {
    target: { repeatMode: "none", defaultRows: 0, fields: [] },
    result: { repeatMode: "none", defaultRows: 0, fields: [] },
  };
  assert.equal(isRecordableWithoutFields(empty.abilityData), true);

  const generic = makeRole("auto");
  generic.abilityData.interactionSchema.target.fields = [seatField("seat", "目标号码")];
  generic.abilityData.interactionSchema.result.fields = [{ key: "note", type: "text", label: "记录" }];
  assert.equal(hasTextField(generic.abilityData), true);
  assert.deepEqual(getGenericFieldLabels(generic.abilityData), ["目标号码", "记录"]);

  const scripts = [
    { id: "s001", roleIds: ["x900", "x901"], travellerIds: ["x902"] },
    { id: "s002", roleIds: ["x900"], fabledIds: [] },
  ];
  const coverage = buildCoverage(scripts);
  assert.deepEqual(coverage.get("x900"), ["s001", "s002"]);
  assert.deepEqual(coverage.get("x902"), ["s001"]);

  const row = describeRole(generic, coverage.get("x900"));
  assert.equal(row.scriptCount, 2);
  assert.equal(row.reviewStatus, "auto");
  assert.equal(row.hasTextField, true);
  assert.equal(row.recordableWithoutFields, false);
  assert.equal(row.deductionStatus, "none");
});

test("official re-import keeps a reviewed role's hand-checked data and only flags changed text", () => {
  const { makeExistingRoleAbilityData } = require("../scripts/manage-official-json");
  const reviewed = makeRole("reviewed", { deduction: { status: "record_only", source: "manual", label: "只记录行动" } });
  reviewed.abilityData.abilitySemantics.review = { reviewer: "tester", reviewerKind: "human", reviewedAt: "2026-01-01" };
  const existing = { id: reviewed.id, englishName: reviewed.englishName, name: reviewed.name, ...reviewed.abilityData };

  const same = makeExistingRoleAbilityData(existing, reviewed, { id: "test-role", ability: reviewed.ability });
  assert.equal(same.abilitySemantics.reviewStatus, "reviewed");
  assert.equal(same.abilityPattern, "manual_record");

  const changedRole = { ...reviewed, ability: `${reviewed.ability}（新版）` };
  const changed = makeExistingRoleAbilityData(existing, changedRole, { id: "test-role", ability: changedRole.ability });
  assert.equal(changed.abilitySemantics.reviewStatus, "source_changed");
  assert.deepEqual(changed.abilitySemantics.review, reviewed.abilityData.abilitySemantics.review);
  assert.deepEqual(changed.abilitySemantics.operations, reviewed.abilityData.abilitySemantics.operations);
  assert.deepEqual(changed.interactionSchema, reviewed.abilityData.interactionSchema);
  assert.equal(changed.abilityPattern, "manual_record");
  assert.equal(changed.needsReview, true);

  // The sync scripts keep treating it as hand-reviewed until someone re-reviews it.
  const { id, englishName, name, ...embedded } = changed;
  const flagged = { ...changedRole, abilityData: embedded };
  assert.equal(syncRoleDeduction(flagged).skipped, true);
  assert.deepEqual(syncRoleAbilitySemantics(flagged, termsConfig).abilityData.deduction, reviewed.abilityData.deduction);
});
