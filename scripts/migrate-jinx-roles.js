const fs = require("node:fs");
const path = require("node:path");
const {
  JINXES_DIR,
  ROLES_DIR,
  SCRIPTS_DIR,
  readYamlCollection,
  relativeToRoot,
  writeYamlFile,
} = require("./lib/library-io");
const {
  isJinxTeam,
  makeJinxConflictKey,
  makeRoleLookup,
  normalizeJinxResolution,
  resolveJinxRoleNames,
  splitJinxRoleNames,
} = require("./lib/jinx-utils");

function safeFileName(value) {
  return String(value || "unnamed").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function nextNumericId(items, prefix) {
  const max = items.reduce((result, item) => {
    const match = String(item.data?.id || "").match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(result, Number(match[1])) : result;
  }, 0);

  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function assertInside(filePath, directoryPath) {
  const relativePath = path.relative(directoryPath, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to touch path outside ${directoryPath}: ${filePath}`);
  }
}

function removeIds(values, removedIds) {
  if (!Array.isArray(values)) {
    return values;
  }

  return values.filter((value) => !removedIds.has(value));
}

function collectSourceScriptIds(scripts, jinxRoleIds) {
  const sourceScriptIdsByRoleId = new Map([...jinxRoleIds].map((roleId) => [roleId, []]));

  scripts.forEach((entry) => {
    const script = entry.data || {};
    const fields = [
      script.roleIds || [],
      script.travellerIds || [],
      script.travelerIds || [],
      script.fabledIds || [],
      script.nightOrder?.first || [],
      script.nightOrder?.other || [],
    ];

    fields.flat().forEach((roleId) => {
      if (sourceScriptIdsByRoleId.has(roleId)) {
        sourceScriptIdsByRoleId.get(roleId).push(script.id);
      }
    });
  });

  return sourceScriptIdsByRoleId;
}

function removeJinxRoleReferences(scripts, jinxRoleIds) {
  const changedScripts = [];

  scripts.forEach((entry) => {
    const script = entry.data;
    const before = JSON.stringify(script);

    script.roleIds = removeIds(script.roleIds, jinxRoleIds);
    script.travellerIds = removeIds(script.travellerIds, jinxRoleIds);
    script.travelerIds = removeIds(script.travelerIds, jinxRoleIds);
    script.fabledIds = removeIds(script.fabledIds, jinxRoleIds);

    if (script.nightOrder) {
      script.nightOrder.first = removeIds(script.nightOrder.first, jinxRoleIds);
      script.nightOrder.other = removeIds(script.nightOrder.other, jinxRoleIds);
    }

    if (JSON.stringify(script) !== before) {
      changedScripts.push(entry);
    }
  });

  return changedScripts;
}

function makeRoleJinxConflictDraft(role, roleLookup) {
  const resolved = normalizeJinxResolution(
    resolveJinxRoleNames(splitJinxRoleNames(role.name), roleLookup),
  );

  return {
    roleIds: resolved.roleIds,
    rule: role.ability || "",
  };
}

function findExistingJinx(jinxes, role, roleLookup) {
  const officialId = role.abilityData?.sourceAbility?.officialId;
  const conflictKey = makeJinxConflictKey(makeRoleJinxConflictDraft(role, roleLookup));

  return (
    jinxes.find((entry) => entry.data?.source?.roleId === role.id) ||
    (officialId
      ? jinxes.find((entry) => entry.data?.source?.officialId === officialId)
      : null) ||
    (conflictKey
      ? jinxes.find((entry) => makeJinxConflictKey(entry.data) === conflictKey)
      : null) ||
    jinxes.find((entry) => entry.data?.name === role.name) ||
    null
  );
}

function makeJinxData(role, existingJinx, roleLookup, sourceScriptIds) {
  const resolved = normalizeJinxResolution(
    resolveJinxRoleNames(splitJinxRoleNames(role.name), roleLookup),
    existingJinx,
  );

  return {
    ...(existingJinx || {}),
    id: existingJinx?.id,
    kind: "jinx",
    name: role.name || role.id,
    roleIds: resolved.roleIds,
    roleNames: resolved.roleNames,
    unresolvedRoleNames: resolved.unresolvedRoleNames,
    ...(resolved.ruleTags.length ? { ruleTags: resolved.ruleTags } : {}),
    ...(resolved.appliesWhen ? { appliesWhen: resolved.appliesWhen } : {}),
    rule: role.ability || existingJinx?.rule || "",
    audience: existingJinx?.audience || "both",
    sourceScriptIds: uniqueValues([
      ...(Array.isArray(existingJinx?.sourceScriptIds) ? existingJinx.sourceScriptIds : []),
      ...sourceScriptIds,
    ]),
    source: {
      ...(existingJinx?.source || {}),
      roleId: role.id,
      englishName: role.englishName || "",
      officialId: role.abilityData?.sourceAbility?.officialId || role.englishName || "",
      officialTeam: role.type || "",
      edition: role.edition || "",
      image: role.image || "",
    },
  };
}

function migrate({ write = false } = {}) {
  const scripts = readYamlCollection(SCRIPTS_DIR);
  const roles = readYamlCollection(ROLES_DIR);
  const jinxes = readYamlCollection(JINXES_DIR);
  const jinxRoleEntries = roles.filter((entry) => isJinxTeam(entry.data?.type));
  const normalRoles = roles.filter((entry) => !isJinxTeam(entry.data?.type));
  const jinxRoleIds = new Set(jinxRoleEntries.map((entry) => entry.data.id));
  const sourceScriptIdsByRoleId = collectSourceScriptIds(scripts, jinxRoleIds);
  const changedScripts = removeJinxRoleReferences(scripts, jinxRoleIds);
  const roleLookup = makeRoleLookup(normalRoles);
  const created = [];
  const updated = [];
  const unresolved = [];
  const deletedRoleFiles = [];
  const touchedJinxes = [...jinxes];

  if (write) {
    fs.mkdirSync(JINXES_DIR, { recursive: true });
  }

  jinxRoleEntries.forEach((entry) => {
    const role = entry.data;
    const existingJinx = findExistingJinx(touchedJinxes, role, roleLookup);
    const jinxId = existingJinx?.data?.id || nextNumericId(touchedJinxes, "j");
    const jinxData = makeJinxData(
      { ...role, id: role.id },
      existingJinx?.data ? { ...existingJinx.data, id: jinxId } : { id: jinxId },
      roleLookup,
      sourceScriptIdsByRoleId.get(role.id) || [],
    );
    const filePath =
      existingJinx?.filePath ||
      path.join(JINXES_DIR, `${jinxId}-${safeFileName(jinxData.name)}.yaml`);

    if (!existingJinx) {
      touchedJinxes.push({ fileName: path.basename(filePath), filePath, data: jinxData });
      created.push(jinxData);
    } else {
      updated.push(jinxData);
    }

    if (jinxData.unresolvedRoleNames.length) {
      unresolved.push(jinxData);
    }

    if (write) {
      assertInside(filePath, JINXES_DIR);
      assertInside(entry.filePath, ROLES_DIR);
      writeYamlFile(filePath, jinxData);
      fs.unlinkSync(entry.filePath);
    }

    deletedRoleFiles.push(entry.filePath);
  });

  if (write) {
    changedScripts.forEach((entry) => {
      assertInside(entry.filePath, SCRIPTS_DIR);
      writeYamlFile(entry.filePath, entry.data);
    });
  }

  return {
    write,
    migrated: jinxRoleEntries.length,
    created: created.length,
    updated: updated.length,
    unresolved: unresolved.length,
    changedScripts: changedScripts.map((entry) => relativeToRoot(entry.filePath)),
    deletedRoleFiles: deletedRoleFiles.map(relativeToRoot),
    unresolvedExamples: unresolved.slice(0, 12).map((jinx) => ({
      id: jinx.id,
      name: jinx.name,
      unresolvedRoleNames: jinx.unresolvedRoleNames,
    })),
  };
}

function main() {
  const write = process.argv.includes("--write");
  const result = migrate({ write });

  console.log(`${write ? "Migrated" : "Would migrate"} ${result.migrated} jinx role files.`);
  console.log(`Jinxes created: ${result.created}; updated: ${result.updated}; unresolved: ${result.unresolved}`);
  console.log(`Scripts cleaned: ${result.changedScripts.length}`);
  if (result.unresolvedExamples.length) {
    console.log("Unresolved examples:");
    result.unresolvedExamples.forEach((item) => {
      console.log(`- ${item.id} ${item.name}: ${item.unresolvedRoleNames.join(", ")}`);
    });
  }
  if (!write) {
    console.log("Run with --write to apply.");
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  migrate,
};
