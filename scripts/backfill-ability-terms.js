const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const {
  applyAbilityTermMetadata,
  getUnmatchedKeywordTokens,
  readTermsConfig,
} = require("./ability-term-utils");

const ROOT_DIR = path.resolve(__dirname, "..");
const ROLES_DIR = path.join(ROOT_DIR, "backend", "data", "library", "roles");
const ROLE_ABILITIES_DIR = path.join(ROOT_DIR, "backend", "data", "library", "role-abilities");

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
  const write = process.argv.includes("--write");
  const termsConfig = readTermsConfig();
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const abilities = readYamlCollection(ROLE_ABILITIES_DIR);
  const unmatchedCounts = new Map();
  let changed = 0;

  abilities.forEach((entry) => {
    const role = roleById.get(entry.data.id) || {};
    const nextData = applyAbilityTermMetadata(entry.data, role, termsConfig);
    const before = stable(entry.data);
    const after = stable(nextData);

    getUnmatchedKeywordTokens(role, entry.data, termsConfig).forEach((keyword) => {
      unmatchedCounts.set(keyword, (unmatchedCounts.get(keyword) || 0) + 1);
    });

    if (before !== after) {
      changed += 1;

      if (write) {
        writeYamlFile(entry.filePath, nextData);
      }
    }
  });

  const unmatched = Array.from(unmatchedCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans"))
    .slice(0, 30);

  console.log(
    `${write ? "Backfilled" : "Checked"} ability term metadata: ${changed} file(s) ${
      write ? "changed" : "would change"
    }.`,
  );

  if (unmatched.length) {
    console.log("Common unmatched role keywords/tags:");
    unmatched.forEach(([keyword, count]) => {
      console.log(`- ${keyword}: ${count}`);
    });
  }

  if (!write && changed) {
    console.log("Run with --write to update role-abilities/*.yaml.");
  }
}

main();
