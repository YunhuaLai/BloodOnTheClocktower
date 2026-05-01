const { augmentEncyclopedia } = require("../backend/data/catalog");
const { loadLibraryData } = require("../backend/data/library");

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

    if (!String(role?.ability || role?.summary || "").trim()) {
      addWarning(`role ${label(role)} is missing both ability and summary`);
    }
  });
}

function validateRoleAbilities(roles, roleAbilities) {
  const roleIds = new Set(roles.map((role) => role.id));
  const abilityIds = new Set(roleAbilities.map((ability) => ability?.id));

  roleAbilities.forEach((ability) => {
    requireString(ability, "id", "roleAbility");
    recommendString(ability, "name", "roleAbility");

    if (!roleIds.has(ability?.id)) {
      addError(`roleAbility ${label(ability)} does not match any role by id`);
    }

    if (!ability?.abilityMeta || typeof ability.abilityMeta !== "object") {
      addError(`roleAbility ${label(ability)} is missing abilityMeta`);
    }

    if (!ability?.interactionSchema || typeof ability.interactionSchema !== "object") {
      addError(`roleAbility ${label(ability)} is missing interactionSchema`);
    }
  });

  roles.forEach((role) => {
    if (!abilityIds.has(role.id)) {
      addError(`role ${label(role)} does not have a matching roleAbility`);
    }
  });
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
  findDuplicates(rawData.roleAbilities, "id", "roleAbilities");
  warnDuplicateValues(rawData.roles, "englishName", "roles");
  warnDuplicateValues(rawData.roleAbilities, "englishName", "roleAbilities");

  validateScripts(rawData.scripts, roleIds);
  validateRoles(rawData.roles);
  validateRoleAbilities(rawData.roles, rawData.roleAbilities);
  validateRelatedRoles(data, new Set(data.roles.map((role) => role.id)));
  validateOrphans(data);

  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    console.error(`Data validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(
    `Data validation passed: ${rawData.scripts.length} scripts, ${rawData.roles.length} roles, ${rawData.roleAbilities.length} role abilities.`,
  );
}

main();
