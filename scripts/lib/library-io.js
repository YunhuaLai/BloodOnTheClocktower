const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const LIBRARY_DIR = path.join(ROOT_DIR, "backend", "data", "library");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const TERMS_FILE = path.join(LIBRARY_DIR, "terms.yaml");

function readYamlFile(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return yaml.load(fs.readFileSync(filePath, "utf8")) ?? fallback;
}

function writeYamlFile(filePath, data) {
  const content = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    quotingType: "'",
  });
  fs.writeFileSync(filePath, content, "utf8");
}

function readYamlCollection(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => {
      const filePath = path.join(directoryPath, entry.name);
      return {
        fileName: entry.name,
        filePath,
        data: readYamlFile(filePath, {}),
      };
    });
}

function relativeToRoot(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

module.exports = {
  LIBRARY_DIR,
  ROLES_DIR,
  ROOT_DIR,
  SCRIPTS_DIR,
  TERMS_FILE,
  readYamlCollection,
  readYamlFile,
  relativeToRoot,
  writeYamlFile,
};
