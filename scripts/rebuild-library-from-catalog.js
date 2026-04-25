const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { loadLibraryData } = require("../backend/data/library");

const ROOT_DIR = path.resolve(__dirname, "..");
const LIBRARY_DIR = path.join(ROOT_DIR, "backend", "data", "library");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const ROLE_ABILITIES_DIR = path.join(LIBRARY_DIR, "role-abilities");

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function clearYamlFiles(directoryPath) {
  ensureDirectory(directoryPath);
  fs.readdirSync(directoryPath, { withFileTypes: true }).forEach((entry) => {
    if (entry.isFile() && [".yaml", ".yml"].includes(path.extname(entry.name))) {
      fs.unlinkSync(path.join(directoryPath, entry.name));
    }
  });
}

function toSafeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function writeYamlFile(filePath, value) {
  const output = yaml.dump(value, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
  });

  fs.writeFileSync(filePath, output, "utf8");
}

function rewriteDirectory(directoryPath, items) {
  clearYamlFiles(directoryPath);

  items.forEach((item) => {
    const fileName = `${item.id}-${toSafeFileName(item.name)}.yaml`;
    writeYamlFile(path.join(directoryPath, fileName), item);
  });
}

function main() {
  const data = loadLibraryData();

  rewriteDirectory(SCRIPTS_DIR, data.scripts || []);
  rewriteDirectory(ROLES_DIR, data.roles || []);
  rewriteDirectory(ROLE_ABILITIES_DIR, data.roleAbilities || []);

  console.log(
    `Normalized library filenames for ${data.scripts?.length || 0} scripts, ${data.roles?.length || 0} roles, and ${data.roleAbilities?.length || 0} role abilities.`,
  );
}

main();
