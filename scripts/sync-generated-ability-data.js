// Regenerate the abilityData of roles that still hold untouched generator output, with lib/ability-generator.js.
//
//   node scripts/sync-generated-ability-data.js                 dry run: counts and examples, full report in tmp/
//   node scripts/sync-generated-ability-data.js --write         write roles/*.yaml
//   node scripts/sync-generated-ability-data.js --id=r481,r642  only these roles
//
// A role is regenerated only when all of these hold, so hand work is never overwritten:
//  - not reviewed (no abilitySemantics.review record, reviewStatus is not "reviewed")
//  - generatedFromOfficial: true
//  - every target/result field has a key, type and label the generator writes (no hand-made fields or labels)
// The night order (first / other night) comes from the scripts that include the role, or its night reminders.

const fs = require("node:fs");
const path = require("node:path");
const { ROLES_DIR, SCRIPTS_DIR, readYamlCollection, writeYamlFile } = require("./lib/library-io");
const { hasHandReviewedAbilityData } = require("./lib/ability-review");
const { hasOnlyGeneratedFields, makeRoleAbilityData } = require("./lib/ability-generator");

const REPORT_FILE = path.join(__dirname, "..", "tmp", "generated-ability-data.md");

function collectNightOrders() {
  const first = new Set();
  const other = new Set();
  readYamlCollection(SCRIPTS_DIR).forEach((entry) => {
    (entry.data?.nightOrder?.first || []).forEach((id) => first.add(id));
    (entry.data?.nightOrder?.other || []).forEach((id) => other.add(id));
  });
  return { first, other };
}

function regenerationBlocker(abilityData, ability = "") {
  if (!abilityData) return "no abilityData";
  if (hasHandReviewedAbilityData(abilityData)) return "reviewed";
  if (abilityData.generatedFromOfficial !== true) return "hand-written";
  if (!hasOnlyGeneratedFields(abilityData, ability)) return "hand-made fields or labels";
  return null;
}

function regenerateRole(role, nightOrders) {
  const officialRole = {
    id: role.abilityData?.sourceAbility?.officialId || role.englishName || role.id,
    ability: role.ability || "",
    setup: Boolean(role.setup),
    firstNight: nightOrders.first.has(role.id) || String(role.firstNightReminder || "").trim() ? 1 : 0,
    otherNight: nightOrders.other.has(role.id) || String(role.otherNightReminder || "").trim() ? 1 : 0,
  };
  const { id, englishName, name, ...abilityData } = makeRoleAbilityData(role, officialRole);
  return abilityData;
}

function describeFields(abilityData, section) {
  const fields = abilityData?.interactionSchema?.[section]?.fields || [];
  return fields.map((field) => `${field.key}:${field.type}(${field.label})`).join(", ") || "-";
}

function describe(abilityData) {
  const meta = abilityData?.abilityMeta || {};
  return [
    `${abilityData?.abilityPattern} ${meta.phaseTiming}/${meta.usagePattern}${meta.eventTiming ? `/${meta.eventTiming}` : ""}${meta.recordable ? "" : " 不可记录"}`,
    `目标 ${describeFields(abilityData, "target")}`,
    `结果 ${describeFields(abilityData, "result")}`,
    `推理 ${abilityData?.deduction?.status || "-"}`,
  ];
}

function fieldShape(abilityData) {
  return JSON.stringify(
    ["target", "result"].map((section) =>
      (abilityData?.interactionSchema?.[section]?.fields || []).map((field) => [field.key, field.type, field.label]),
    ),
  );
}

function main() {
  const write = process.argv.includes("--write");
  const idArg = process.argv.find((arg) => arg.startsWith("--id="));
  const onlyIds = idArg ? new Set(idArg.slice("--id=".length).split(",").filter(Boolean)) : null;
  const nightOrders = collectNightOrders();
  const skipped = new Map();
  const changes = [];
  let fieldsChanged = 0;
  let timingChanged = 0;
  let staleFixed = 0;

  readYamlCollection(ROLES_DIR).forEach((entry) => {
    const role = entry.data;
    if (!role?.id || (onlyIds && !onlyIds.has(role.id))) return;

    const blocker = regenerationBlocker(role.abilityData, role.ability);
    if (blocker) {
      if (blocker !== "reviewed" && blocker !== "no abilityData") {
        skipped.set(blocker, [...(skipped.get(blocker) || []), `${role.id} ${role.name}`]);
      }
      return;
    }

    const before = role.abilityData;
    const after = regenerateRole(role, nightOrders);
    if (JSON.stringify(before) === JSON.stringify(after)) return;

    const shapeChanged = fieldShape(before) !== fieldShape(after);
    const metaBefore = before.abilityMeta || {};
    const metaAfter = after.abilityMeta || {};
    const timingDiff = ["phaseTiming", "usagePattern", "eventTiming", "recordable"].some(
      (key) => metaBefore[key] !== metaAfter[key],
    );
    fieldsChanged += shapeChanged ? 1 : 0;
    timingChanged += timingDiff ? 1 : 0;
    staleFixed += before.abilitySemantics?.reviewStatus === "source_changed" ? 1 : 0;
    if (shapeChanged || timingDiff) {
      changes.push({ role, before: describe(before), after: describe(after) });
    }

    if (write) {
      role.abilityData = after;
      writeYamlFile(entry.filePath, role);
    }
  });

  const total = changes.length;
  console.log(`${write ? "Regenerated" : "Would regenerate"} abilityData: ${total} role(s) with field or timing changes.`);
  console.log(`- fields changed: ${fieldsChanged}`);
  console.log(`- timing / recordable changed: ${timingChanged}`);
  console.log(`- source_changed roles regenerated from the current text: ${staleFixed}`);
  changes.slice(0, 15).forEach(({ role, before, after }) => {
    console.log(`\n${role.id} ${role.name}：${role.ability}`);
    console.log(`  旧 ${before.join(" | ")}`);
    console.log(`  新 ${after.join(" | ")}`);
  });
  if (total > 15) console.log(`\n... ${total - 15} more, see the report.`);

  skipped.forEach((lines, reason) => {
    console.log(`\nSkipped (${reason}): ${lines.length}`);
    console.log(`- ${lines.slice(0, 20).join("、")}${lines.length > 20 ? " ..." : ""}`);
  });

  const report = [
    "# 重新生成能力数据",
    "",
    `- 模式：${write ? "已写入" : "dry-run"}`,
    `- 字段或时机有变化：${total}（字段 ${fieldsChanged}，时机/可记录 ${timingChanged}）`,
    `- 原文已变、按当前原文重新生成：${staleFixed}`,
    "",
    ...changes.flatMap(({ role, before, after }) => [
      `## ${role.id} ${role.name}`,
      "",
      `> ${role.ability}`,
      "",
      ...before.map((line) => `- 旧：${line}`),
      ...after.map((line) => `- 新：${line}`),
      "",
    ]),
  ].join("\n");
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, report, "utf8");
  console.log(`\nReport: ${path.relative(process.cwd(), REPORT_FILE)}`);
  if (!write && total) console.log("Run with --write to update roles/*.yaml.");
}

if (require.main === module) {
  main();
}

module.exports = { regenerateRole, regenerationBlocker };
