import { getClaimRoleOptions } from "../notes-claims.js";
import { clampNumber, cloneRoleInfo, cloneRoleInfoEntries, createEmptyRoleInfo, getActiveGame } from "../notes-state.js";
import { state, typeLabels } from "../state.js";
import { getClaimAbbreviation } from "./notes-core.js";

// Role ability metadata and summaries. Field/panel renderers live next to this file.

export const abilityPageTypeLabels = {
  no_input: "无录入",
  record_result_only: "只记结果",
  pick_and_record: "选择并记录",
  event_triggered: "事件触发",
  rule_modifier: "规则型",
};

export const abilityPhaseTimingLabels = {
  setup: "开局",
  first_night: "首夜",
  each_night: "每晚",
  each_night_star: "每晚*",
  night: "夜间",
  day: "白天",
  each_day: "每天",
  passive: "被动",
  special: "特殊",
};

export const abilityEventTimingLabels = {
  on_nomination: "提名时",
  on_execution: "处决时",
  on_death: "死亡时",
  on_attack: "受袭时",
  on_vote: "投票时",
  endgame: "残局",
};

export const abilityUsagePatternLabels = {
  once: "一次",
  once_per_game: "本局一次",
  once_per_day: "每天一次",
  once_per_night: "每晚一次",
  repeatable: "可重复",
  passive: "被动",
  variable: "不固定",
};

export const abilityActivationModeLabels = {
  active: "主动",
  passive: "被动",
  conditional: "条件触发",
  reactive: "响应触发",
};

export const abilityValueLabels = {
  yes: "是",
  no: "否",
  good: "好",
  evil: "坏",
  sober: "清",
  poisoned: "毒",
  drunk: "醉",
  self: "自己",
  target: "目标",
  unknown: "?",
};

export function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

export function getClaimedRole(playerOrClaim, game = getActiveGame()) {
  const claim =
    typeof playerOrClaim === "string"
      ? playerOrClaim
      : playerOrClaim?.claim;
  const normalizedClaim = normalizeRoleName(claim);
  if (!normalizedClaim) {
    return null;
  }

  const roleOptions = game ? getClaimRoleOptions(game) : state.roles;
  const matchRole = (role) =>
    [role.name, role.en, role.id, role.englishName].some(
      (name) => normalizeRoleName(name) === normalizedClaim,
    );

  return roleOptions.find(matchRole) || state.roles.find(matchRole) || null;
}

export function getRoleAbilityData(playerOrClaim, game = getActiveGame()) {
  return getClaimedRole(playerOrClaim, game)?.abilityData || null;
}

export function getRoleInfoNode(abilityData, sectionKey) {
  const node = abilityData?.interactionSchema?.[sectionKey];
  return {
    repeatMode: node?.repeatMode || "none",
    defaultRows: clampNumber(Number(node?.defaultRows) || 0, 0, 99),
    fields: Array.isArray(node?.fields) ? node.fields : [],
  };
}

export function isRoleInfoEntryFilled(entry) {
  return Object.values(entry || {}).some((value) => String(value ?? "").trim());
}

export function normalizeLegacyBooleanValue(value) {
  const normalized = normalizeRoleName(value);
  if (["yes", "true", "1", "是"].includes(normalized)) {
    return "yes";
  }

  if (["no", "false", "0", "否"].includes(normalized)) {
    return "no";
  }

  return String(value || "").trim();
}

export function migrateLegacyRoleInfo(roleInfo, role, abilityData) {
  const legacyEntries = Array.isArray(roleInfo?.entries) ? roleInfo.entries : [];
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const nextRoleInfo = createEmptyRoleInfo(role?.id || "");

  if (roleInfo?.profile === "yes-no-seq") {
    const resultKey = resultNode.fields[0]?.key || "answer";
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultKey]: normalizeLegacyBooleanValue(entry?.value),
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "seat-seq") {
    const targetKey = targetNode.fields[0]?.key || "seat";
    nextRoleInfo.targetEntries = legacyEntries.map((entry) => ({
      [targetKey]: String(entry?.seat || "").trim(),
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "digit-seq") {
    const resultKey = resultNode.fields[0]?.key || "count";
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultKey]: entry?.value ?? "",
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "seat-pair-alignment") {
    const targetKey = targetNode.fields[0]?.key || "seat";
    nextRoleInfo.targetEntries = legacyEntries.map((entry) => ({
      [targetKey]: String(entry?.seat || "").trim(),
    }));
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultNode.fields[0]?.key || "first"]: entry?.first || "",
      [resultNode.fields[1]?.key || "second"]: entry?.second || "",
    }));
    return nextRoleInfo;
  }

  return nextRoleInfo;
}

export function ensureRoleInfoMatchesClaim(player, game = getActiveGame()) {
  const role = getClaimedRole(player, game);
  const abilityData = role?.abilityData || null;
  const current = cloneRoleInfo(player?.roleInfo);

  if (!role || !abilityData?.abilityMeta?.recordable) {
    return createEmptyRoleInfo(role?.id || "");
  }

  if (current.version === 2) {
    if (current.roleId && current.roleId !== role.id) {
      return createEmptyRoleInfo(role.id);
    }

    if (!current.profile && !current.entries.length) {
      return {
        version: 2,
        roleId: role.id,
        targetEntries: cloneRoleInfoEntries(current.targetEntries),
        resultEntries: cloneRoleInfoEntries(current.resultEntries),
      };
    }
  }

  return migrateLegacyRoleInfo(current, role, abilityData);
}

export function getRoleInfoEntries(roleInfo, sectionKey) {
  if (sectionKey === "target") {
    return cloneRoleInfoEntries(roleInfo?.targetEntries);
  }

  return cloneRoleInfoEntries(roleInfo?.resultEntries);
}

export function getDisplayedRoleInfoEntries(roleInfo, node, sectionKey) {
  const entries = getRoleInfoEntries(roleInfo, sectionKey);
  if (node.repeatMode === "none" || !node.fields.length) {
    return [];
  }

  const minimumRows =
    node.repeatMode === "once"
      ? Math.max(node.defaultRows || 0, 1)
      : Math.max(node.defaultRows || 0, 1);
  const totalRows = Math.max(entries.length, minimumRows);

  return Array.from({ length: totalRows }, (_, index) => entries[index] || {});
}

export function getAbilityTimingText(abilityMeta) {
  if (abilityMeta?.eventTiming) {
    return abilityEventTimingLabels[abilityMeta.eventTiming] || "";
  }

  if (abilityMeta?.phaseTiming) {
    return abilityPhaseTimingLabels[abilityMeta.phaseTiming] || "";
  }

  return "";
}

export function getAbilityMetaSummary(abilityData) {
  const meta = abilityData?.abilityMeta || {};
  return [
    abilityPageTypeLabels[meta.pageType] || "",
    getAbilityTimingText(meta),
    abilityUsagePatternLabels[meta.usagePattern] || "",
    abilityActivationModeLabels[meta.activationMode] || "",
  ]
    .filter(Boolean)
    .join(" / ");
}

export function getChoiceLabel(value) {
  const normalized = normalizeRoleName(value);
  if (abilityValueLabels[normalized]) {
    return abilityValueLabels[normalized];
  }

  if (typeLabels[normalized]) {
    return typeLabels[normalized];
  }

  return String(value || "");
}

export function getCompactFieldValue(field, value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const normalized = normalizeRoleName(text);

  if (field.type === "role") {
    return getClaimAbbreviation(text);
  }

  if (field.type === "seat" || field.type === "player" || field.type === "number") {
    return text;
  }

  if (field.type === "team" || field.type === "boolean" || field.type === "status") {
    return getChoiceLabel(normalized);
  }

  if (field.type === "character_type") {
    return typeLabels[normalized] || text;
  }

  if (field.type === "choice") {
    return getChoiceLabel(normalized);
  }

  return text.replace(/\s+/g, "").slice(0, 8);
}

export function formatRoleInfoEntrySummary(entry, fields) {
  if (!fields.length || !isRoleInfoEntryFilled(entry)) {
    return "";
  }

  return fields
    .map((field) => getCompactFieldValue(field, entry?.[field.key]))
    .filter(Boolean)
    .join(",");
}

export function getRoleInfoSummary(player, game = getActiveGame()) {
  const abilityData = getRoleAbilityData(player, game);
  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const targetEntries = getRoleInfoEntries(roleInfo, "target");
  const resultEntries = getRoleInfoEntries(roleInfo, "result");
  const rowCount = Math.max(targetEntries.length, resultEntries.length);

  if (!abilityData?.abilityMeta?.recordable || !rowCount) {
    return "--";
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const targetText = formatRoleInfoEntrySummary(targetEntries[index], targetNode.fields);
    const resultText = formatRoleInfoEntrySummary(resultEntries[index], resultNode.fields);
    if (!targetText && !resultText) {
      continue;
    }

    rows.push([targetText, resultText].filter(Boolean).join(">"));
  }

  return rows.length ? rows.join("/") : "--";
}

export function getRoleInfoSectionLabel(sectionKey, abilityData) {
  const pageType = abilityData?.abilityMeta?.pageType;
  if (sectionKey === "target") {
    if (pageType === "event_triggered") {
      return "触发对象";
    }

    return "目标";
  }

  if (pageType === "record_result_only") {
    return "结果";
  }

  if (pageType === "event_triggered") {
    return "触发结果";
  }

  return "记录";
}
