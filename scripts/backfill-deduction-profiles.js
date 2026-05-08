const { inferDeductionData } = require("./deduction-profile-utils");
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
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const abilities = readYamlCollection(ROLE_ABILITIES_DIR);
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
