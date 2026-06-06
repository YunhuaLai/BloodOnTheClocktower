const { withResolvedImage } = require("./image-assets");

const ROLE_TYPES = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
  traveller: "旅行者",
  traveler: "旅行者",
  fabled: "传奇角色",
};

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTermReplacements(replacements) {
  return (Array.isArray(replacements) ? replacements : [])
    .map((replacement) => {
      if (Array.isArray(replacement)) {
        return { from: replacement[0], to: replacement[1] };
      }

      return replacement;
    })
    .filter((replacement) => replacement?.from && replacement?.to);
}

function replaceTerms(value, replacements) {
  if (typeof value === "string") {
    return replacements.reduce(
      (result, { from, to }) => result.replaceAll(from, to),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map((nestedValue) => replaceTerms(nestedValue, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replaceTerms(nestedValue, replacements),
      ]),
    );
  }

  return value;
}

function mapRoleReference(roleReference, roleIdByEnglishName, roleIds) {
  return roleIds.has(roleReference) ? roleReference : roleIdByEnglishName.get(roleReference) || roleReference;
}

function makeDetail(roleData) {
  const typeLabel = ROLE_TYPES[roleData.type] || "角色";
  const abilityText = roleData.ability || roleData.summary;
  const typeTips = {
    townsfolk: [
      "先判断这条信息或能力适合公开、半公开还是暂时保留。",
      "把能力结果和投票、死亡、提名轨迹合在一起看，不要只靠单点结论。",
      "如果结果与全局冲突，优先考虑醉酒、中毒、伪装或剧本机制。",
    ],
    outsider: [
      "尽早想清楚公开身份会帮助善良方排配置，还是会给邪恶方借口。",
      "你的负面能力本身也是线索，别因为角色有副作用就退出讨论。",
      "在残局前说明自己的风险点，避免全桌临时处理导致误判。",
    ],
    minion: [
      "你的任务不是单纯自保，而是给恶魔争取时间和可信伪装。",
      "围绕自己的能力准备一套能解释异常信息的故事。",
      "必要时可以牺牲自己，换取恶魔身份更安全或善良方判断失焦。",
    ],
    demon: [
      "击杀或转移目标要服务于长期伪装，而不是只清掉最显眼的威胁。",
      "主动设计一个能解释死亡、信息异常和投票行为的身份故事。",
      "残局前要确认哪些玩家会阻碍胜利路线，优先处理他们。",
    ],
    traveller: [
      "你是额外加入的玩家角色，先确认本局对旅行者提名、流放和投票的处理方式。",
      "公开讨论自己的善恶倾向和能力使用时机，避免基础配置被误算。",
      "中途加入后，尽快补齐前几天的公开信息和当前阵营判断。",
    ],
    traveler: [
      "你是额外加入的玩家角色，先确认本局对旅行者提名、流放和投票的处理方式。",
      "公开讨论自己的善恶倾向和能力使用时机，避免基础配置被误算。",
      "中途加入后，尽快补齐前几天的公开信息和当前阵营判断。",
    ],
    fabled: [
      "把它视为说书人工具或特殊规则提示，而不是普通玩家角色。",
      "开局前确认全桌理解它如何改变配置、流程或信息结构。",
      "如果剧本依赖它成立，记录清楚它影响了哪些玩家和角色。",
    ],
  };

  const storytellerTips = {
    townsfolk: [
      "让这个角色的信息能够参与推理，而不是直接替玩家给出答案。",
      "若涉及醉酒或中毒，确保错误结果仍有复盘价值。",
      "新手局可以让能力结果更清楚，帮助玩家理解剧本节奏。",
    ],
    outsider: [
      "外来者应制造有趣负担，而不是让玩家完全没有参与感。",
      "处理死亡、醉酒、疯狂或阵营变化时，要及时记录状态。",
      "让外来者信息能与配置、跳身份和邪恶伪装产生联系。",
    ],
    minion: [
      "爪牙能力应给邪恶方创造空间，同时保留善良方可推理的痕迹。",
      "注意能力触发时机，避免漏结算造成局面无法解释。",
      "新手局可以让爪牙效果更集中，方便复盘。",
    ],
    demon: [
      "恶魔能力决定整局节奏，要保证死亡和信息污染路径自洽。",
      "给邪恶方足够伪装空间，也给善良方足够追查线索。",
      "复杂恶魔需要提前理清夜晚顺序和异常结算。",
    ],
    traveller: [
      "旅行者不改变基础配置人数，加入时单独记录座位、身份和当前阵营。",
      "如果旅行者能力需要夜晚处理，按其加入后的首个可用时机补进流程。",
      "明确流放、投票和死亡状态，避免和普通玩家处决记录混淆。",
    ],
    traveler: [
      "旅行者不改变基础配置人数，加入时单独记录座位、身份和当前阵营。",
      "如果旅行者能力需要夜晚处理，按其加入后的首个可用时机补进流程。",
      "明确流放、投票和死亡状态，避免和普通玩家处决记录混淆。",
    ],
    fabled: [
      "只在剧本结构确实需要时使用，避免让玩家觉得配置被任意操控。",
      "开局宣布和执行方式要一致，尤其是影响角色分配时。",
      "如果它是线上工具型角色，线下局需要先说明替代流程。",
    ],
  };

  return {
    overview: `${roleData.name}是《${roleData.script}》中的${typeLabel}。${roleData.summary}`,
    abilitySummary: abilityText,
    playTips: typeTips[roleData.type] || typeTips.townsfolk,
    storytellerTips: storytellerTips[roleData.type] || storytellerTips.townsfolk,
    commonMistakes: [
      "只看角色能力文本，不结合当前剧本和人数配置。",
      "把一次结果当作绝对结论，忽略信息污染或伪装空间。",
      "没有记录关键时间点，导致后续复盘断线。",
    ],
    relatedRoleIds: [],
  };
}

function normalizeRole(rawRole, context) {
  const corrected = replaceTerms({ ...rawRole }, context.termReplacements);
  const scriptIds = context.roleScriptIdsById.get(corrected.id) || [];
  const scriptNames = scriptIds.map((scriptId) => context.scriptNamesById.get(scriptId) || scriptId);
  const roleEnglishName = corrected.englishName || corrected.id;
  const normalized = withResolvedImage({
    ...corrected,
    scriptId: scriptIds[0] || "",
    scriptIds,
    scriptNames,
    script: scriptNames.join(" / "),
    ability: corrected.ability || corrected.summary,
  }, "roles");
  const detail = corrected.detail ? replaceTerms(corrected.detail, context.termReplacements) : null;

  normalized.detail = {
    ...makeDetail(normalized),
    ...(detail || {}),
    abilitySummary: detail?.abilitySummary || normalized.ability,
    relatedRoleIds: (detail?.relatedRoleIds || []).map((roleReference) =>
      mapRoleReference(roleReference, context.roleIdByEnglishName, context.roleIds),
    ),
  };
  normalized.abilityData =
    corrected.abilityData ||
    context.roleAbilityById.get(corrected.id) ||
    context.roleAbilityByEnglishName.get(roleEnglishName) ||
    null;

  return normalized;
}

function normalizeScript(script, roleIds, termReplacements, roleIdByEnglishName = new Map()) {
  const corrected = replaceTerms(script, termReplacements);
  const travellerIds = uniqueValues(corrected.travellerIds || corrected.travelerIds || [])
    .map((roleReference) => mapRoleReference(roleReference, roleIdByEnglishName, roleIds))
    .filter((roleId) => roleIds.has(roleId));
  const fabledIds = uniqueValues(corrected.fabledIds || [])
    .map((roleReference) => mapRoleReference(roleReference, roleIdByEnglishName, roleIds))
    .filter((roleId) => roleIds.has(roleId));

  return withResolvedImage({
    ...corrected,
    status: corrected.status || "published",
    tags: Array.isArray(corrected.tags) ? corrected.tags : [],
    roleIds: uniqueValues(corrected.roleIds || [])
      .map((roleReference) => mapRoleReference(roleReference, roleIdByEnglishName, roleIds))
      .filter((roleId) => roleIds.has(roleId)),
    travellerIds,
    fabledIds,
  }, "scripts");
}

function normalizeJinx(jinx, context) {
  const corrected = replaceTerms({ ...jinx }, context.termReplacements);
  const roleIds = uniqueValues(corrected.roleIds || [])
    .map((roleReference) => mapRoleReference(roleReference, context.roleIdByEnglishName, context.roleIds))
    .filter((roleId) => context.roleIds.has(roleId));
  const resolvedRoleNames = roleIds.map((roleId) => context.roleNamesById.get(roleId) || roleId);
  const storedRoleNames = Array.isArray(corrected.roleNames) ? corrected.roleNames.filter(Boolean) : [];

  return {
    ...corrected,
    kind: corrected.kind || "jinx",
    roleIds,
    roleNames: resolvedRoleNames.length ? resolvedRoleNames : storedRoleNames,
    unresolvedRoleNames: Array.isArray(corrected.unresolvedRoleNames)
      ? corrected.unresolvedRoleNames.filter(Boolean)
      : [],
    rule: corrected.rule || corrected.ability || "",
    audience: corrected.audience || "both",
    sourceScriptIds: uniqueValues(corrected.sourceScriptIds || []),
  };
}

function normalizeTerms(rawTerms, roleIdByEnglishName, roleIds, termReplacements) {
  return replaceTerms(rawTerms, termReplacements).map((term) => ({
    ...term,
    relatedRoleIds: (term.relatedRoleIds || []).map((roleReference) =>
      mapRoleReference(roleReference, roleIdByEnglishName, roleIds),
    ),
  }));
}

function augmentEncyclopedia(data) {
  const baseData = { ...data };
  delete baseData.termReplacements;
  const rawScripts = data.scripts || [];
  const rawRoles = data.roles || [];
  const rawJinxes = data.jinxes || [];
  const rawRoleAbilities = data.roleAbilities || [];
  const rawTerms = Array.isArray(data.terms) ? data.terms : [];
  const termReplacements = normalizeTermReplacements(data.termReplacements);
  const roleIds = new Set(rawRoles.map((role) => role.id));
  const roleIdByEnglishName = new Map(
    rawRoles.map((role) => [role.englishName || role.id, role.id]),
  );
  const roleNamesById = new Map(rawRoles.map((role) => [role.id, role.name || role.id]));
  const scriptNamesById = new Map(rawScripts.map((script) => [script.id, script.name]));
  const roleAbilityByEnglishName = new Map(
    rawRoleAbilities
      .filter((ability) => ability.englishName || ability.id)
      .map((ability) => [ability.englishName || ability.id, ability]),
  );
  const roleAbilityById = new Map(
    rawRoleAbilities.filter((ability) => ability.id).map((ability) => [ability.id, ability]),
  );
  const scripts = rawScripts.map((script) =>
    normalizeScript(script, roleIds, termReplacements, roleIdByEnglishName),
  );
  const roleScriptIdsById = new Map(rawRoles.map((role) => [role.id, []]));

  scripts.forEach((script) => {
    [...(script.roleIds || []), ...(script.travellerIds || []), ...(script.fabledIds || [])].forEach((roleId) => {
      const scriptIds = roleScriptIdsById.get(roleId);

      if (scriptIds) {
        scriptIds.push(script.id);
      }
    });
  });

  return {
    ...baseData,
    scripts,
    roles: rawRoles.map((role) =>
      normalizeRole(role, {
        scriptNamesById,
        roleScriptIdsById,
        roleIdByEnglishName,
        roleIds,
        roleAbilityById,
        roleAbilityByEnglishName,
        termReplacements,
      }),
    ),
    jinxes: rawJinxes.map((jinx) =>
      normalizeJinx(jinx, {
        roleIdByEnglishName,
        roleIds,
        roleNamesById,
        termReplacements,
      }),
    ),
    terms: normalizeTerms(rawTerms, roleIdByEnglishName, roleIds, termReplacements),
  };
}

module.exports = {
  augmentEncyclopedia,
};
