const test = require("node:test");
const assert = require("node:assert/strict");
const {
  carryFieldAliases,
  hasOnlyGeneratedFields,
  inferUsagePattern,
  isOwnAction,
  makeRoleAbilityData,
} = require("../scripts/lib/ability-generator");

/** Generate abilityData for a role text; nights: "first", "other", "both" or "none". */
function generate(ability, nights = "both") {
  return makeRoleAbilityData(
    { id: "rx", name: "测试", type: "townsfolk", ability },
    {
      ability,
      firstNight: nights === "first" || nights === "both" ? 1 : 0,
      otherNight: nights === "other" || nights === "both" ? 1 : 0,
    },
  );
}

const fields = (data, section) =>
  data.interactionSchema[section].fields.map((field) => `${field.key}:${field.type}:${field.label}`);

test("classic information roles keep their structured fields", () => {
  const washer = generate("在你的首个夜晚，你会得知两名玩家和一个镇民角色：这两名玩家之一是该角色。", "first");
  assert.deepEqual(fields(washer, "result"), ["seat1:seat:候选1", "seat2:seat:候选2", "role:role:得知角色"]);
  assert.equal(washer.abilityMeta.phaseTiming, "first_night");

  const empath = generate("每个夜晚，你会得知与你邻近的两名存活的玩家中邪恶玩家的数量。");
  assert.deepEqual(fields(empath, "result"), ["count:number:数量"]);

  const teller = generate("每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。会有一名善良玩家始终被你的能力当作恶魔。");
  assert.deepEqual(fields(teller, "target"), ["seat1:seat:查验1", "seat2:seat:查验2"]);
  assert.deepEqual(fields(teller, "result"), ["answer:boolean:有恶魔"]);

  const ravenkeeper = generate("如果你在夜晚死亡，你会被唤醒，然后你要选择一名玩家：你会得知他的角色。", "other");
  assert.deepEqual(fields(ravenkeeper, "target"), ["seat:seat:查验对象"]);
  assert.deepEqual(fields(ravenkeeper, "result"), ["role:role:得知角色"]);
});

test("the learned object decides the field, not an earlier word of the text", () => {
  // 风水师: 顺时针方向 is where he looks, the answer is a character type.
  const geomancer = generate("在你的首个夜晚，你会得知一名玩家的角色类型。每个夜晚*，你会从他的顺时针方向得知下一名非旅行者玩家的角色类型。");
  assert.deepEqual(fields(geomancer, "result"), ["seat:seat:得知玩家", "character_type:character_type:角色类型"]);

  // 阎罗: 查看魔典 is not information to record.
  const yama = generate("在你的首个夜晚，你能查看魔典并选择一名玩家：他在第三个夜晚死亡，即使因为任何原因让他不会死亡。每个夜晚，你要选择一名玩家：上个夜晚被你选择的玩家死亡。");
  assert.deepEqual(fields(yama, "result"), []);
  assert.deepEqual(fields(yama, "target"), ["seat:seat:攻击对象"]);

  // 是否 beats the number / distance words around it.
  assert.deepEqual(fields(generate("每个夜晚，你得知你和武曲星邻近存活玩家中的邪恶数量是否相同。"), "result"), ["answer:boolean:相同"]);
  assert.deepEqual(fields(generate("在你的首个夜晚，你会得知恶魔与爪牙之间最近的距离。（邻座的玩家距离为1）", "first"), "result"), ["distance:number:距离"]);
  assert.deepEqual(fields(generate("每个夜晚*，你可以得知距离新的死亡玩家最远的邪恶玩家的角色类型。"), "result"), [
    "character_type:character_type:角色类型",
  ]);
  // The object runs past a comma when the first part names no answer.
  assert.deepEqual(
    fields(generate("每个夜晚*，你要选择一名与你距离大于1的存活玩家：你得知在顺时针方向上，你与该玩家之间有多少名邪恶玩家，如果你选择了邪恶玩家，你产生错误信息。"), "result"),
    ["count:number:数量"],
  );
  // 「当你得知你死亡时」 is a trigger; a parenthetical about other players is not the role's information.
  assert.deepEqual(fields(generate("当你得知你死亡时，你要公开选择一名存活的玩家。他死亡。", "none"), "result"), []);
  assert.deepEqual(fields(generate("每个夜晚*，你可以选择三名玩家（所有玩家都会得知前两名玩家是谁）：第三名玩家秘密决定他们中谁会被你杀死。"), "result"), []);
  // The head noun is 玩家.
  assert.deepEqual(fields(generate("每个夜晚，你会得知一名与上个夜晚得知的玩家角色类型不同的玩家。"), "result"), ["seat:seat:得知玩家"]);
  assert.deepEqual(fields(generate("每个夜晚*，你要选择一个角色：如果他在当晚死亡，你会得知他是谁。"), "result"), ["seat:seat:得知玩家"]);
});

test("a choice only counts inside its own clause", () => {
  // 狸猫: 交换角色 is not a role choice.
  const raccoon = generate("每个夜晚*，你要选择一名除你及旅行者以外的玩家：如果恶魔在今晚杀死了他，你和他交换角色，然后你醉酒。");
  assert.deepEqual(fields(raccoon, "target"), ["seat:seat:选择对象"]);
  assert.deepEqual(raccoon.interactionSchema.target.fields[0].seatFilter, ["notSelf"]);

  // 掮客: 两名存活玩家 is two seats; 选择他们之一 later in the text is someone else's choice.
  const broker = generate("每个夜晚，你要选择两名存活玩家：如果他们阵营相同，今晚任何玩家使用自身能力选择他们之一作为目标时，改为选中另一名玩家。");
  assert.deepEqual(fields(broker, "target"), ["seat1:seat:选择1", "seat2:seat:选择2"]);

  // 驿使: a public declaration is the target, the night answer the result.
  const courier = generate("每个白天，你可以公开声明一个角色。在当晚，你会得知该角色是否在场。如果你因此得知了否，你失去此能力。", "other");
  assert.deepEqual(fields(courier, "target"), ["role:role:声明角色"]);
  assert.deepEqual(fields(courier, "result"), ["answer:boolean:在场"]);

  // 打更人 guesses a distance.
  assert.deepEqual(fields(generate("每个夜晚*，你要猜测今晚首个死亡的玩家与你的距离。如果你猜测正确，则除你以外的所有玩家今晚不会死亡。"), "target"), [
    "guess:number:猜测距离",
  ]);

  // 巨怪: 你的阵营 is a possessive object, not someone choosing you.
  const troll = generate("每个夜晚，你要选择你的阵营。在最后一个夜晚，一名玩家会得知巨怪在场，即使你已死亡。");
  assert.deepEqual(fields(troll, "target"), ["team:team:选择阵营"]);
  assert.equal(troll.abilityMeta.recordable, true);
  // …but 「选择了你的善良玩家」「选择你的善良玩家」 are other players choosing you.
  assert.deepEqual(fields(generate("每个夜晚，首个使用其自身能力选择了你的善良玩家会在下一个夜晚死亡。"), "target"), []);
  assert.deepEqual(fields(generate("以你为中心，夜晚选择你的善良玩家改为选择他与你相同距离的另一侧玩家。", "none"), "target"), []);

  // 一名存活的爪牙 is a player.
  assert.deepEqual(fields(generate("在你的首个夜晚，你要选择一名存活的爪牙。只有他死亡时你才会一同死亡。", "first"), "target"), ["seat:seat:选择对象"]);
});

test("other players' choices and information add no field", () => {
  const fortune = generate("任何在夜晚使用自身能力选择你的其他玩家，会改为选中另一名邪恶玩家作为替代。", "none");
  assert.deepEqual(fields(fortune, "target"), []);
  assert.equal(fortune.abilityMeta.recordable, false);

  assert.deepEqual(fields(generate("如果多于一名善良玩家被处决，邪恶阵营获胜。所有玩家都知道利维坦在场。", "none"), "result"), []);
  assert.deepEqual(fields(generate("每个夜晚，你要选择一名玩家。如果你选中了爪牙，落难少女会得知你选择的哪名玩家是爪牙。"), "result"), []);
  assert.deepEqual(fields(generate("每个夜晚*，你要选择一名玩家。从现在开始，他被告知不能提名或投票。"), "result"), []);
  assert.deepEqual(fields(generate("如果你死亡，在当晚恶魔可以选择一名其他邪恶玩家和一个不在场的爪牙角色。", "none"), "target"), []);

  assert.equal(isOwnAction("你要"), true);
  assert.equal(isOwnAction("你和恶魔会"), true);
  assert.equal(isOwnAction("你们都会"), true);
  assert.equal(isOwnAction("你可以私下拜访说书人以"), true);
  assert.equal(isOwnAction("你要选择一名玩家并"), true);
  assert.equal(isOwnAction("你可以选择三名玩家所有玩家都会"), false);
  assert.equal(isOwnAction("上个夜晚被你"), false);
  assert.equal(isOwnAction("所有玩家都"), false);
});

test("target labels follow the clause of the choice", () => {
  assert.deepEqual(fields(generate("每个夜晚*，你要选择一名玩家：如果他在下个黄昏前死亡，你代替他死亡。"), "target"), ["seat:seat:保护对象"]);
  assert.deepEqual(fields(generate("每个夜晚*，你要选择一名玩家：他死亡。"), "target"), ["seat:seat:攻击对象"]);
  assert.deepEqual(fields(generate("每个夜晚*，你要选择除你以外的一名玩家：当晚恶魔的负面能力对他无效。"), "target"), ["seat:seat:保护对象"]);
});

test("timing: per-night and per-day limits are not once per game", () => {
  assert.equal(inferUsagePattern("每个夜晚*，你要选择一名玩家：他死亡。每个夜晚限一次，如果你以这种方式杀死了一名外来者，当晚你可以再次行动。", false, true), "once_per_night");
  assert.equal(inferUsagePattern("每个白天限一次，你可以杀死与你邻近的两名存活的玩家中的一名。", false, false), "once_per_day");
  assert.equal(inferUsagePattern("每局游戏限一次，在夜晚时，你可以选择一名玩家。", false, true), "once_per_game");
  assert.equal(inferUsagePattern("限一次，在白天时，你可以公开选择一名玩家。", false, false), "once_per_game");

  const prisoner = generate("你不能投票。在你的首个夜晚，你会得知一个不在场角色。如果多数玩家同意释放你，你会变成该角色。");
  assert.equal(prisoner.abilityMeta.phaseTiming, "first_night");
  assert.equal(prisoner.abilityMeta.usagePattern, "once");

  const princess = generate("如果你死于处决，所有玩家知道你是维齐尔。", "none");
  assert.equal(princess.abilityMeta.eventTiming, "on_execution");
});

test("renamed keys are kept as aliases so saved notes stay readable", () => {
  const schema = (target, result = []) => ({ interactionSchema: { target: { fields: target }, result: { fields: result } } });
  const before = schema(
    [{ key: "seat1", type: "seat" }, { key: "seat2", type: "seat" }],
    [{ key: "outsider_role", type: "role", aliases: ["very_old"] }, { key: "note", type: "text" }],
  );
  const after = carryFieldAliases(before, schema([{ key: "seat", type: "seat" }], [{ key: "role", type: "role" }, { key: "count", type: "number" }]));
  // One old key per new field; seat2 stays an unknown key rather than being folded into seat.
  assert.deepEqual(after.interactionSchema.target.fields[0].aliases, ["seat1"]);
  assert.deepEqual(after.interactionSchema.result.fields[0].aliases, ["outsider_role", "very_old"]);
  // A changed type (note text -> count number) is not an alias.
  assert.equal(after.interactionSchema.result.fields[1].aliases, undefined);
  // Existing aliases survive a regeneration that keeps the key.
  const again = carryFieldAliases(after, schema([{ key: "seat", type: "seat" }], [{ key: "role", type: "role" }]));
  assert.deepEqual(again.interactionSchema.result.fields[0].aliases, ["outsider_role", "very_old"]);
});

test("only untouched generator output counts as generated", () => {
  const tellerText = "每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。";
  assert.equal(hasOnlyGeneratedFields(generate(tellerText), tellerText), true);
  // A hand-written label (大人物 代言人号码) protects the role.
  assert.equal(
    hasOnlyGeneratedFields({
      interactionSchema: { target: { fields: [{ key: "seat", type: "seat", label: "代言人号码" }] }, result: { fields: [] } },
    }),
    false,
  );
  assert.equal(
    hasOnlyGeneratedFields({
      interactionSchema: {
        target: { fields: [{ key: "executed_seat", type: "seat" }] },
        result: { fields: [] },
      },
    }),
    false,
  );
  assert.equal(
    hasOnlyGeneratedFields({ interactionSchema: { target: { fields: [{ key: "seat", type: "role" }] }, result: { fields: [] } } }),
    false,
  );
});
