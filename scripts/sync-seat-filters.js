// Infer seatFilter (alive / dead / notSelf) on target seat fields from the ability text.
//
//   node scripts/sync-seat-filters.js                      dry run: list what would change
//   node scripts/sync-seat-filters.js --write              write unreviewed roles
//   node scripts/sync-seat-filters.js --write --include-reviewed   also write reviewed roles (check the list first)
//
// Only fields without a seatFilter are touched; an explicit value (including one set by hand) is never replaced.
// Reviewed roles are listed but skipped unless --include-reviewed: their schema was checked by hand.

const { ROLES_DIR, readYamlCollection, writeYamlFile } = require("./lib/library-io");
const { hasHandReviewedAbilityData } = require("./lib/ability-review");
const { applySeatFilters, inferSeatFilters } = require("./lib/seat-filter-inference");

function main() {
  const write = process.argv.includes("--write");
  const includeReviewed = process.argv.includes("--include-reviewed");
  const inferred = [];
  const reviewedSkipped = [];
  const ambiguous = [];

  readYamlCollection(ROLES_DIR).forEach((entry) => {
    const role = entry.data;
    if (!role?.abilityData) {
      return;
    }
    const inference = inferSeatFilters(role);
    if (inference.status === "ambiguous") {
      ambiguous.push(role);
      return;
    }
    if (inference.status !== "infer") {
      return;
    }

    const line = `${role.id} ${role.name}: ${inference.fieldKeys.join(",")} -> [${inference.filters.join(", ")}]`;
    if (hasHandReviewedAbilityData(role.abilityData) && !includeReviewed) {
      reviewedSkipped.push(line);
      return;
    }
    inferred.push(line);
    if (write && applySeatFilters(role, inference)) {
      writeYamlFile(entry.filePath, role);
    }
  });

  console.log(`${write ? "Wrote" : "Would write"} seatFilter on ${inferred.length} role(s).`);
  inferred.slice(0, 40).forEach((line) => console.log(`- ${line}`));
  if (inferred.length > 40) console.log(`- ... ${inferred.length - 40} more`);

  if (reviewedSkipped.length) {
    console.log(`\nReviewed roles skipped (${reviewedSkipped.length}); check, then rerun with --include-reviewed or edit by hand:`);
    reviewedSkipped.forEach((line) => console.log(`- ${line}`));
  }

  if (ambiguous.length) {
    console.log(`\nSeveral choose-player clauses, not inferred (${ambiguous.length}):`);
    ambiguous.slice(0, 20).forEach((role) => console.log(`- ${role.id} ${role.name}`));
    if (ambiguous.length > 20) console.log(`- ... ${ambiguous.length - 20} more`);
  }

  if (!write && inferred.length) {
    console.log("\nRun with --write to update roles/*.yaml.");
  }
}

if (require.main === module) {
  main();
}
