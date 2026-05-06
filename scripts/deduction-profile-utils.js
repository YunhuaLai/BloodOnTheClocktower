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

const explicitSupportedProfiles = {
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
  r198: {
    templates: [
      {
        type: "not_role_type_group",
        seats: { source: "target", keys: ["seat1", "seat2", "first", "second"] },
        role: resultRole,
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
};

const explicitWorldEffects = {
  r007: { effectType: "natural_language", note: "送葬者还缺少结构化处决座位，暂不自动校验。" },
  r017: { effectType: "poison_drunk" },
  r024: { effectType: "poison_drunk" },
  r025: { effectType: "awake_malfunction", note: "侍女需要夜晚唤醒/行动模型。" },
  r030: { effectType: "poison_drunk" },
  r053: { effectType: "awake_malfunction", note: "数学家需要异常来源模型。" },
  r054: { effectType: "action_history", note: "卖花女孩需要结构化投票历史。" },
  r055: { effectType: "action_history", note: "城镇公告员需要结构化提名历史。" },
  r060: { effectType: "natural_language" },
  r078: { effectType: "poison_drunk" },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFields(abilityData, section) {
  return abilityData?.interactionSchema?.[section]?.fields || [];
}

function allFields(abilityData) {
  return [...getFields(abilityData, "target"), ...getFields(abilityData, "result")];
}

function hasField(abilityData, section, key, type = "") {
  return getFields(abilityData, section).some(
    (field) => field.key === key && (!type || field.type === type),
  );
}

function hasAnyField(abilityData, type) {
  return allFields(abilityData).some((field) => field.type === type);
}

function hasTag(abilityData, tag) {
  return Array.isArray(abilityData?.tags) && abilityData.tags.includes(tag);
}

function textMatches(roleData, abilityData, pattern) {
  return pattern.test(
    [
      roleData?.name,
      roleData?.ability,
      roleData?.summary,
      ...(roleData?.reminders || []),
      ...(abilityData?.tags || []),
      ...allFields(abilityData).map((field) => field.label),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function supported(profile, source = "manual") {
  return {
    status: "supported",
    source,
    templates: clone(profile.templates),
  };
}

function worldEffect(profile, source = "manual") {
  return {
    status: "world_effect",
    source,
    effectType: profile.effectType,
    note: profile.note || "",
  };
}

function candidate(label, templates = []) {
  return {
    status: "candidate",
    source: "inferred",
    label,
    templates: clone(templates),
  };
}

function inferBySchema(abilityData, roleData = {}) {
  if (!abilityData?.abilityMeta?.recordable) {
    return null;
  }

  if (hasField(abilityData, "target", "seat", "seat") && hasField(abilityData, "result", "role", "role")) {
    return candidate("可模板化：目标身份信息", [
      {
        type: "role_at_seat",
        seat: targetSeat,
        role: resultRole,
      },
    ]);
  }

  if (hasField(abilityData, "target", "seat", "seat") && hasField(abilityData, "result", "hit_demon", "boolean")) {
    return candidate("可模板化：目标是否恶魔", [
      {
        type: "demon_in_group",
        seats: { source: "target", keys: ["seat"] },
        value: { source: "result", keys: ["hit_demon", "answer", "value"] },
      },
    ]);
  }

  if (
    hasField(abilityData, "target", "seat1", "seat") &&
    hasField(abilityData, "target", "seat2", "seat") &&
    hasField(abilityData, "result", "same_team", "boolean")
  ) {
    return candidate("可模板化：两目标阵营关系", [
      {
        type: "team_relation",
        seats: { source: "target", keys: ["seat1", "seat2"] },
        value: { source: "result", keys: ["same_team", "answer", "value"] },
      },
    ]);
  }

  if (
    hasField(abilityData, "target", "seat1", "seat") &&
    hasField(abilityData, "target", "seat2", "seat") &&
    hasField(abilityData, "result", "answer", "boolean") &&
    textMatches(roleData, abilityData, /同阵营|同一阵营|相同阵营/)
  ) {
    return candidate("可模板化：两目标阵营关系", [
      {
        type: "team_relation",
        seats: { source: "target", keys: ["seat1", "seat2"] },
        value: { source: "result", keys: ["same_team", "answer", "value"] },
      },
    ]);
  }

  if (hasAnyField(abilityData, "team")) {
    return candidate("可模板化：阵营信息");
  }

  if (hasAnyField(abilityData, "role")) {
    return candidate("可模板化：身份信息");
  }

  if (hasAnyField(abilityData, "number") && hasTag(abilityData, "信息型")) {
    return candidate("可模板化：数字信息");
  }

  if (hasTag(abilityData, "信息型")) {
    return {
      status: "manual",
      source: "inferred",
      label: "信息型角色，但需要人工语义归类",
    };
  }

  return null;
}

function inferByText(abilityData, roleData = {}) {
  if (!abilityData?.abilityMeta?.recordable) {
    return null;
  }

  if (textMatches(roleData, abilityData, /中毒|醉酒|失去能力/)) {
    return worldEffect({ effectType: "poison_drunk" }, "inferred");
  }

  if (textMatches(roleData, abilityData, /投票|提名/)) {
    return worldEffect({ effectType: "action_history" }, "inferred");
  }

  if (textMatches(roleData, abilityData, /声明|问题|陈述/)) {
    return worldEffect({ effectType: "natural_language" }, "inferred");
  }

  return null;
}

function inferDeductionData(abilityData, roleData = {}) {
  const explicitProfile = explicitSupportedProfiles[abilityData?.id];
  if (explicitProfile) {
    return supported(explicitProfile);
  }

  const explicitEffect = explicitWorldEffects[abilityData?.id];
  if (explicitEffect) {
    return worldEffect(explicitEffect);
  }

  return inferBySchema(abilityData, roleData) || inferByText(abilityData, roleData);
}

module.exports = {
  explicitSupportedProfiles,
  explicitWorldEffects,
  inferDeductionData,
};
