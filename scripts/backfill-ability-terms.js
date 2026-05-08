const {
  applyAbilityTermMetadata,
  getUnmatchedKeywordTokens,
  readTermsConfig,
} = require("./ability-term-utils");
const {
  ROLE_ABILITIES_DIR,
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./library-files");

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
