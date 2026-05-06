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
    .map((fileName) => {
      const filePath = path.join(directoryPath, fileName);
      return {
        fileName,
        filePath,
        data: yaml.load(fs.readFileSync(filePath, "utf8")) || {},
      };
    });
}

function writeYamlFile(filePath, data) {
  const content = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    quotingType: "'",
  });
  fs.writeFileSync(filePath, content, "utf8");
}

function stable(value) {
  return JSON.stringify(value);
}

function main() {
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const abilities = readYamlCollection(ROLE_ABILITY_DIR);
  let changed = 0;
  let removed = 0;

  abilities.forEach((entry) => {
    const role = roleById.get(entry.data.id) || {};
    const nextDeduction = inferDeductionData(entry.data, role);
    const before = stable(entry.data.deduction || null);

    if (nextDeduction) {
      entry.data.deduction = nextDeduction;
    } else if (entry.data.deduction) {
      delete entry.data.deduction;
      removed += 1;
    }

    if (stable(entry.data.deduction || null) !== before) {
      writeYamlFile(entry.filePath, entry.data);
      changed += 1;
    }
  });

  console.log(`Backfilled deduction profiles: ${changed} file(s) changed, ${removed} stale profile(s) removed.`);
}

main();
