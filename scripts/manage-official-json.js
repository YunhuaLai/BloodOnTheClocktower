const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { applyAbilityTermMetadata } = require("./lib/ability-term-metadata");
const { inferDeductionData } = require("./lib/deduction-profile-inference");
const {
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
};

const TYPE_TO_TEAM = {
  townsfolk: "townsfolk",
  outsider: "outsider",
  minion: "minion",
  demon: "demon",
  traveller: "traveler",
  traveler: "traveler",
  fabled: "fabled",
};

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

function findRoleEntry(roles, officialRole) {
  return roles.find((entry) => entry.data?.name === officialRole.name) || null;
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

function hashSourceAbilityPayload(payload) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex");
}

const ROLE_ABILITY_SOURCE_HASH_FIELDS = [
  "ability",
  "type",
  "setup",
  "reminders",
  "remindersGlobal",
  "firstNightReminder",
  "otherNightReminder",
];

function makeSourceAbilityData(roleData, officialRole = {}) {
  const payload = {
    ability: roleData.ability || "",
    type: roleData.type || "",
    setup: Boolean(roleData.setup),
    reminders: roleData.reminders || [],
    remindersGlobal: roleData.remindersGlobal || [],
    firstNightReminder: roleData.firstNightReminder || "",
    otherNightReminder: roleData.otherNightReminder || "",
  };

  return {
    source: "role-file",
    roleId: roleData.id || "",
    officialId: officialRole.id || roleData.englishName || "",
    sourceHash: hashSourceAbilityPayload(payload),
    sourceHashFields: ROLE_ABILITY_SOURCE_HASH_FIELDS,
  };
}

function getSchemaFields(node) {
  return Array.isArray(node?.fields) ? node.fields : [];
}

function countFieldsByType(node, type) {
  return getSchemaFields(node).filter((field) => field?.type === type).length;
}

function hasFieldType(node, type) {
  return getSchemaFields(node).some((field) => field?.type === type);
}

function hasFieldKey(node, key) {
  return getSchemaFields(node).some((field) => field?.key === key);
}

function inferRoleTypeHint(ability) {
  if (/镇民/.test(ability)) return "townsfolk";
  if (/外来者/.test(ability)) return "outsider";
  if (/爪牙/.test(ability)) return "minion";
  if (/恶魔/.test(ability)) return "demon";
  return null;
}

function inferBooleanQuestionKind(ability) {
  if (/恶魔/.test(ability)) return "demon_check";
  if (/同阵营|同一阵营|相同阵营/.test(ability)) return "team_relation";
  if (/投票/.test(ability)) return "vote_check";
  if (/提名/.test(ability)) return "nomination_check";
  return "boolean_check";
}

function inferNumberKind(ability) {
  if (/距离/.test(ability)) return "distance";
  if (/死亡|死去|死者/.test(ability)) return "death_count";
  if (/邪恶|恶/.test(ability)) return "evil_count";
  return "count";
}

function inferSemanticOperations({ ability, officialRole, roleData, target, result, pageType, eventTiming }) {
  const operations = [];
  const targetSeatCount = countFieldsByType(target, "seat");
  const resultSeatCount = countFieldsByType(result, "seat");
  const hasTargetRole = hasFieldType(target, "role");
  const hasResultRole = hasFieldType(result, "role");
  const hasResultBoolean = hasFieldType(result, "boolean");
  const hasResultNumber = hasFieldType(result, "number");
  const hasResultTeam = hasFieldType(result, "team");

  if (officialRole.setup || roleData.setupMeta?.configurationAdjustments?.length) {
    operations.push({
      kind: "setup_modifier",
      adjustments: roleData.setupMeta?.configurationAdjustments || [],
    });
  }

  if (targetSeatCount) {
    operations.push({
      kind: "choose_player",
      count: targetSeatCount,
      source: "target",
    });
  }

  if (hasTargetRole) {
    operations.push({
      kind: "choose_role",
      source: "target",
    });
  }

  if (hasFieldKey(result, "seat1") && hasFieldKey(result, "seat2") && hasResultRole) {
    operations.push({
      kind: "learn_role_in_group",
      seats: resultSeatCount || 2,
      roleType: inferRoleTypeHint(ability),
    });
  } else if (targetSeatCount && hasResultRole) {
    operations.push({
      kind: "learn_role_at_target",
      targetSource: "target",
    });
  } else if (hasResultRole) {
    operations.push({
      kind: "learn_role",
      roleType: inferRoleTypeHint(ability),
    });
  }

  if (hasResultBoolean) {
    operations.push({
      kind: "learn_boolean",
      question: inferBooleanQuestionKind(ability),
    });
  }

  if (hasResultNumber) {
    operations.push({
      kind: "learn_number",
      numberKind: inferNumberKind(ability),
    });
  }

  if (hasResultTeam) {
    operations.push({
      kind: "learn_team",
    });
  }

  if (resultSeatCount && !hasResultRole) {
    operations.push({
      kind: "learn_player",
      count: resultSeatCount,
    });
  }

  if (/中毒|醉酒|失去能力/.test(ability)) {
    operations.push({
      kind: "apply_status_effect",
      effect: "poison_drunk_or_malfunction",
    });
  }

  if (/保护|不会死亡|免于死亡|免受|免疫|无效/.test(ability)) {
    operations.push({
      kind: "protect_player",
    });
  }

  if (/死亡|死去|处决/.test(ability) && !operations.some((operation) => operation.kind === "learn_number")) {
    operations.push({
      kind: "death_or_execution_effect",
    });
  }

  if (pageType === "event_triggered") {
    operations.push({
      kind: "event_trigger",
      eventTiming,
    });
  }

  if (!operations.length) {
    operations.push({
      kind: pageType === "rule_modifier" || pageType === "no_input" ? "passive_rule" : "manual_record",
    });
  }

  return operations;
}

function makeAbilitySemantics({
  ability,
  officialRole,
  roleData,
  target,
  result,
  pageType,
  phaseTiming,
  eventTiming,
  usagePattern,
  needsReview,
}) {
  return {
    schemaVersion: 1,
    reviewStatus: needsReview ? "needs_review" : "auto",
    confidence: needsReview ? 0.45 : 0.75,
    timing: {
      phase: phaseTiming,
      event: eventTiming,
      frequency: usagePattern,
    },
    actor: {
      drivenBy: pageType === "pick_and_record" ? "player" : pageType === "rule_modifier" ? "system" : "storyteller",
    },
    operations: inferSemanticOperations({
      ability,
      officialRole,
      roleData,
      target,
      result,
      pageType,
      eventTiming,
    }),
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

function makeRoleAbilityData(roleData, officialRole) {
  const ability = officialRole.ability || "";
  const hasFirstNight = Number(officialRole.firstNight) > 0;
  const hasOtherNight = Number(officialRole.otherNight) > 0;
  const usagePattern = inferUsagePattern(ability, hasFirstNight, hasOtherNight);
  const isOnceRecord = usagePattern === "once" || usagePattern === "once_per_game";
  const target = inferTargetSchema(ability, isOnceRecord);
  const result = inferResultSchema(ability, isOnceRecord);
  const chooses = target.fields.length > 0;
  const learnsInfo = result.fields.length > 0;
  const isEvent = isEventTriggeredAbility(ability, hasFirstNight, hasOtherNight);
  const isSetupOnly = Boolean(officialRole.setup) && !hasFirstNight && !hasOtherNight;
  const needsReview = needsAbilityReview(ability, target, result);
  const phaseTiming = inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent);
  const eventTiming = isEvent ? inferEventTiming(ability) : null;
  const pageType = chooses
    ? "pick_and_record"
    : learnsInfo
      ? "record_result_only"
      : isEvent
        ? "event_triggered"
        : isSetupOnly
          ? "rule_modifier"
          : "no_input";
  const abilityData = {
    id: roleData.id,
    englishName: roleData.englishName,
    name: roleData.name,
    schemaVersion: 2,
    generatedFromOfficial: true,
    sourceAbility: makeSourceAbilityData(roleData, officialRole),
    needsReview,
    reviewReason: needsReview ? "官方能力文本包含复杂结算，需人工确认笔记页记录字段。" : "",
    tags: buildAbilityTags(officialRole, pageType),
    abilityMeta: {
      pageType,
      phaseTiming,
      eventTiming,
      usagePattern,
      activationMode: chooses ? "active" : isEvent ? "conditional" : "passive",
      drivenBy: chooses ? "player" : isSetupOnly ? "system" : "storyteller",
      recordable: pageType !== "no_input" && pageType !== "rule_modifier",
    },
    abilitySemantics: makeAbilitySemantics({
      ability,
      officialRole,
      roleData,
      target,
      result,
      pageType,
      phaseTiming,
      eventTiming,
      usagePattern,
      needsReview,
    }),
    interactionSchema: {
      target: stripSchemaNodeMeta(target),
      result: stripSchemaNodeMeta(result),
    },
  };
  const deduction = inferDeductionData(abilityData, { ...roleData, ability });
  if (deduction) {
    abilityData.deduction = deduction;
  }

  return applyAbilityTermMetadata(abilityData, { ...roleData, ability });
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
  const nextData = {
    ...existingAbilityData,
    schemaVersion: Math.max(Number(existingAbilityData.schemaVersion) || 1, 2),
    generatedFromOfficial: true,
    sourceAbility,
  };

  if (!existingAbilityData.abilitySemantics || sourceChanged) {
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

function stripSchemaNodeMeta(node) {
  return {
    repeatMode: node.repeatMode,
    defaultRows: node.defaultRows,
    fields: node.fields,
  };
}

function inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent) {
  if (hasEachDayTiming(ability)) return "each_day";
  if (hasEachNightStarTiming(ability)) return "each_night_star";
  if (hasEachNightTiming(ability)) return "each_night";
  if (hasFirstNight && !hasOtherNight) return "first_night";
  if (hasOtherNight) return "each_night";
  if (isSetupOnly) return "setup";
  if (isEvent) return null;
  return "passive";
}

function isEventTriggeredAbility(ability, hasFirstNight, hasOtherNight) {
  return /当|如果.*死亡|提名|处决|投票|落败|获胜/.test(ability) && !hasFirstNight && !hasOtherNight;
}

function needsAbilityReview(ability, target, result) {
  if (/变成|交换|转变|疯狂|创造.*恶魔|代替|额外进行|互相知道|无法获胜|阵营落败|阵营获胜/.test(ability)) {
    return true;
  }

  if (/说书人决定|可能|至多|任意|秘密|所有|全部|邻近|旅行者/.test(ability)) {
    return true;
  }

  return target.needsReview || result.needsReview;
}

function buildAbilityTags(officialRole, pageType) {
  const tags = [];

  if (officialRole.firstNight) tags.push("首夜");
  if (officialRole.otherNight) tags.push("每晚");
  if (officialRole.setup) tags.push("设置");
  if (pageType === "pick_and_record") tags.push("主动选择");
  if (pageType === "record_result_only") tags.push("信息型");
  if (pageType === "event_triggered") tags.push("事件触发");

  return tags.length ? tags : ["被动"];
}

function inferEventTiming(ability) {
  if (ability.includes("提名")) return "on_nomination";
  if (ability.includes("处决")) return "on_execution";
  if (ability.includes("死亡")) return "on_death";
  return null;
}

function inferUsagePattern(ability, hasFirstNight, hasOtherNight) {
  if (hasOncePerGameTiming(ability)) return "once_per_game";
  if (hasEachDayTiming(ability)) return "once_per_day";
  if (hasEachNightTiming(ability)) return "once_per_night";
  if (hasFirstNight && !hasOtherNight) return "once";
  if (hasOtherNight) return "once_per_night";
  return "passive";
}

function hasOncePerGameTiming(ability) {
  return /每局游戏限一次|每局限一次|每局一次|每局游戏一次|限一次/.test(ability);
}

function hasEachDayTiming(ability) {
  return /每个白天|每天白天|每个白昼|每天(?!夜晚)/.test(ability);
}

function hasEachNightTiming(ability) {
  return /每个夜晚|每晚|每天夜晚|每夜/.test(ability);
}

function hasEachNightStarTiming(ability) {
  return /每个夜晚\*|每晚\*|夜晚时\*|夜晚\*/.test(ability);
}

function inferTargetSchema(ability, isOnceRecord) {
  const fields = [];
  const choosesPlayer = /选择.*玩家/.test(ability);
  const choosesRole = /选择.*角色|猜测.*角色/.test(ability);

  if (choosesPlayer) {
    const count = inferMentionedCount(ability, "玩家");

    if (count >= 2 && count <= 3) {
      for (let index = 1; index <= count; index += 1) {
        fields.push(seatField(`seat${index}`, `目标号码${index}`));
      }
    } else {
      fields.push(seatField("seat", ability.includes("死亡的玩家") ? "死亡玩家号码" : "目标号码"));
    }
  }

  if (choosesRole) {
    fields.push(roleField(fields.some((field) => field.key === "role") ? "guess_role" : "role", /猜测/.test(ability) ? "猜测角色" : "选择角色"));
  }

  return makeSchemaNode(fields, isOnceRecord);
}

function inferResultSchema(ability, isOnceRecord) {
  const fields = [];
  const needsReview = false;

  if (!/得知|会知道|是否|几|多少|数量|查看/.test(ability)) {
    return makeSchemaNode(fields, isOnceRecord);
  }

  if (/得知两名玩家和一个.*角色/.test(ability)) {
    fields.push(seatField("seat1", "号码1"));
    fields.push(seatField("seat2", "号码2"));
    fields.push(roleField("role", "身份"));
    return makeSchemaNode(fields, true);
  }

  if (/得知三名玩家/.test(ability)) {
    fields.push(seatField("seat1", "号码1"));
    fields.push(seatField("seat2", "号码2"));
    fields.push(seatField("seat3", "号码3"));
    return makeSchemaNode(fields, true);
  }

  if (/得知一名.*玩家和.*角色/.test(ability)) {
    fields.push(seatField("seat", "号码"));
    fields.push(roleField("role", "身份"));
    return makeSchemaNode(fields, true);
  }

  if (/顺时针|逆时针|方向/.test(ability)) {
    fields.push(choiceField("direction", "方向", ["clockwise", "counterclockwise"]));
    return makeSchemaNode(fields, isOnceRecord);
  }

  if (/是否/.test(ability)) {
    fields.push(booleanField("answer", "是否"));
  } else if (/几|多少|数量|有几/.test(ability)) {
    fields.push(numberField("count", "数量"));
  } else if (/阵营/.test(ability)) {
    fields.push(teamField("team", "阵营"));
  } else if (/角色|身份|查看/.test(ability)) {
    fields.push(roleField("role", "身份"));
  } else if (/得知一名.*玩家/.test(ability)) {
    fields.push(seatField("seat", "号码"));
  }

  if (!fields.length) {
    fields.push(textField("note", "记录", "导入初稿，请按角色能力调整结构化字段。"));
  }

  const node = makeSchemaNode(fields, isOnceRecord);
  node.needsReview = needsReview;
  return node;
}

function inferMentionedCount(ability, noun) {
  const patterns = [
    [new RegExp(`三(?:名|个)?${noun}`), 3],
    [new RegExp(`两(?:名|个)?${noun}`), 2],
    [new RegExp(`二(?:名|个)?${noun}`), 2],
    [new RegExp(`一(?:名|个)?${noun}`), 1],
  ];
  const match = patterns.find(([pattern]) => pattern.test(ability));
  return match ? match[1] : 1;
}

function makeSchemaNode(fields, isOnce) {
  if (!fields.length) {
    return { repeatMode: "none", defaultRows: 0, fields: [], needsReview: false };
  }

  return {
    repeatMode: isOnce ? "once" : "sequence",
    defaultRows: isOnce ? 1 : 3,
    fields,
    needsReview: false,
  };
}

function seatField(key, label) {
  return {
    key,
    type: "seat",
    label,
    required: true,
    optionsSource: null,
    options: null,
    min: 1,
    max: 15,
    placeholder: null,
  };
}

function roleField(key, label) {
  return {
    key,
    type: "role",
    label,
    required: true,
    optionsSource: "current_script_roles",
    options: null,
    min: null,
    max: null,
    placeholder: null,
  };
}

function teamField(key, label) {
  return {
    key,
    type: "team",
    label,
    required: true,
    optionsSource: "teams",
    options: null,
    min: null,
    max: null,
    placeholder: null,
  };
}

function booleanField(key, label) {
  return {
    key,
    type: "boolean",
    label,
    required: true,
    optionsSource: "custom",
    options: ["yes", "no"],
    min: null,
    max: null,
    placeholder: null,
  };
}

function numberField(key, label) {
  return {
    key,
    type: "number",
    label,
    required: true,
    optionsSource: null,
    options: null,
    min: 0,
    max: 15,
    placeholder: null,
  };
}

function choiceField(key, label, options) {
  return {
    key,
    type: "choice",
    label,
    required: true,
    optionsSource: "custom",
    options,
    min: null,
    max: null,
    placeholder: null,
  };
}

function textField(key, label, placeholder) {
  return {
    key,
    type: "text",
    label,
    required: false,
    optionsSource: null,
    options: null,
    min: null,
    max: null,
    placeholder,
  };
}

function orderRoleIds(officialRoles, roleIdByOfficialName, fieldName) {
  return officialRoles
    .filter((role) => Number(role[fieldName]) > 0)
    .sort((left, right) => Number(left[fieldName]) - Number(right[fieldName]))
    .map((role) => roleIdByOfficialName.get(role.name))
    .filter(Boolean);
}

function importOfficialJson(inputPath) {
  const { meta, roles: officialRoles } = normalizeOfficialInput(inputPath);
  const scripts = readYamlCollection(SCRIPTS_DIR);
  const roles = readYamlCollection(ROLES_DIR);
  const scriptId = makeScriptId(scripts, meta.name);
  const existingScript = findEntryById(scripts, scriptId);
  const roleIdByOfficialName = new Map();
  const changed = [];
  const createdRoles = [];
  const reusedRoles = [];
  const createdRoleAbilities = [];
  const reviewRoles = [];

  officialRoles.forEach((officialRole) => {
    const existingRole = findRoleEntry(roles, officialRole);
    const roleId = existingRole?.data?.id || nextNumericId(roles, "r");
    const roleData = makeRoleData(existingRole?.data ? { ...existingRole.data, id: roleId } : { id: roleId }, officialRole);
    const filePath = existingRole?.filePath || path.join(ROLES_DIR, `${roleId}-${safeFileName(officialRole.name)}.yaml`);

    if (!existingRole) {
      roles.push({ fileName: path.basename(filePath), filePath, data: roleData });
      createdRoles.push({ id: roleId, name: officialRole.name });
    } else {
      reusedRoles.push({ id: roleId, name: officialRole.name });
    }

    const existingAbility = roleData.abilityData
      ? { id: roleData.id, englishName: roleData.englishName, name: roleData.name, ...roleData.abilityData }
      : null;
    const abilityData = existingAbility
      ? makeExistingRoleAbilityData(existingAbility, roleData, officialRole)
      : makeRoleAbilityData(roleData, officialRole);

    if (!abilityData.deduction) {
      const deduction = inferDeductionData(abilityData, { ...roleData, ability: officialRole.ability || roleData.ability || "" });
      if (deduction) {
        abilityData.deduction = deduction;
      }
    }

    roleData.abilityData = stripEmbeddedAbilityFields(abilityData);
    writeYamlFile(filePath, roleData);
    roleIdByOfficialName.set(officialRole.name, roleId);
    changed.push(relativeToRoot(filePath));

    if (!existingAbility) {
      createdRoleAbilities.push({ id: roleId, name: officialRole.name });
    }

    if (abilityData.needsReview) {
      reviewRoles.push({ id: roleId, name: officialRole.name });
    }
  });

  const roleIds = officialRoles
    .filter((role) => isCoreScriptRole(TEAM_TO_TYPE[role.team]))
    .map((role) => roleIdByOfficialName.get(role.name))
    .filter(Boolean);
  const travellerIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "traveller")
    .map((role) => roleIdByOfficialName.get(role.name))
    .filter(Boolean);
  const fabledIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "fabled")
    .map((role) => roleIdByOfficialName.get(role.name))
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
    createdRoleAbilities,
    reviewRoles,
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
  ];
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
  const output = [meta, ...officialRoles];

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, "\t")}\n`, "utf8");

  return { outputPath, roles: officialRoles.length };
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
      console.log(`  新角色：${item.createdRoles.length}；复用角色：${item.reusedRoles.length}；新建笔记结构：${item.createdRoleAbilities.length}；待复查：${item.reviewRoles.length}`);
      if (item.reviewRoles.length) {
        console.log(`  待复查角色：${formatRoleList(item.reviewRoles)}`);
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
};
