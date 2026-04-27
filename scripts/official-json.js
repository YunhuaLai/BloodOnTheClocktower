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

const TYPE_ORDER = ["traveller", "townsfolk", "outsider", "minion", "demon", "fabled"];

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
  const choosesPlayer = /选择.*玩家/.test(ability);
  const learnsInfo = /得知|会知道|是否|数量|几/.test(ability);
  const isEvent = /当|如果.*死亡|提名|处决/.test(ability) && !hasFirstNight && !hasOtherNight;
  const isSetupOnly = Boolean(officialRole.setup) && !hasFirstNight && !hasOtherNight;
  const needsReview = /变成|交换|转变|疯狂|恶魔|角色|阵营|旅行者|说书人决定|可能/.test(ability);
  const phaseTiming = hasFirstNight && !hasOtherNight
    ? "first_night"
    : hasOtherNight
      ? "each_night"
      : isSetupOnly
        ? "setup"
        : isEvent
          ? null
          : "passive";
  const pageType = choosesPlayer
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
      activationMode: choosesPlayer ? "active" : isEvent ? "conditional" : "passive",
      drivenBy: choosesPlayer ? "player" : "storyteller",
      recordable: pageType !== "no_input" && pageType !== "rule_modifier",
    },
    interactionSchema: makeInteractionSchema(pageType, choosesPlayer, learnsInfo),
  };
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

function makeInteractionSchema(pageType, choosesPlayer, learnsInfo) {
  const target = choosesPlayer
    ? {
        repeatMode: "sequence",
        defaultRows: 3,
        fields: [
          {
            key: "seat",
            type: "seat",
            label: "目标号码",
            required: true,
            optionsSource: null,
            options: null,
            min: 1,
            max: 15,
            placeholder: null,
          },
        ],
      }
    : { repeatMode: "none", defaultRows: 0, fields: [] };
  const result = learnsInfo || pageType === "event_triggered"
    ? {
        repeatMode: "sequence",
        defaultRows: 3,
        fields: [
          {
            key: "note",
            type: "text",
            label: "记录",
            required: false,
            optionsSource: null,
            options: null,
            min: null,
            max: null,
            placeholder: "导入初稿，请按角色能力调整结构化字段。",
          },
        ],
      }
    : { repeatMode: "none", defaultRows: 0, fields: [] };

  return { target, result };
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

  const travellerIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] === "traveller")
    .map((role) => roleIdByOfficialName.get(role.name))
    .filter(Boolean);
  const roleIds = officialRoles
    .filter((role) => TEAM_TO_TYPE[role.team] !== "traveller")
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
    travellerIds,
    roleIds,
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
  const orderedScriptRoleIds = [...(script.travellerIds || []), ...(script.roleIds || [])];
  const officialRoles = orderedScriptRoleIds
    .map((roleId) => roleById.get(roleId))
    .filter(Boolean)
    .sort((left, right) => getRoleSortValue(left) - getRoleSortValue(right))
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

function getRoleSortValue(role) {
  const typeIndex = TYPE_ORDER.indexOf(role.type);
  return typeIndex === -1 ? TYPE_ORDER.length : typeIndex;
}

function printUsage() {
  console.log(`用法:
  node scripts/official-json.js import <official.json>
  node scripts/official-json.js export <scriptId|scriptName> <output.json>

示例:
  node scripts/official-json.js import "C:\\path\\#暗流涌动.json"
  node scripts/official-json.js export s001 ".\\dist\\暗流涌动.json"`);
}

function main() {
  const [, , command, firstArg, secondArg] = process.argv;

  if (command === "import" && firstArg) {
    const result = importOfficialJson(path.resolve(firstArg));
    console.log(`导入完成：${result.scriptId}`);
    console.log(result.changed.join("\n"));
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
  exportOfficialJson,
};
