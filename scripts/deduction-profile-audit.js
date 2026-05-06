const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT_DIR = path.resolve(__dirname, "..");
const ROLE_ABILITY_DIR = path.join(ROOT_DIR, "backend", "data", "library", "role-abilities");
const PROFILE_FILE = path.join(
  ROOT_DIR,
  "frontend",
  "scripts",
  "notes",
  "deduction",
  "profiles.js",
);

function readProfileIds(sectionStart, sectionEnd = "") {
  const text = fs.readFileSync(PROFILE_FILE, "utf8");
  const startIndex = text.indexOf(sectionStart);
  if (startIndex < 0) {
    return new Set();
  }

  const endIndex = sectionEnd ? text.indexOf(sectionEnd, startIndex) : text.length;
  const section = text.slice(startIndex, endIndex < 0 ? text.length : endIndex);
  return new Set([...section.matchAll(/^\s+(r\d+):\s*{/gm)].map((match) => match[1]));
}

function loadRoles() {
  return fs
    .readdirSync(ROLE_ABILITY_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => {
      const data = yaml.load(fs.readFileSync(path.join(ROLE_ABILITY_DIR, file), "utf8")) || {};
      return { file, ...data };
    });
}

function fields(role, section) {
  return role.interactionSchema?.[section]?.fields || [];
}

function allFields(role) {
  return [...fields(role, "target"), ...fields(role, "result")];
}

function hasTag(role, tag) {
  return Array.isArray(role.tags) && role.tags.includes(tag);
}

function hasField(role, section, key, type = "") {
  return fields(role, section).some(
    (field) => field.key === key && (!type || field.type === type),
  );
}

function hasAnyFieldType(role, type) {
  return allFields(role).some((field) => field.type === type);
}

function classifyRole(role, supportedIds, effectIds) {
  if (supportedIds.has(role.id)) {
    return "supported";
  }

  if (effectIds.has(role.id)) {
    return "world_effect";
  }

  if (!role.abilityMeta?.recordable) {
    return "not_recordable";
  }

  if (
    hasField(role, "target", "seat", "seat") &&
    (hasField(role, "result", "role", "role") ||
      hasField(role, "result", "hit_demon", "boolean"))
  ) {
    return "candidate";
  }

  if (
    hasField(role, "target", "seat1", "seat") &&
    hasField(role, "target", "seat2", "seat") &&
    hasField(role, "result", "same_team", "boolean")
  ) {
    return "candidate";
  }

  if (
    hasTag(role, "信息型") &&
    (hasAnyFieldType(role, "role") || hasAnyFieldType(role, "team") || hasAnyFieldType(role, "number"))
  ) {
    return "candidate";
  }

  if (hasTag(role, "信息型")) {
    return "manual_info";
  }

  return "record_only";
}

function summarize(items, limit = 14) {
  return items
    .slice(0, limit)
    .map((role) => `${role.id} ${role.name || role.file}`)
    .join("、");
}

function main() {
  const roles = loadRoles();
  const supportedIds = readProfileIds(
    "const roleDeductionProfiles = {",
    "const worldEffectProfiles = {",
  );
  const effectIds = readProfileIds("const worldEffectProfiles = {", "function getFields");
  const buckets = new Map();

  roles.forEach((role) => {
    const key = classifyRole(role, supportedIds, effectIds);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(role);
  });

  const order = [
    ["supported", "已接入自动推理"],
    ["candidate", "可模板化候选"],
    ["world_effect", "世界效果/解释器"],
    ["manual_info", "信息型但需人工语义"],
    ["record_only", "只记录行动或暂不推理"],
    ["not_recordable", "不可记录/被动规则"],
  ];

  console.log(`Deduction profile audit: ${roles.length} roles`);
  order.forEach(([key, label]) => {
    const items = buckets.get(key) || [];
    console.log(`\n${label}: ${items.length}`);
    if (items.length) {
      console.log(`  ${summarize(items)}`);
    }
  });
}

main();
