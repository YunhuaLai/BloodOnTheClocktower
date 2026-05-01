const fs = require("node:fs");
const path = require("node:path");
const { augmentEncyclopedia } = require("./catalog");
const { loadLibraryData } = require("./library");

const LIBRARY_DIR = path.join(__dirname, "library");
const CACHE_CHECK_INTERVAL_MS = 1000;

let cachedEntry = null;
let lastSignatureCheckAt = 0;

function collectLibrarySignature(directoryPath) {
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

function createIndex(items) {
  return new Map((items || []).filter((item) => item?.id).map((item) => [item.id, item]));
}

function buildCacheEntry(signature) {
  const data = augmentEncyclopedia(loadLibraryData());

  return {
    data,
    indexes: {
      scriptsById: createIndex(data.scripts),
      rolesById: createIndex(data.roles),
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

  const signature = collectLibrarySignature(LIBRARY_DIR);
  lastSignatureCheckAt = now;

  if (!cachedEntry || cachedEntry.signature !== signature) {
    cachedEntry = buildCacheEntry(signature);
  }

  return cachedEntry;
}

function getEncyclopediaData() {
  return getCacheEntry().data;
}

function getScriptById(id) {
  return getCacheEntry().indexes.scriptsById.get(id) || null;
}

function getRoleById(id) {
  return getCacheEntry().indexes.rolesById.get(id) || null;
}

function getTermById(id) {
  return getCacheEntry().indexes.termsById.get(id) || null;
}

module.exports = {
  getEncyclopediaData,
  getRoleById,
  getScriptById,
  getTermById,
};
