const {
  applyAbilityTermMetadata,
  readTermsConfig,
} = require("./lib/ability-term-metadata");
const {
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./lib/library-io");
const { inferDeductionData } = require("./lib/deduction-profile-inference");
const {
  ROLE_ABILITY_SOURCE_HASH_FIELDS,
  hasHandReviewedAbilityData,
  makeSourceAbilityHash,
} = require("./lib/ability-review");

const FIELD_ORDER = [
  "schemaVersion",
  "generatedFromOfficial",
  "sourceAbility",
  "needsReview",
  "reviewReason",
  "tags",
  "termIds",
  "abilityPattern",
  "abilitySemantics",
  "abilityMeta",
  "interactionSchema",
  "deduction",
];

function stable(value) {
  return JSON.stringify(value);
}

function makeSourceAbilityData(role) {
  return {
    source: "role-file",
    roleId: role.id || "",
    officialId: role.englishName || "",
    sourceHash: makeSourceAbilityHash(role),
    sourceHashFields: ROLE_ABILITY_SOURCE_HASH_FIELDS,
  };
}

function getFields(abilityData, section) {
  return abilityData?.interactionSchema?.[section]?.fields || [];
}

function countFieldsByType(abilityData, section, type) {
  return getFields(abilityData, section).filter((field) => field?.type === type).length;
}

function hasFieldType(abilityData, section, type) {
  return getFields(abilityData, section).some((field) => field?.type === type);
}

function hasFieldKey(abilityData, section, key) {
  return getFields(abilityData, section).some((field) => field?.key === key);
}

function inferRoleTypeHint(text) {
  if (/镇民|townsfolk/i.test(text)) return "townsfolk";
  if (/外来者|outsider/i.test(text)) return "outsider";
  if (/爪牙|minion/i.test(text)) return "minion";
  if (/恶魔|demon/i.test(text)) return "demon";
  return null;
}

function inferBooleanQuestionKind(text) {
  if (/恶魔|demon/i.test(text)) return "demon_check";
  if (/同阵营|同一阵营|相同阵营|same team/i.test(text)) return "team_relation";
  if (/投票|vote/i.test(text)) return "vote_check";
  if (/提名|nomination/i.test(text)) return "nomination_check";
  return "boolean_check";
}

function inferNumberKind(text) {
  if (/距离|distance/i.test(text)) return "distance";
  if (/死亡|死去|死者|dead|death/i.test(text)) return "death_count";
  if (/邪恶|恶|evil/i.test(text)) return "evil_count";
  return "count";
}

function inferActor(pageType) {
  if (pageType === "pick_and_record") return "player";
  if (pageType === "rule_modifier" || pageType === "no_input") return "system";
  return "storyteller";
}

function inferOperations(role, abilityData) {
  const text = [
    role.ability,
    abilityData.tags?.join(" "),
    abilityData.abilityPattern,
  ]
    .filter(Boolean)
    .join(" ");
  const operations = [];
  const targetSeatCount = countFieldsByType(abilityData, "target", "seat");
  const resultSeatCount = countFieldsByType(abilityData, "result", "seat");
  const hasTargetRole = hasFieldType(abilityData, "target", "role");
  const hasResultRole = hasFieldType(abilityData, "result", "role");
  const hasResultBoolean = hasFieldType(abilityData, "result", "boolean");
  const hasResultNumber = hasFieldType(abilityData, "result", "number");
  const hasResultTeam = hasFieldType(abilityData, "result", "team");
  const hasResultSeat = hasFieldType(abilityData, "result", "seat");

  if (role.setup || role.setupMeta?.configurationAdjustments?.length) {
    operations.push({
      kind: "setup_modifier",
      adjustments: role.setupMeta?.configurationAdjustments || [],
    });
  }

  if (targetSeatCount) {
    operations.push({
      kind: "choose_player",
      count: targetSeatCount,
      source: "target",
    });
  }

  if (hasTargetRole) {
    operations.push({
      kind: "choose_role",
      source: "target",
    });
  }

  if (hasFieldKey(abilityData, "result", "seat1") && hasFieldKey(abilityData, "result", "seat2") && hasResultRole) {
    operations.push({
      kind: "learn_role_in_group",
      seats: resultSeatCount || 2,
      roleType: inferRoleTypeHint(text),
    });
  } else if (targetSeatCount && hasResultRole) {
    operations.push({
      kind: "learn_role_at_target",
      targetSource: "target",
    });
  } else if (hasResultRole) {
    operations.push({
      kind: "learn_role",
      roleType: inferRoleTypeHint(text),
    });
  }

  if (hasResultBoolean) {
    operations.push({
      kind: "learn_boolean",
      question: inferBooleanQuestionKind(text),
    });
  }

  if (hasResultNumber) {
    operations.push({
      kind: "learn_number",
      numberKind: inferNumberKind(text),
    });
  }

  if (hasResultTeam) {
    operations.push({
      kind: "learn_team",
    });
  }

  if (hasResultSeat && !hasResultRole) {
    operations.push({
      kind: "learn_player",
      count: resultSeatCount || 1,
    });
  }

  if (/中毒|醉酒|失去能力|poison|drunk|malfunction/i.test(text)) {
    operations.push({
      kind: "apply_status_effect",
      effect: "poison_drunk_or_malfunction",
    });
  }

  if (/保护|不会死亡|免于死亡|免受|免疫|无效|protect|safe/i.test(text)) {
    operations.push({
      kind: "protect_player",
    });
  }

  if (/死亡|死去|处决|death|execute/i.test(text) && !operations.some((operation) => operation.kind === "learn_number")) {
    operations.push({
      kind: "death_or_execution_effect",
    });
  }

  const eventTiming = abilityData.abilityMeta?.eventTiming || null;
  if (abilityData.abilityMeta?.pageType === "event_triggered" || eventTiming) {
    operations.push({
      kind: "event_trigger",
      eventTiming,
    });
  }

  if (!operations.length) {
    operations.push({
      kind: abilityData.abilityMeta?.pageType === "rule_modifier" || abilityData.abilityMeta?.pageType === "no_input"
        ? "passive_rule"
        : "manual_record",
    });
  }

  return operations;
}

function makeAbilitySemantics(role, abilityData) {
  const meta = abilityData.abilityMeta || {};

  return {
    schemaVersion: 1,
    reviewStatus: abilityData.needsReview ? "needs_review" : "auto",
    confidence: abilityData.needsReview ? 0.45 : 0.7,
    timing: {
      phase: Object.prototype.hasOwnProperty.call(meta, "phaseTiming") ? meta.phaseTiming : null,
      event: Object.prototype.hasOwnProperty.call(meta, "eventTiming") ? meta.eventTiming : null,
      frequency: meta.usagePattern || "variable",
    },
    actor: {
      drivenBy: meta.drivenBy || inferActor(meta.pageType),
    },
    operations: inferOperations(role, abilityData),
  };
}

function orderEmbeddedAbilityData(abilityData) {
  const ordered = {};

  FIELD_ORDER.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(abilityData, key)) {
      ordered[key] = abilityData[key];
    }
  });

  Object.keys(abilityData).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = abilityData[key];
    }
  });

  return ordered;
}

/**
 * Fill missing schema parts for one role and refresh term metadata.
 * Returns { changed, abilityData, schemaUpgraded, sourceAdded, semanticsAdded }.
 * Reviewed roles keep their abilityPattern (see applyAbilityTermMetadata) and their deduction,
 * including a deliberately absent one.
 */
function syncRoleAbilitySemantics(role, termsConfig) {
  const before = stable(role.abilityData || null);
  const reviewed = hasHandReviewedAbilityData(role.abilityData);
  const abilityData = {
    ...(role.abilityData || {}),
  };
  const counters = { schemaUpgraded: false, sourceAdded: false, semanticsAdded: false };

  if (Number(abilityData.schemaVersion || 1) < 2) {
    abilityData.schemaVersion = 2;
    counters.schemaUpgraded = true;
  }

  if (!abilityData.sourceAbility) {
    abilityData.sourceAbility = makeSourceAbilityData(role);
    counters.sourceAdded = true;
  }

  if (!abilityData.abilitySemantics) {
    abilityData.abilitySemantics = makeAbilitySemantics(role, abilityData);
    counters.semanticsAdded = true;
  }

  if (!abilityData.deduction && !reviewed) {
    const deduction = inferDeductionData(
      { id: role.id, englishName: role.englishName, name: role.name, ...abilityData },
      role,
    );
    if (deduction) {
      abilityData.deduction = deduction;
    }
  }

  const withIds = applyAbilityTermMetadata(
    {
      id: role.id,
      englishName: role.englishName,
      name: role.name,
      ...abilityData,
    },
    role,
    termsConfig,
  );
  const { id, englishName, name, ...embeddedData } = withIds;
  const nextAbilityData = orderEmbeddedAbilityData(embeddedData);

  return { changed: before !== stable(nextAbilityData), abilityData: nextAbilityData, ...counters };
}

function main() {
  const write = process.argv.includes("--write");
  const termsConfig = readTermsConfig();
  const roleEntries = readYamlCollection(ROLES_DIR);
  const changedIds = [];
  let semanticsAdded = 0;
  let sourceAdded = 0;
  let schemaUpgraded = 0;

  roleEntries.forEach((entry) => {
    const role = entry.data;
    const result = syncRoleAbilitySemantics(role, termsConfig);
    schemaUpgraded += result.schemaUpgraded ? 1 : 0;
    sourceAdded += result.sourceAdded ? 1 : 0;
    semanticsAdded += result.semanticsAdded ? 1 : 0;

    if (result.changed) {
      changedIds.push(role.id);

      if (write) {
        role.abilityData = result.abilityData;
        writeYamlFile(entry.filePath, role);
      }
    }
  });

  console.log(
    `${write ? "Synced" : "Checked"} ability semantics: ${changedIds.length} file(s) ${
      write ? "changed" : "would change"
    }.`,
  );
  console.log(`- schemaVersion upgraded: ${schemaUpgraded}`);
  console.log(`- sourceAbility added: ${sourceAdded}`);
  console.log(`- abilitySemantics added: ${semanticsAdded}`);

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

module.exports = { syncRoleAbilitySemantics };
