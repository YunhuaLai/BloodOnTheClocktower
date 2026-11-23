const crypto = require("node:crypto");

// Shared helpers for manually reviewed role abilityData.
// A role whose abilitySemantics.reviewStatus is "reviewed" has hand-checked abilityPattern,
// abilityMeta, interactionSchema and deduction; the sync-* scripts must not regenerate those.

const ROLE_ABILITY_SOURCE_HASH_FIELDS = [
  "ability",
  "type",
  "setup",
  "reminders",
  "remindersGlobal",
  "firstNightReminder",
  "otherNightReminder",
];

// Labels produced by the generators that say nothing about the ability.
const GENERIC_FIELD_LABELS = new Set([
  "目标号码",
  "号码",
  "号码1",
  "号码2",
  "号码3",
  "记录",
  "身份",
  "目标身份",
  "选择身份",
  "选择角色",
  "是否",
  "数字",
  "阵营",
  "结果",
]);

function isReviewedAbilityData(abilityData) {
  return abilityData?.abilitySemantics?.reviewStatus === "reviewed";
}

/**
 * Hand-checked content that generators must not regenerate: a reviewed role, or one that was reviewed and then
 * flagged source_changed (it keeps its abilitySemantics.review record until someone re-reviews it).
 */
function hasHandReviewedAbilityData(abilityData) {
  const semantics = abilityData?.abilitySemantics;
  return semantics?.reviewStatus === "reviewed" || Boolean(semantics?.review && typeof semantics.review === "object");
}

function hashSourceAbilityPayload(payload) {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function makeSourceAbilityPayload(role = {}) {
  return {
    ability: role.ability || "",
    type: role.type || "",
    setup: Boolean(role.setup),
    reminders: role.reminders || [],
    remindersGlobal: role.remindersGlobal || [],
    firstNightReminder: role.firstNightReminder || "",
    otherNightReminder: role.otherNightReminder || "",
  };
}

function makeSourceAbilityHash(role) {
  return hashSourceAbilityPayload(makeSourceAbilityPayload(role));
}

function getSchemaFields(abilityData, section) {
  const fields = abilityData?.interactionSchema?.[section]?.fields;
  return Array.isArray(fields) ? fields : [];
}

function getAllSchemaFields(abilityData) {
  return [...getSchemaFields(abilityData, "target"), ...getSchemaFields(abilityData, "result")];
}

/** recordable but neither target nor result has a field: the notes page can only say "写在额外信息里". */
function isRecordableWithoutFields(abilityData) {
  return Boolean(abilityData?.abilityMeta?.recordable) && getAllSchemaFields(abilityData).length === 0;
}

function hasTextField(abilityData) {
  return getAllSchemaFields(abilityData).some((field) => field?.type === "text");
}

function getGenericFieldLabels(abilityData) {
  return getAllSchemaFields(abilityData)
    .map((field) => String(field?.label || ""))
    .filter((label) => GENERIC_FIELD_LABELS.has(label));
}

/** The role text changed after the reviewed abilityData was hashed. */
function hasReviewedSourceDrift(abilityData, role) {
  const recordedHash = abilityData?.sourceAbility?.sourceHash;
  return Boolean(isReviewedAbilityData(abilityData) && recordedHash && role && recordedHash !== makeSourceAbilityHash(role));
}

module.exports = {
  GENERIC_FIELD_LABELS,
  ROLE_ABILITY_SOURCE_HASH_FIELDS,
  getAllSchemaFields,
  getGenericFieldLabels,
  hasReviewedSourceDrift,
  hasHandReviewedAbilityData,
  hasTextField,
  isRecordableWithoutFields,
  isReviewedAbilityData,
  makeSourceAbilityHash,
  makeSourceAbilityPayload,
};
