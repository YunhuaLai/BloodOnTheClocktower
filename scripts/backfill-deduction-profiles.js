const { inferDeductionData } = require("./lib/deduction-profile-inference");
const {
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./lib/library-io");

function stable(value) {
  return JSON.stringify(value);
}

function main() {
  const roleEntries = readYamlCollection(ROLES_DIR);
  let changed = 0;
  let removed = 0;

  roleEntries.forEach((entry) => {
    const role = entry.data;
    const abilityData = {
      id: role.id,
      englishName: role.englishName,
      name: role.name,
      ...(role.abilityData || {}),
    };
    const nextDeduction = inferDeductionData(abilityData, role);
    const before = stable(abilityData.deduction || null);

    if (nextDeduction) {
      abilityData.deduction = nextDeduction;
    } else if (abilityData.deduction) {
      delete abilityData.deduction;
      removed += 1;
    }

    if (stable(abilityData.deduction || null) !== before) {
      const { id, englishName, name, ...embeddedData } = abilityData;
      role.abilityData = embeddedData;
      writeYamlFile(entry.filePath, role);
      changed += 1;
    }
  });

  console.log(`Backfilled deduction profiles: ${changed} role file(s) changed, ${removed} stale profile(s) removed.`);
}

main();
