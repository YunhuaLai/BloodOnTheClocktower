const { ROLE_ABILITIES } = require("./roles");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function field({
  key,
  type,
  label,
  required = true,
  optionsSource = null,
  options = null,
  min = null,
  max = null,
  placeholder = null,
}) {
  return {
    key,
    type,
    label,
    required,
    optionsSource,
    options,
    min,
    max,
    placeholder,
  };
}

function seatField(key = "seat", label = "目标号码", required = true) {
  return field({
    key,
    type: "seat",
    label,
    required,
    min: 1,
    max: 15,
  });
}

function roleField(key = "role", label = "身份", required = true) {
  return field({
    key,
    type: "role",
    label,
    required,
    optionsSource: "current_script_roles",
  });
}

function booleanField(key = "answer", label = "是否", required = true) {
  return field({
    key,
    type: "boolean",
    label,
    required,
    optionsSource: "custom",
    options: ["yes", "no"],
  });
}

function numberField(key = "value", label = "数字", min = 0, max = 9, required = true) {
  return field({
    key,
    type: "number",
    label,
    required,
    min,
    max,
  });
}

function teamField(key = "team", label = "阵营", required = true) {
  return field({
    key,
    type: "team",
    label,
    required,
    optionsSource: "teams",
  });
}

function choiceField(key, label, options, required = true) {
  return field({
    key,
    type: "choice",
    label,
    required,
    optionsSource: "custom",
    options,
  });
}

function textField(key = "text", label = "记录", required = true, placeholder = null) {
  return field({
    key,
    type: "text",
    label,
    required,
    placeholder,
  });
}

function schemaNode(repeatMode, defaultRows, fields) {
  return {
    repeatMode,
    defaultRows,
    fields: clone(fields),
  };
}

function noneNode() {
  return schemaNode("none", 0, []);
}

function onceNode(fields) {
  return schemaNode("once", fields.length ? 1 : 0, fields);
}

function sequenceNode(fields, defaultRows = 3) {
  return schemaNode("sequence", defaultRows, fields);
}

function variableNode(fields, defaultRows = 1) {
  return schemaNode("variable", defaultRows, fields);
}

function abilityData(tags, abilityMeta, target = noneNode(), result = noneNode()) {
  return {
    schemaVersion: 1,
    tags: clone(tags),
    abilityMeta: {
      pageType: "no_input",
      phaseTiming: null,
      eventTiming: null,
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
      recordable: true,
      ...abilityMeta,
    },
    interactionSchema: {
      target: clone(target),
      result: clone(result),
    },
  };
}

function recordResultOnly(tags, meta, result, target = noneNode()) {
  return abilityData(tags, { pageType: "record_result_only", ...meta }, target, result);
}

function pickAndRecord(tags, meta, target, result = noneNode()) {
  return abilityData(tags, { pageType: "pick_and_record", ...meta }, target, result);
}

function eventTriggered(tags, meta, target = noneNode(), result = noneNode()) {
  return abilityData(tags, { pageType: "event_triggered", ...meta }, target, result);
}

function ruleModifier(tags, meta = {}) {
  return abilityData(tags, {
    pageType: "rule_modifier",
    phaseTiming: "passive",
    usagePattern: "passive",
    activationMode: "passive",
    drivenBy: "system",
    recordable: false,
    ...meta,
  });
}

const ROLE_ABILITY_OVERRIDES = {
  washerwoman: recordResultOnly(
    ["首夜", "信息型", "身份提示"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2"), roleField()]),
  ),
  librarian: recordResultOnly(
    ["首夜", "信息型", "身份提示"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2"), roleField()]),
  ),
  investigator: recordResultOnly(
    ["首夜", "信息型", "身份提示"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2"), roleField()]),
  ),
  chef: recordResultOnly(
    ["首夜", "信息型", "数字"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([numberField("count", "相邻邪恶数", 0, 5)]),
  ),
  empath: recordResultOnly(
    ["每晚", "信息型", "数字"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([numberField("count", "邻座邪恶数", 0, 2)]),
  ),
  "fortune-teller": pickAndRecord(
    ["每晚", "主动选玩家", "信息型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
    sequenceNode([booleanField("has_demon", "是否含恶魔")]),
  ),
  undertaker: recordResultOnly(
    ["每晚", "信息型", "查看身份"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([roleField("role", "处决玩家身份")]),
  ),
  monk: pickAndRecord(
    ["每晚", "主动选玩家", "保护型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  ravenkeeper: eventTriggered(
    ["死亡触发", "信息型", "查看身份"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    onceNode([seatField()]),
    onceNode([roleField("role", "查看身份")]),
  ),
  virgin: eventTriggered(
    ["提名触发", "一次性", "特殊机制"],
    {
      eventTiming: "on_nomination",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "system",
    },
    noneNode(),
    onceNode([booleanField("triggered", "是否触发")]),
  ),
  slayer: pickAndRecord(
    ["白天", "一次性", "主动选玩家", "击杀型"],
    {
      phaseTiming: "day",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField()]),
    onceNode([booleanField("hit_demon", "命中恶魔")]),
  ),
  soldier: ruleModifier(["被动", "保护型", "规则修饰"]),
  mayor: ruleModifier(["被动", "残局", "规则修饰"]),
  butler: pickAndRecord(
    ["每晚", "主动选玩家", "规则约束"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat", "主人号码")]),
  ),
  drunk: ruleModifier(["被动", "特殊机制", "外来者"]),
  recluse: ruleModifier(["被动", "特殊机制", "外来者"]),
  saint: ruleModifier(["被动", "特殊机制", "外来者"]),
  poisoner: pickAndRecord(
    ["每晚", "主动选玩家", "中毒型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  spy: recordResultOnly(
    ["每晚", "信息型", "特殊机制"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([textField("grimoire_note", "魔典记录", true, "记录当晚看到的关键信息")]),
  ),
  baron: ruleModifier(["开局", "被动", "规则修饰"], {
    phaseTiming: "setup",
    drivenBy: "system",
  }),
  "scarlet-woman": ruleModifier(["被动", "恶魔接替", "规则修饰"]),
  imp: pickAndRecord(
    ["每晚", "主动选玩家", "击杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),

  grandmother: recordResultOnly(
    ["首夜", "信息型", "身份提示"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat", "善良玩家"), roleField()]),
  ),
  sailor: pickAndRecord(
    ["每晚", "主动选玩家", "特殊机制"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
    sequenceNode([choiceField("drunk_side", "醉酒方", ["self", "target", "unknown"], false)]),
  ),
  chambermaid: pickAndRecord(
    ["每晚", "主动选玩家", "信息型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
    sequenceNode([numberField("count", "被唤醒人数", 0, 2)]),
  ),
  exorcist: pickAndRecord(
    ["每晚", "主动选玩家", "阻断型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
    sequenceNode([booleanField("hit_demon", "命中恶魔")]),
  ),
  innkeeper: pickAndRecord(
    ["每晚", "主动选玩家", "保护型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  gambler: pickAndRecord(
    ["每晚", "主动选玩家", "主动选角色"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField(), roleField("role", "猜测身份")]),
    sequenceNode([booleanField("correct", "是否猜中")]),
  ),
  gossip: recordResultOnly(
    ["白天", "信息型", "公开声明"],
    {
      phaseTiming: "each_day",
      usagePattern: "repeatable",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([textField("statement", "公开声明")]),
  ),
  courtier: pickAndRecord(
    ["一次性", "主动选角色", "中毒型"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([roleField("role", "目标身份")]),
  ),
  professor: pickAndRecord(
    ["一次性", "主动选玩家", "复活型"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField("seat", "复活号码")]),
    onceNode([booleanField("revived", "是否复活成功")]),
  ),
  minstrel: eventTriggered(
    ["处决触发", "全局影响", "特殊机制"],
    {
      eventTiming: "on_execution",
      usagePattern: "variable",
      activationMode: "conditional",
      drivenBy: "system",
    },
  ),
  "tea-lady": ruleModifier(["被动", "保护型", "邻座"]),
  pacifist: ruleModifier(["被动", "保护型", "处决"]),
  fool: ruleModifier(["被动", "免死", "一次性"]),
  tinker: ruleModifier(["被动", "随机死亡", "外来者"]),
  moonchild: eventTriggered(
    ["死亡触发", "主动选玩家", "外来者"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "player",
    },
    onceNode([seatField()]),
  ),
  goon: ruleModifier(["被动", "阵营变化", "特殊机制"]),
  lunatic: pickAndRecord(
    ["每晚", "主动选玩家", "特殊机制"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  godfather: abilityData(
    ["特殊机制", "开局信息", "击杀型"],
    {
      pageType: "pick_and_record",
      phaseTiming: "special",
      usagePattern: "variable",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    variableNode([seatField("seat", "击杀号码", false)], 2),
    variableNode([textField("note", "外来者与击杀记录", false)], 2),
  ),
  "devils-advocate": pickAndRecord(
    ["每晚", "主动选玩家", "保护型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  assassin: pickAndRecord(
    ["一次性", "主动选玩家", "击杀型"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField()]),
  ),
  mastermind: ruleModifier(["被动", "残局", "规则修饰"]),
  zombuul: ruleModifier(["被动", "假死", "恶魔"]),
  pukka: pickAndRecord(
    ["每晚", "主动选玩家", "中毒型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  shabaloth: pickAndRecord(
    ["每晚", "主动选玩家", "多杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  po: pickAndRecord(
    ["每晚", "主动选玩家", "多杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "variable",
      activationMode: "active",
      drivenBy: "player",
    },
    variableNode([seatField()], 3),
  ),

  clockmaker: recordResultOnly(
    ["首夜", "信息型", "数字"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([numberField("distance", "距离", 0, 10)]),
  ),
  noble: recordResultOnly(
    ["首夜", "信息型", "三选一"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2"), seatField("seat3", "号码3")]),
  ),
  balloonist: recordResultOnly(
    ["每晚", "信息型", "角色类型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([seatField("seat", "得知玩家")]),
  ),
  "village-idiot": pickAndRecord(
    ["每晚", "主动选玩家", "信息型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
    sequenceNode([teamField("team", "阵营")]),
  ),
  dreamer: pickAndRecord(
    ["每晚", "主动选玩家", "身份提示"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
    sequenceNode([roleField("good_role", "好身份"), roleField("evil_role", "坏身份")]),
  ),
  "snake-charmer": pickAndRecord(
    ["每晚", "主动选玩家", "特殊机制"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  mathematician: recordResultOnly(
    ["每晚", "信息型", "数字"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([numberField("count", "异常人数", 0, 15)]),
  ),
  flowergirl: recordResultOnly(
    ["每晚", "信息型", "投票相关"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([booleanField("voted", "恶魔是否投票")]),
  ),
  "town-crier": recordResultOnly(
    ["每晚", "信息型", "提名相关"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([booleanField("nominated", "爪牙是否提名")]),
  ),
  oracle: recordResultOnly(
    ["每晚", "信息型", "数字"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([numberField("count", "死亡邪恶数", 0, 15)]),
  ),
  savant: recordResultOnly(
    ["白天", "信息型", "双信息"],
    {
      phaseTiming: "each_day",
      usagePattern: "repeatable",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([textField("statement1", "信息1"), textField("statement2", "信息2")]),
  ),
  seamstress: pickAndRecord(
    ["一次性", "主动选玩家", "信息型"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
    onceNode([booleanField("same_team", "是否同阵营")]),
  ),
  philosopher: pickAndRecord(
    ["一次性", "主动选角色", "复制能力"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([roleField("role", "选择身份")]),
  ),
  artist: recordResultOnly(
    ["白天", "一次性", "问答型"],
    {
      phaseTiming: "day",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([textField("question", "问题"), booleanField("answer", "回答")]),
  ),
  engineer: abilityData(
    ["一次性", "主动选角色", "配置变更"],
    {
      pageType: "pick_and_record",
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
      recordable: true,
    },
    variableNode([roleField("role", "新邪恶身份")], 3),
    onceNode([choiceField("change_type", "变更类型", ["demon", "minions"])]),
  ),
  fisherman: recordResultOnly(
    ["白天", "一次性", "建议型"],
    {
      phaseTiming: "day",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "storyteller",
    },
    onceNode([textField("advice", "建议")]),
  ),
  juggler: pickAndRecord(
    ["白天", "一次性", "多目标"],
    {
      phaseTiming: "day",
      usagePattern: "once",
      activationMode: "active",
      drivenBy: "player",
    },
    variableNode([seatField(), roleField("role", "猜测身份")], 5),
    onceNode([numberField("correct_count", "猜中数量", 0, 5)]),
  ),
  "bounty-hunter": recordResultOnly(
    ["首夜", "信息型", "持续更新"],
    {
      phaseTiming: "first_night",
      usagePattern: "variable",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([seatField("seat", "邪恶玩家")], 2),
  ),
  sage: eventTriggered(
    ["死亡触发", "信息型", "二选一"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    noneNode(),
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  huntsman: pickAndRecord(
    ["一次性", "主动选玩家", "转化型"],
    {
      phaseTiming: "night",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField("seat", "目标号码")]),
    onceNode([booleanField("found_damsel", "命中落难少女")]),
  ),
  atheist: ruleModifier(["被动", "特殊胜利", "规则修饰"], {
    phaseTiming: "setup",
    drivenBy: "storyteller",
  }),
  "poppy-grower": ruleModifier(["被动", "邪恶不互认", "规则修饰"], {
    phaseTiming: "setup",
    drivenBy: "system",
  }),
  mutant: ruleModifier(["被动", "疯狂机制", "外来者"]),
  puzzlemaster: abilityData(
    ["一次性", "猜测型", "特殊机制"],
    {
      pageType: "pick_and_record",
      phaseTiming: "day",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
      recordable: true,
    },
    onceNode([seatField("seat", "醉酒猜测")]),
    onceNode([seatField("demon_seat", "恶魔号码", false)]),
  ),
  sweetheart: eventTriggered(
    ["死亡触发", "中毒/醉酒", "外来者"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    noneNode(),
    onceNode([seatField("seat", "醉酒玩家")]),
  ),
  golem: pickAndRecord(
    ["白天", "一次性", "提名触发"],
    {
      phaseTiming: "day",
      usagePattern: "once_per_game",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField("seat", "提名号码")]),
    onceNode([booleanField("hit_demon", "命中恶魔")]),
  ),
  barber: eventTriggered(
    ["死亡触发", "换身份", "外来者"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    noneNode(),
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  damsel: ruleModifier(["被动", "公开猜测", "外来者"]),
  klutz: eventTriggered(
    ["死亡触发", "主动选玩家", "外来者"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "player",
    },
    onceNode([seatField()]),
  ),
  "evil-twin": recordResultOnly(
    ["开局", "双生机制", "特殊机制"],
    {
      phaseTiming: "setup",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat", "双子号码")]),
  ),
  witch: pickAndRecord(
    ["每晚", "主动选玩家", "诅咒型"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  "organ-grinder": recordResultOnly(
    ["每晚", "特殊机制", "自选状态"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([booleanField("self_drunk", "是否自醉")]),
  ),
  cerenovus: pickAndRecord(
    ["每晚", "主动选玩家", "主动选角色", "疯狂机制"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField(), roleField("role", "宣称身份")]),
  ),
  "pit-hag": pickAndRecord(
    ["每晚", "主动选玩家", "主动选角色", "换身份"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField(), roleField("role", "新身份")]),
  ),
  widow: abilityData(
    ["首夜", "魔典", "中毒型"],
    {
      pageType: "pick_and_record",
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    onceNode([seatField("seat", "中毒号码")]),
    onceNode([seatField("widow_call_seat", "得知寡妇在场的善良玩家", false)]),
  ),
  "fang-gu": pickAndRecord(
    ["每晚", "主动选玩家", "击杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  vigormortis: pickAndRecord(
    ["每晚", "主动选玩家", "击杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  "al-hadikhia": abilityData(
    ["每晚", "主动选玩家", "多杀型"],
    {
      pageType: "pick_and_record",
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
      recordable: true,
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2"), seatField("seat3", "号码3")]),
    sequenceNode([
      choiceField("seat1_choice", "1号选择", ["live", "die"]),
      choiceField("seat2_choice", "2号选择", ["live", "die"]),
      choiceField("seat3_choice", "3号选择", ["live", "die"]),
    ]),
  ),
  "no-dashii": pickAndRecord(
    ["每晚", "主动选玩家", "击杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
  ),
  leviathan: ruleModifier(["被动", "残局", "规则修饰"]),
  vortox: ruleModifier(["被动", "错误信息", "规则修饰"]),

  steward: recordResultOnly(
    ["首夜", "信息型", "善良定位"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat", "善良玩家")]),
  ),
  knight: recordResultOnly(
    ["首夜", "信息型", "二选一"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  "high-priestess": recordResultOnly(
    ["每晚", "信息型", "交流建议"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    sequenceNode([seatField("seat", "建议交流对象")]),
  ),
  amnesiac: abilityData(
    ["白天", "特殊机制", "自定义"],
    {
      pageType: "record_result_only",
      phaseTiming: "each_day",
      usagePattern: "repeatable",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    noneNode(),
    sequenceNode([textField("guess", "能力猜测"), textField("feedback", "反馈")]),
  ),
  farmer: eventTriggered(
    ["死亡触发", "传承", "特殊机制"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    noneNode(),
    onceNode([seatField("seat", "新农夫")]),
  ),
  cannibal: ruleModifier(["被动", "能力继承", "特殊机制"]),
  ogre: pickAndRecord(
    ["首夜", "主动选玩家", "阵营变化"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "active",
      drivenBy: "player",
    },
    onceNode([seatField()]),
    onceNode([teamField("team", "结果阵营", false)]),
  ),
  harpy: pickAndRecord(
    ["每晚", "主动选玩家", "疯狂机制"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField("seat1", "号码1"), seatField("seat2", "号码2")]),
  ),
  mezepheles: recordResultOnly(
    ["首夜", "特殊机制", "密语"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([textField("secret_word", "秘密词语")]),
  ),
  psychopath: abilityData(
    ["白天", "公开击杀", "猜拳"],
    {
      pageType: "pick_and_record",
      phaseTiming: "special",
      usagePattern: "variable",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    variableNode([seatField("seat", "白天击杀号码", false)], 3),
    variableNode([textField("note", "猜拳/处决记录", false)], 3),
  ),
  kazali: abilityData(
    ["开局", "每晚", "特殊机制", "自定义"],
    {
      pageType: "pick_and_record",
      phaseTiming: "special",
      usagePattern: "variable",
      activationMode: "active",
      drivenBy: "player",
      recordable: true,
    },
    variableNode([seatField("seat", "号码"), roleField("role", "爪牙身份", false)], 3),
    variableNode([seatField("kill_seat", "击杀号码", false)], 3),
  ),
  ojo: pickAndRecord(
    ["每晚", "主动选角色", "击杀型"],
    {
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([roleField("role", "点名身份")]),
  ),

  pixie: recordResultOnly(
    ["首夜", "信息型", "疯狂机制", "能力继承"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([roleField("role", "得知在场镇民")]),
  ),
  snitch: ruleModifier(["开局", "外来者", "伪装信息"], {
    phaseTiming: "setup",
    drivenBy: "storyteller",
  }),
  legion: abilityData(
    ["每晚", "特殊恶魔", "投票规则"],
    {
      pageType: "pick_and_record",
      phaseTiming: "special",
      usagePattern: "variable",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    variableNode([seatField("death_seat", "死亡号码", false)], 3),
    variableNode([textField("vote_note", "投票/军团规则记录", false)], 3),
  ),
  shugenja: recordResultOnly(
    ["首夜", "信息型", "方向"],
    {
      phaseTiming: "first_night",
      usagePattern: "once",
      activationMode: "passive",
      drivenBy: "storyteller",
    },
    onceNode([choiceField("direction", "最近邪恶方向", ["clockwise", "counterclockwise", "storyteller_choice"])]),
  ),
  preacher: pickAndRecord(
    ["每晚", "主动选玩家", "爪牙失能"],
    {
      phaseTiming: "each_night",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "player",
    },
    sequenceNode([seatField()]),
    sequenceNode([booleanField("hit_minion", "是否命中爪牙")]),
  ),
  "plague-doctor": eventTriggered(
    ["死亡触发", "爪牙能力", "说书人"],
    {
      eventTiming: "on_death",
      usagePattern: "once",
      activationMode: "conditional",
      drivenBy: "storyteller",
    },
    noneNode(),
    onceNode([roleField("minion_role", "说书人获得的爪牙能力")]),
  ),
  "lil-monsta": abilityData(
    ["每晚", "爪牙协作", "特殊恶魔"],
    {
      pageType: "pick_and_record",
      phaseTiming: "each_night_star",
      usagePattern: "once_per_night",
      activationMode: "active",
      drivenBy: "mixed",
      recordable: true,
    },
    sequenceNode([seatField("babysitter", "照看者/恶魔号码")]),
    sequenceNode([seatField("death_seat", "死亡号码", false)]),
  ),
  "spirit-of-ivory": ruleModifier(["被动", "人数限制", "传说角色"]),
};

function fallbackAbilityData(roleData) {
  if (roleData.type === "fabled") {
    return ruleModifier(["传说角色", "规则修饰"], {
      phaseTiming: "setup",
      drivenBy: "storyteller",
    });
  }

  return abilityData(
    ["待分类"],
    {
      pageType: "record_result_only",
      phaseTiming: "special",
      usagePattern: "variable",
      activationMode: "passive",
      drivenBy: "storyteller",
      recordable: true,
    },
    noneNode(),
    variableNode([textField("note", "技能记录")], 1),
  );
}

function getRoleAbilityData(roleData) {
  return clone(ROLE_ABILITY_OVERRIDES[roleData.id] || fallbackAbilityData(roleData));
}

const ROLE_ABILITY_DATA_COVERAGE = {
  totalRoleIds: Object.keys(ROLE_ABILITIES).length,
  coveredRoleIds: Object.keys(ROLE_ABILITY_OVERRIDES).length,
  missingRoleIds: Object.keys(ROLE_ABILITIES).filter(
    (roleId) => !ROLE_ABILITY_OVERRIDES[roleId],
  ),
};

module.exports = {
  ROLE_ABILITY_DATA_COVERAGE,
  ROLE_ABILITY_OVERRIDES,
  getRoleAbilityData,
};
