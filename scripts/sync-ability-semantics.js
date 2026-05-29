const crypto = require("node:crypto");
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

const ROLE_ABILITY_SOURCE_HASH_FIELDS = [
  "ability",
  "type",
  "setup",
  "reminders",
  "remindersGlobal",
  "firstNightReminder",
  "otherNightReminder",
];

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

function hashSourceAbilityPayload(payload) {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function makeSourceAbilityData(role) {
  const payload = {
    ability: role.ability || "",
    type: role.type || "",
    setup: Boolean(role.setup),
    reminders: role.reminders || [],
    remindersGlobal: role.remindersGlobal || [],
    firstNightReminder: role.firstNightReminder || "",
    otherNightReminder: role.otherNightReminder || "",
  };

  return {
    source: "role-file",
    roleId: role.id || "",
    officialId: role.englishName || "",
    sourceHash: hashSourceAbilityPayload(payload),
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

function main() {
  const write = process.argv.includes("--write");
  const termsConfig = readTermsConfig();
  const roleEntries = readYamlCollection(ROLES_DIR);
  let changed = 0;
  let semanticsAdded = 0;
  let sourceAdded = 0;
  let schemaUpgraded = 0;

  roleEntries.forEach((entry) => {
    const role = entry.data;
    const before = stable(role.abilityData || null);
    const abilityData = {
      ...(role.abilityData || {}),
    };

    if (Number(abilityData.schemaVersion || 1) < 2) {
      abilityData.schemaVersion = 2;
      schemaUpgraded += 1;
    }

    if (!abilityData.sourceAbility) {
      abilityData.sourceAbility = makeSourceAbilityData(role);
      sourceAdded += 1;
    }

    if (!abilityData.abilitySemantics) {
      abilityData.abilitySemantics = makeAbilitySemantics(role, abilityData);
      semanticsAdded += 1;
    }

    if (!abilityData.deduction) {
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
    const after = stable(nextAbilityData);

    if (before !== after) {
      changed += 1;

      if (write) {
        role.abilityData = nextAbilityData;
        writeYamlFile(entry.filePath, role);
      }
    }
  });

  console.log(
    `${write ? "Synced" : "Checked"} ability semantics: ${changed} file(s) ${
      write ? "changed" : "would change"
    }.`,
  );
  console.log(`- schemaVersion upgraded: ${schemaUpgraded}`);
  console.log(`- sourceAbility added: ${sourceAdded}`);
  console.log(`- abilitySemantics added: ${semanticsAdded}`);

  if (!write && changed) {
    console.log("Run with --write to update roles/*.yaml abilityData.");
  }
}

main();
