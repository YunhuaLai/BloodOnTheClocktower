export const templateLabels = {
  adjacent_evil_pair_count: "相邻邪恶对数",
  evil_count_group: "目标组邪恶数量",
  clockwise_evil_count: "顺时针区间邪恶数量",
  good_player: "确认善良玩家",
  role_in_group: "目标组含身份",
  role_at_seat: "目标身份",
  not_role_type_group: "目标组排除身份类型",
  demon_in_group: "目标组含恶魔",
  not_demon_group: "目标组排除恶魔",
  team_relation: "阵营关系",
  either_role: "二选一身份",
  evil_dead_count: "死亡邪恶数量",
  demon_minion_distance: "恶魔爪牙距离",
  role_guess: "身份猜测",
  role_guess_count: "身份猜中数量",
  nearest_evil_direction: "最近邪恶方向",
};

export const worldEffectLabels = {
  poison_drunk: "醉酒/中毒/失能效果",
  death_protection: "死亡/保护/复活效果",
  alignment_role_change: "阵营或身份变化",
  setup_rule_modifier: "开局或规则修饰",
  action_history: "投票/提名等行动历史",
  natural_language: "自然语言命题",
  awake_malfunction: "唤醒/异常信息",
};

const targetSeat = {
  source: "target",
  keys: ["seat", "player", "target", "target_seat"],
};

const resultSeat = {
  source: "result",
  keys: ["seat", "player", "target", "target_seat"],
};

const resultCount = {
  source: "result",
  keys: ["count", "evilCount", "number", "value"],
};

const resultRole = {
  source: "result",
  keys: ["role", "character", "claim"],
};

const roleDeductionProfiles = {
  r001: {
    templates: [
      {
        type: "role_in_group",
        seats: { source: "result", keys: ["seat1", "seat2"] },
        role: resultRole,
      },
    ],
  },
  r002: {
    templates: [
      {
        type: "role_in_group",
        seats: { source: "result", keys: ["seat1", "seat2"] },
        role: resultRole,
      },
    ],
  },
  r003: {
    templates: [
      {
        type: "role_in_group",
        seats: { source: "result", keys: ["seat1", "seat2"] },
        role: resultRole,
      },
    ],
  },
  r004: {
    templates: [{ type: "adjacent_evil_pair_count", value: resultCount }],
  },
  r005: {
    templates: [
      {
        type: "evil_count_group",
        group: "source_alive_neighbors",
        value: resultCount,
      },
    ],
  },
  r006: {
    templates: [
      {
        type: "demon_in_group",
        seats: { source: "target", keys: ["seat1", "seat2"] },
        value: { source: "result", keys: ["has_demon", "answer", "value"] },
      },
    ],
  },
  r009: {
    templates: [
      {
        type: "role_at_seat",
        seat: targetSeat,
        role: resultRole,
      },
    ],
  },
  r022: {
    templates: [
      {
        type: "demon_in_group",
        seats: { source: "target", keys: ["seat"] },
        value: { source: "result", keys: ["hit_demon", "answer", "value"] },
      },
    ],
  },
  r023: {
    templates: [
      {
        type: "good_player",
        seat: resultSeat,
        role: resultRole,
      },
    ],
  },
  r026: {
    templates: [
      {
        type: "demon_in_group",
        seats: { source: "target", keys: ["seat"] },
        value: { source: "result", keys: ["hit_demon", "answer", "value"] },
      },
    ],
  },
  r028: {
    templates: [
      {
        type: "role_guess",
        seat: targetSeat,
        role: { source: "target", keys: ["role", "character", "claim"] },
        value: { source: "result", keys: ["correct", "answer", "value"] },
      },
    ],
  },
  r048: {
    templates: [
      {
        type: "demon_minion_distance",
        value: { source: "result", keys: ["distance", "count", "number", "value"] },
      },
    ],
  },
  r049: {
    templates: [
      {
        type: "evil_count_group",
        seats: { source: "result", keys: ["seat1", "seat2", "seat3"] },
        fixedValue: 1,
      },
    ],
  },
  r051: {
    templates: [
      {
        type: "either_role",
        seat: targetSeat,
        goodRole: { source: "result", keys: ["good_role", "goodRole", "good"] },
        evilRole: { source: "result", keys: ["evil_role", "evilRole", "evil"] },
      },
    ],
  },
  r056: {
    templates: [{ type: "evil_dead_count", value: resultCount }],
  },
  r058: {
    templates: [
      {
        type: "team_relation",
        seats: { source: "target", keys: ["seat1", "seat2"] },
        value: { source: "result", keys: ["same_team", "answer", "value"] },
      },
    ],
  },
  r062: {
    templates: [
      {
        type: "role_guess_count",
        rowMode: "all_targets",
        guesses: {
          seat: targetSeat,
          role: { source: "target", keys: ["role", "character", "claim"] },
        },
        value: { source: "result", keys: ["correct_count", "count", "number", "value"] },
      },
    ],
  },
  r063: {
    templates: [
      {
        type: "demon_in_group",
        seats: { source: "result", keys: ["seat1", "seat2"] },
        fixedValue: true,
      },
    ],
  },
  r084: {
    templates: [
      {
        type: "good_player",
        seat: resultSeat,
      },
    ],
  },
  r085: {
    templates: [
      {
        type: "not_demon_group",
        seats: { source: "result", keys: ["seat1", "seat2"] },
      },
    ],
  },
  r100: {
    templates: [
      {
        type: "nearest_evil_direction",
        value: { source: "result", keys: ["direction", "answer", "value"] },
      },
    ],
  },
  r197: {
    templates: [
      {
        type: "clockwise_evil_count",
        group: "clockwise_between_source_and_target",
        seat: targetSeat,
        value: resultCount,
        targetMustBeGood: true,
      },
    ],
  },
  r367: {
    templates: [
      {
        type: "evil_count_group",
        group: "target_alive_neighbors",
        seat: targetSeat,
        value: resultCount,
      },
    ],
  },
  r445: {
    templates: [
      {
        type: "evil_count_group",
        group: "target_alive_neighbors",
        seat: targetSeat,
        value: resultCount,
      },
    ],
  },
  r198: {
    templates: [
      {
        type: "not_role_type_group",
        seats: { source: "target", keys: ["seat1", "seat2", "first", "second"] },
        role: resultRole,
      },
    ],
  },
};

const worldEffectProfiles = {
  r007: { type: "natural_language", note: "送葬者还缺少结构化处决座位，暂不自动校验。" },
  r017: { type: "poison_drunk" },
  r024: { type: "poison_drunk" },
  r025: { type: "awake_malfunction", note: "侍女需要夜晚唤醒/行动模型。" },
  r030: { type: "poison_drunk" },
  r053: { type: "awake_malfunction", note: "数学家需要异常来源模型。" },
  r054: { type: "action_history", note: "卖花女孩需要结构化投票历史。" },
  r055: { type: "action_history", note: "城镇公告员需要结构化提名历史。" },
  r060: { type: "natural_language" },
  r078: { type: "poison_drunk" },
};

function getFields(role, section) {
  return role?.abilityData?.interactionSchema?.[section]?.fields || [];
}

function hasField(role, section, key, type = "") {
  return getFields(role, section).some(
    (field) => field.key === key && (!type || field.type === type),
  );
}

function hasAnyField(role, type) {
  return ["target", "result"].some((section) =>
    getFields(role, section).some((field) => field.type === type),
  );
}

function hasTag(role, tag) {
  const tags = [...(role?.tags || []), ...(role?.abilityData?.tags || [])];
  return tags.includes(tag);
}

function inferTemplateCandidate(role) {
  if (!role?.abilityData?.abilityMeta?.recordable) {
    return null;
  }

  if (hasField(role, "target", "seat", "seat") && hasField(role, "result", "role", "role")) {
    return {
      status: "candidate",
      label: "可模板化：目标身份信息",
      templates: [
        {
          type: "role_at_seat",
          seat: targetSeat,
          role: resultRole,
        },
      ],
    };
  }

  if (hasField(role, "target", "seat", "seat") && hasField(role, "result", "hit_demon", "boolean")) {
    return {
      status: "candidate",
      label: "可模板化：目标是否恶魔",
      templates: [
        {
          type: "demon_in_group",
          seats: { source: "target", keys: ["seat"] },
          value: { source: "result", keys: ["hit_demon", "answer", "value"] },
        },
      ],
    };
  }

  if (
    hasField(role, "target", "seat1", "seat") &&
    hasField(role, "target", "seat2", "seat") &&
    hasField(role, "result", "same_team", "boolean")
  ) {
    return {
      status: "candidate",
      label: "可模板化：两目标阵营关系",
      templates: [
        {
          type: "team_relation",
          seats: { source: "target", keys: ["seat1", "seat2"] },
          value: { source: "result", keys: ["same_team", "answer", "value"] },
        },
      ],
    };
  }

  if (hasAnyField(role, "team")) {
    return { status: "candidate", label: "可模板化：阵营信息" };
  }

  if (hasAnyField(role, "role")) {
    return { status: "candidate", label: "可模板化：身份信息" };
  }

  if (hasAnyField(role, "number") && hasTag(role, "信息型")) {
    return { status: "candidate", label: "可模板化：数字信息" };
  }

  return null;
}

export function getRoleDeductionProfile(role) {
  const profile = roleDeductionProfiles[role?.id];
  if (profile) {
    return {
      status: "supported",
      label: "已接入自动推理",
      ...profile,
    };
  }

  return inferTemplateCandidate(role);
}

export function getRoleDeductionReview(role) {
  const profile = getRoleDeductionProfile(role);
  if (profile?.status === "supported") {
    return {
      status: "supported",
      label: "已接入自动推理",
      templateTypes: profile.templates.map((template) => template.type),
    };
  }

  if (profile?.status === "candidate") {
    return {
      status: "candidate",
      label: profile.label,
      templateTypes: profile.templates?.map((template) => template.type) || [],
    };
  }

  const effect = worldEffectProfiles[role?.id];
  if (effect) {
    return {
      status: "world_effect",
      label: effect.note || worldEffectLabels[effect.type] || "世界效果",
      effectType: effect.type,
    };
  }

  if (hasTag(role, "信息型")) {
    return {
      status: "manual",
      label: "信息型角色，但需要人工语义归类",
    };
  }

  if (role?.abilityData?.abilityMeta?.recordable) {
    return {
      status: "record_only",
      label: "可记录行动/效果，暂不作为信息校验",
    };
  }

  return {
    status: "none",
    label: "无需记录或暂不参与推理",
  };
}
