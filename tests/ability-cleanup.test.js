const test = require("node:test");
const assert = require("node:assert/strict");
const { describeTargetSeat, planCleanup } = require("../scripts/lib/ability-cleanup");

const seat = (key, label) => ({ key, type: "seat", label });
function role(ability, { meta = {}, target = [], result = [] } = {}) {
  return {
    id: "rx",
    name: "测试",
    ability,
    abilityData: {
      abilityMeta: { recordable: true, pageType: "pick_and_record", phaseTiming: "each_night", eventTiming: null, usagePattern: "once_per_night", ...meta },
      interactionSchema: {
        target: { repeatMode: target.length ? "sequence" : "none", defaultRows: target.length ? 3 : 0, fields: target },
        result: { repeatMode: result.length ? "sequence" : "none", defaultRows: result.length ? 3 : 0, fields: result },
      },
    },
  };
}
const rules = (item) => planCleanup(item).map((step) => step.rule);
function applyAll(item) {
  planCleanup(item).forEach((step) => step.apply(item.abilityData));
  return item.abilityData;
}

test("recordable abilities without any field stop being recordable", () => {
  const data = applyAll(role("如果你被处决，你的阵营获胜。", { meta: { pageType: "event_triggered" } }));
  assert.equal(data.abilityMeta.recordable, false);
  assert.equal(data.abilityMeta.pageType, "rule_modifier");
});

test("first-night-only and night-star timing are fixed only when the text has no second clause", () => {
  const first = applyAll(role("在你的首个夜晚，你会得知三名玩家：其中有且只有一名玩家是邪恶的。", { result: [seat("seat1", "号码1")] }));
  assert.equal(first.abilityMeta.phaseTiming, "first_night");
  assert.equal(first.abilityMeta.usagePattern, "once");
  assert.equal(first.interactionSchema.result.repeatMode, "once");
  assert.equal(first.interactionSchema.result.fields[0].label, "候选1");

  assert.deepEqual(rules(role("在你的首个夜晚，你会得知一名邪恶玩家。每当你得知的玩家死亡，你会在当晚得知另一名邪恶玩家。", { result: [seat("seat", "号码")] })).includes("firstNightOnly"), false);
  assert.deepEqual(rules(role("在你的首个夜晚，你要选择一个数字。在该数字对应的那一个夜晚，你会得知对应数量的在场角色。", { target: [seat("seat", "号码")] })).includes("firstNightOnly"), false);

  const star = applyAll(role("每个夜晚*，你要选择一名玩家：他死亡。", { target: [seat("seat", "目标号码")] }));
  assert.equal(star.abilityMeta.phaseTiming, "each_night_star");
  assert.equal(star.interactionSchema.target.fields[0].label, "攻击对象");
  assert.equal(rules(role("每个夜晚*，你要选择一名玩家：他死亡。在你的首个夜晚，你要选择一名存活的玩家：他中毒。", { target: [seat("seat", "x")] })).includes("nightStar"), false);
});

test("generic labels are replaced by what the field holds", () => {
  assert.equal(describeTargetSeat("每个夜晚，你要选择一名玩家：你会得知他的阵营。"), "查验对象");
  assert.equal(describeTargetSeat("每个夜晚，你要选择一名玩家：他在当晚和明天白天中毒。"), "下毒对象");
  assert.equal(describeTargetSeat("每个夜晚*，你要选择除你以外的一名玩家：当晚恶魔的负面能力对他无效。"), "保护对象");
  assert.equal(describeTargetSeat("每个夜晚*，你要选择一名玩家并猜测他的角色：如果你猜错了，你会死亡。"), "猜测对象");
  assert.equal(describeTargetSeat("每个夜晚，你要选择一名玩家：明天他的投票算作三票。"), "选择对象");

  const data = applyAll(role("每个夜晚，你要选择两名玩家：你会得知其中一人的角色。", {
    target: [seat("a", "目标号码1"), seat("b", "目标号码2")],
    result: [{ key: "role", type: "role", label: "身份" }],
  }));
  assert.deepEqual(data.interactionSchema.target.fields.map((field) => field.label), ["查验1", "查验2"]);
  assert.equal(data.interactionSchema.result.fields[0].label, "得知角色");
});

test("a role field gets a type filter only when the text names exactly one character type", () => {
  const data = applyAll(role("每局游戏限一次，在夜晚时*，你可以选择一个镇民角色：如果他在场，他醉酒并死亡。", { target: [{ key: "role", type: "role", label: "选择角色" }] }));
  assert.deepEqual(data.interactionSchema.target.fields[0].roleTypes, ["townsfolk"]);
  assert.equal(rules(role("你会得知一个镇民角色和一个爪牙角色。", { result: [{ key: "role", type: "role", label: "选择角色" }] })).includes("roleTypes"), false);
  assert.equal(rules(role("选择一个镇民角色。", { target: [{ key: "role", type: "role", label: "选择角色", roleTypes: [] }] })).includes("roleTypes"), false, "explicit roleTypes win");
});
