const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const LIBRARY_DIR = path.join(__dirname, "library");
const RULES_FILE = path.join(LIBRARY_DIR, "rules.yaml");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const ROLE_ABILITIES_DIR = path.join(LIBRARY_DIR, "role-abilities");
const META_DIR = path.join(LIBRARY_DIR, "meta");
const ROLE_ABILITY_SCHEMA_FILE = path.join(META_DIR, "role-ability-schema.yaml");

function readYamlFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(content);
  return parsed ?? null;
}

function readYamlCollection(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && [".yaml", ".yml"].includes(path.extname(entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => readYamlFile(path.join(directoryPath, entry.name)))
    .filter(Boolean);
}

function loadLibraryData() {
  const rules = fs.existsSync(RULES_FILE) ? readYamlFile(RULES_FILE) : [];

  return {
    rules: Array.isArray(rules) ? rules : [],
    scripts: readYamlCollection(SCRIPTS_DIR),
    roles: readYamlCollection(ROLES_DIR),
    roleAbilities: readYamlCollection(ROLE_ABILITIES_DIR),
    roleAbilitySchema: fs.existsSync(ROLE_ABILITY_SCHEMA_FILE)
      ? readYamlFile(ROLE_ABILITY_SCHEMA_FILE)
      : null,
  };
}

module.exports = {
  loadLibraryData,
};
