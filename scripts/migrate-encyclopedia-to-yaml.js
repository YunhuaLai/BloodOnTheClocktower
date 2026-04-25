const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const yaml = require("js-yaml");
const { loadLibraryData } = require("../backend/data/library");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_FILE = path.join(ROOT_DIR, "backend", "data", "encyclopedia.json");
const LIBRARY_DIR = path.join(ROOT_DIR, "backend", "data", "library");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const RULES_FILE = path.join(LIBRARY_DIR, "rules.yaml");

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeYamlFile(filePath, value) {
  const output = yaml.dump(value, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
  });

  fs.writeFileSync(filePath, output, "utf8");
}

function resetYamlDirectory(directoryPath) {
  ensureDirectory(directoryPath);

  fs.readdirSync(directoryPath, { withFileTypes: true }).forEach((entry) => {
    if (entry.isFile() && [".yaml", ".yml"].includes(path.extname(entry.name))) {
      fs.unlinkSync(path.join(directoryPath, entry.name));
    }
  });
}

function uniqueByEnglishName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const englishName = item.englishName || item.id;
    if (!englishName || seen.has(englishName)) {
      return false;
    }

    seen.add(englishName);
    return true;
  });
}

function main() {
  const source = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
  const current = loadLibraryData();
  const existingScriptsByEnglishName = new Map(
    (current.scripts || []).map((script) => [script.englishName || script.id, script]),
  );
  const existingRolesByEnglishName = new Map(
    (current.roles || []).map((role) => [role.englishName || role.id, role]),
  );

  ensureDirectory(LIBRARY_DIR);
  resetYamlDirectory(SCRIPTS_DIR);
  resetYamlDirectory(ROLES_DIR);

  writeYamlFile(RULES_FILE, source.rules || []);

  const mergedScripts = uniqueByEnglishName([
    ...(source.scripts || []).map((script) => {
      const englishName = script.englishName || script.id;
      const existing = existingScriptsByEnglishName.get(englishName);

      return existing
        ? { ...existing, ...script, id: existing.id, englishName }
        : { ...script, englishName };
    }),
    ...(current.scripts || []),
  ]);

  const scriptIdByEnglishName = new Map(
    mergedScripts.map((script) => [script.englishName || script.id, script.id]),
  );

  const mergedRoles = uniqueByEnglishName([
    ...(source.roles || []).map((role) => {
      const englishName = role.englishName || role.id;
      const existing = existingRolesByEnglishName.get(englishName);
      const scriptEnglishNames = [...new Set([...(role.scriptIds || []), role.scriptId].filter(Boolean))];
      const mappedScriptIds = scriptEnglishNames
        .map((scriptReference) => scriptIdByEnglishName.get(scriptReference) || scriptReference)
        .filter(Boolean);
      const relatedRoleIds = (role.detail?.relatedRoleIds || []).map(
        (roleReference) => existingRolesByEnglishName.get(roleReference)?.id || roleReference,
      );

      return existing
        ? {
            ...existing,
            ...role,
            id: existing.id,
            englishName,
            scriptId: mappedScriptIds[0] || existing.scriptId || "",
            scriptIds: mappedScriptIds.length ? mappedScriptIds : existing.scriptIds || [],
            detail: role.detail
              ? { ...role.detail, relatedRoleIds }
              : existing.detail,
          }
        : {
            ...role,
            englishName,
            scriptId: mappedScriptIds[0] || "",
            scriptIds: mappedScriptIds,
            detail: role.detail
              ? { ...role.detail, relatedRoleIds }
              : role.detail,
          };
    }),
    ...(current.roles || []),
  ]);

  mergedScripts.forEach((script) => {
    writeYamlFile(path.join(SCRIPTS_DIR, `${script.id}.yaml`), script);
  });

  mergedRoles.forEach((role) => {
    writeYamlFile(path.join(ROLES_DIR, `${role.id}.yaml`), role);
  });

  console.log(
    `Migrated encyclopedia base data and preserved library extensions. Scripts: ${mergedScripts.length}, roles: ${mergedRoles.length}.`,
  );

  const rebuild = spawnSync(process.execPath, [path.join(__dirname, "rebuild-library-from-catalog.js")], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  if (rebuild.status !== 0) {
    process.exit(rebuild.status || 1);
  }
}

main();
