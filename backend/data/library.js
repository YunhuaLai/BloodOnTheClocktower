const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const LIBRARY_DIR = process.env.BOTC_LIBRARY_DIR
  ? path.resolve(process.env.BOTC_LIBRARY_DIR)
  : path.join(__dirname, "library");
const RULES_FILE = path.join(LIBRARY_DIR, "rules.yaml");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const JINXES_DIR = path.join(LIBRARY_DIR, "jinxes");
const TERMS_FILE = path.join(LIBRARY_DIR, "terms.yaml");
const META_DIR = path.join(LIBRARY_DIR, "meta");
const ROLE_ABILITY_SCHEMA_FILE = path.join(META_DIR, "role-ability-schema.yaml");

function readYamlFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(content);
  return parsed ?? null;
}

async function readYamlFileAsync(filePath) {
  const content = await fs.promises.readFile(filePath, "utf8");
  const parsed = yaml.load(content);
  return parsed ?? null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
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

async function readYamlCollectionAsync(directoryPath, concurrency = 32) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && [".yaml", ".yml"].includes(path.extname(entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const values = await mapWithConcurrency(entries, concurrency, (entry) =>
    readYamlFileAsync(path.join(directoryPath, entry.name)),
  );
  return values.filter(Boolean);
}

function makeRoleAbilityFromRole(role) {
  if (!role?.abilityData || typeof role.abilityData !== "object") {
    return null;
  }

  return {
    id: role.id,
    englishName: role.englishName,
    name: role.name,
    ...role.abilityData,
  };
}

function loadLibraryData() {
  const rules = fs.existsSync(RULES_FILE) ? readYamlFile(RULES_FILE) : [];
  const termData = fs.existsSync(TERMS_FILE) ? readYamlFile(TERMS_FILE) : {};
  const roles = readYamlCollection(ROLES_DIR);

  return {
    rules: Array.isArray(rules) ? rules : [],
    scripts: readYamlCollection(SCRIPTS_DIR),
    roles,
    jinxes: readYamlCollection(JINXES_DIR),
    roleAbilities: roles.map(makeRoleAbilityFromRole).filter(Boolean),
    terms: Array.isArray(termData) ? termData : Array.isArray(termData?.terms) ? termData.terms : [],
    termReplacements: Array.isArray(termData?.replacements) ? termData.replacements : [],
    roleAbilitySchema: fs.existsSync(ROLE_ABILITY_SCHEMA_FILE)
      ? readYamlFile(ROLE_ABILITY_SCHEMA_FILE)
      : null,
  };
}

async function loadLibraryDataAsync() {
  const [rules, termData, roles, scripts, jinxes, roleAbilitySchema] = await Promise.all([
    fs.existsSync(RULES_FILE) ? readYamlFileAsync(RULES_FILE) : [],
    fs.existsSync(TERMS_FILE) ? readYamlFileAsync(TERMS_FILE) : {},
    readYamlCollectionAsync(ROLES_DIR),
    readYamlCollectionAsync(SCRIPTS_DIR),
    readYamlCollectionAsync(JINXES_DIR),
    fs.existsSync(ROLE_ABILITY_SCHEMA_FILE) ? readYamlFileAsync(ROLE_ABILITY_SCHEMA_FILE) : null,
  ]);

  return {
    rules: Array.isArray(rules) ? rules : [],
    scripts,
    roles,
    jinxes,
    roleAbilities: roles.map(makeRoleAbilityFromRole).filter(Boolean),
    terms: Array.isArray(termData) ? termData : Array.isArray(termData?.terms) ? termData.terms : [],
    termReplacements: Array.isArray(termData?.replacements) ? termData.replacements : [],
    roleAbilitySchema,
  };
}

module.exports = {
  loadLibraryData,
  loadLibraryDataAsync,
};
