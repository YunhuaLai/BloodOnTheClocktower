const {
  applyAbilityTermMetadata,
  getUnmatchedKeywordTokens,
  readTermsConfig,
} = require("./ability-term-utils");
const {
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
  const roleEntries = readYamlCollection(ROLES_DIR);
  const unmatchedCounts = new Map();
  let changed = 0;

  roleEntries.forEach((entry) => {
    const role = entry.data;
    const abilityData = {
      id: role.id,
      englishName: role.englishName,
      name: role.name,
      ...(role.abilityData || {}),
    };
    const nextData = applyAbilityTermMetadata(abilityData, role, termsConfig);
    const before = stable(abilityData);
    const after = stable(nextData);

    getUnmatchedKeywordTokens(role, abilityData, termsConfig).forEach((keyword) => {
      unmatchedCounts.set(keyword, (unmatchedCounts.get(keyword) || 0) + 1);
    });

    if (before !== after) {
      changed += 1;

      if (write) {
        const { id, englishName, name, ...embeddedData } = nextData;
        role.abilityData = embeddedData;
        writeYamlFile(entry.filePath, role);
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
    console.log("Run with --write to update roles/*.yaml abilityData.");
  }
}

main();
