import { getClaimRoleOptions, isCustomRoleGame, isFabledRole, isTravellerRole } from "../notes-claims.js";
import { clampNumber, cloneRoleInfo, createEmptyRoleInfo, createEmptyRoleInfoEntries, getActiveGame } from "../notes-state.js";
import { state, typeLabels } from "../state.js";
import { getClaimAbbreviation } from "./notes-core.js";
import { flattenRoleInfoRecords, isPhasedRoleInfo, isRoleInfoEntryFilled, migrateRoleInfoRowsToRecords } from "./notes-role-info-records.js";
import { acquiredPhaseIndex, acquiredPhaseLabel, findAcquiredRole, getCurrentAcquiredAbilities, getAcquiredAbilitySummary, isAcquiredAbilityActive } from "./notes-acquired-abilities.js";

// Role ability metadata and summaries. Field/panel renderers live next to this file.

export const abilityPageTypeLabels = {
  no_input: "无录入",
  record_result_only: "只记结果",
  pick_and_record: "选择并记录",
  event_triggered: "事件触发",
  rule_modifier: "规则型",
};

const abilityPhaseTimingLabels = {
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

const abilityEventTimingLabels = {
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

const abilityActivationModeLabels = {
  active: "主动",
  passive: "被动",
  conditional: "条件触发",
  reactive: "响应触发",
};

const abilityValueLabels = {
  yes: "是",
  no: "否",
  good: "好",
  evil: "坏",
  sober: "清",
  poisoned: "毒",
  drunk: "醉",
  self: "自己",
  target: "目标",
  // Directions are relative to a seated player facing the center of the table.
  clockwise: "左",
  counterclockwise: "右",
  顺时针: "左",
  逆时针: "右",
  storyteller_choice: "说书人选择",
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

  return (
    roleOptions.find(matchRole) ||
    (game && isCustomRoleGame(game)
      ? null
      : state.roles.find(
          (role) => !isFabledRole(role) && !isTravellerRole(role) && matchRole(role),
        )) ||
    null
  );
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

export { isRoleInfoEntryFilled };

function normalizeLegacyBooleanValue(value) {
  const normalized = normalizeRoleName(value);
  if (["yes", "true", "1", "是"].includes(normalized)) {
    return "yes";
  }

  if (["no", "false", "0", "否"].includes(normalized)) {
    return "no";
  }

  return String(value || "").trim();
}

function migrateLegacyRoleInfo(roleInfo, role, abilityData) {
  const legacyEntries = Array.isArray(roleInfo?.entries) ? roleInfo.entries : [];
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const nextRoleInfo = createEmptyRoleInfoEntries(role?.id || "");

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

function toPhasedRoleInfo(roleId, rows, abilityData) {
  return {
    version: 3,
    roleId,
    records: migrateRoleInfoRowsToRecords(rows.targetEntries, rows.resultEntries, abilityData?.abilityMeta),
  };
}

/**
 * Returns the player's main ability record in v3 format (phase-tagged records) for the role
 * currently claimed (or the true role when the caller passes the storyteller subject).
 * v2 rows and the legacy profile format are migrated here, because the mapping needs the role timing.
 */
export function ensureRoleInfoMatchesClaim(player, game = getActiveGame()) {
  const role = getClaimedRole(player, game);
  const abilityData = role?.abilityData || null;
  const current = cloneRoleInfo(player?.roleInfo);

  if (!role || !abilityData?.abilityMeta?.recordable) {
    return createEmptyRoleInfo(role?.id || "");
  }

  if (current.roleId && current.roleId !== role.id) {
    return createEmptyRoleInfo(role.id);
  }

  if (isPhasedRoleInfo(current)) {
    return { version: 3, roleId: role.id, records: current.records };
  }

  if (current.version === 2 && !current.profile && !current.entries.length) {
    return toPhasedRoleInfo(role.id, current, abilityData);
  }

  return toPhasedRoleInfo(role.id, migrateLegacyRoleInfo(current, role, abilityData), abilityData);
}

/** Filled rows of a v3 roleInfo in phase order (see flattenRoleInfoRecords). */
export function getRoleInfoRows(roleInfo) {
  return flattenRoleInfoRecords(roleInfo?.records);
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

function getCompactFieldValue(field, value) {
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
  const acquiredSummary = game ? getAcquiredInfoSummary(player, game) : "";
  const abilityData = getRoleAbilityData(player, game);
  if (!abilityData?.abilityMeta?.recordable) {
    return acquiredSummary || "--";
  }

  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const rows = getRoleInfoRows(roleInfo)
    .map((row) => {
      const targetText = formatRoleInfoEntrySummary(row.target, targetNode.fields);
      const resultText = formatRoleInfoEntrySummary(row.result, resultNode.fields);
      return [targetText, resultText].filter(Boolean).join(">");
    })
    .filter(Boolean);

  return [rows.join("/"), acquiredSummary].filter(Boolean).join(" · ") || "--";
}

function getAcquiredInfoSummary(player, game) {
  const summary = getAcquiredAbilitySummary(player, game);
  if (!summary) return "";
  const phase = acquiredPhaseIndex(game.phaseType, game.phaseNumber);
  const details = getCurrentAcquiredAbilities(player, game).filter((ability) => isAcquiredAbilityActive(ability, game)).map((ability) => {
    const role = findAcquiredRole(ability.role);
    if (!role) return "";
    const records = [...ability.records].filter((record) => acquiredPhaseIndex(record.phaseType, record.phaseNumber) <= phase)
      .sort((a, b) => acquiredPhaseIndex(b.phaseType, b.phaseNumber) - acquiredPhaseIndex(a.phaseType, a.phaseNumber));
    for (const record of records) {
      const text = ["target", "result"].map((section) => (record.roleInfo[`${section}Entries`] || [])
        .map((entry) => formatRoleInfoEntrySummary(entry, getRoleInfoNode(role.abilityData, section).fields)).filter(Boolean).join("/"))
        .filter(Boolean).join(">");
      if (text) return `${role.name} ${acquiredPhaseLabel(record.phaseType, record.phaseNumber)}：${text}`;
    }
    return "";
  }).filter(Boolean);
  return [summary, ...details].join(" · ");
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
