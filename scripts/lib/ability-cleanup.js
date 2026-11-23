// Conservative clean-up rules for generated (unreviewed) role abilityData. Each rule only fires when the
// ability text makes the answer unambiguous; anything else is left for hand review.
//
//  - emptyRecordable: recordable but neither target nor result has a field -> not recordable (the notes page
//    can only say "写在额外信息里" anyway).
//  - firstNightOnly: the text only speaks of the first night -> first_night / once, sections "once".
//  - nightStar: the text only speaks of 每个夜晚* -> each_night_star (no empty row on night 1).
//  - genericLabels: generator labels (目标号码, 号码1, 身份...) -> labels that say what the field holds.
//  - roleTypes: a role field without a type filter whose text names exactly one character type.

const TIMING_WORDS = /每个夜晚|每个白天|每局游戏|白天|黄昏|黎明|当你|每当|如果|首次|第[二三四五六七八九十\d]+个?夜晚|直到/;

function getFields(abilityData, section) {
  const fields = abilityData?.interactionSchema?.[section]?.fields;
  return Array.isArray(fields) ? fields : [];
}

function isSeat(field) {
  return field?.type === "seat" || field?.type === "player";
}

function stripBracket(text) {
  return String(text || "").replace(/\[[^\]]*\]/g, "").trim();
}

function ruleEmptyRecordable(role) {
  const meta = role.abilityData?.abilityMeta;
  if (!meta?.recordable) return null;
  if (getFields(role.abilityData, "target").length || getFields(role.abilityData, "result").length) return null;
  return {
    apply(abilityData) {
      abilityData.abilityMeta.recordable = false;
      if (["event_triggered", "pick_and_record", "record_result_only"].includes(abilityData.abilityMeta.pageType)) {
        abilityData.abilityMeta.pageType = "rule_modifier";
      }
    },
    detail: "recordable -> false",
  };
}

function ruleFirstNightOnly(role) {
  const meta = role.abilityData?.abilityMeta;
  const text = stripBracket(role.ability);
  if (!meta?.recordable || !/^(?:在)?(?:你的)?首个夜晚/.test(text)) return null;
  const rest = text.replace(/^(?:在)?(?:你的)?首个夜晚/, "");
  // Any other time reference (当晚, 前三个夜晚, 当…死亡时, 1~4天后) means a second use: leave it for hand review.
  if (TIMING_WORDS.test(rest) || /夜|晚|天|当|每|首次/.test(rest)) return null;
  if (meta.phaseTiming === "first_night" && meta.usagePattern === "once") return null;
  if (meta.eventTiming) return null;
  return {
    apply(abilityData) {
      abilityData.abilityMeta.phaseTiming = "first_night";
      abilityData.abilityMeta.usagePattern = "once";
      ["target", "result"].forEach((section) => {
        const node = abilityData.interactionSchema?.[section];
        if (node && node.repeatMode !== "none" && node.fields?.length) {
          node.repeatMode = "once";
          node.defaultRows = 1;
        }
      });
    },
    detail: `${meta.phaseTiming}/${meta.usagePattern} -> first_night/once`,
  };
}

function ruleNightStar(role) {
  const meta = role.abilityData?.abilityMeta;
  const text = stripBracket(role.ability);
  if (!meta?.recordable || meta.eventTiming || !/^每个夜晚[*＊]/.test(text)) return null;
  const rest = text.replace(/^每个夜晚[*＊]/, "");
  if (TIMING_WORDS.test(rest) || /首个夜晚|夜晚时/.test(rest)) return null;
  if (meta.phaseTiming === "each_night_star") return null;
  return {
    apply(abilityData) {
      abilityData.abilityMeta.phaseTiming = "each_night_star";
      if (!["once_per_night"].includes(abilityData.abilityMeta.usagePattern)) {
        abilityData.abilityMeta.usagePattern = "once_per_night";
      }
    },
    detail: `${meta.phaseTiming} -> each_night_star`,
  };
}

/** Label for a single target seat, from what the ability does to the chosen player. */
function describeTargetSeat(text) {
  if (/猜测/.test(text)) return "猜测对象";
  if (/交换/.test(text)) return "选择对象";
  if (/你会得知|得知他|得知其/.test(text)) return "查验对象";
  if (/中毒/.test(text) && !/他死亡/.test(text)) return "下毒对象";
  if (/他死亡|他们死亡|杀死/.test(text)) return "攻击对象";
  if (/不会死亡|无效|保护/.test(text)) return "保护对象";
  if (/醉酒/.test(text)) return "醉酒对象";
  return "选择对象";
}

function ruleGenericLabels(role) {
  const ad = role.abilityData;
  const text = stripBracket(role.ability);
  const renames = [];
  const targetSeats = getFields(ad, "target").filter(isSeat);
  const resultSeats = getFields(ad, "result").filter(isSeat);
  const learns = /你会得知|得知/.test(text);

  getFields(ad, "target").forEach((field) => {
    if (isSeat(field) && /^目标号码$|^号码$/.test(field.label) && targetSeats.length === 1) {
      renames.push([field, describeTargetSeat(text)]);
    } else if (isSeat(field) && /^(?:目标号码|号码)(\d)$/.test(field.label)) {
      const index = field.label.match(/(\d)$/)[1];
      renames.push([field, `${learns ? "查验" : "选择"}${index}`]);
    } else if (field.type === "role" && field.label === "身份") {
      renames.push([field, "选择角色"]);
    }
  });
  getFields(ad, "result").forEach((field) => {
    if (isSeat(field) && /^(?:目标号码|号码)$/.test(field.label) && resultSeats.length === 1) {
      renames.push([field, "得知玩家"]);
    } else if (isSeat(field) && /^(?:目标号码|号码)(\d)$/.test(field.label)) {
      renames.push([field, `候选${field.label.match(/(\d)$/)[1]}`]);
    } else if (field.type === "role" && (field.label === "身份" || field.label === "目标身份")) {
      renames.push([field, "得知角色"]);
    }
  });

  if (!renames.length) return null;
  return {
    apply(abilityData) {
      renames.forEach(([field, label]) => {
        const section = getFields(abilityData, "target").includes(field) ? "target" : "result";
        const own = getFields(abilityData, section).find((item) => item.key === field.key);
        if (own) own.label = label;
      });
    },
    detail: renames.map(([field, label]) => `${field.label}->${label}`).join(", "),
  };
}

const TYPE_WORDS = [
  ["townsfolk", /镇民角色/],
  ["outsider", /外来者角色/],
  ["minion", /爪牙角色/],
  ["demon", /恶魔角色/],
];

function ruleRoleTypes(role) {
  const ad = role.abilityData;
  const text = stripBracket(role.ability);
  const named = TYPE_WORDS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type);
  if (named.length !== 1) return null;
  const targets = ["target", "result"].flatMap((section) =>
    getFields(ad, section)
      .filter((field) => field.type === "role" && (field.roleTypes === undefined || field.roleTypes === null))
      .filter((field) => !/townsfolk|outsider|minion|demon|good|evil/.test(String(field.key || "")) && !/镇民|外来者|爪牙|恶魔|善良|邪恶|好|坏/.test(String(field.label || "")))
      .map((field) => [section, field.key]),
  );
  if (targets.length !== 1) return null;
  const [section, key] = targets[0];
  return {
    apply(abilityData) {
      const field = getFields(abilityData, section).find((item) => item.key === key);
      if (field) field.roleTypes = [named[0]];
    },
    detail: `${section}.${key} roleTypes [${named[0]}]`,
  };
}

const RULES = {
  emptyRecordable: ruleEmptyRecordable,
  firstNightOnly: ruleFirstNightOnly,
  nightStar: ruleNightStar,
  genericLabels: ruleGenericLabels,
  roleTypes: ruleRoleTypes,
};

/** [{ rule, detail, apply }] for one role (apply mutates an abilityData). */
function planCleanup(role) {
  return Object.entries(RULES)
    .map(([rule, check]) => {
      const result = role?.abilityData ? check(role) : null;
      return result ? { rule, ...result } : null;
    })
    .filter(Boolean);
}

module.exports = { RULES, describeTargetSeat, planCleanup };
