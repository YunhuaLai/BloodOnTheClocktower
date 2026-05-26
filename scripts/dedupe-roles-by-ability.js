const fs = require("node:fs");
const path = require("node:path");
const {
  LIBRARY_DIR,
  ROLES_DIR,
  readYamlFile,
  relativeToRoot,
  writeYamlFile,
} = require("./lib/library-io");

function roleNumber(roleId) {
  const match = String(roleId || "").match(/^r(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeAbilityText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[，。；：、,.；;:：]/g, "")
    .trim();
}

function collectYamlFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return collectYamlFiles(filePath);
    }

    return entry.isFile() && entry.name.endsWith(".yaml") ? [filePath] : [];
  });
}

function readRoleEntries() {
  return fs
    .readdirSync(ROLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => {
      const filePath = path.join(ROLES_DIR, entry.name);
      return {
        fileName: entry.name,
        filePath,
        data: readYamlFile(filePath, {}),
      };
    });
}

function inferDuplicateGroups(roleEntries) {
  const byAbility = new Map();

  roleEntries.forEach((entry) => {
    const role = entry.data || {};
    const abilityText = normalizeAbilityText(
      role.ability || role.summary || role.detail?.abilitySummary || "",
    );

    if (!role.id || !abilityText) {
      return;
    }

    if (!byAbility.has(abilityText)) {
      byAbility.set(abilityText, []);
    }

    byAbility.get(abilityText).push(entry);
  });

  return Array.from(byAbility.values())
    .map((entries) => entries.sort((left, right) => roleNumber(left.data.id) - roleNumber(right.data.id)))
    .filter((entries) => entries.length > 1);
}

function makeReplacementMap(duplicateGroups) {
  const replacementMap = new Map();

  duplicateGroups.forEach((entries) => {
    const keptRoleId = entries[0].data.id;

    entries.slice(1).forEach((entry) => {
      replacementMap.set(entry.data.id, keptRoleId);
    });
  });

  return replacementMap;
}

function replaceRoleReferences(value, replacementMap) {
  if (!replacementMap.size) {
    return value;
  }

  if (typeof value === "string") {
    return replacementMap.get(value) || value;
  }

  if (Array.isArray(value)) {
    const mappedItems = value.map((item) => {
      const nextItem = replaceRoleReferences(item, replacementMap);
      return {
        nextItem,
        key: stable(nextItem),
        changed: stable(item) !== stable(nextItem),
      };
    });
    const keyStats = new Map();

    mappedItems.forEach((item) => {
      const stats = keyStats.get(item.key) || { count: 0, changed: false };
      stats.count += 1;
      stats.changed ||= item.changed;
      keyStats.set(item.key, stats);
    });

    const result = [];
    const seen = new Set();

    mappedItems.forEach(({ nextItem, key }) => {
      const stats = keyStats.get(key);
      const shouldDedupe = stats.count > 1 && stats.changed;

      if (shouldDedupe && seen.has(key)) {
        return;
      }

      if (shouldDedupe) {
        seen.add(key);
      }

      result.push(nextItem);
    });

    return result;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replaceRoleReferences(nestedValue, replacementMap),
      ]),
    );
  }

  return value;
}

function stable(value) {
  return JSON.stringify(value);
}

function main() {
  const write = process.argv.includes("--write");
  const roleEntries = readRoleEntries();
  const duplicateGroups = inferDuplicateGroups(roleEntries);
  const replacementMap = makeReplacementMap(duplicateGroups);
  const duplicateRoleIds = new Set(replacementMap.keys());
  const duplicateRoleFiles = roleEntries
    .filter((entry) => duplicateRoleIds.has(entry.data.id))
    .map((entry) => entry.filePath);
  const deleteFileSet = new Set(duplicateRoleFiles);
  const changedFiles = [];

  collectYamlFiles(LIBRARY_DIR).forEach((filePath) => {
    if (deleteFileSet.has(filePath)) {
      return;
    }

    const data = readYamlFile(filePath, {});
    const nextData = replaceRoleReferences(data, replacementMap);

    if (stable(data) !== stable(nextData)) {
      changedFiles.push(filePath);

      if (write) {
        writeYamlFile(filePath, nextData);
      }
    }
  });

  if (write) {
    deleteFileSet.forEach((filePath) => {
      fs.unlinkSync(filePath);
    });
  }

  console.log(`${write ? "Deduped" : "Checked"} duplicate roles by ability text.`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Removed role ids: ${duplicateRoleIds.size}`);

  duplicateGroups.forEach((entries) => {
    const kept = entries[0].data;
    const removed = entries.slice(1).map((entry) => entry.data);
    console.log(
      `- keep ${kept.id} ${kept.name || ""}; remove ${removed
        .map((role) => `${role.id} ${role.name || ""}`)
        .join(", ")}`,
    );
  });

  console.log(`Reference files ${write ? "changed" : "to change"}: ${changedFiles.length}`);
  changedFiles.forEach((filePath) => {
    console.log(`  - ${relativeToRoot(filePath)}`);
  });

  console.log(`Files ${write ? "deleted" : "to delete"}: ${deleteFileSet.size}`);
  Array.from(deleteFileSet)
    .sort()
    .forEach((filePath) => {
      console.log(`  - ${relativeToRoot(filePath)}`);
    });

  if (!write && duplicateRoleIds.size) {
    console.log("Run with --write to update references and delete duplicate role files.");
  }
}

main();
