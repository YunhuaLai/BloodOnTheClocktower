const {
  applyAbilityTermMetadata,
  getUnmatchedKeywordTokens,
  readTermsConfig,
} = require("./lib/ability-term-metadata");
const {
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./lib/library-io");

function stable(value) {
  return JSON.stringify(value);
}

function main() {
  const write = process.argv.includes("--write");
  const termsConfig = readTermsConfig();
  const roleEntries = readYamlCollection(ROLES_DIR);
  const unmatchedCounts = new Map();
  const changedIds = [];

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
      changedIds.push(role.id);

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
    `${write ? "Synced" : "Checked"} ability term metadata: ${changedIds.length} file(s) ${
      write ? "changed" : "would change"
    }.`,
  );

  if (changedIds.length) {
    console.log(`- ${changedIds.slice(0, 30).join(", ")}${changedIds.length > 30 ? ", ..." : ""}`);
  }

  if (unmatched.length) {
    console.log("Common unmatched role keywords/tags:");
    unmatched.forEach(([keyword, count]) => {
      console.log(`- ${keyword}: ${count}`);
    });
  }

  if (!write && changedIds.length) {
    console.log("Run with --write to update roles/*.yaml abilityData.");
  }
}


if (require.main === module) {
  main();
}
