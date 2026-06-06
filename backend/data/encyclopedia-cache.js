const fs = require("node:fs");
const path = require("node:path");
const { augmentEncyclopedia } = require("./catalog");
const { getImageAssetDirectories } = require("./image-assets");
const { loadLibraryData } = require("./library");

const LIBRARY_DIR = path.join(__dirname, "library");

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
  return [LIBRARY_DIR, ...getImageAssetDirectories()]
    .map((directoryPath) => `${directoryPath}:${collectDirectorySignature(directoryPath)}`)
    .join("|");
}

function createIndex(items) {
  return new Map((items || []).filter((item) => item?.id).map((item) => [item.id, item]));
}

function summarizeScript(script) {
  return {
    id: script.id,
    englishName: script.englishName,
    name: script.name,
    en: script.en,
    status: script.status,
    author: script.author,
    level: script.level,
    mood: script.mood,
    text: script.text,
    description: script.description,
    image: script.image,
    tags: script.tags,
    roleIds: script.roleIds,
    travellerIds: script.travellerIds,
    fabledIds: script.fabledIds,
    nightOrder: script.nightOrder,
  };
}

function summarizeRole(role) {
  return {
    id: role.id,
    englishName: role.englishName,
    name: role.name,
    en: role.en,
    type: role.type,
    summary: role.summary,
    keywords: role.keywords,
    ability: role.ability,
    image: role.image,
    scriptId: role.scriptId,
    scriptIds: role.scriptIds,
    scriptNames: role.scriptNames,
    script: role.script,
  };
}

function summarizeJinx(jinx) {
  return {
    id: jinx.id,
    kind: jinx.kind,
    name: jinx.name,
    roleIds: jinx.roleIds,
    roleNames: jinx.roleNames,
    unresolvedRoleNames: jinx.unresolvedRoleNames,
    ruleTags: jinx.ruleTags,
    appliesWhen: jinx.appliesWhen,
    rule: jinx.rule,
    audience: jinx.audience,
    sourceScriptIds: jinx.sourceScriptIds,
    source: jinx.source,
  };
}

function summarizeTerm(term) {
  return {
    id: term.id,
    name: term.name,
    category: term.category,
    summary: term.summary,
    aliases: term.aliases,
    relatedRoleIds: term.relatedRoleIds,
    relatedTermIds: term.relatedTermIds,
  };
}

function buildBootstrapData(data) {
  return {
    rules: data.rules || [],
    scripts: (data.scripts || []).map(summarizeScript),
    roles: (data.roles || []).map(summarizeRole),
    jinxes: (data.jinxes || []).map(summarizeJinx),
    terms: (data.terms || []).map(summarizeTerm),
  };
}

function buildCacheEntry(signature) {
  const data = augmentEncyclopedia(loadLibraryData());

  return {
    bootstrap: buildBootstrapData(data),
    data,
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

function getBootstrapData() {
  return getCacheEntry().bootstrap;
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
  getEncyclopediaData,
  getJinxById,
  getRoleById,
  getScriptById,
  getTermById,
};
