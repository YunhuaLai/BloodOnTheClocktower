const { augmentEncyclopedia } = require("../backend/data/catalog");
const { loadLibraryData } = require("../backend/data/library");

const KNOWN_SCRIPT_STATUSES = new Set(["draft", "review", "published", "archived"]);

const KNOWN_ROLE_TYPES = new Set([
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "fabled",
  "traveller",
  "traveller2",
  "jinxes",
  "a jinxed",
  "a jinxes",
]);

const KNOWN_DEDUCTION_STATUSES = new Set([
  "supported",
  "candidate",
  "world_effect",
  "manual",
  "record_only",
  "none",
]);

const KNOWN_ABILITY_PATTERNS = new Set([
  "no_input",
  "rule_modifier",
  "nomination_trigger",
  "execution_trigger",
  "death_trigger",
  "vote_trigger",
  "role_in_group_hint",
  "target_role_info",
  "target_demon_check",
  "target_boolean_check",
  "target_number_info",
  "choose_role_status_effect",
  "choose_player_death",
  "choose_player_protection",
  "choose_player_status_effect",
  "choose_player_effect",
  "number_info",
  "boolean_info",
  "team_info",
  "role_info",
  "player_info",
  "status_effect",
  "record_result_only",
  "manual_record",
]);

const KNOWN_DEDUCTION_TEMPLATE_TYPES = new Set([
  "adjacent_evil_pair_count",
  "evil_count_group",
  "clockwise_evil_count",
  "good_player",
  "role_in_group",
  "role_at_seat",
  "role_at_day_execution",
  "not_role_type_group",
  "demon_in_group",
  "not_demon_group",
  "team_relation",
  "either_role",
  "evil_dead_count",
  "demon_minion_distance",
  "role_guess",
  "role_guess_count",
  "nearest_evil_direction",
  "demon_voted_today",
  "minion_nominated_today",
]);

const KNOWN_DEDUCTION_EFFECT_TYPES = new Set([
  "poison_drunk",
  "death_protection",
  "alignment_role_change",
  "setup_rule_modifier",
  "action_history",
  "natural_language",
  "awake_malfunction",
]);

const KNOWN_SEMANTIC_REVIEW_STATUSES = new Set([
  "auto",
  "needs_review",
  "reviewed",
  "source_changed",
]);

const KNOWN_SEMANTIC_OPERATION_KINDS = new Set([
  "setup_modifier",
  "choose_player",
  "choose_role",
  "learn_role_in_group",
  "learn_role_at_target",
  "learn_role",
  "learn_boolean",
  "learn_number",
  "learn_team",
  "learn_player",
  "apply_status_effect",
  "protect_player",
  "death_or_execution_effect",
  "event_trigger",
  "passive_rule",
  "manual_record",
]);

const errors = [];
const warnings = [];

function label(item, fallback = "unknown") {
  return `${item?.id || fallback}${item?.name ? ` (${item.name})` : ""}`;
}

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function findDuplicates(items, field, collectionName) {
  const seen = new Map();

  items.forEach((item, index) => {
    const value = item?.[field];
    if (!value) {
      addError(`${collectionName}[${index}] is missing ${field}`);
      return;
    }

    if (seen.has(value)) {
      addError(
        `${collectionName} has duplicate ${field} "${value}" at indexes ${seen.get(value)} and ${index}`,
      );
      return;
    }

    seen.set(value, index);
  });
}

function warnDuplicateValues(items, field, collectionName) {
  const seen = new Map();
  const duplicates = [];

  items.forEach((item, index) => {
    const value = item?.[field];
    if (!value) {
      return;
    }

    if (seen.has(value)) {
      duplicates.push(`${value} (${seen.get(value)}, ${index})`);
      return;
    }

    seen.set(value, index);
  });

  if (duplicates.length) {
    addWarning(
      `${collectionName} has duplicate ${field} values: ${duplicates.slice(0, 12).join(", ")}${
        duplicates.length > 12 ? ", ..." : ""
      }`,
    );
  }
}

function requireString(item, field, collectionName) {
  if (!String(item?.[field] || "").trim()) {
    addError(`${collectionName} ${label(item)} is missing ${field}`);
  }
}

function recommendString(item, field, collectionName) {
  if (!String(item?.[field] || "").trim()) {
    addWarning(`${collectionName} ${label(item)} is missing ${field}`);
  }
}

function validateScripts(scripts, roleIds) {
  scripts.forEach((script) => {
    requireString(script, "id", "script");
    requireString(script, "name", "script");

    if (script?.status && !KNOWN_SCRIPT_STATUSES.has(script.status)) {
      addWarning(`script ${label(script)} has unknown status "${script.status}"`);
    }

    if (!Array.isArray(script.roleIds)) {
      addError(`script ${label(script)} must have a roleIds array`);
      return;
    }

    script.roleIds.forEach((roleId) => {
      if (!roleIds.has(roleId)) {
        addError(`script ${label(script)} references missing role "${roleId}"`);
      }
    });

    ["first", "other"].forEach((nightKey) => {
      const order = script.nightOrder?.[nightKey];
      if (!order) {
        return;
      }

      if (!Array.isArray(order)) {
        addError(`script ${label(script)} nightOrder.${nightKey} must be an array`);
        return;
      }

      order.forEach((roleId) => {
        if (!roleIds.has(roleId)) {
          addError(`script ${label(script)} nightOrder.${nightKey} references missing role "${roleId}"`);
        }
      });
    });
  });
}

function validateRoles(roles) {
  roles.forEach((role) => {
    requireString(role, "id", "role");
    recommendString(role, "name", "role");

    if (!KNOWN_ROLE_TYPES.has(role?.type)) {
      addWarning(`role ${label(role)} has unknown type "${role?.type || ""}"`);
    }

    if (!String(role?.ability || "").trim()) {
      addWarning(`role ${label(role)} is missing ability`);
    }
  });
}

function validateTerms(terms) {
  const termIds = new Set(terms.map((term) => term?.id).filter(Boolean));

  terms.forEach((term) => {
    requireString(term, "id", "term");
    requireString(term, "name", "term");

    if (!Array.isArray(term?.aliases)) {
      addWarning(`term ${label(term)} should have an aliases array`);
    }

    (term.relatedTermIds || []).forEach((termId) => {
      if (!termIds.has(termId)) {
        addError(`term ${label(term)} relatedTermIds references missing term "${termId}"`);
      }
    });
  });
}

function validateRoleAbilities(roles, roleAbilities, termIds) {
  const roleIds = new Set(roles.map((role) => role.id));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const abilityIds = new Set(roleAbilities.map((ability) => ability?.id));
  const legacyGenerated = [];

  roleAbilities.forEach((ability) => {
    requireString(ability, "id", "role.abilityData");
    const role = roleById.get(ability?.id);

    if (!roleIds.has(ability?.id)) {
      addError(`role.abilityData ${label(ability)} does not match any role by id`);
    }

    if (!ability?.abilityMeta || typeof ability.abilityMeta !== "object") {
      addError(`role.abilityData ${label(ability)} is missing abilityMeta`);
    }

    if (!ability?.interactionSchema || typeof ability.interactionSchema !== "object") {
      addError(`role.abilityData ${label(ability)} is missing interactionSchema`);
    }

    if (ability?.abilityPattern && !KNOWN_ABILITY_PATTERNS.has(ability.abilityPattern)) {
      addError(`role.abilityData ${label(ability)} has unknown abilityPattern "${ability.abilityPattern}"`);
    }

    if (ability?.termIds) {
      if (!Array.isArray(ability.termIds)) {
        addError(`role.abilityData ${label(ability)} termIds must be an array`);
      } else {
        ability.termIds.forEach((termId) => {
          if (!termIds.has(termId)) {
            addError(`role.abilityData ${label(ability)} termIds references missing term "${termId}"`);
          }
        });
      }
    }

    if (ability?.generatedFromOfficial && Number(ability?.schemaVersion || 1) < 2) {
      legacyGenerated.push(label(ability));
    }

    validateSourceAbility(ability, role);
    validateAbilitySemantics(ability);
    validateDeductionProfile(ability);
  });

  if (legacyGenerated.length) {
    addWarning(
      `${legacyGenerated.length} generated role abilityData entries still use v1 semantics: ${legacyGenerated
        .slice(0, 12)
        .join(", ")}${legacyGenerated.length > 12 ? ", ..." : ""}`,
    );
  }

  roles.forEach((role) => {
    if (!abilityIds.has(role.id)) {
      addError(`role ${label(role)} is missing abilityData`);
    }
  });
}

function validateSourceAbility(ability, role) {
  const sourceAbility = ability?.sourceAbility;

  if (!sourceAbility) {
    if (ability?.generatedFromOfficial && Number(ability?.schemaVersion || 1) >= 2) {
      addError(`role.abilityData ${label(ability)} schemaVersion>=2 is missing sourceAbility`);
    }
    return;
  }

  if (typeof sourceAbility !== "object" || Array.isArray(sourceAbility)) {
    addError(`role.abilityData ${label(ability)} sourceAbility must be an object`);
    return;
  }

  if (!String(sourceAbility.source || "").trim()) {
    addError(`role.abilityData ${label(ability)} sourceAbility is missing source`);
  }

  if (sourceAbility.source === "role-file" && sourceAbility.roleId && sourceAbility.roleId !== ability?.id) {
    addError(`role.abilityData ${label(ability)} sourceAbility.roleId must match role.abilityData id`);
  }

  if (sourceAbility.source === "role-file" && !Array.isArray(sourceAbility.sourceHashFields)) {
    addError(`role.abilityData ${label(ability)} sourceAbility.sourceHashFields must be an array`);
  }

  if (!String(sourceAbility.sourceHash || "").trim()) {
    addWarning(`role.abilityData ${label(ability)} sourceAbility is missing sourceHash`);
  }
}

function validateAbilitySemantics(ability) {
  const semantics = ability?.abilitySemantics;

  if (!semantics) {
    if (Number(ability?.schemaVersion || 1) >= 2) {
      addError(`role.abilityData ${label(ability)} schemaVersion>=2 is missing abilitySemantics`);
    }
    return;
  }

  if (typeof semantics !== "object" || Array.isArray(semantics)) {
    addError(`role.abilityData ${label(ability)} abilitySemantics must be an object`);
    return;
  }

  if (!KNOWN_SEMANTIC_REVIEW_STATUSES.has(semantics.reviewStatus)) {
    addError(
      `role.abilityData ${label(ability)} has unknown abilitySemantics.reviewStatus "${semantics.reviewStatus || ""}"`,
    );
  }

  if (!semantics.timing || typeof semantics.timing !== "object") {
    addWarning(`role.abilityData ${label(ability)} abilitySemantics is missing timing`);
  }

  if (!Array.isArray(semantics.operations) || !semantics.operations.length) {
    addError(`role.abilityData ${label(ability)} abilitySemantics.operations must be a non-empty array`);
    return;
  }

  semantics.operations.forEach((operation, index) => {
    if (!KNOWN_SEMANTIC_OPERATION_KINDS.has(operation?.kind)) {
      addError(
        `role.abilityData ${label(ability)} abilitySemantics.operations[${index}] has unknown kind "${operation?.kind || ""}"`,
      );
    }
  });
}

function validateDeductionProfile(ability) {
  const deduction = ability?.deduction;
  if (!deduction) {
    return;
  }

  if (!KNOWN_DEDUCTION_STATUSES.has(deduction.status)) {
    addError(`role.abilityData ${label(ability)} has unknown deduction.status "${deduction.status || ""}"`);
  }

  if (Array.isArray(deduction.templates)) {
    deduction.templates.forEach((template, index) => {
      if (!KNOWN_DEDUCTION_TEMPLATE_TYPES.has(template?.type)) {
        addError(
          `role.abilityData ${label(ability)} deduction.templates[${index}] has unknown type "${template?.type || ""}"`,
        );
      }
    });
  }

  if (
    deduction.status === "world_effect" &&
    deduction.effectType &&
    !KNOWN_DEDUCTION_EFFECT_TYPES.has(deduction.effectType)
  ) {
    addError(
      `role.abilityData ${label(ability)} has unknown deduction.effectType "${deduction.effectType}"`,
    );
  }

  if (
    deduction.status === "supported" &&
    (!Array.isArray(deduction.templates) || !deduction.templates.length)
  ) {
    addError(`role.abilityData ${label(ability)} deduction.status=supported requires templates`);
  }
}

function validateRelatedRoles(data, roleIds) {
  data.roles.forEach((role) => {
    (role.detail?.relatedRoleIds || []).forEach((roleId) => {
      if (!roleIds.has(roleId)) {
        addError(`role ${label(role)} detail.relatedRoleIds references missing role "${roleId}"`);
      }
    });
  });

  data.terms.forEach((term) => {
    (term.relatedRoleIds || []).forEach((roleId) => {
      if (!roleIds.has(roleId)) {
        addError(`term ${label(term)} relatedRoleIds references missing role "${roleId}"`);
      }
    });
  });
}

function validateOrphans(data) {
  const orphanRoles = data.roles.filter((role) => !(role.scriptIds || []).length);

  if (orphanRoles.length) {
    addWarning(
      `${orphanRoles.length} roles are not included in any script: ${orphanRoles
        .slice(0, 12)
        .map(label)
        .join(", ")}${orphanRoles.length > 12 ? ", ..." : ""}`,
    );
  }
}

function main() {
  const rawData = loadLibraryData();
  const data = augmentEncyclopedia(rawData);
  const roleIds = new Set(rawData.roles.map((role) => role.id));

  findDuplicates(rawData.scripts, "id", "scripts");
  findDuplicates(rawData.roles, "id", "roles");
  findDuplicates(rawData.roleAbilities, "id", "role abilityData");
  findDuplicates(rawData.terms, "id", "terms");
  warnDuplicateValues(rawData.roles, "englishName", "roles");
  warnDuplicateValues(rawData.roleAbilities, "englishName", "role abilityData");

  validateScripts(rawData.scripts, roleIds);
  validateRoles(rawData.roles);
  validateTerms(rawData.terms);
  validateRoleAbilities(rawData.roles, rawData.roleAbilities, new Set(rawData.terms.map((term) => term.id)));
  validateRelatedRoles(data, new Set(data.roles.map((role) => role.id)));
  validateOrphans(data);

  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    console.error(`Data validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(
    `Data validation passed: ${rawData.scripts.length} scripts, ${rawData.roles.length} roles, ${rawData.roleAbilities.length} role abilityData entries.`,
  );
}

main();
