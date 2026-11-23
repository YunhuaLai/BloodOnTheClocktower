// Clean up generated (unreviewed) role abilityData with the conservative rules in lib/ability-cleanup.js.
//
//   node scripts/sync-ability-cleanup.js                 dry run: counts per rule and examples
//   node scripts/sync-ability-cleanup.js --write         write roles/*.yaml
//   node scripts/sync-ability-cleanup.js --rule=genericLabels,roleTypes   only these rules
//
// Roles with hand-reviewed abilityData are never touched.

const { ROLES_DIR, readYamlCollection, writeYamlFile } = require("./lib/library-io");
const { hasHandReviewedAbilityData } = require("./lib/ability-review");
const { RULES, planCleanup } = require("./lib/ability-cleanup");

function main() {
  const write = process.argv.includes("--write");
  const ruleArg = process.argv.find((arg) => arg.startsWith("--rule="));
  const only = ruleArg ? ruleArg.slice("--rule=".length).split(",").filter(Boolean) : Object.keys(RULES);
  const byRule = new Map(only.map((rule) => [rule, []]));
  let files = 0;

  readYamlCollection(ROLES_DIR).forEach((entry) => {
    const role = entry.data;
    if (!role?.abilityData || hasHandReviewedAbilityData(role.abilityData)) {
      return;
    }
    const steps = planCleanup(role).filter((step) => only.includes(step.rule));
    if (!steps.length) {
      return;
    }
    steps.forEach((step) => {
      byRule.get(step.rule).push(`${role.id} ${role.name}: ${step.detail}`);
      step.apply(role.abilityData);
    });
    files += 1;
    if (write) {
      writeYamlFile(entry.filePath, role);
    }
  });

  console.log(`${write ? "Cleaned" : "Would clean"} ${files} role file(s).`);
  byRule.forEach((lines, rule) => {
    console.log(`\n${rule}: ${lines.length}`);
    lines.slice(0, 12).forEach((line) => console.log(`- ${line}`));
    if (lines.length > 12) console.log(`- ... ${lines.length - 12} more`);
  });
  if (!write && files) {
    console.log("\nRun with --write to update roles/*.yaml.");
  }
}

if (require.main === module) {
  main();
}
