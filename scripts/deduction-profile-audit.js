const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { inferDeductionData } = require("./deduction-profile-utils");

const ROOT_DIR = path.resolve(__dirname, "..");
const ROLES_DIR = path.join(ROOT_DIR, "backend", "data", "library", "roles");
const ROLE_ABILITY_DIR = path.join(ROOT_DIR, "backend", "data", "library", "role-abilities");

function readYamlCollection(directoryPath) {
  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".yaml"))
    .map((fileName) => ({
      fileName,
      filePath: path.join(directoryPath, fileName),
      data: yaml.load(fs.readFileSync(path.join(directoryPath, fileName), "utf8")) || {},
    }));
}

function classify(roleAbility, roleById) {
  return (
    roleAbility.deduction ||
    inferDeductionData(roleAbility, roleById.get(roleAbility.id)) ||
    {
      status: roleAbility.abilityMeta?.recordable ? "record_only" : "none",
      label: roleAbility.abilityMeta?.recordable
        ? "可记录行动/效果，暂不作为信息校验"
        : "无需记录或暂不参与推理",
    }
  );
}

function summarize(items, limit = 14) {
  return items
    .slice(0, limit)
    .map((item) => `${item.id} ${item.name || item.fileName}`)
    .join("、");
}

function main() {
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data);
  const abilities = readYamlCollection(ROLE_ABILITY_DIR);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const buckets = new Map();

  abilities.forEach((entry) => {
    const deduction = classify(entry.data, roleById);
    const status = deduction.status || "none";
    if (!buckets.has(status)) {
      buckets.set(status, []);
    }
    buckets.get(status).push({
      id: entry.data.id,
      name: entry.data.name,
      fileName: entry.fileName,
      deduction,
    });
  });

  const order = [
    ["supported", "已接入自动推理"],
    ["candidate", "可模板化候选"],
    ["world_effect", "世界效果/解释器"],
    ["manual", "信息型但需人工语义"],
    ["record_only", "只记录行动或暂不推理"],
    ["none", "不可记录/被动规则"],
  ];

  console.log(`Deduction profile audit: ${abilities.length} role abilities`);
  order.forEach(([key, label]) => {
    const items = buckets.get(key) || [];
    console.log(`\n${label}: ${items.length}`);
    if (items.length) {
      console.log(`  ${summarize(items)}`);
    }
  });
}

main();
