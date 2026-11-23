// Read-only report: role abilityData review state, ordered by how many scripts include the role.
//
//   node scripts/audit-ability-review.js                 all roles that appear in at least one script
//   node scripts/audit-ability-review.js --script=s001   only roles of s001 (comma-separate several ids)
//   node scripts/audit-ability-review.js --all           also list roles that no script includes
//   node scripts/audit-ability-review.js --status=needs_review,source_changed
//   node scripts/audit-ability-review.js --limit=50      rows printed to the console (report files keep all)
//
// Reports go to tmp/ability-review-audit[-<scripts>].md and .json; YAML is never written.

const fs = require("node:fs");
const path = require("node:path");
const {
  ROLES_DIR,
  ROOT_DIR,
  SCRIPTS_DIR,
  readYamlCollection,
  relativeToRoot,
} = require("./lib/library-io");
const {
  getGenericFieldLabels,
  hasReviewedSourceDrift,
  hasTextField,
  isRecordableWithoutFields,
} = require("./lib/ability-review");

const REVIEW_STATUS_ORDER = ["reviewed", "auto", "needs_review", "source_changed"];
const TYPE_ORDER = ["townsfolk", "outsider", "minion", "demon", "traveller", "fabled"];

function parseArgs(argv) {
  const options = { scripts: [], statuses: [], limit: null, all: false, unknown: [] };

  argv.forEach((arg) => {
    if (!arg.startsWith("--")) {
      options.unknown.push(arg);
      return;
    }
    const [key, value = ""] = arg.slice(2).split("=");
    const list = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (key === "script" || key === "scripts") options.scripts.push(...list);
    else if (key === "status") options.statuses.push(...list);
    else if (key === "limit") options.limit = Math.max(0, Number(value) || 0);
    else if (key === "all") options.all = true;
    else options.unknown.push(arg);
  });

  return options;
}

function getScriptRoleIds(script) {
  return [
    ...(script.roleIds || []),
    ...(script.travellerIds || []),
    ...(script.fabledIds || []),
  ].filter(Boolean);
}

function buildCoverage(scripts) {
  const coverage = new Map();

  scripts.forEach((script) => {
    new Set(getScriptRoleIds(script)).forEach((roleId) => {
      if (!coverage.has(roleId)) coverage.set(roleId, []);
      coverage.get(roleId).push(script.id);
    });
  });

  return coverage;
}

function describeRole(role, scriptIds) {
  const abilityData = role.abilityData || {};
  const semantics = abilityData.abilitySemantics || {};
  const review = semantics.review || null;

  return {
    id: role.id,
    name: role.name,
    type: role.type || "",
    scriptCount: scriptIds.length,
    reviewStatus: semantics.reviewStatus || "missing",
    confidence: typeof semantics.confidence === "number" ? semantics.confidence : null,
    needsReview: Boolean(abilityData.needsReview),
    recordable: Boolean(abilityData.abilityMeta?.recordable),
    recordableWithoutFields: isRecordableWithoutFields(abilityData),
    hasTextField: hasTextField(abilityData),
    genericLabels: getGenericFieldLabels(abilityData),
    deductionStatus: abilityData.deduction?.status || "none",
    sourceDrift: hasReviewedSourceDrift(abilityData, role),
    reviewedBy: review?.reviewer || "",
    reviewedAt: review?.reviewedAt || "",
  };
}

function compareRows(left, right) {
  return (
    right.scriptCount - left.scriptCount ||
    TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type) ||
    String(left.id).localeCompare(String(right.id), "en", { numeric: true })
  );
}

function countBy(rows, pick) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = pick(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function formatCounts(counts, order = []) {
  const keys = [...counts.keys()].sort(
    (left, right) =>
      (order.includes(left) ? order.indexOf(left) : order.length) -
        (order.includes(right) ? order.indexOf(right) : order.length) || String(left).localeCompare(String(right)),
  );
  return keys.map((key) => `${key} ${counts.get(key)}`).join("，");
}

function summarize(rows) {
  return {
    total: rows.length,
    reviewStatus: Object.fromEntries(countBy(rows, (row) => row.reviewStatus)),
    deductionStatus: Object.fromEntries(countBy(rows, (row) => row.deductionStatus)),
    recordableWithoutFields: rows.filter((row) => row.recordableWithoutFields).length,
    hasTextField: rows.filter((row) => row.hasTextField).length,
    genericLabels: rows.filter((row) => row.genericLabels.length).length,
    sourceDrift: rows.filter((row) => row.sourceDrift).length,
  };
}

function flagText(row) {
  const flags = [];
  if (row.recordableWithoutFields) flags.push("可记录无字段");
  if (row.hasTextField) flags.push("自由文本");
  if (row.genericLabels.length) flags.push(`泛标签:${[...new Set(row.genericLabels)].join("/")}`);
  if (row.sourceDrift) flags.push("审核后原文已变");
  if (row.needsReview && row.reviewStatus === "reviewed") flags.push("needsReview残留");
  return flags.join(" ");
}

function formatConfidence(value) {
  return value === null ? "-" : value.toFixed(2);
}

function formatConsoleRow(row) {
  return [
    String(row.scriptCount).padStart(3),
    row.id.padEnd(5),
    row.name,
    `[${row.type}]`,
    row.reviewStatus,
    formatConfidence(row.confidence),
    `推理:${row.deductionStatus}`,
    flagText(row),
  ]
    .filter(Boolean)
    .join(" ");
}

function formatSummaryLines(summary) {
  return [
    `角色数：${summary.total}`,
    `审核状态：${formatCounts(new Map(Object.entries(summary.reviewStatus)), REVIEW_STATUS_ORDER)}`,
    `推理状态：${formatCounts(new Map(Object.entries(summary.deductionStatus)))}`,
    `可记录但无字段：${summary.recordableWithoutFields}；含自由文本字段：${summary.hasTextField}；含泛标签：${summary.genericLabels}；审核后原文已变：${summary.sourceDrift}`,
  ];
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function makeMarkdown({ title, filters, summary, rows }) {
  const lines = [
    `# ${title}`,
    "",
    `生成时间：${new Date().toISOString()}`,
    `过滤条件：${filters}`,
    "",
    "## 汇总",
    "",
    ...formatSummaryLines(summary).map((line) => `- ${line}`),
    "",
    "## 明细（按收录剧本数排序）",
    "",
    "| 剧本数 | id | 名称 | 类型 | 审核状态 | 置信度 | 推理 | 标记 | 审核者 |",
    "| ---: | --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...rows.map((row) =>
      [
        row.scriptCount,
        row.id,
        row.name,
        row.type,
        row.reviewStatus,
        formatConfidence(row.confidence),
        row.deductionStatus,
        flagText(row),
        row.reviewedBy ? `${row.reviewedBy} ${row.reviewedAt}` : "",
      ]
        .map(escapeCell)
        .join(" | "),
    ).map((line) => `| ${line} |`),
    "",
  ];
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const scripts = readYamlCollection(SCRIPTS_DIR).map((entry) => entry.data).filter((script) => script?.id);
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data).filter((role) => role?.id);
  const coverage = buildCoverage(scripts);

  if (options.unknown.length) {
    console.error(`Unknown argument(s): ${options.unknown.join(" ")}（用法见文件开头注释，例如 --script=s001）`);
    process.exitCode = 1;
    return;
  }

  const unknownScripts = options.scripts.filter((id) => !scripts.some((script) => script.id === id));
  if (unknownScripts.length) {
    console.error(`Unknown script id(s): ${unknownScripts.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const selectedRoleIds = options.scripts.length
    ? new Set(
        scripts
          .filter((script) => options.scripts.includes(script.id))
          .flatMap((script) => getScriptRoleIds(script)),
      )
    : null;

  const rows = roles
    .filter((role) => (selectedRoleIds ? selectedRoleIds.has(role.id) : options.all || coverage.has(role.id)))
    .map((role) => describeRole(role, coverage.get(role.id) || []))
    .filter((row) => !options.statuses.length || options.statuses.includes(row.reviewStatus))
    .sort(compareRows);

  const summary = summarize(rows);
  const filters = [
    options.scripts.length ? `剧本 ${options.scripts.join(",")}` : options.all ? "全部角色" : "被至少一个剧本收录的角色",
    options.statuses.length ? `审核状态 ${options.statuses.join(",")}` : "",
  ]
    .filter(Boolean)
    .join("；");
  const suffix = [
    ...options.scripts,
    ...(options.statuses.length ? [options.statuses.join("-")] : []),
    ...(options.all && !options.scripts.length ? ["all"] : []),
  ]
    .map((part) => `-${part}`)
    .join("");
  const outputDir = path.join(ROOT_DIR, "tmp");
  const markdownPath = path.join(outputDir, `ability-review-audit${suffix}.md`);
  const jsonPath = path.join(outputDir, `ability-review-audit${suffix}.json`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(markdownPath, makeMarkdown({ title: "角色能力数据审核报告", filters, summary, rows }), "utf8");
  fs.writeFileSync(jsonPath, `${JSON.stringify({ filters, summary, rows }, null, 2)}\n`, "utf8");

  const limit = options.limit ?? (options.scripts.length ? rows.length : 40);
  console.log(`角色能力数据审核报告（${filters}）`);
  formatSummaryLines(summary).forEach((line) => console.log(`- ${line}`));
  if (limit) {
    console.log(`\n剧本数 id 名称 [类型] 审核状态 置信度 推理 标记${rows.length > limit ? `（前 ${limit} 条）` : ""}`);
    rows.slice(0, limit).forEach((row) => console.log(formatConsoleRow(row)));
  }
  console.log(`\n报告：${relativeToRoot(markdownPath)}，${relativeToRoot(jsonPath)}`);
}

if (require.main === module) {
  main();
}

module.exports = { buildCoverage, describeRole, getScriptRoleIds, summarize };
