const fs = require("node:fs");
const path = require("node:path");
const { augmentEncyclopedia } = require("./catalog");
const { buildBootstrapData, buildHomeData } = require("./catalog-summaries");
const { getImageAssetDirectories } = require("./image-assets");
const { loadLibraryData } = require("./library");

const LIBRARY_DIR = process.env.BOTC_LIBRARY_DIR
  ? path.resolve(process.env.BOTC_LIBRARY_DIR)
  : path.join(__dirname, "library");
const COMPILED_DATA_DIR = path.resolve(__dirname, "..", "..", "dist", "data");
const COMPILED_FILES = {
  bootstrap: path.join(COMPILED_DATA_DIR, "bootstrap.json"),
  encyclopedia: path.join(COMPILED_DATA_DIR, "encyclopedia.json"),
  home: path.join(COMPILED_DATA_DIR, "home.json"),
};

function getCacheCheckIntervalMs() {
  const configured = Number(process.env.DATA_CACHE_CHECK_INTERVAL_MS);
  if (Number.isFinite(configured) && configured >= 0) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? 60_000 : 1_000;
}

const CACHE_CHECK_INTERVAL_MS = getCacheCheckIntervalMs();

let cachedEntry = null;
let lastSignatureCheckAt = 0;
const compiledBuffers = new Map();

function collectDirectorySignature(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return "missing";
  }

  let fileCount = 0;
  let latestMtimeMs = 0;

  function visit(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    entries.forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        return;
      }

      if (!entry.isFile()) {
        return;
      }

      const stats = fs.statSync(entryPath);
      fileCount += 1;
      latestMtimeMs = Math.max(latestMtimeMs, stats.mtimeMs);
    });
  }

  visit(directoryPath);
  return `${fileCount}:${latestMtimeMs}`;
}

function collectDataSignature() {
  if (hasCompiledData()) {
    const stats = fs.statSync(COMPILED_FILES.encyclopedia);
    return `compiled:${stats.size}:${stats.mtimeMs}`;
  }

  return [LIBRARY_DIR, ...getImageAssetDirectories()]
    .map((directoryPath) => `${directoryPath}:${collectDirectorySignature(directoryPath)}`)
    .join("|");
}

function hasCompiledData() {
  return Object.values(COMPILED_FILES).every((filePath) => fs.existsSync(filePath));
}

function getCompiledBuffer(kind) {
  const filePath = COMPILED_FILES[kind];
  if (!filePath || !hasCompiledData()) {
    return null;
  }

  if (!compiledBuffers.has(kind)) {
    compiledBuffers.set(kind, fs.readFileSync(filePath));
  }

  return compiledBuffers.get(kind);
}

function createIndex(items) {
  return new Map((items || []).filter((item) => item?.id).map((item) => [item.id, item]));
}

function buildCacheEntry(signature) {
  const compiled = getCompiledBuffer("encyclopedia");
  const data = compiled
    ? JSON.parse(compiled.toString("utf8"))
    : augmentEncyclopedia(loadLibraryData());

  return {
    bootstrap: buildBootstrapData(data),
    data,
    home: buildHomeData(data),
    indexes: {
      scriptsById: createIndex(data.scripts),
      rolesById: createIndex(data.roles),
      jinxesById: createIndex(data.jinxes),
      termsById: createIndex(data.terms),
    },
    signature,
  };
}

function getCacheEntry() {
  const now = Date.now();

  if (cachedEntry && now - lastSignatureCheckAt < CACHE_CHECK_INTERVAL_MS) {
    return cachedEntry;
  }

  const signature = collectDataSignature();
  lastSignatureCheckAt = now;

  if (!cachedEntry || cachedEntry.signature !== signature) {
    cachedEntry = buildCacheEntry(signature);
  }

  return cachedEntry;
}

function getEncyclopediaData() {
  return getCacheEntry().data;
}

function getEncyclopediaJson() {
  return getCompiledBuffer("encyclopedia") || Buffer.from(JSON.stringify(getEncyclopediaData()));
}

function getBootstrapData() {
  return getCacheEntry().bootstrap;
}

function getBootstrapJson() {
  return getCompiledBuffer("bootstrap") || Buffer.from(JSON.stringify(getBootstrapData()));
}

function getHomeData() {
  return getCacheEntry().home;
}

function getHomeJson() {
  return getCompiledBuffer("home") || Buffer.from(JSON.stringify(getHomeData()));
}

function getScriptById(id) {
  return getCacheEntry().indexes.scriptsById.get(id) || null;
}

function getRoleById(id) {
  return getCacheEntry().indexes.rolesById.get(id) || null;
}

function getJinxById(id) {
  return getCacheEntry().indexes.jinxesById.get(id) || null;
}

function getTermById(id) {
  return getCacheEntry().indexes.termsById.get(id) || null;
}

module.exports = {
  getBootstrapData,
  getBootstrapJson,
  getEncyclopediaData,
  getEncyclopediaJson,
  getHomeData,
  getHomeJson,
  getJinxById,
  getRoleById,
  getScriptById,
  getTermById,
};
