// Generate role abilityData (notes-page fields, timing, semantics, deduction) from the Chinese ability text.
//
// The text is read clause by clause: a sentence is split at 。；, a clause at ，：. A choice (选择…玩家 /
// 选择…角色 / 猜测 / 声明) or a piece of information (得知 / 会知道 / 查看) only counts when it is the role's own
// action, so 「任何…选择你的其他玩家」 or 「所有玩家都知道…」 add no field. Each learn clause is classified on its
// own object (the words after 得知), most specific shape first, and the results are merged.
//
// Used by manage-official-json.js (import) and sync-generated-ability-data.js (regenerate unreviewed roles).

const { applyAbilityTermMetadata } = require("./ability-term-metadata");
const { inferDeductionData } = require("./deduction-profile-inference");
const { ROLE_ABILITY_SOURCE_HASH_FIELDS, makeSourceAbilityHash } = require("./ability-review");
const { describeTargetSeat, planCleanup } = require("./ability-cleanup");
const { applySeatFilters, inferSeatFilters } = require("./seat-filter-inference");

// ---------------------------------------------------------------------------------------------------------------
// Text helpers

function stripBrackets(text) {
  return String(text || "").replace(/\[[^\]]*\]/g, "").trim();
}

function splitSentences(text) {
  // Parentheticals are side notes (（与之前不同）, （所有玩家都会得知前两名玩家是谁）), not the role's actions.
  return stripBrackets(text)
    .replace(/（[^）]*）|\([^)]*\)|【[^】]*】/g, "")
    .split(/[。；;！!？?\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitClauses(sentence) {
  return String(sentence || "")
    .split(/[，,：:]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

const COUNT_WORDS = { 一: 1, 1: 1, 二: 2, 两: 2, 2: 2, 三: 3, 3: 3, 四: 4, 4: 4, 五: 5, 5: 5 };

/** Number in 「两名」「三个」「一位」 at the start of `text` (before the noun), 1 when none is given. */
function readCount(text) {
  const match = String(text || "").match(/([一二两三四五1-5])(?:名|个|位)/);
  return match ? COUNT_WORDS[match[1]] : 1;
}

const OWN_MODAL = /你们?(?:都|也|还|再|可能|就)?(?:要|可以|能|会|需要|必须|将)/;
const OWN_ACTOR_END = /你们?(?:都|也|还|再|可能|就)?(?:要|可以|能|会|需要|必须|将)?(?:再|秘密地?|公开地?|立即|同时)?$/;
// 「你和恶魔会得知」「你与兔弟分别得知」: you are one of the subjects.
const OWN_WITH_OTHERS = /你(?:和|与|及)[^，。]{1,8}?(?:都|分别|也)?(?:会|要|能|可以)?$/;
const OTHER_ACTOR = /玩家|恶魔|爪牙|镇民|外来者|旅行者|他|她|它|说书人|任何|有人|对方|其中|阵营|彼此|互相|所有|全部|其他/;

/** The words before a verb make it the role's own action (你要选择 / 选择… with no other subject). */
function isOwnAction(prefix) {
  // 「被你选择的玩家」 is passive; 「你会被唤醒得知」 is still the role's own information.
  if (/被(?:你|他|她|他们)?$/.test(prefix) || /不(?:会|能|可以)|不$/.test(prefix)) return false;
  if (OWN_ACTOR_END.test(prefix) || OWN_WITH_OTHERS.test(prefix)) return true;
  // 「你能查看魔典并选择」: 你 is the subject unless someone else is named after it.
  // Objects of your own earlier verbs (拜访说书人以…, 选择一名玩家并…) are not subjects.
  const tail = prefix
    .slice(Math.max(prefix.lastIndexOf("你"), 0))
    .replace(/(?:拜访|询问|问|找|选择|欺骗|唤醒|告诉)[^并以且然来]*?(?:并且?|以|且|然后|来)/g, "");
  if (OWN_MODAL.test(tail) && !OTHER_ACTOR.test(tail.replace(/^你们?/, ""))) return true;
  // 「落难少女会得知」: a modal verb right after someone other than 你.
  if (/(?:^|[^你])(?:都|也|就|则)?(?:会|要|可以|能|需要|必须)$/.test(prefix) && prefix.length > 1) return false;
  return !OTHER_ACTOR.test(prefix);
}

// A person: 玩家 / 旅行者, or 「一名…爪牙」 (名 counts people, so 一名存活的爪牙 is a player).
const PERSON = /玩家|旅行者|[一二两三四五1-5]名[^，。]*?(?:爪牙|恶魔|镇民|外来者)/;

// ---------------------------------------------------------------------------------------------------------------
// Field builders

function baseField(key, type, label, extra = {}) {
  return {
    key,
    type,
    label,
    required: true,
    optionsSource: null,
    options: null,
    min: null,
    max: null,
    placeholder: null,
    ...extra,
  };
}

function seatField(key, label) {
  return baseField(key, "seat", label, { min: 1, max: 15 });
}

function roleField(key, label) {
  return baseField(key, "role", label, { optionsSource: "current_script_roles" });
}

function teamField(key, label) {
  return baseField(key, "team", label, { optionsSource: "teams" });
}

function characterTypeField(key, label) {
  return baseField(key, "character_type", label, { optionsSource: "character_types" });
}

function booleanField(key, label) {
  return baseField(key, "boolean", label, { optionsSource: "custom", options: ["yes", "no"] });
}

function numberField(key, label) {
  return baseField(key, "number", label, { min: 0, max: 15 });
}

function choiceField(key, label, options) {
  return baseField(key, "choice", label, { optionsSource: "custom", options });
}

function textField(key, label, placeholder) {
  return baseField(key, "text", label, { required: false, placeholder });
}

/** key -> type of every field this generator (or the regex importer before it) can write. */
const GENERATED_FIELD_TYPES = {
  seat: "seat",
  seat1: "seat",
  seat2: "seat",
  seat3: "seat",
  guess_seat: "seat",
  role: "role",
  role1: "role",
  role2: "role",
  role3: "role",
  guess_role: "role",
  number: "number",
  guess: "number",
  count: "number",
  distance: "number",
  answer: "boolean",
  team: "team",
  character_type: "character_type",
  direction: "choice",
  note: "text",
};

/** Labels written by this generator, the regex importer before it and the clean-up rules. */
const GENERATED_FIELD_LABELS = new Set([
  "目标号码", "号码", "死亡玩家号码", "记录", "身份", "目标身份", "选择身份", "选择角色", "猜测角色", "声明角色",
  "是否", "数量", "距离", "阵营", "方向", "角色类型", "得知玩家", "得知角色", "选择数字", "选择阵营",
  "猜测数字", "猜测距离", "猜测对象", "选择对象", "查验对象", "下毒对象", "攻击对象", "保护对象", "醉酒对象",
  ...[1, 2, 3].flatMap((index) => [`号码${index}`, `目标号码${index}`, `查验${index}`, `选择${index}`, `候选${index}`, `得知角色${index}`]),
]);

/**
 * Every field of the abilityData has a key, type and label this generator writes (no hand-made fields or
 * hand-written labels). A yes/no label is taken from the ability text, so any label found in the text counts.
 */
function hasOnlyGeneratedFields(abilityData, ability = "") {
  return ["target", "result"].every((section) => {
    const fields = abilityData?.interactionSchema?.[section]?.fields || [];
    return fields.every((field) => {
      if (GENERATED_FIELD_TYPES[field?.key] !== field?.type) return false;
      const label = String(field?.label || "");
      return GENERATED_FIELD_LABELS.has(label) || (field.type === "boolean" && Boolean(label) && String(ability).includes(label));
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Target: what the player chooses

/** [{ kind: "player"|"role"|"number"|"team"|"guess_role"|"guess_number"|"guess_player", count, context }] */
function findChoices(ability) {
  const choices = [];

  splitSentences(ability).forEach((sentence) => {
    const clauses = splitClauses(sentence);
    clauses.forEach((clause, clauseIndex) => {
      const context = clauses.slice(clauseIndex).join("，");
      const verbPattern = /选择|猜测|声明/g;
      let match;

      while ((match = verbPattern.exec(clause))) {
        const verb = match[0];
        const prefix = clause.slice(0, match.index);
        const rest = clause.slice(match.index + verb.length);

        if (!isOwnAction(prefix) || /^了?你/.test(rest)) continue;
        // 「被你选择的玩家」 refers back to an earlier choice.
        if (verb === "选择" && /^的/.test(rest)) continue;

        if (verb === "猜测") {
          if (/角色|身份/.test(rest)) choices.push({ kind: "guess_role", count: 1, context });
          else if (/距离|几|多少|数量|数字/.test(rest)) choices.push({ kind: "guess_number", count: 1, context });
          else if (/玩家/.test(rest)) choices.push({ kind: "guess_player", count: 1, context });
          continue;
        }

        if (verb === "声明") {
          if (/角色|身份/.test(rest)) choices.push({ kind: "role", count: 1, context, label: "声明角色" });
          continue;
        }

        const person = rest.match(PERSON);
        const playerAt = person ? person.index : -1;
        const roleAt = rest.search(/角色/);
        if (playerAt >= 0 && (roleAt < 0 || playerAt < roleAt)) {
          const count = readCount(rest.slice(0, playerAt + person[0].length));
          choices.push({ kind: "player", count, context, vague: /任意|至多|至少|若干/.test(rest) });
          // 「选择一名玩家并猜测他的角色」 is handled by the 猜测 match; 「选择两名玩家和一个角色」 adds the role here.
          if (roleAt > playerAt && /和|及|与/.test(rest.slice(playerAt, roleAt))) choices.push({ kind: "role", count: 1, context });
        } else if (roleAt >= 0) {
          choices.push({ kind: "role", count: 1, context });
        } else if (/数字|数量/.test(rest)) {
          choices.push({ kind: "number", count: 1, context });
        } else if (/阵营/.test(rest)) {
          choices.push({ kind: "team", count: 1, context });
        }
      }
    });
  });

  return choices;
}

function learnsInContext(context) {
  return /你(?:会|也会|将)?(?:得知|知道)|得知他|得知其|告诉你|告知你/.test(context);
}

function inferTargetFields(ability) {
  const choices = findChoices(ability);
  const fields = [];
  const add = (field) => {
    if (!fields.some((item) => item.key === field.key)) fields.push(field);
  };

  const players = choices.filter((choice) => choice.kind === "player");
  if (players.length) {
    // Several choose-player clauses (首夜一次、每晚一次) share one row: use the largest count.
    const widest = players.reduce((best, choice) => (choice.count > best.count ? choice : best), players[0]);
    const count = Math.min(widest.count, 3);
    if (count === 1) {
      add(seatField("seat", describeTargetSeat(widest.context)));
    } else {
      const prefix = learnsInContext(widest.context) ? "查验" : "选择";
      for (let index = 1; index <= count; index += 1) add(seatField(`seat${index}`, `${prefix}${index}`));
    }
  }

  choices.forEach((choice) => {
    if (choice.kind === "guess_player") add(seatField("guess_seat", "猜测对象"));
    if (choice.kind === "role") add(roleField("role", choice.label || "选择角色"));
    if (choice.kind === "guess_role") add(roleField(fields.some((field) => field.key === "role") ? "guess_role" : "role", "猜测角色"));
    if (choice.kind === "guess_number") add(numberField("guess", /距离/.test(choice.context) ? "猜测距离" : "猜测数字"));
    if (choice.kind === "number") add(numberField("number", "选择数字"));
    if (choice.kind === "team") add(teamField("team", "选择阵营"));
  });

  return { fields, vague: players.some((choice) => choice.vague) };
}

// ---------------------------------------------------------------------------------------------------------------
// Result: what the player learns

const LEARN_VERB = /得知|获知|知晓|知道|查看(?!魔典)|告诉你|告知你|被告知/g;
// 「说书人会告诉你」 is information for you whoever speaks; 被告知 keeps the subject check (他被告知 is not yours).
const INHERENTLY_OWN = new Set(["告诉你", "告知你"]);

/** The objects of the role's own learn verbs: 「两名玩家和一个镇民角色」「他们之中是否有恶魔」… */
function findLearnObjects(ability) {
  const objects = [];

  splitSentences(ability).forEach((sentence) => {
    const clauses = splitClauses(sentence);
    clauses.forEach((clause, clauseIndex) => {
      let match;
      LEARN_VERB.lastIndex = 0;
      while ((match = LEARN_VERB.exec(clause))) {
        const verb = match[0];
        const prefix = clause.slice(0, match.index);
        let object = clause.slice(match.index + verb.length);

        if (!INHERENTLY_OWN.has(verb) && !isOwnAction(prefix)) continue;
        // 「如果你因此得知了否」「你得知的爪牙」 refer back to the information; 「当你得知你死亡时」 is a trigger.
        if (/^(?:了|的|此事|你(?:已)?死亡|自己(?:已)?死亡)/.test(object) || /时$/.test(object)) continue;
        if (!object && clauses[clauseIndex + 1]) object = clauses[clauseIndex + 1];
        // 「你得知在顺时针方向上，你与该玩家之间有多少名邪恶玩家」: the object can run past a comma, but not
        // into a clause that starts a new action (你要… / 如果… / 然后…).
        const following = [];
        for (const next of clauses.slice(clauseIndex + 1, clauseIndex + 3)) {
          if (/^(?:你(?!与|和)|如果|若|当|然后|并且|且|但|他|她|所有|每|随后|之后)/.test(next)) break;
          following.push(next);
        }
        if (object) objects.push([object, ...following]);
        break;
      }
    });
  });

  return objects;
}

function booleanLabel(object) {
  const match = object.match(/是否(.+)$/);
  const tail = match ? match[1].replace(/^(?:为|是)?/, "").trim() : "";
  return tail && tail.length <= 8 ? tail : "是否";
}

/** Result seats for 「一名玩家」 (得知玩家) or 「两/三名玩家」 (候选1…). */
function seatsFor(count) {
  if (count < 2) return [seatField("seat", "得知玩家")];
  const seats = [];
  for (let index = 1; index <= Math.min(count, 3); index += 1) seats.push(seatField(`seat${index}`, `候选${index}`));
  return seats;
}

/** Fields for one learn object, most specific shape first. */
function classifyLearnObject(object) {
  const text = String(object || "")
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .trim();

  const groupWithRole = text.match(/([一二两三四五1-5])(?:名|个|位)[^，。]*?玩家(?:和|及|与)[^，。]*?角色/);
  if (groupWithRole) {
    const count = COUNT_WORDS[groupWithRole[1]];
    if (count >= 2) {
      const seats = [];
      for (let index = 1; index <= Math.min(count, 3); index += 1) seats.push(seatField(`seat${index}`, `候选${index}`));
      return [...seats, roleField("role", "得知角色")];
    }
    return [seatField("seat", "得知玩家"), roleField("role", "得知角色")];
  }

  // 「数量是否相同」「是否是恶魔」 ask yes/no even when they mention a number or a distance.
  if (/是否|有没有|是不是/.test(text)) return [booleanField("answer", booleanLabel(text))];
  if (/距离(?:是)?(?:多少|几)?$/.test(text)) return [numberField("distance", "距离")];
  if (/多少|几(?:名|个|对|位|人|次|票)?|数量|人数|数字|之和|总和|总数|次数/.test(text)) return [numberField("count", "数量")];

  // 「他是谁」「哪些玩家是外来者」 name a player.
  if (/是谁|了谁|谁$|哪(?:一)?(?:名|位|些)[^，。]{0,6}?玩家/.test(text)) return [seatField("seat", "得知玩家")];

  // The head noun is 玩家: 「一名与上个夜晚得知的玩家角色类型不同的玩家」「两名阵营不同的玩家」.
  const people = text.match(/([一二两三四五1-5])(?:名|个|位)[^，。]*?玩家$/);
  if (people) return seatsFor(COUNT_WORDS[people[1]]);

  if (/角色类型/.test(text)) {
    return /一名[^，。]*?玩家的角色类型/.test(text)
      ? [seatField("seat", "得知玩家"), characterTypeField("character_type", "角色类型")]
      : [characterTypeField("character_type", "角色类型")];
  }

  if (/哪个方向|哪一侧|哪边|顺时针还是逆时针/.test(text)) {
    return [choiceField("direction", "方向", ["clockwise", "counterclockwise"])];
  }

  if (/[一1](?:名|个|位)[^，。]*?玩家(?:的|及他的|和他的)(?:角色|身份)/.test(text)) {
    return [seatField("seat", "得知玩家"), roleField("role", "得知角色")];
  }
  if (/阵营/.test(text)) return [teamField("team", "阵营")];

  // 名 counts people; 「一个…玩家」 is a player only when 玩家 is the head noun (not 「一个和该玩家有关的标记」).
  const players = text.match(/([一二两三四五1-5])(?:名[^，。]*?(?:玩家|旅行者|爪牙|恶魔|镇民|外来者)|(?:个|位)[^，。]*?玩家(?=$|[和及与]))/);
  if (players && !/角色|身份/.test(text.slice(0, players.index))) return seatsFor(COUNT_WORDS[players[1]]);
  if (/玩家$/.test(text)) return [seatField("seat", "得知玩家")];

  if (/角色|身份/.test(text)) {
    const count = readCount(text.slice(0, text.search(/角色|身份/)));
    if (count >= 2) {
      const roles = [];
      for (let index = 1; index <= Math.min(count, 3); index += 1) roles.push(roleField(`role${index}`, `得知角色${index}`));
      return roles;
    }
    return [roleField("role", "得知角色")];
  }

  return [];
}

function inferResultFields(ability) {
  const objects = findLearnObjects(ability);
  const fields = [];
  let shapes = 0;

  objects.forEach(([object, ...following]) => {
    let found = classifyLearnObject(object);
    for (let index = 0; !found.length && index < following.length; index += 1) {
      found = classifyLearnObject([object, ...following.slice(0, index + 1)].join("，"));
    }
    if (found.length) shapes += 1;
    found.forEach((field) => {
      if (!fields.some((item) => item.key === field.key)) fields.push(field);
    });
  });

  if (objects.length && !fields.length) {
    fields.push(textField("note", "记录", "导入初稿，请按角色能力调整结构化字段。"));
  }

  return { fields, uncertain: objects.length > 0 && (shapes === 0 || shapes < objects.length) };
}

function makeSchemaNode(fields, isOnce) {
  if (!fields.length) {
    return { repeatMode: "none", defaultRows: 0, fields: [] };
  }
  return {
    repeatMode: isOnce ? "once" : "sequence",
    defaultRows: isOnce ? 1 : 3,
    fields,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Timing

const LIMITED_TO_NIGHT = /每个?(?:夜晚|晚上?)[*＊]?限一次/;
const LIMITED_TO_DAY = /每个?(?:白天|天)限一次/;

function hasOncePerGameTiming(ability) {
  if (/每局(?:游戏)?(?:限|只能|仅)?一次/.test(ability)) return true;
  // A bare 限一次 is per game unless it is 每个夜晚限一次 / 每个白天限一次.
  return /限一次/.test(ability.replace(LIMITED_TO_NIGHT, "").replace(LIMITED_TO_DAY, ""));
}

function hasEachDayTiming(ability) {
  return /每个白天|每天白天|每个白昼|每天(?!夜晚)/.test(ability);
}

function hasEachNightTiming(ability) {
  return /每个夜晚|每晚|每天夜晚|每夜|每个黎明/.test(ability);
}

/** The text only ever speaks of the first night (no other night, 当晚 or 第N个夜晚). */
function hasOnlyFirstNightTiming(ability) {
  return /首个夜晚/.test(ability) && !/每个?夜晚|每晚|每夜|当晚|今晚|夜晚时|在夜晚|第[二三四五六七八九十\d]+个?夜晚|每个黎明/.test(ability);
}

function hasEachNightStarTiming(ability) {
  return /每个夜晚[*＊]|每晚[*＊]|夜晚时[*＊]|夜晚[*＊]/.test(ability);
}

function inferUsagePattern(ability, hasFirstNight, hasOtherNight) {
  if (hasOncePerGameTiming(ability)) return "once_per_game";
  if (LIMITED_TO_DAY.test(ability) && !hasEachNightTiming(ability)) return "once_per_day";
  if (hasEachDayTiming(ability) && !hasEachNightTiming(ability)) return "once_per_day";
  if (hasEachNightTiming(ability)) return "once_per_night";
  if (hasEachDayTiming(ability)) return "once_per_day";
  if (hasOnlyFirstNightTiming(ability)) return "once";
  if (hasFirstNight && !hasOtherNight) return "once";
  if (hasOtherNight) return "once_per_night";
  return "passive";
}

function inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent) {
  if (hasEachDayTiming(ability) && !hasEachNightTiming(ability)) return "each_day";
  if (hasEachNightStarTiming(ability)) return "each_night_star";
  if (hasEachNightTiming(ability)) return "each_night";
  if (hasOnlyFirstNightTiming(ability)) return "first_night";
  if (hasFirstNight && !hasOtherNight) return "first_night";
  if (hasOtherNight) return "each_night";
  if (isSetupOnly) return "setup";
  if (isEvent) return null;
  return "passive";
}

const EVENT_WORDS = /每当|当(?![晚天日夜前时])|如果[^。]*?(?:死亡|死于)|提名|处决|投票|落败|获胜/;

function isEventTriggeredAbility(ability, hasFirstNight, hasOtherNight) {
  return EVENT_WORDS.test(stripBrackets(ability)) && !hasFirstNight && !hasOtherNight;
}

function eventInClause(clause) {
  if (/被处决|死于处决/.test(clause)) return "on_execution";
  const candidates = [
    ["on_nomination", clause.search(/提名/)],
    ["on_execution", clause.search(/处决/)],
    ["on_vote", clause.search(/投票/)],
    ["on_death", clause.search(/死亡|死于|死去/)],
  ].filter(([, index]) => index >= 0);
  if (!candidates.length) return null;
  return candidates.sort((left, right) => left[1] - right[1])[0][0];
}

/** The event named in the triggering clause (当… / 如果… / 每当…), else anywhere in the text. */
function inferEventTiming(ability) {
  const clauses = splitSentences(ability).flatMap(splitClauses);
  for (const clause of clauses) {
    if (/^(?:在[^，]*?)?(?:每当|当(?![晚天日夜前时])|如果|若)/.test(clause)) {
      const event = eventInClause(clause);
      if (event) return event;
    }
  }
  return eventInClause(stripBrackets(ability));
}

function needsAbilityReview(ability, { vagueTarget = false, uncertainResult = false } = {}) {
  if (/变成|交换|转变|疯狂|创造.*恶魔|代替|额外进行|互相知道|无法获胜|阵营落败|阵营获胜/.test(ability)) return true;
  if (/说书人决定|可能|至多|任意|秘密|所有|全部|邻近|旅行者/.test(ability)) return true;
  return vagueTarget || uncertainResult;
}

function buildAbilityTags(officialRole, pageType) {
  const tags = [];
  if (Number(officialRole.firstNight) > 0) tags.push("首夜");
  if (Number(officialRole.otherNight) > 0) tags.push("每晚");
  if (officialRole.setup) tags.push("设置");
  if (pageType === "pick_and_record") tags.push("主动选择");
  if (pageType === "record_result_only") tags.push("信息型");
  if (pageType === "event_triggered") tags.push("事件触发");
  return tags.length ? tags : ["被动"];
}

// ---------------------------------------------------------------------------------------------------------------
// Semantics

function getSchemaFields(node) {
  return Array.isArray(node?.fields) ? node.fields : [];
}

function countFieldsByType(node, type) {
  return getSchemaFields(node).filter((field) => field?.type === type).length;
}

function hasFieldType(node, type) {
  return getSchemaFields(node).some((field) => field?.type === type);
}

function hasFieldKey(node, key) {
  return getSchemaFields(node).some((field) => field?.key === key);
}

function inferRoleTypeHint(ability) {
  if (/镇民/.test(ability)) return "townsfolk";
  if (/外来者/.test(ability)) return "outsider";
  if (/爪牙/.test(ability)) return "minion";
  if (/恶魔/.test(ability)) return "demon";
  return null;
}

function inferBooleanQuestionKind(ability) {
  if (/恶魔/.test(ability)) return "demon_check";
  if (/同阵营|同一阵营|相同阵营/.test(ability)) return "team_relation";
  if (/投票/.test(ability)) return "vote_check";
  if (/提名/.test(ability)) return "nomination_check";
  return "boolean_check";
}

function inferNumberKind(ability) {
  if (/距离/.test(ability)) return "distance";
  if (/死亡|死去|死者/.test(ability)) return "death_count";
  if (/邪恶|恶/.test(ability)) return "evil_count";
  return "count";
}

function inferSemanticOperations({ ability, officialRole = {}, roleData = {}, target, result, pageType, eventTiming }) {
  const operations = [];
  const targetSeatCount = countFieldsByType(target, "seat");
  const resultSeatCount = countFieldsByType(result, "seat");
  const hasResultRole = hasFieldType(result, "role");

  if (officialRole.setup || roleData.setup || roleData.setupMeta?.configurationAdjustments?.length) {
    operations.push({ kind: "setup_modifier", adjustments: roleData.setupMeta?.configurationAdjustments || [] });
  }
  if (targetSeatCount) operations.push({ kind: "choose_player", count: targetSeatCount, source: "target" });
  if (hasFieldType(target, "role")) operations.push({ kind: "choose_role", source: "target" });

  if (hasFieldKey(result, "seat1") && hasFieldKey(result, "seat2") && hasResultRole) {
    operations.push({ kind: "learn_role_in_group", seats: resultSeatCount || 2, roleType: inferRoleTypeHint(ability) });
  } else if (targetSeatCount && hasResultRole) {
    operations.push({ kind: "learn_role_at_target", targetSource: "target" });
  } else if (hasResultRole) {
    operations.push({ kind: "learn_role", roleType: inferRoleTypeHint(ability) });
  }
  if (hasFieldType(result, "character_type")) operations.push({ kind: "learn_character_type" });
  if (hasFieldType(result, "boolean")) operations.push({ kind: "learn_boolean", question: inferBooleanQuestionKind(ability) });
  if (hasFieldType(result, "number")) operations.push({ kind: "learn_number", numberKind: inferNumberKind(ability) });
  if (hasFieldType(result, "team")) operations.push({ kind: "learn_team" });
  if (resultSeatCount && !hasResultRole) operations.push({ kind: "learn_player", count: resultSeatCount });

  if (/中毒|醉酒|失去能力/.test(ability)) operations.push({ kind: "apply_status_effect", effect: "poison_drunk_or_malfunction" });
  if (/保护|不会死亡|免于死亡|免受|免疫|无效/.test(ability)) operations.push({ kind: "protect_player" });
  if (/死亡|死去|处决/.test(ability) && !operations.some((operation) => operation.kind === "learn_number")) {
    operations.push({ kind: "death_or_execution_effect" });
  }
  if (pageType === "event_triggered" || eventTiming) operations.push({ kind: "event_trigger", eventTiming: eventTiming || null });

  if (!operations.length) {
    operations.push({ kind: pageType === "rule_modifier" || pageType === "no_input" ? "passive_rule" : "manual_record" });
  }
  return operations;
}

function makeAbilitySemantics({ ability, officialRole, roleData, target, result, pageType, phaseTiming, eventTiming, usagePattern, needsReview }) {
  return {
    schemaVersion: 1,
    reviewStatus: needsReview ? "needs_review" : "auto",
    confidence: needsReview ? 0.45 : 0.75,
    timing: { phase: phaseTiming, event: eventTiming, frequency: usagePattern },
    actor: {
      drivenBy: pageType === "pick_and_record" ? "player" : pageType === "rule_modifier" ? "system" : "storyteller",
    },
    operations: inferSemanticOperations({ ability, officialRole, roleData, target, result, pageType, eventTiming }),
  };
}

function makeSourceAbilityData(roleData, officialRole = {}) {
  return {
    source: "role-file",
    roleId: roleData.id || "",
    officialId: officialRole.id || roleData.englishName || "",
    sourceHash: makeSourceAbilityHash(roleData),
    sourceHashFields: ROLE_ABILITY_SOURCE_HASH_FIELDS,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Whole abilityData

/** Recompute everything that is derived from abilityMeta + interactionSchema (after clean-up rules changed them). */
function refreshDerivedAbilityData(abilityData, roleData, officialRole, needsReview, deduction) {
  const ability = roleData.ability || "";
  const meta = abilityData.abilityMeta;
  const { target, result } = abilityData.interactionSchema;

  abilityData.abilitySemantics = makeAbilitySemantics({
    ability,
    officialRole,
    roleData,
    target,
    result,
    pageType: meta.pageType,
    phaseTiming: meta.phaseTiming,
    eventTiming: meta.eventTiming,
    usagePattern: meta.usagePattern,
    needsReview,
  });
  delete abilityData.deduction;
  if (deduction) abilityData.deduction = deduction;
  return applyAbilityTermMetadata(abilityData, roleData);
}

/**
 * Build role abilityData from the role text.
 * officialRole: { id, ability, firstNight, otherNight, setup } (official JSON role object, or the same shape
 * derived from the library: firstNight/otherNight > 0 when the role has a place in a night order).
 */
function makeRoleAbilityData(roleData, officialRole = {}) {
  const ability = officialRole.ability || roleData.ability || "";
  const role = { ...roleData, ability };
  const hasFirstNight = Number(officialRole.firstNight) > 0;
  const hasOtherNight = Number(officialRole.otherNight) > 0;
  const usagePattern = inferUsagePattern(ability, hasFirstNight, hasOtherNight);
  const isOnceRecord = usagePattern === "once" || usagePattern === "once_per_game";
  const targetInfo = inferTargetFields(ability);
  const resultInfo = inferResultFields(ability);
  const target = makeSchemaNode(targetInfo.fields, isOnceRecord);
  const result = makeSchemaNode(resultInfo.fields, isOnceRecord);
  const chooses = target.fields.length > 0;
  const learnsInfo = result.fields.length > 0;
  const isEvent = isEventTriggeredAbility(ability, hasFirstNight, hasOtherNight);
  const isSetupOnly = Boolean(officialRole.setup ?? roleData.setup) && !hasFirstNight && !hasOtherNight;
  const needsReview = needsAbilityReview(ability, { vagueTarget: targetInfo.vague, uncertainResult: resultInfo.uncertain });
  const phaseTiming = inferPhaseTiming(ability, hasFirstNight, hasOtherNight, isSetupOnly, isEvent);
  const eventTiming = isEvent ? inferEventTiming(ability) : null;
  const pageType = chooses
    ? "pick_and_record"
    : learnsInfo
      ? "record_result_only"
      : isEvent
        ? "event_triggered"
        : isSetupOnly
          ? "rule_modifier"
          : "no_input";

  const abilityData = {
    id: roleData.id,
    englishName: roleData.englishName,
    name: roleData.name,
    schemaVersion: 2,
    generatedFromOfficial: true,
    sourceAbility: makeSourceAbilityData(role, officialRole),
    needsReview,
    reviewReason: needsReview ? "官方能力文本包含复杂结算，需人工确认笔记页记录字段。" : "",
    tags: buildAbilityTags({ ...officialRole, setup: officialRole.setup ?? roleData.setup }, pageType),
    abilityMeta: {
      pageType,
      phaseTiming,
      eventTiming,
      usagePattern,
      activationMode: chooses ? "active" : isEvent ? "conditional" : "passive",
      drivenBy: chooses ? "player" : isSetupOnly ? "system" : "storyteller",
      recordable: pageType !== "no_input" && pageType !== "rule_modifier",
    },
    interactionSchema: { target, result },
  };

  // Conservative clean-up rules (first-night-only / night-star timing, empty recordable, role type filters)
  // and seat filters (存活 / 死亡 / 除你以外) apply to fresh data exactly as they do to the library.
  // The deduction profile is inferred before clean-up, as the importer always did: switching a role without
  // fields to "not recordable" must not drop its world effect (中毒、醉酒…) for the possible-world analyzer.
  const deduction = inferDeductionData(abilityData, role);
  const draft = { ...role, abilityData };
  planCleanup(draft).forEach((step) => step.apply(abilityData));
  applySeatFilters(draft, inferSeatFilters(draft));

  return refreshDerivedAbilityData(abilityData, role, officialRole, needsReview, deduction);
}

module.exports = {
  GENERATED_FIELD_TYPES,
  classifyLearnObject,
  findChoices,
  findLearnObjects,
  hasOnlyGeneratedFields,
  inferEventTiming,
  inferPhaseTiming,
  inferResultFields,
  inferTargetFields,
  inferUsagePattern,
  isOwnAction,
  makeAbilitySemantics,
  makeRoleAbilityData,
  makeSourceAbilityData,
};
