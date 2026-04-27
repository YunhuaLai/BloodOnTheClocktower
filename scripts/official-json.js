const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT_DIR = path.resolve(__dirname, "..");
const LIBRARY_DIR = path.join(ROOT_DIR, "backend", "data", "library");
const SCRIPTS_DIR = path.join(LIBRARY_DIR, "scripts");
const ROLES_DIR = path.join(LIBRARY_DIR, "roles");
const ROLE_ABILITIES_DIR = path.join(LIBRARY_DIR, "role-abilities");

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

function readYamlFile(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
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
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => ({
      fileName: entry.name,
      filePath: path.join(directoryPath, entry.name),
      data: readYamlFile(path.join(directoryPath, entry.name)),
    }));
}

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
    reminders: officialRole.reminders || [],
    remindersGlobal: officialRole.remindersGlobal || [],
    firstNightReminder: officialRole.firstNightReminder || "",
    otherNightReminder: officialRole.otherNightReminder || "",
    summary: base.summary || officialRole.ability || "",
    keywords: base.keywords || buildKeywords(type, officialRole),
    detail: base.detail,
    ability: officialRole.ability || base.ability || "",
  };
}

function buildKeywords(type, officialRole) {
  const keywords = [type];

  if (officialRole.firstNight) keywords.push("首夜");
  if (officialRole.otherNight) keywords.push("夜晚");
  if (officialRole.setup) keywords.push("设置");
  if (String(officialRole.ability || "").includes("死亡")) keywords.push("死亡");
  if (String(officialRole.ability || "").includes("中毒")) keywords.push("中毒");
  if (String(officialRole.ability || "").includes("醉酒")) keywords.push("醉酒");

  return keywords.join(" ");
}

function makeRoleAbilityData(roleData, officialRole) {
  const ability = officialRole.ability || "";
  const hasFirstNight = Number(officialRole.firstNight) > 0;
  const hasOtherNight = Number(officialRole.otherNight) > 0;
  const target = inferTargetSchema(ability, hasFirstNight, hasOtherNight);
  const result = inferResultSchema(ability, hasFirstNight, hasOtherNight);
  const chooses = target.fields.length > 0;
  const learnsInfo = result.fields.length > 0;
  const isEvent = isEventTriggeredAbility(ability, hasFirstNight, hasOtherNight);
  const isSetupOnly = Boolean(officialRole.setup) && !hasFirstNight && !hasOtherNight;
  const needsReview = needsAbilityReview(ability, target, result);
  const phaseTiming = inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent);
  const pageType = chooses
    ? "pick_and_record"
    : learnsInfo
      ? "record_result_only"
      : isEvent
        ? "event_triggered"
        : isSetupOnly
          ? "rule_modifier"
          : "no_input";

  return {
    id: roleData.id,
    englishName: roleData.englishName,
    name: roleData.name,
    schemaVersion: 1,
    generatedFromOfficial: true,
    needsReview,
    reviewReason: needsReview ? "官方能力文本包含复杂结算，需人工确认笔记页记录字段。" : "",
    tags: buildAbilityTags(officialRole, pageType),
    abilityMeta: {
      pageType,
      phaseTiming,
      eventTiming: isEvent ? inferEventTiming(ability) : null,
      usagePattern: inferUsagePattern(ability, hasFirstNight, hasOtherNight),
      activationMode: chooses ? "active" : isEvent ? "conditional" : "passive",
      drivenBy: chooses ? "player" : isSetupOnly ? "system" : "storyteller",
      recordable: pageType !== "no_input" && pageType !== "rule_modifier",
    },
    interactionSchema: {
      target: stripSchemaNodeMeta(target),
      result: stripSchemaNodeMeta(result),
    },
  };
}

function stripSchemaNodeMeta(node) {
  return {
    repeatMode: node.repeatMode,
    defaultRows: node.defaultRows,
    fields: node.fields,
  };
}

function inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent) {
  if (/每个白天|每天白天/.test(ability)) return "each_day";
  if (hasFirstNight && !hasOtherNight) return "first_night";
  if (hasOtherNight && /夜晚\*|每晚\*/.test(ability)) return "each_night_star";
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
  if (/每局游戏限一次|每局一次|限一次/.test(ability)) return "once_per_game";
  if (hasFirstNight && !hasOtherNight) return "once";
  if (hasOtherNight) return "once_per_night";
  if (/每个白天/.test(ability)) return "once_per_day";
  return "passive";
}

function inferTargetSchema(ability, hasFirstNight, hasOtherNight) {
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

  return makeSchemaNode(fields, hasFirstNight && !hasOtherNight);
}

function inferResultSchema(ability, hasFirstNight, hasOtherNight) {
  const fields = [];
  const needsReview = false;

  if (!/得知|会知道|是否|几|多少|数量|查看/.test(ability)) {
    return makeSchemaNode(fields, hasFirstNight && !hasOtherNight);
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
    return makeSchemaNode(fields, hasFirstNight && !hasOtherNight);
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

  const node = makeSchemaNode(fields, hasFirstNight && !hasOtherNight);
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
  const roleAbilities = readYamlCollection(ROLE_ABILITIES_DIR);
  const scriptId = makeScriptId(scripts, meta.name);
  const existingScript = findEntryById(scripts, scriptId);
  const roleIdByOfficialName = new Map();
  const changed = [];

  officialRoles.forEach((officialRole) => {
    const existingRole = findRoleEntry(roles, officialRole);
    const roleId = existingRole?.data?.id || nextNumericId(roles, "r");
    const roleData = makeRoleData(existingRole?.data ? { ...existingRole.data, id: roleId } : { id: roleId }, officialRole);
    const filePath = existingRole?.filePath || path.join(ROLES_DIR, `${roleId}-${safeFileName(officialRole.name)}.yaml`);

    writeYamlFile(filePath, roleData);
    roleIdByOfficialName.set(officialRole.name, roleId);
    changed.push(path.relative(ROOT_DIR, filePath));

    if (!existingRole) {
      roles.push({ fileName: path.basename(filePath), filePath, data: roleData });
    }

    if (!roleAbilities.some((entry) => entry.data?.id === roleId)) {
      const abilityData = makeRoleAbilityData(roleData, officialRole);
      const abilityPath = path.join(ROLE_ABILITIES_DIR, `${roleId}-${safeFileName(officialRole.name)}.yaml`);
      writeYamlFile(abilityPath, abilityData);
      roleAbilities.push({ fileName: path.basename(abilityPath), filePath: abilityPath, data: abilityData });
      changed.push(path.relative(ROOT_DIR, abilityPath));
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
  changed.push(path.relative(ROOT_DIR, scriptPath));

  return { scriptId, changed };
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

function printUsage() {
  console.log(`用法:
  node scripts/official-json.js import <official.json|folder>
  node scripts/official-json.js export <scriptId|scriptName> <output.json>

示例:
  node scripts/official-json.js import "C:\\path\\#暗流涌动.json"
  node scripts/official-json.js import "C:\\path\\官方剧本文件夹"
  node scripts/official-json.js export s001 ".\\dist\\暗流涌动.json"`);
}

function main() {
  const [, , command, firstArg, secondArg] = process.argv;

  if (command === "import" && firstArg) {
    const result = importOfficialJsonPath(path.resolve(firstArg));

    console.log(`扫描 JSON 文件：${result.files.length}`);
    console.log(`导入成功：${result.imported.length}`);
    result.imported.forEach((item) => {
      console.log(`- ${item.scriptId}: ${path.relative(ROOT_DIR, item.filePath)}`);
    });

    if (result.failed.length) {
      console.log(`导入失败：${result.failed.length}`);
      result.failed.forEach((item) => {
        console.log(`- ${path.relative(ROOT_DIR, item.filePath)}: ${item.error}`);
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
};
