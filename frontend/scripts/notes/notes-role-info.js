import { getClaimRoleOptions, isCustomRoleGame, isFabledRole, isTravellerRole } from "../notes-claims.js";
import { clampNumber, cloneRoleInfo, createEmptyRoleInfo, createEmptyRoleInfoEntries, getActiveGame } from "../notes-state.js";
import { state, typeLabels } from "../state.js";
import { getClaimAbbreviation } from "./notes-core.js";
import { abilityPageTypeLabels, abilityUsagePatternLabels, getAbilityTimingText } from "../ability-meta.js";
import {
  flattenRoleInfoRecords,
  formatRoleInfoPhaseLabel,
  formatRoleInfoPhaseShortLabel,
  isPhased,
  isPhasedRoleInfo,
  isRoleInfoEntryFilled,
  migrateRoleInfoRowsToRecords,
} from "./notes-role-info-records.js";
import { acquiredPhaseIndex, findAcquiredRole, getCurrentAcquiredAbilities, getAcquiredAbilitySummary, isAcquiredAbilityActive } from "./notes-acquired-abilities.js";

// Role ability metadata and summaries. Field/panel renderers live next to this file.

export { abilityPageTypeLabels, abilityUsagePatternLabels, getAbilityTimingText };

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
  equal: "相同",
  balanced: "均势",
  live: "生",
  die: "死",
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

/**
 * An "or you learn there is none" switch (调查员 无爪牙): a boolean that, when on, replaces the other fields of
 * its row. Set by `exclusive: true`; a boolean whose key starts with no_ counts as one unless exclusive: false.
 */
export function isExclusiveField(field) {
  if (field?.type !== "boolean") {
    return false;
  }
  return field.exclusive === undefined || field.exclusive === null ? /^no_/.test(String(field.key || "")) : field.exclusive === true;
}

export function isExclusiveValueOn(value) {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

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

  if (isExclusiveField(field)) {
    return isExclusiveValueOn(text) ? String(field.label || "") : "";
  }

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

/**
 * Join the compact target/result texts of one row.
 * Without labels: "3,5→是" (summaries). With labels: "目标 3,5 / 结果 是" (timeline, storyteller list).
 */
export function formatRoleInfoPairText(targetText, resultText, labels = null) {
  if (labels) {
    return [
      targetText ? `${labels.target} ${targetText}` : "",
      resultText ? `${labels.result} ${resultText}` : "",
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return targetText && resultText ? `${targetText}→${resultText}` : targetText || resultText || "";
}

/** Compact texts of one row ({ target, result } entries) for the given ability. */
export function formatRoleInfoRowTexts(target, result, abilityData) {
  return {
    targetText: formatRoleInfoEntrySummary(target, getRoleInfoNode(abilityData, "target").fields),
    resultText: formatRoleInfoEntrySummary(result, getRoleInfoNode(abilityData, "result").fields),
  };
}

/** Every filled row of a { targetEntries, resultEntries } pair as one text each. */
export function formatRoleInfoEntriesTexts(roleInfo, abilityData, labels = null) {
  const targets = roleInfo?.targetEntries || [];
  const results = roleInfo?.resultEntries || [];
  const texts = [];
  for (let index = 0; index < Math.max(targets.length, results.length); index += 1) {
    const { targetText, resultText } = formatRoleInfoRowTexts(targets[index], results[index], abilityData);
    const text = formatRoleInfoPairText(targetText, resultText, labels);
    if (text) texts.push(text);
  }
  return texts;
}

export const ROLE_INFO_SUMMARY_LIMIT = 3;

function getSummaryPhase(phaseType, phaseNumber, abilityData) {
  if (isPhased(phaseType)) {
    return {
      phase: formatRoleInfoPhaseShortLabel(phaseType, phaseNumber),
      phaseTitle: formatRoleInfoPhaseLabel(phaseType, phaseNumber),
    };
  }

  const eventText = abilityData?.abilityMeta?.eventTiming ? getAbilityTimingText(abilityData.abilityMeta) : "";
  return { phase: eventText || "?", phaseTitle: eventText || "阶段未知" };
}

function getMainSummaryItems(player, game) {
  const abilityData = getRoleAbilityData(player, game);
  if (!abilityData?.abilityMeta?.recordable) {
    return [];
  }

  return getRoleInfoRows(ensureRoleInfoMatchesClaim(player, game))
    .map((row) => {
      const { targetText, resultText } = formatRoleInfoRowTexts(row.target, row.result, abilityData);
      return {
        source: "main",
        phaseType: row.phaseType,
        phaseNumber: row.phaseNumber,
        ...getSummaryPhase(row.phaseType, row.phaseNumber, abilityData),
        text: formatRoleInfoPairText(targetText, resultText),
      };
    })
    .filter((item) => item.text);
}

// Latest filled record (up to the current phase) of each active acquired ability.
function getAcquiredSummaryItems(player, game) {
  if (!game) return [];
  const phase = acquiredPhaseIndex(game.phaseType, game.phaseNumber);
  return getCurrentAcquiredAbilities(player, game)
    .filter((ability) => isAcquiredAbilityActive(ability, game))
    .map((ability) => {
      const role = findAcquiredRole(ability.role);
      if (!role) return null;
      const records = [...ability.records]
        .filter((record) => acquiredPhaseIndex(record.phaseType, record.phaseNumber) <= phase)
        .sort((a, b) => acquiredPhaseIndex(b.phaseType, b.phaseNumber) - acquiredPhaseIndex(a.phaseType, a.phaseNumber));
      for (const record of records) {
        const text = formatRoleInfoEntriesTexts(record.roleInfo, role.abilityData).join(" / ");
        if (text) {
          return {
            source: "acquired",
            roleName: role.name,
            phaseType: record.phaseType,
            phaseNumber: Number(record.phaseNumber),
            ...getSummaryPhase(record.phaseType, record.phaseNumber, role.abilityData),
            text,
          };
        }
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Structured role ability summary for rendering as tags.
 * Returns { items, total, hiddenCount, acquiredItems, acquiredLabel }:
 * - items: the latest `limit` main-ability rows, oldest first ({ phase: "N1", phaseTitle: "第 1 夜", text: "3,5→是" }).
 * - total / hiddenCount: number of filled main rows and how many were left out.
 * - acquiredItems: latest record of each active acquired ability ({ roleName, phase, phaseTitle, text }).
 * - acquiredLabel: "能力：xx" label of the current acquired abilities (see getAcquiredAbilitySummary).
 */
export function getRoleInfoSummaryData(player, game = getActiveGame(), { limit = ROLE_INFO_SUMMARY_LIMIT } = {}) {
  const all = getMainSummaryItems(player, game);
  const visible = limit > 0 && all.length > limit ? all.slice(-limit) : all;
  return {
    items: visible,
    total: all.length,
    hiddenCount: all.length - visible.length,
    acquiredItems: getAcquiredSummaryItems(player, game),
    acquiredLabel: game ? getAcquiredAbilitySummary(player, game) : "",
  };
}

/** "N1 3,5→是", or "守鸦人 N3 4" for an acquired ability. */
export function formatRoleInfoSummaryItem(item) {
  const prefix = [item.roleName, item.phase].filter(Boolean).join(" ");
  return prefix ? `${prefix} ${item.text}` : item.text;
}

/**
 * Plain-text summary, e.g. "N2 3,5→是，N3 2,4→否（共 4 条） · 能力：守鸦人 · 守鸦人 N3 4".
 * Records are joined with "，" so the text can sit inside "；"-separated lines. Pass { limit: 0 } for every record.
 */
export function getRoleInfoSummary(player, game = getActiveGame(), options = {}) {
  const data = getRoleInfoSummaryData(player, game, options);
  const main = data.items.map(formatRoleInfoSummaryItem).join("，");
  return (
    [
      main && data.hiddenCount ? `${main}（共 ${data.total} 条）` : main,
      data.acquiredLabel,
      ...data.acquiredItems.map(formatRoleInfoSummaryItem),
    ]
      .filter(Boolean)
      .join(" · ") || "--"
  );
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
