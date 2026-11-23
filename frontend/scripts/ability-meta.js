// Chinese labels for role abilityData.abilityMeta, shared by the encyclopedia and the game notes.
// Pure module (no DOM / global state).

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

export function getAbilityTimingText(abilityMeta) {
  if (abilityMeta?.eventTiming) {
    return abilityEventTimingLabels[abilityMeta.eventTiming] || "";
  }

  if (abilityMeta?.phaseTiming) {
    return abilityPhaseTimingLabels[abilityMeta.phaseTiming] || "";
  }

  return "";
}

export const ABILITY_AUTO_HINT = "自动识别，可能有误";

/**
 * Structured ability tags for display.
 * Returns { tags: [{ kind, label }], reviewed, hint } where kind is
 * "timing" | "usage" | "activation" | "tag". `hint` is non-empty when the classification has not been
 * reviewed by a person (abilitySemantics.reviewStatus !== "reviewed").
 */
export function getAbilityMetaTags(abilityData) {
  const meta = abilityData?.abilityMeta || {};
  const tags = [];
  const seen = new Set();
  const push = (kind, label) => {
    const text = String(label || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    tags.push({ kind, label: text });
  };

  push("timing", getAbilityTimingText(meta));
  push("usage", abilityUsagePatternLabels[meta.usagePattern]);
  push("activation", abilityActivationModeLabels[meta.activationMode]);
  (Array.isArray(abilityData?.tags) ? abilityData.tags : []).forEach((tag) => push("tag", tag));

  const reviewed = abilityData?.abilitySemantics?.reviewStatus === "reviewed";
  return { tags, reviewed, hint: tags.length && !reviewed ? ABILITY_AUTO_HINT : "" };
}
