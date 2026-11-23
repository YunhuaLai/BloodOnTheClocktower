const { inferDeductionData } = require("./lib/deduction-profile-inference");
const { hasHandReviewedAbilityData } = require("./lib/ability-review");
const {
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./lib/library-io");

function stable(value) {
  return JSON.stringify(value);
}

/**
 * Re-infer one role's deduction profile.
 * Returns { changed, removed, skipped, abilityData } where abilityData is the embedded data to write.
 * Reviewed roles keep their hand-checked deduction (including a deliberately absent one).
 */
function syncRoleDeduction(role) {
  if (hasHandReviewedAbilityData(role.abilityData)) {
    return { changed: false, removed: false, skipped: true, abilityData: role.abilityData };
  }

  const abilityData = {
    id: role.id,
    englishName: role.englishName,
    name: role.name,
    ...(role.abilityData || {}),
  };
  const nextDeduction = inferDeductionData(abilityData, role);
  const before = stable(abilityData.deduction || null);
  let removed = false;

  if (nextDeduction) {
    abilityData.deduction = nextDeduction;
  } else if (abilityData.deduction) {
    delete abilityData.deduction;
    removed = true;
  }

  const { id, englishName, name, ...embeddedData } = abilityData;
  return {
    changed: stable(abilityData.deduction || null) !== before,
    removed,
    skipped: false,
    abilityData: embeddedData,
  };
}

function main() {
  const write = process.argv.includes("--write");
  const roleEntries = readYamlCollection(ROLES_DIR);
  const changedIds = [];
  let removed = 0;
  let skipped = 0;

  roleEntries.forEach((entry) => {
    const role = entry.data;
    const result = syncRoleDeduction(role);

    if (result.skipped) {
      skipped += 1;
      return;
    }

    if (result.changed) {
      changedIds.push(role.id);
      if (result.removed) {
        removed += 1;
      }

      if (write) {
        role.abilityData = result.abilityData;
        writeYamlFile(entry.filePath, role);
      }
    }
  });

  console.log(
    `${write ? "Synced" : "Checked"} deduction profiles: ${changedIds.length} role file(s) ${
      write ? "changed" : "would change"
    }, ${removed} stale profile(s) ${write ? "removed" : "would be removed"}, ${skipped} reviewed role(s) kept as is.`,
  );

  if (changedIds.length) {
    console.log(`- ${changedIds.slice(0, 30).join(", ")}${changedIds.length > 30 ? ", ..." : ""}`);
  }

  if (!write && changedIds.length) {
    console.log("Run with --write to update roles/*.yaml abilityData.");
  }
}

if (require.main === module) {
  main();
}

module.exports = { syncRoleDeduction };
