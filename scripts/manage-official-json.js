const fs = require("node:fs");
const path = require("node:path");
const { applyAbilityTermMetadata } = require("./lib/ability-term-metadata");
const { inferDeductionData } = require("./lib/deduction-profile-inference");
const { hasHandReviewedAbilityData } = require("./lib/ability-review");
const {
  hasOnlyGeneratedFields,
  makeAbilitySemantics,
  makeRoleAbilityData,
  makeSourceAbilityData,
} = require("./lib/ability-generator");
const {
  isJinxTeam,
  jinxAppliesToRoleSet,
  makeJinxConflictKey,
  makeRoleLookup,
  normalizeJinxResolution,
  resolveJinxRoleNames,
  splitJinxRoleNames,
} = require("./lib/jinx-utils");
const {
  JINXES_DIR,
  ROLES_DIR,
  SCRIPTS_DIR,
  readYamlCollection,
  readYamlFile,
  relativeToRoot,
  writeYamlFile,
} = require("./lib/library-io");

const TEAM_TO_TYPE = {
  townsfolk: "townsfolk",
  outsider: "outsider",
  minion: "minion",
  demon: "demon",
  traveler: "traveller",
  traveller: "traveller",
  fabled: "fabled",
  token: "token",
};

const TYPE_TO_TEAM = {
  townsfolk: "townsfolk",
  outsider: "outsider",
  minion: "minion",
  demon: "demon",
  traveller: "traveler",
  traveler: "traveler",
  fabled: "fabled",
  token: "token",
};

const MERGED_FABLED_JINX_NAMES = new Set([
  "遗忘之门",
  "活跃",
  "受伤",
  "隐伤",
  "倒地",
  "濒死",
  "持有&获得",
  "造谣者※",
  "鎏金执事",
  "巫女",
  "暗莺※",
  "米-戈",
  "舞伴※",
  "盲从·运作",
  "死灵的复活祭典",
  "天使告诉恶魔",
  "帽匠可选规则",
  "精神病患者※",
  "舞狮人＆恶魔伪装",
  "*角色得知",
  "*角色选择",
  "*角色死亡",
  "*角色复活",
  "*状态：中毒醉酒",
  "*状态：暴露",
]);

const ROLE_ABILITY_REUSE_THRESHOLD = 0.92;
const SHORT_ROLE_ABILITY_REUSE_THRESHOLD = 0.96;
const ROLE_ABILITY_REVIEW_THRESHOLD = 0.75;
const SHORT_ROLE_ABILITY_LENGTH = 20;

function slugify(value) {
  return String(value || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function safeFileName(value) {
  return String(value || "未命名").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function nextNumericId(items, prefix) {
  const max = items.reduce((result, item) => {
    const match = String(item.data?.id || "").match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(result, Number(match[1])) : result;
  }, 0);

  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function findEntryById(entries, id) {
  return entries.find((entry) => entry.data?.id === id) || null;
}

function normalizeRoleType(type) {
  return TEAM_TO_TYPE[type] || type || "townsfolk";
}

function getOfficialRoleType(officialRole) {
  return normalizeRoleType(officialRole.team);
}

function normalizeAbilityForComparison(value) {
  return stripHtml(String(value || ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function getAbilityReuseThreshold(leftAbility, rightAbility) {
  const shortestLength = Math.min(
    normalizeAbilityForComparison(leftAbility).length,
    normalizeAbilityForComparison(rightAbility).length,
  );

  return shortestLength > 0 && shortestLength < SHORT_ROLE_ABILITY_LENGTH
    ? SHORT_ROLE_ABILITY_REUSE_THRESHOLD
    : ROLE_ABILITY_REUSE_THRESHOLD;
}

function levenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    current[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + substitutionCost,
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

function getAbilitySimilarity(leftAbility, rightAbility) {
  const left = normalizeAbilityForComparison(leftAbility);
  const right = normalizeAbilityForComparison(rightAbility);

  if (!left && !right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  return 1 - (levenshteinDistance(left, right) / Math.max(left.length, right.length));
}

function summarizeRoleMatchCandidate(candidate) {
  if (!candidate?.entry?.data) {
    return null;
  }

  return {
    id: candidate.entry.data.id,
    name: candidate.entry.data.name,
    type: candidate.entry.data.type,
    similarity: candidate.similarity,
  };
}

function findRoleEntry(roles, officialRole) {
  const type = getOfficialRoleType(officialRole);
  const sameNameRoles = roles.filter((entry) => entry.data?.name === officialRole.name);
  const sameNameSameTypeRoles = sameNameRoles.filter((entry) => normalizeRoleType(entry.data?.type) === type);
  const sameNameDifferentTypeRoles = sameNameRoles.filter((entry) => normalizeRoleType(entry.data?.type) !== type);

  if (!sameNameSameTypeRoles.length) {
    return {
      entry: null,
      reason: sameNameDifferentTypeRoles.length ? "same_name_different_type" : "new_role",
      candidate: null,
      candidates: sameNameDifferentTypeRoles.map((entry) => ({
        id: entry.data.id,
        name: entry.data.name,
        type: entry.data.type,
      })),
    };
  }

  const scoredCandidates = sameNameSameTypeRoles
    .map((entry) => ({
      entry,
      similarity: getAbilitySimilarity(entry.data?.ability, officialRole.ability),
      reuseThreshold: getAbilityReuseThreshold(entry.data?.ability, officialRole.ability),
    }))
    .sort((left, right) => right.similarity - left.similarity);
  const bestCandidate = scoredCandidates[0];

  if (bestCandidate.similarity >= bestCandidate.reuseThreshold) {
    return {
      entry: bestCandidate.entry,
      reason: "matched_name_type_ability",
      candidate: summarizeRoleMatchCandidate(bestCandidate),
      candidates: [],
    };
  }

  return {
    entry: null,
    reason:
      bestCandidate.similarity >= ROLE_ABILITY_REVIEW_THRESHOLD
        ? "same_name_type_similar_ability"
        : "same_name_type_different_ability",
    candidate: summarizeRoleMatchCandidate(bestCandidate),
    candidates: scoredCandidates.map(summarizeRoleMatchCandidate).filter(Boolean),
  };
}

function normalizeOfficialInput(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!Array.isArray(parsed)) {
    throw new Error("官方 JSON 顶层必须是数组。");
  }

  const meta = parsed.find((entry) => entry.id === "_meta");
  const roles = parsed.filter((entry) => entry.id !== "_meta");

  if (!meta) {
    throw new Error("官方 JSON 缺少 _meta 条目。");
  }

  return { meta, roles };
}

function collectOfficialJsonFiles(inputPath) {
  const stat = fs.statSync(inputPath);

  if (stat.isFile()) {
    return inputPath.endsWith(".json") ? [inputPath] : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(inputPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(inputPath, entry.name);

      if (entry.isDirectory()) {
        return collectOfficialJsonFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function makeScriptId(existingScripts, scriptName) {
  const nextId = nextNumericId(existingScripts, "s");
  const existing = existingScripts.find((entry) => entry.data?.name === scriptName);
  return existing?.data?.id || nextId;
}

function makeJinxId(existingJinxes, jinxName) {
  const nextId = nextNumericId(existingJinxes, "j");
  const existing = existingJinxes.find((entry) => entry.data?.name === jinxName);
  return existing?.data?.id || nextId;
}

function makeOfficialJinxConflictDraft(officialRole, roleLookup) {
  const resolved = normalizeJinxResolution(
    resolveJinxRoleNames(splitJinxRoleNames(officialRole.name), roleLookup),
  );

  return {
    roleIds: resolved.roleIds,
    rule: officialRole.ability || "",
  };
}

function findJinxEntry(jinxes, officialRole, roleLookup) {
  const conflictKey = makeJinxConflictKey(
    makeOfficialJinxConflictDraft(officialRole, roleLookup),
  );

  return (
    (officialRole.id
      ? jinxes.find((entry) => entry.data?.source?.officialId === officialRole.id)
      : null) ||
    (conflictKey
      ? jinxes.find((entry) => makeJinxConflictKey(entry.data) === conflictKey)
      : null) ||
    jinxes.find((entry) => entry.data?.name === officialRole.name) ||
    null
  );
}

function makeJinxData(existingJinx, officialRole, roleLookup, scriptId) {
  const rawNames = splitJinxRoleNames(officialRole.name);
  const resolved = normalizeJinxResolution(
    resolveJinxRoleNames(rawNames, roleLookup),
    existingJinx,
  );
  const sourceScriptIds = [
    ...new Set([
      ...(Array.isArray(existingJinx?.sourceScriptIds) ? existingJinx.sourceScriptIds : []),
      scriptId,
    ].filter(Boolean)),
  ];

  return {
    ...(existingJinx || {}),
    id: existingJinx?.id,
    kind: "jinx",
    name: officialRole.name,
    roleIds: resolved.roleIds,
    roleNames: resolved.roleNames,
    unresolvedRoleNames: resolved.unresolvedRoleNames,
    ...(resolved.ruleTags.length ? { ruleTags: resolved.ruleTags } : {}),
    ...(resolved.appliesWhen ? { appliesWhen: resolved.appliesWhen } : {}),
    rule: officialRole.ability || existingJinx?.rule || "",
    audience: existingJinx?.audience || "both",
    sourceScriptIds,
    source: {
      ...(existingJinx?.source || {}),
      officialId: officialRole.id || existingJinx?.source?.officialId || "",
      officialTeam: officialRole.team || existingJinx?.source?.officialTeam || "",
      edition: officialRole.edition || existingJinx?.source?.edition || "",
      image: officialRole.image || existingJinx?.source?.image || "",
    },
  };
}

function shouldMergeJinxIntoFabled(officialRole) {
  return MERGED_FABLED_JINX_NAMES.has(officialRole.name);
}

function mergeJinxAbilityIntoFabledRole(roles, officialRole) {
  const entry = roles.find(
    (roleEntry) =>
      roleEntry.data?.name === officialRole.name &&
      roleEntry.data?.type === "fabled",
  );

  if (!entry?.data) {
    return null;
  }

  const roleData = entry.data;
  const jinxAbility = String(officialRole.ability || "").trim();
  if (!jinxAbility || String(roleData.ability || "").includes(jinxAbility)) {
    return entry;
  }

  roleData.ability = `${String(roleData.ability || "").trim()}${jinxAbility ? jinxAbility : ""}`;
  const mergedOfficialRole = {
    ...officialRole,
    id: roleData.abilityData?.sourceAbility?.officialId || roleData.englishName || roleData.id,
    team: TYPE_TO_TEAM[roleData.type] || roleData.type,
    ability: roleData.ability,
  };
  roleData.abilityData = stripEmbeddedAbilityFields(
    hasHandReviewedAbilityData(roleData.abilityData)
      ? makeExistingRoleAbilityData(
          { id: roleData.id, englishName: roleData.englishName, name: roleData.name, ...roleData.abilityData },
          roleData,
          mergedOfficialRole,
        )
      : makeRoleAbilityData(roleData, mergedOfficialRole),
  );
  writeYamlFile(entry.filePath, roleData);
  return entry;
}

function makeRoleData(existingRole, officialRole) {
  const type = TEAM_TO_TYPE[officialRole.team] || officialRole.team || "townsfolk";
  const base = existingRole ? { ...existingRole } : {};
  const ability = officialRole.ability || base.ability || "";

  return {
    ...base,
    id: base.id,
    englishName: base.englishName || slugify(officialRole.id || officialRole.name),
    name: officialRole.name,
    type,
    edition: officialRole.edition || base.edition || "custom",
    image: officialRole.image || base.image || "",
    flavor: officialRole.flavor || base.flavor || "",
    setup: Boolean(officialRole.setup),
    setupMeta: base.setupMeta || inferSetupMeta({ ...officialRole, ability }, type),
    reminders: officialRole.reminders || [],
    remindersGlobal: officialRole.remindersGlobal || [],
    firstNightReminder: officialRole.firstNightReminder || "",
    otherNightReminder: officialRole.otherNightReminder || "",
    ability,
  };
}

function inferSetupMeta(role, type) {
  const ability = role.ability || "";
  const identityOverlay = inferIdentityOverlay(role, type);
  const initialAbsence = inferInitialAbsence(ability);
  const configurationAdjustments = inferConfigurationAdjustments(ability);
  const setupNotes = [];

  if (identityOverlay.enabled) {
    setupNotes.push(identityOverlay.note);
  }

  if (initialAbsence.enabled) {
    setupNotes.push(initialAbsence.note);
  }

  configurationAdjustments.forEach((adjustment) => {
    setupNotes.push(adjustment.note);
  });

  return {
    randomAssignable: !identityOverlay.enabled && !initialAbsence.enabled,
    tokenRequired: true,
    setupAlertLevel: setupNotes.length ? "danger" : "none",
    identityOverlay,
    configurationAdjustments,
    setupNotes,
  };
}

function inferInitialAbsence(ability) {
  if (!/\[?[^\]]*初始配置不在场[^\]]*\]?/.test(ability)) {
    return {
      enabled: false,
      note: "",
    };
  }

  return {
    enabled: true,
    note: "初始配置不在场：不要将该角色加入初始随机直发池。",
  };
}

function inferIdentityOverlay(role, type) {
  const ability = role.ability || "";
  const name = role.name || "";
  const isDrunkLike = name.includes("酒鬼") || /你不知道你是.*你以为你是/.test(ability);
  const isMarionetteLike = name.includes("提线木偶") || /你以为你是.*但其实/.test(ability);

  if (!isDrunkLike && !isMarionetteLike) {
    return {
      enabled: false,
      shownToken: "self",
      actualRoleType: type,
      shownRoleTypes: [],
      note: "",
    };
  }

  const shownRoleTypes = isDrunkLike ? ["townsfolk"] : ["townsfolk", "outsider"];

  return {
    enabled: true,
    shownToken: "other_role",
    actualRoleType: type,
    shownRoleTypes,
    note: isDrunkLike
      ? "身份覆盖：不要把酒鬼标记直接加入随机直发池；玩家应拿到一个镇民标记，酒鬼本体由说书人记录。"
      : "身份覆盖：不要把提线木偶标记直接加入随机直发池；玩家应拿到一个善良角色标记，提线木偶本体由说书人记录。",
  };
}

function inferConfigurationAdjustments(ability) {
  const adjustments = [];
  const bracketMatches = Array.from(String(ability || "").matchAll(/\[([^\]]+)\]/g)).map((match) => match[1]);

  bracketMatches.forEach((text) => {
    const normalized = text.replace(/\s+/g, "");

    if (!normalized.includes("外来者")) {
      return;
    }

    const rangeMatch = normalized.match(/([+-]?\d+)[~或]([+-]?\d+)/);
    const singleMatch = normalized.match(/([+-]\d+)/);
    let min = null;
    let max = null;

    if (rangeMatch) {
      min = Number(rangeMatch[1]);
      max = Number(rangeMatch[2]);
    } else if (singleMatch) {
      min = Number(singleMatch[1]);
      max = Number(singleMatch[1]);
    }

    if (min === null || max === null) {
      return;
    }

    adjustments.push({
      type: "outsider_count",
      min,
      max,
      source: `[${text}]`,
      note: `配置调整：外来者数量 ${formatSignedRange(min, max)}。`,
    });
  });

  if (/额外增加或减少.*外来者|增加或减少.*外来者/.test(ability)) {
    adjustments.push({
      type: "outsider_count",
      min: -1,
      max: 1,
      source: "ability_text",
      note: "配置调整：外来者数量可能 +1 或 -1。",
    });
  }

  return adjustments;
}

function formatSignedRange(min, max) {
  const format = (value) => (value > 0 ? `+${value}` : String(value));
  return min === max ? format(min) : `${format(min)} 到 ${format(max)}`;
}

function stripEmbeddedAbilityFields(abilityData) {
  const { id, englishName, name, ...rest } = abilityData;
  return rest;
}

function makeExistingRoleAbilityData(existingAbilityData, roleData, officialRole) {
  const ability = officialRole.ability || roleData.ability || "";
  const generatedAbilityData = makeRoleAbilityData(roleData, officialRole);
  const sourceAbility = makeSourceAbilityData(roleData, officialRole);
  const sourceChanged =
    existingAbilityData.sourceAbility?.source === sourceAbility.source &&
    existingAbilityData.sourceAbility?.sourceHash &&
    existingAbilityData.sourceAbility.sourceHash !== sourceAbility.sourceHash;

  // Untouched generator output for the old text: generate again from the new text instead of keeping stale fields.
  if (
    sourceChanged &&
    !hasHandReviewedAbilityData(existingAbilityData) &&
    existingAbilityData.generatedFromOfficial === true &&
    hasOnlyGeneratedFields(existingAbilityData, ability)
  ) {
    return generatedAbilityData;
  }

  const nextData = {
    ...existingAbilityData,
    schemaVersion: Math.max(Number(existingAbilityData.schemaVersion) || 1, 2),
    generatedFromOfficial: true,
    sourceAbility,
  };

  if (sourceChanged && hasHandReviewedAbilityData(existingAbilityData)) {
    // Keep the hand-checked semantics, fields and review record; only flag the role for re-review.
    nextData.abilitySemantics = {
      ...existingAbilityData.abilitySemantics,
      reviewStatus: "source_changed",
    };
    nextData.needsReview = true;
    nextData.reviewReason = "Official ability text changed after review; re-check semantics and note fields.";
  } else if (!existingAbilityData.abilitySemantics || sourceChanged) {
    const abilityMeta = existingAbilityData.abilityMeta || generatedAbilityData.abilityMeta || {};
    const interactionSchema = existingAbilityData.interactionSchema || generatedAbilityData.interactionSchema || {};
    const target = interactionSchema.target || generatedAbilityData.interactionSchema.target;
    const result = interactionSchema.result || generatedAbilityData.interactionSchema.result;

    nextData.abilitySemantics = makeAbilitySemantics({
      ability,
      officialRole,
      roleData,
      target,
      result,
      pageType: abilityMeta.pageType || generatedAbilityData.abilityMeta.pageType,
      phaseTiming:
        Object.prototype.hasOwnProperty.call(abilityMeta, "phaseTiming")
          ? abilityMeta.phaseTiming
          : generatedAbilityData.abilityMeta.phaseTiming,
      eventTiming:
        Object.prototype.hasOwnProperty.call(abilityMeta, "eventTiming")
          ? abilityMeta.eventTiming
          : generatedAbilityData.abilityMeta.eventTiming,
      usagePattern: abilityMeta.usagePattern || generatedAbilityData.abilityMeta.usagePattern,
      needsReview: sourceChanged || Boolean(existingAbilityData.needsReview ?? generatedAbilityData.needsReview),
    });

    if (sourceChanged) {
      nextData.abilitySemantics.reviewStatus = "source_changed";
      nextData.needsReview = true;
      nextData.reviewReason =
        nextData.reviewReason || "Official ability text changed; review semantics and note fields.";
    }
  }

  return applyAbilityTermMetadata(nextData, { ...roleData, ability });
}

function orderRoleIds(officialRoles, roleIdByOfficialRole, fieldName) {
  return officialRoles
    .filter((role) => Number(role[fieldName]) > 0)
    .sort((left, right) => Number(left[fieldName]) - Number(right[fieldName]))
    .map((role) => roleIdByOfficialRole.get(role))
    .filter(Boolean);
}

function formatSimilarity(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "未知";
}

function makeRoleMatchReviewReason(roleMatch) {
  if (roleMatch.reason === "same_name_different_type") {
    const types = roleMatch.candidates.map((candidate) => `${candidate.id}(${candidate.type})`).join("、");
    return `导入检测到同名但类型不同的已有角色：${types}。已创建独立角色，请人工确认阵营/类型是否正确。`;
  }

  if (roleMatch.reason === "same_name_type_similar_ability") {
    return `导入检测到同名同类型角色，但能力相似度 ${formatSimilarity(roleMatch.candidate?.similarity)} 低于自动复用阈值。已创建独立角色，请人工确认是否应合并。`;
  }

  if (roleMatch.reason === "same_name_type_different_ability") {
    return `导入检测到同名同类型角色，但能力相似度 ${formatSimilarity(roleMatch.candidate?.similarity)} 较低。已创建独立角色，请人工确认是否为新变体。`;
  }

  return "";
}

function appendReviewReason(existingReason, nextReason) {
  if (!nextReason) {
    return existingReason || "";
  }

  return existingReason ? `${existingReason} ${nextReason}` : nextReason;
}

function importOfficialJson(inputPath) {
  const { meta, roles: officialEntries } = normalizeOfficialInput(inputPath);
  const officialRoles = officialEntries.filter((role) => !isJinxTeam(role.team));
  const officialJinxes = officialEntries.filter((role) => isJinxTeam(role.team));
  const scripts = readYamlCollection(SCRIPTS_DIR);
  const roles = readYamlCollection(ROLES_DIR);
  const jinxes = readYamlCollection(JINXES_DIR);
  const scriptId = makeScriptId(scripts, meta.name);
  const existingScript = findEntryById(scripts, scriptId);
  const roleIdByOfficialRole = new Map();
  const changed = [];
  const createdRoles = [];
  const reusedRoles = [];
  const createdJinxes = [];
  const reusedJinxes = [];
  const unresolvedJinxes = [];
  const mergedFabledJinxRoleIds = [];
  const createdRoleAbilities = [];
  const reviewRoles = [];
  const roleMatchReviews = [];

  officialRoles.forEach((officialRole) => {
    const roleMatch = findRoleEntry(roles, officialRole);
    const existingRole = roleMatch.entry;
    const roleId = existingRole?.data?.id || nextNumericId(roles, "r");
    const roleData = makeRoleData(existingRole?.data ? { ...existingRole.data, id: roleId } : { id: roleId }, officialRole);
    const filePath = existingRole?.filePath || path.join(ROLES_DIR, `${roleId}-${safeFileName(officialRole.name)}.yaml`);
    const importReviewReason = existingRole ? "" : makeRoleMatchReviewReason(roleMatch);

    if (!existingRole) {
      roles.push({ fileName: path.basename(filePath), filePath, data: roleData });
      createdRoles.push({ id: roleId, name: officialRole.name });
      if (importReviewReason) {
        roleMatchReviews.push({
          id: roleId,
          name: officialRole.name,
          type: roleData.type,
          reason: roleMatch.reason,
          candidate: roleMatch.candidate,
          candidates: roleMatch.candidates,
        });
      }
    } else {
      reusedRoles.push({ id: roleId, name: officialRole.name });
    }

    const existingAbility = roleData.abilityData
      ? { id: roleData.id, englishName: roleData.englishName, name: roleData.name, ...roleData.abilityData }
      : null;
    const abilityData = existingAbility
      ? makeExistingRoleAbilityData(existingAbility, roleData, officialRole)
      : makeRoleAbilityData(roleData, officialRole);

    if (!abilityData.deduction && !hasHandReviewedAbilityData(abilityData)) {
      const deduction = inferDeductionData(abilityData, { ...roleData, ability: officialRole.ability || roleData.ability || "" });
      if (deduction) {
        abilityData.deduction = deduction;
      }
    }

    if (importReviewReason) {
      abilityData.needsReview = true;
      abilityData.reviewReason = appendReviewReason(abilityData.reviewReason, importReviewReason);
      if (abilityData.abilitySemantics) {
        abilityData.abilitySemantics.reviewStatus =
          abilityData.abilitySemantics.reviewStatus === "auto"
            ? "import_review"
            : abilityData.abilitySemantics.reviewStatus || "import_review";
      }
    }

    roleData.abilityData = stripEmbeddedAbilityFields(abilityData);
    writeYamlFile(filePath, roleData);
    roleIdByOfficialRole.set(officialRole, roleId);
    changed.push(relativeToRoot(filePath));

    if (!existingAbility) {
      createdRoleAbilities.push({ id: roleId, name: officialRole.name });
    }

    if (abilityData.needsReview) {
      reviewRoles.push({ id: roleId, name: officialRole.name });
    }
  });

  const roleLookup = makeRoleLookup(roles);

  if (officialJinxes.length) {
    fs.mkdirSync(JINXES_DIR, { recursive: true });
  }

  officialJinxes.forEach((officialRole) => {
    if (shouldMergeJinxIntoFabled(officialRole)) {
      const mergedEntry = mergeJinxAbilityIntoFabledRole(roles, officialRole);
      if (mergedEntry?.filePath) {
        changed.push(relativeToRoot(mergedEntry.filePath));
        if (mergedEntry.data?.id) {
          mergedFabledJinxRoleIds.push(mergedEntry.data.id);
        }
        return;
      }
    }

    const existingJinx = findJinxEntry(jinxes, officialRole, roleLookup);
    const jinxId = existingJinx?.data?.id || makeJinxId(jinxes, officialRole.name);
    const jinxData = makeJinxData(
      existingJinx?.data ? { ...existingJinx.data, id: jinxId } : { id: jinxId },
      officialRole,
      roleLookup,
      scriptId,
    );
    const filePath = existingJinx?.filePath || path.join(JINXES_DIR, `${jinxId}-${safeFileName(officialRole.name)}.yaml`);

    if (!existingJinx) {
      jinxes.push({ fileName: path.basename(filePath), filePath, data: jinxData });
      createdJinxes.push({ id: jinxId, name: officialRole.name });
    } else {
      reusedJinxes.push({ id: jinxId, name: officialRole.name });
    }

    if (jinxData.unresolvedRoleNames.length) {
      unresolvedJinxes.push({
        id: jinxId,
        name: officialRole.name,
        unresolvedRoleNames: jinxData.unresolvedRoleNames,
      });
    }

    writeYamlFile(filePath, jinxData);
    changed.push(relativeToRoot(filePath));
  });

  const roleIds = officialRoles
    .filter((role) => isCoreScriptRole(TEAM_TO_TYPE[role.team]))
    .map((role) => roleIdByOfficialRole.get(role))
    .filter(Boolean);
  const travellerIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "traveller")
    .map((role) => roleIdByOfficialRole.get(role))
    .filter(Boolean);
  const fabledIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "fabled")
    .map((role) => roleIdByOfficialRole.get(role))
    .concat(mergedFabledJinxRoleIds)
    .filter(Boolean)
    .filter((roleId, index, roleIds) => roleIds.indexOf(roleId) === index);
  const tokenIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "token")
    .map((role) => roleIdByOfficialRole.get(role))
    .filter(Boolean);
  const scriptData = {
    ...(existingScript?.data || {}),
    id: scriptId,
    englishName: existingScript?.data?.englishName || slugify(meta.name),
    name: meta.name,
    status: existingScript?.data?.status || (existingScript ? "published" : "draft"),
    en: existingScript?.data?.en || meta.name,
    author: meta.author || "",
    logo: meta.logo || "",
    description: meta.description || "",
    townsfolkName: meta.townsfolkName || "镇民",
    additional: meta.additional || [],
    level: existingScript?.data?.level || "官方剧本",
    mood: existingScript?.data?.mood || "",
    text: existingScript?.data?.text || stripHtml(meta.description || "").slice(0, 120),
    image: existingScript?.data?.image || meta.logo || "/assets/clock-tower-night.jpg",
    tags: existingScript?.data?.tags || ["官方剧本"],
    sourceUrl: existingScript?.data?.sourceUrl || "",
    detail: existingScript?.data?.detail || makeScriptDetail(meta),
    roleIds,
    travellerIds,
    fabledIds,
    tokenIds,
    nightOrder: {
      first: orderRoleIds(officialRoles, roleIdByOfficialName, "firstNight"),
      other: orderRoleIds(officialRoles, roleIdByOfficialName, "otherNight"),
    },
  };
  const scriptPath = existingScript?.filePath || path.join(SCRIPTS_DIR, `${scriptId}-${safeFileName(meta.name)}.yaml`);

  writeYamlFile(scriptPath, scriptData);
  changed.push(relativeToRoot(scriptPath));

  return {
    scriptId,
    status: scriptData.status,
    changed,
    createdRoles,
    reusedRoles,
    createdJinxes,
    reusedJinxes,
    unresolvedJinxes,
    createdRoleAbilities,
    reviewRoles,
    roleMatchReviews,
  };
}

function importOfficialJsonPath(inputPath) {
  const files = collectOfficialJsonFiles(inputPath);
  const imported = [];
  const failed = [];

  files.forEach((filePath) => {
    try {
      const result = importOfficialJson(filePath);
      imported.push({ filePath, ...result });
    } catch (error) {
      failed.push({ filePath, error: error.message });
    }
  });

  return { files, imported, failed };
}

function stripHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

function makeScriptDetail(meta) {
  const overview = stripHtml(meta.additional?.[0]?.["剧本介绍"] || meta.description || "这里填写剧本介绍。");

  return {
    overview,
    bestFor: [],
    playStyle: [],
    storytellerNotes: [],
    commonPitfalls: [],
  };
}

function exportOfficialJson(scriptId, outputPath) {
  const scripts = readYamlCollection(SCRIPTS_DIR).map((entry) => entry.data);
  const roles = readYamlCollection(ROLES_DIR).map((entry) => entry.data);
  const jinxes = readYamlCollection(JINXES_DIR).map((entry) => entry.data);
  const script = scripts.find((entry) => entry.id === scriptId || entry.englishName === scriptId || entry.name === scriptId);

  if (!script) {
    throw new Error(`找不到剧本：${scriptId}`);
  }

  const roleById = new Map(roles.map((role) => [role.id, role]));
  const firstNightOrder = new Map((script.nightOrder?.first || []).map((roleId, index) => [roleId, index + 1]));
  const otherNightOrder = new Map((script.nightOrder?.other || []).map((roleId, index) => [roleId, index + 1]));
  const meta = {
    description: script.description || script.detail?.overview || script.text || "",
    author: script.author || "",
    name: script.name,
    logo: script.logo || script.image || "",
    id: "_meta",
    townsfolkName: script.townsfolkName || "镇民",
    additional: script.additional || [],
  };
  const orderedScriptRoleIds = [
    ...(script.travellerIds || []),
    ...(script.roleIds || []),
    ...(script.fabledIds || []),
    ...(script.tokenIds || []),
  ];
  const scriptRoleIdSet = new Set(orderedScriptRoleIds);
  const officialRoles = orderedScriptRoleIds
    .map((roleId) => roleById.get(roleId))
    .filter(Boolean)
    .map((role) => ({
      ability: role.ability || "",
      image: role.image || "",
      edition: role.edition || "custom",
      flavor: role.flavor || "",
      id: role.id,
      firstNightReminder: role.firstNightReminder || "",
      otherNightReminder: role.otherNightReminder || "",
      name: role.name,
      otherNight: otherNightOrder.get(role.id) || 0,
      setup: role.setup ? 1 : 0,
      reminders: role.reminders || [],
      remindersGlobal: role.remindersGlobal || [],
      team: TYPE_TO_TEAM[role.type] || role.type,
      firstNight: firstNightOrder.get(role.id) || 0,
    }));
  const officialJinxes = jinxes
    .filter((jinx) => jinxAppliesToRoleSet(jinx, scriptRoleIdSet, { sourceScriptId: script.id }))
    .map((jinx) => ({
      ability: jinx.rule || "",
      image: jinx.source?.image || "",
      edition: jinx.source?.edition || "custom",
      flavor: "",
      id: jinx.source?.officialId || jinx.id,
      firstNightReminder: "",
      otherNightReminder: "",
      name: jinx.name,
      otherNight: 0,
      setup: 0,
      reminders: [],
      remindersGlobal: [],
      team: jinx.source?.officialTeam || "jinxes",
      firstNight: 0,
    }));
  const output = [meta, ...officialRoles, ...officialJinxes];

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, "\t")}\n`, "utf8");

  return { outputPath, roles: officialRoles.length, jinxes: officialJinxes.length };
}

function isCoreScriptRole(type) {
  return ["townsfolk", "outsider", "minion", "demon"].includes(type);
}

function formatRoleList(items, limit = 8) {
  if (!items.length) {
    return "无";
  }

  const names = items.slice(0, limit).map((item) => `${item.id} ${item.name}`);
  return `${names.join("、")}${items.length > limit ? ` 等 ${items.length} 个` : ""}`;
}

function formatRoleMatchReason(reason) {
  const labels = {
    same_name_different_type: "同名不同类型",
    same_name_type_similar_ability: "同名同类型能力相近",
    same_name_type_different_ability: "同名同类型能力不同",
  };

  return labels[reason] || reason || "待检查";
}

function formatRoleMatchReviewList(items, limit = 6) {
  if (!items.length) {
    return "无";
  }

  const names = items.slice(0, limit).map((item) => {
    const candidate = item.candidate
      ? `；候选 ${item.candidate.id} ${formatSimilarity(item.candidate.similarity)}`
      : "";
    return `${item.id} ${item.name}（${formatRoleMatchReason(item.reason)}${candidate}）`;
  });
  return `${names.join("、")}${items.length > limit ? ` 等 ${items.length} 个` : ""}`;
}

function printUsage() {
  console.log(`用法:
  node scripts/manage-official-json.js import <official.json|folder>
  node scripts/manage-official-json.js export <scriptId|scriptName> <output.json>

示例:
  node scripts/manage-official-json.js import "C:\\path\\#暗流涌动.json"
  node scripts/manage-official-json.js import "C:\\path\\官方剧本文件夹"
  node scripts/manage-official-json.js export s001 ".\\dist\\暗流涌动.json"`);
}

function main() {
  const [, , command, firstArg, secondArg] = process.argv;

  if (command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "import" && firstArg) {
    const result = importOfficialJsonPath(path.resolve(firstArg));

    console.log(`扫描 JSON 文件：${result.files.length}`);
    console.log(`导入成功：${result.imported.length}`);
    result.imported.forEach((item) => {
      console.log(`- ${item.scriptId} [${item.status}]: ${relativeToRoot(item.filePath)}`);
      console.log(`  新角色：${item.createdRoles.length}；复用角色：${item.reusedRoles.length}；新建笔记结构：${item.createdRoleAbilities.length}；待复查：${item.reviewRoles.length}；同名检查：${item.roleMatchReviews.length}`);
      if (item.reviewRoles.length) {
        console.log(`  待复查角色：${formatRoleList(item.reviewRoles)}`);
      }
      if (item.roleMatchReviews.length) {
        console.log(`  同名角色检查：${formatRoleMatchReviewList(item.roleMatchReviews)}`);
      }
    });

    if (result.failed.length) {
      console.log(`导入失败：${result.failed.length}`);
      result.failed.forEach((item) => {
        console.log(`- ${relativeToRoot(item.filePath)}: ${item.error}`);
      });
      process.exitCode = 1;
    }
    return;
  }

  if (command === "export" && firstArg && secondArg) {
    const result = exportOfficialJson(firstArg, path.resolve(secondArg));
    console.log(`导出完成：${result.outputPath}`);
    console.log(`角色数：${result.roles}`);
    console.log(`相克规则数：${result.jinxes}`);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  importOfficialJson,
  importOfficialJsonPath,
  exportOfficialJson,
  inferSetupMeta,
  makeExistingRoleAbilityData,
};
