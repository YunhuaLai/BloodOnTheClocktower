const {
  ROLES_DIR,
  readYamlCollection,
  writeYamlFile,
} = require("./library-files");

const BAD_ENGLISH_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f-]{20,}[a-z0-9]*$/i,
  /\d/,
  /button$/i,
  /(?:^|-)button$/i,
  /meta/i,
  /zhiminghuaerzi|emoxueyuan|sanshenmiti|chenfengjiuguan|futureking|goldapple|darkage|guiyihuayuan|jinhulun/i,
  /recovery|juedou|coil|(?:^|-)seve(?:-|$)|bbb|zxpy|xqxa|yylm|acup|city-of-illusio/i,
  /xinjide|xitele|wolaishou|sheshe|nzltjm|sihuoshangren|hebusiniyade|mushi|tiejiang/i,
  /youke|chong+|xuncha|dfkas|asdf|shabi|oih|hsih|jsio|suaibi|qiaozhong|saar/i,
  /(?:[a-z])\1{3,}/i,
  /^[a-z]{24,}$/i,
];

const BAD_EXACT_NAMES = new Set([
  "emoxueyuan",
  "recovery",
  "zhiminghuaerzi",
  "juedou",
  "hundun",
  "qiongqi",
  "taowu",
  "baihu",
  "xuanwu",
  "zhuque",
  "youke",
  "shiyizhezhezhezhe",
  "jianghu-renzhe",
]);

const NAME_OVERRIDES = {
  魔术师: "magician",
  异端分子: "heretic",
  恐惧之灵: "fearmonger",
  灯神: "djinn",
  解谜大师: "puzzle-master",
  炸弹人: "boomdandy",
  提线木偶: "marionette",
  主教: "bishop",
  集骨者: "bone-collector",
  官员: "bureaucrat",
  屠夫: "butcher",
  女舍监: "matron",
  哨兵: "sentinel",
  窃贼: "thief",
  替罪羊: "scapegoat",
  乞丐: "beggar",
  法官: "judge",
  流莺: "songbird",
  将军: "general",
  守夜人: "nightwatchman",
  政客: "politician",
  牙噶巴卜: "yaggababble",
  赏金猎人: "bounty-hunter",
  气球驾驶员: "balloonist",
  痢蛭: "lleech",
  异教领袖: "cult-leader",
  革命者: "revolutionary",
  巫毒师: "voodoo-master",
  学徒: "apprentice",
  咖啡师: "barista",
  半兽人: "half-beast",
  炼金术士: "alchemist",
  瘟疫医生: "plague-doctor",
  军团: "legion",
  暴风捕手: "storm-catcher",
  末日预言者: "doomsayer",
  天外来客: "visitor-from-beyond",
  "天外来客♦": "visitor-from-beyond-diamond",
  义务警员: "vigilante",
  "魂命少女★": "soulbound-maiden",
  铁匠: "blacksmith",
  "自然术士★": "naturalist",
  提夫林: "tiefling",
  牧师: "priest",
  "地外生命★": "extraterrestrial",
  殉道者: "martyr",
  隙间: "rift",
  "巫师★": "wizard",
  门之钥: "gate-key",
  次元吸引者: "dimension-magnet",
  学者: "scholar",
  七色鹿: "seven-colored-deer",
  知府: "prefect",
  龙庭侍卫: "dragon-court-guard",
  罗姆人: "romani",
  "巴隆-撒麦迪": "baron-samedi",
  阴阳先生: "yin-yang-master",
  杂技演员: "acrobat",
  逍遥谷: "wandering-valley",
  雾影: "mist-shade",
  学院长: "dean",
  肃清使: "purger",
  死神: "reaper",
  恶魔学院: "demon-academy",
  小恶魔自习室: "imp-study-hall",
  亡骨魔补习班: "zombuul-cram-school",
  诡谋参议院: "scheming-senate",
  暴虐斗技场: "tyrant-arena",
  千变穹顶阁: "everchanging-dome",
  黑冕拜谒堂: "black-crown-hall",
  店小二: "tavern-boy",
  纵横家: "strategist",
  巡察: "inspector",
  史官: "historian",
  御史: "imperial-censor",
  提刑官: "magistrate",
  报丧女妖: "banshee",
  判决者: "adjudicator",
  养蛊人: "gu-keeper",
  铜蛇帮: "copper-serpent-gang",
  典狱长: "warden",
  暴君: "tyrant",
  奸佞: "sycophant",
  平反: "exoneration",
  代罪: "sin-bearer",
  峻刑: "harsh-sentence",
  追猎者: "stalker",
  游歌者: "wandering-singer",
  巫师学徒: "wizard-apprentice",
  疗养师: "sanatorium-keeper",
  马车邮差: "coach-postman",
  史莱姆: "slime",
  忏悔者: "penitent",
  调香师: "perfumer",
  云栖客: "cloud-hermit",
  魔女: "witch",
  蚀疫魔: "plague-eater",
  "狄奥尼索斯：酒神": "dionysus",
  "蛋酒：庆典": "eggnog",
  "公牛子弹：决斗": "silver-bullet",
  "月光蜜酿：烈！": "moonshine",
  "苦艾酒：调制": "absinthe",
  "盘尼西林：解脱": "penicillin",
  别西卜: "beelzebub",
  搭车客: "hitchhiker",
  光明祭典: "festival-of-light",
  伊卡洛斯: "icarus",
  六扇门: "six-gates",
  勘探者: "prospector",
  小说家: "novelist",
  教皇: "pope",
  秉笔: "scribe",
  孟菲斯: "memphis",
  战车: "chariot",
  谜题魔: "riddle-fiend",
  斯芬克斯: "sphinx",
  魔笛手: "pied-piper",
  邪祭司: "dark-priest",
  假面狂欢: "masquerade",
  叫花子: "beggar-king",
  "造谣者※": "gossip-variant",
  鎏金执事: "gilded-butler",
  巫女: "shrine-maiden",
  "暗莺※": "dark-nightingale",
  "舞伴※": "dance-partner",
  "鸩※": "poison-bird",
  "白蔷薇※": "white-rose",
  "酒保※": "bartender",
  限: "limit",
  游宴人: "banqueter",
  派对猫咪: "party-cat",
  古董收藏家: "antique-collector",
  精准杀戮: "precise-kill",
  钦天监: "astronomer-royal",
  书童: "page",
  探险者: "explorer",
  库洛普斯: "cyclops",
  帽子戏法: "hat-trick",
  洗脑师调整: "brainwasher-adjustment",
  村夫调整: "villager-adjustment",
  理发师调整: "barber-adjustment",
  帽匠: "hatter",
  穿越者: "time-traveler",
  狸猫: "tanuki",
  修正者: "corrector",
  拉普拉斯: "laplace",
  时空悖论: "time-paradox",
  天才: "genius",
  戏法师: "trickster",
  雕刻家: "sculptor",
  科学怪人: "frankenstein",
  街头风琴手: "organ-grinder",
  磁感实验员: "magnetist",
  议: "council",
  摆渡人: "ferryman",
  亡命徒: "outlaw",
  使节: "envoy",
  私货商人: "smuggler",
  世界: "world",
  药剂师: "apothecary",
  手相师: "palm-reader",
  无暗者: "shadowless",
  通灵师: "medium",
  治安官: "sheriff",
  暴徒: "rioter",
  冒名客: "impostor",
  原初: "primordial",
  序列之上的污染: "corruption-beyond-order",
  驿使: "courier",
  煞星: "bane-star",
  凶星: "ill-star",
  星月争辉: "star-moon-strife",
  神秘学家: "occultist",
  空中飞人: "trapeze-artist",
  暮光精灵: "twilight-elf",
  亡语师: "death-speaker",
  狂战士: "berserker",
  潜伏者: "lurker",
  心魔: "inner-demon",
  中流柱石: "mainstay",
  利维坦: "leviathan",
  竖琴手: "harpist",
  女家教: "governess",
  改衣匠: "alteration-tailor",
  商人: "merchant",
  邮差: "postman",
  火柴女孩: "match-girl",
  护火贞女: "vestal-flamekeeper",
  逃脱艺术家: "escape-artist",
  阿芙洛狄忒: "aphrodite",
  技能卡结算: "ability-card",
  怪盗: "phantom-thief",
  巫婆: "crone",
  赫拉: "hera",
  奥喇剌: "orara",
  云顶之役: "battle-above-clouds",
  金苹果之战: "golden-apple-war",
  金币的游戏: "coin-game",
  技能商店: "ability-shop",
  收容专家: "containment-specialist",
  名誉监事: "honorary-overseer",
  全员拜访: "open-visitation",
  拜访相克: "visitation-jinx",
  拜访日事件: "visitation-event",
  上帝信徒: "god-believer",
  上帝酒友: "god-drinking-buddy",
  鸩: "poison-bird",
  蛊雕: "gudiao",
  画皮: "painted-skin",
  酿酒师: "brewer",
  饕餮: "taotie",
  宠妃: "favored-consort",
  弗兰肯斯坦: "frankenstein",
  巧匠: "artificer",
  "使节♦": "envoy-diamond",
  "半仙♦": "half-immortal-diamond",
  玩偶: "doll",
  钛金化: "titanium-transmutation",
  和尚: "monk",
  赶尸人: "corpse-driver",
  无常: "wuchang",
  姑获鸟: "guhuoniao",
  回光返照: "last-light",
  马革裹尸: "horsehide-shroud",
  风向标: "weather-vane",
  "呵！长大了！": "grown-up",
  雏菊: "daisy",
  梅花: "plum-blossom",
  水仙: "narcissus",
  水草: "waterweed",
  竹子: "bamboo",
  睡莲: "water-lily",
  狗尾草: "foxtail-grass",
  蓬莱蕉: "monstera",
  堇菜: "violet",
  树蕨: "tree-fern",
  常青树: "evergreen",
  三叶草: "clover",
  银杏: "ginkgo",
  牵牛花: "morning-glory",
  树翁: "tree-elder",
  珊瑚: "coral",
  仙人掌: "cactus",
  落叶: "fallen-leaf",
  椰树: "coconut-palm",
  食人花: "man-eating-flower",
  寄生植株: "parasitic-plant",
  捕蝇草: "venus-flytrap",
  玫瑰: "rose",
  烈阳炽葵: "sunblaze-sunflower",
  荆棘: "bramble",
  树妖: "dryad",
  第一夜: "first-night",
  第二夜: "second-night",
  第三夜: "third-night",
  第四夜: "fourth-night",
  第五夜: "fifth-night",
  第六夜: "sixth-night",
  第七夜: "seventh-night",
  墓园之花: "graveyard-flower",
  顶上之果: "crown-fruit",
  织衣匠: "weaver",
  胆小鬼: "coward",
  代理人: "agent",
  堤丰之首: "lord-of-typhon",
  大守护者: "great-guardian",
  梼杌: "taowu",
  山海之间: "between-mountains-and-seas",
  混沌降世: "hundun-descends",
  穷奇降世: "qiongqi-descends",
  饕餮降世: "taotie-descends",
  白虎庇护: "white-tiger-sanctuary",
  玄武庇护: "black-tortoise-sanctuary",
  朱雀庇护: "vermillion-bird-sanctuary",
  冒险家: "adventurer",
  圣骑士: "paladin",
  地狱犬: "hellhound",
  枪手: "gunslinger",
  黑帮: "gangster",
  刁民: "heckler",
  木偶阴谋论: "marionette-conspiracy",
  灾厄源起: "calamity-origin",
  情动: "stirred-heart",
  喜: "joy",
  怒: "wrath",
  忧: "sorrow",
  思: "longing",
  悲: "grief",
  恐: "fear",
  惊: "shock",
  "“修正”": "correction",
  "“共鸣”": "resonance",
  韦斯莱兄弟: "weasley-brothers",
};

Object.assign(NAME_OVERRIDES, {
  "牙噶巴卜&驱魔人": "yaggababble-exorcist-jinx",
  "召唤师&普卡": "summoner-pukka-jinx",
  变幻之神: "shifting-god",
  "神之谜题：酒鬼规则细节": "riddle-of-god-drunk-rules",
  "神之谜题：村夫": "riddle-of-god-villager",
  "神之谜题：理发师": "riddle-of-god-barber",
  不可思议: "wonder",
  绮月: "silken-moon",
  雅典娜: "athena",
  大嘴巴: "big-mouth",
  小迷雾: "little-mist",
  渗透者: "infiltrator",
  双重人格: "split-personality",
  明修暗度: "feint-and-crossing",
  明修栈道: "open-boardwalk",
  暗度陈仓: "secret-crossing",
  言咒: "spoken-curse",
  刀客: "blade-master",
  无眠者: "sleepless",
  送报童: "newsboy",
  懂王: "know-it-all",
  编剧: "screenwriter",
  猪倌: "swineherd",
  皮影: "shadow-puppet",
  继生王爵: "heir-duke",
  妖猫: "demon-cat",
  "魔像&明修栈道": "golem-open-boardwalk-jinx",
  "魔像&皮影": "golem-shadow-puppet-jinx",
  "懂王&刀客": "know-it-all-blade-master-jinx",
  "猪倌&牙噶巴卜": "swineherd-yaggababble-jinx",
  "继生王爵&牙噶巴卜": "heir-duke-yaggababble-jinx",
  洞幽之耳: "ear-of-hidden-depths",
  游侠: "ranger",
  伴舞女: "dancer",
  艺妓: "geisha",
  暗夜公爵: "duke-of-night",
  车夫: "coachman",
  歌伶: "songstress",
  假面特工: "masked-agent",
  汀镇调整: "ting-town-adjustment",
  小提琴手: "violinist",
  "旅行者·派对猫咪": "traveler-party-cat",
  "*角色得知": "role-learns",
  "*角色选择": "role-chooses",
  "*角色死亡": "role-dies",
  "*角色复活": "role-revives",
  "*状态：中毒醉酒": "status-poisoned-drunk",
  "*状态：暴露": "status-exposed",
  审计员: "auditor",
  幽灵猎人: "ghost-hunter",
  浊瘴: "miasma",
  旅行商人: "bootlegger",
  航天员: "astronaut",
  风水师: "feng-shui-master",
  猎犬饲养员: "hound-keeper",
  宇航员: "cosmonaut",
  打更人: "night-watchman",
  邪教徒: "cultist",
  风之旅人: "wind-traveler",
  航线: "route",
  江湖骗子: "charlatan",
  幽灵: "ghost",
  超新星: "supernova",
  超新星与幽灵: "supernova-and-ghost",
  监管者: "overseer",
  醉面客: "drunken-guest",
  毒涎虫: "venom-slug",
  安德拉斯: "andras",
  勒西弗: "lucifer",
  "食人魔&敲诈犯": "ogre-blackmailer-jinx",
  画家: "painter",
  情报官: "intelligence-officer",
  军医: "combat-medic",
  银匠: "silversmith",
  时空碎片: "time-shard",
  笔仙: "pen-spirit",
  佞舌: "silver-tongue",
  幸福: "happiness",
  绣刃领袖: "embroidered-blade-leader",
  狂戮: "blood-frenzy",
  半巫妖: "half-lich",
  小镇做题家: "town-quizzer",
  小题大做: "much-ado",
  司簿: "bookkeeper",
  档案管理员: "archivist",
  天机阁: "heavenly-pavilion",
  铸佛师: "idol-forger",
  骁勇者: "valiant",
  谛听: "truth-listener",
  怪物专家: "monster-expert",
  大雪怪: "yeti",
  船长: "captain",
  暴民: "mob",
  无题: "untitled",
  毒舞者: "poison-dancer",
  化尸道人: "corpse-taoist",
  指点江山: "kingmaker",
  空间大盗: "space-thief",
  食梦貘: "dream-eater",
  天龙教: "heavenly-dragon-cult",
  "化尸道人&陌客": "corpse-taoist-recluse-jinx",
  "戏子（改）": "actor-variant",
  真心人: "trueheart",
  浪人: "ronin",
  白骑士: "white-knight",
  恶魔遗子: "demon-heir",
  亡灵骑士: "death-knight",
  亚瑟王: "king-arthur",
  塞壬: "siren",
  恶堕: "fallen",
  决斗: "duel",
  响马: "bandit",
  大主教: "archbishop",
  往生者: "afterlife-seeker",
  "哲学家&石像鬼": "philosopher-gargoyle-jinx",
  方士: "ritualist",
  熊孩子: "brat",
  郎中: "folk-doctor",
  鸩: "zhen-bird",
  弗兰肯斯坦: "frankenstein-monster",
  交换生: "exchange-student",
  和尚: "bonze",
  复仇者: "avenger",
  疯狂生长: "mad-growth",
  蛇神使: "serpent-apostle",
  气球驾驶员: "aeronaut",
  瘟疫医生: "pest-doctor",
  "炼金术士▲": "alchemist-variant",
  阴阳先生: "yin-yang-sage",
  魔女: "sorceress",
  "半兽人（古董）": "antique-half-beast",
  "瘟疫医生（古董）": "antique-plague-doctor",
  梼杌: "taowu-fiend",
  忍者: "ninja",
  报童: "paperboy",
});

const TOKEN_OVERRIDES = {
  酒鬼: "drunk",
  食人魔: "ogre",
  驱魔人: "exorcist",
  普卡: "pukka",
  魔像: "golem",
  敲诈犯: "blackmailer",
  哲学家: "philosopher",
  石像鬼: "gargoyle",
  陌客: "recluse",
  间谍: "spy",
  卡扎力: "kazali",
  莽夫: "klutz",
  侍女: "chambermaid",
  数学家: "mathematician",
  疯子: "lunatic",
  魔术师: "magician",
  猎手: "slayer",
  红唇女郎: "scarlet-woman",
  工程师: "engineer",
  食人族: "cannibal",
  调酒师: "bartender",
  清洁工: "cleaner",
  召唤师: "summoner",
  罂粟种植者: "poppy-grower",
  魔仆: "familiar",
  妄想乐园: "delusion-park",
  麻将巫婆: "mahjong-witch",
  毒蛇: "viper",
  科学怪人: "frankenstein",
  引路人: "guide",
  狂热者: "zealot",
  祖母: "grandmother",
  旅店老板: "innkeeper",
  利维坦: "leviathan",
  空中飞人: "trapeze-artist",
};

const CHAR_OVERRIDES = {
  神: "god",
  之: "of",
  谜: "riddle",
  题: "question",
  村: "village",
  夫: "man",
  理: "logic",
  发: "hair",
  师: "master",
  调: "tune",
  整: "adjustment",
  暗: "dark",
  莺: "nightingale",
  舞: "dance",
  伴: "partner",
  白: "white",
  蔷: "briar",
  薇: "rose",
  酒: "wine",
  保: "keeper",
  游: "wandering",
  宴: "feast",
  人: "person",
  派: "party",
  对: "pair",
  猫: "cat",
  咪: "cat",
  古: "old",
  董: "curio",
  收: "collector",
  藏: "hidden",
  家: "keeper",
  精: "precise",
  准: "true",
  杀: "kill",
  戮: "slaughter",
  书: "book",
  童: "page",
  探: "explore",
  险: "danger",
  者: "one",
  库: "vault",
  洛: "lo",
  普: "pu",
  斯: "s",
  帽: "hat",
  子: "child",
  戏: "trick",
  法: "magic",
  穿: "cross",
  越: "beyond",
  狸: "raccoon-dog",
  修: "repair",
  正: "correct",
  拉: "la",
  天: "heaven",
  才: "talent",
  雕: "carve",
  刻: "carve",
  街: "street",
  头: "head",
  风: "wind",
  琴: "organ",
  手: "hand",
  磁: "magnet",
  感: "sense",
  实: "experiment",
  验: "test",
  员: "worker",
  摆: "ferry",
  渡: "crossing",
  亡: "dead",
  命: "fate",
  徒: "follower",
  使: "envoy",
  节: "mission",
  私: "secret",
  货: "goods",
  商: "merchant",
  药: "medicine",
  剂: "potion",
  相: "palm",
  无: "no",
  通: "spirit",
  灵: "spirit",
  治: "law",
  安: "peace",
  官: "officer",
  暴: "violent",
  名: "name",
  客: "guest",
  原: "origin",
  初: "first",
  星: "star",
  秘: "mystic",
  学: "study",
  空: "sky",
  中: "middle",
  飞: "flyer",
  暮: "twilight",
  光: "light",
  精: "spirit",
  亡: "death",
  语: "speech",
  狂: "mad",
  战: "war",
  士: "knight",
  潜: "hidden",
  伏: "lurking",
  心: "heart",
  魔: "demon",
  柱: "pillar",
  石: "stone",
  竖: "harp",
  女: "woman",
  教: "teach",
  改: "alter",
  衣: "clothes",
  匠: "smith",
  邮: "post",
  差: "messenger",
  火: "fire",
  柴: "match",
  护: "protect",
  贞: "virgin",
  逃: "escape",
  脱: "free",
  艺: "art",
  技: "skill",
  能: "ability",
  卡: "card",
  结: "resolve",
  算: "reckoning",
  怪: "strange",
  盗: "thief",
  云: "cloud",
  顶: "summit",
  金: "gold",
  苹: "apple",
  果: "fruit",
  币: "coin",
  店: "shop",
};

function normalizeDisplayName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[「」]/g, "")
    .replace(/（.*?）/g, "")
    .replace(/\s+/g, "");
}

function slugify(value) {
  return String(value || "role")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "role";
}

function stripDecorations(name) {
  return normalizeDisplayName(name)
    .replace(/[★※▲△♦]/g, "")
    .replace(/[“”"]/g, "");
}

function isBadEnglishName(value) {
  const englishName = String(value || "").trim();

  if (!englishName || BAD_EXACT_NAMES.has(englishName)) {
    return true;
  }

  return BAD_ENGLISH_PATTERNS.some((pattern) => pattern.test(englishName));
}

function translateSegment(segment) {
  const normalized = stripDecorations(segment);

  if (NAME_OVERRIDES[segment]) {
    return NAME_OVERRIDES[segment];
  }

  if (NAME_OVERRIDES[normalized]) {
    return NAME_OVERRIDES[normalized];
  }

  const tokens = [];
  let index = 0;
  const phrases = Object.keys(TOKEN_OVERRIDES).sort((left, right) => right.length - left.length);

  while (index < normalized.length) {
    const phrase = phrases.find((candidate) => normalized.startsWith(candidate, index));

    if (phrase) {
      tokens.push(TOKEN_OVERRIDES[phrase]);
      index += phrase.length;
      continue;
    }

    const char = normalized[index];

    if (/[\u4e00-\u9fff]/.test(char)) {
      tokens.push(CHAR_OVERRIDES[char] || "mystery");
    } else if (/[a-z0-9]/i.test(char)) {
      let ascii = "";
      while (index < normalized.length && /[a-z0-9]/i.test(normalized[index])) {
        ascii += normalized[index];
        index += 1;
      }
      tokens.push(ascii);
      continue;
    }

    index += 1;
  }

  return slugify(tokens.join("-"));
}

function generateEnglishName(role) {
  const rawName = String(role.name || "").trim().replace(/\s+/g, "");

  if (!rawName) {
    return "unnamed-role";
  }

  if (NAME_OVERRIDES[rawName]) {
    return NAME_OVERRIDES[rawName];
  }

  const name = normalizeDisplayName(rawName);

  if (NAME_OVERRIDES[name]) {
    return NAME_OVERRIDES[name];
  }

  if (name.includes("&")) {
    return slugify(`${name.split("&").map(translateSegment).join("-")}-jinx`);
  }

  if (name.includes("：")) {
    return slugify(name.split("：").map(translateSegment).join("-"));
  }

  return translateSegment(name);
}

function roleNumber(roleId) {
  const match = String(roleId || "").match(/^r(\d+)$/);
  return match ? Number(match[1]) : 9999;
}

function makeUniqueName(baseName, role, usedNames) {
  let candidate = slugify(baseName);

  if (!usedNames.has(candidate) || usedNames.get(candidate) === role.id) {
    return candidate;
  }

  candidate = `${candidate}-${roleNumber(role.id)}`;
  return candidate;
}

function orderFieldsLikeRole(source, updates) {
  const result = {};

  Object.entries(source).forEach(([key, value]) => {
    result[key] = Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : value;
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = value;
    }
  });

  return result;
}

function shouldCleanRoleEnglishName(role) {
  if (!role.name) {
    return role.englishName !== "unnamed-role";
  }

  return isBadEnglishName(role.englishName);
}

function main() {
  const write = process.argv.includes("--write");
  const roles = readYamlCollection(ROLES_DIR);
  const usedNames = new Map(
    roles
      .filter((entry) => !shouldCleanRoleEnglishName(entry.data))
      .map((entry) => [entry.data.englishName, entry.data.id]),
  );
  const changes = [];

  roles
    .slice()
    .sort((left, right) => roleNumber(left.data.id) - roleNumber(right.data.id))
    .forEach((entry) => {
      const role = entry.data;

      if (!shouldCleanRoleEnglishName(role)) {
        return;
      }

      const englishName = makeUniqueName(generateEnglishName(role), role, usedNames);
      usedNames.set(englishName, role.id);
      changes.push({
        id: role.id,
        name: role.name || "",
        from: role.englishName || "",
        to: englishName,
      });

      if (write) {
        const nextRole = orderFieldsLikeRole(role, { englishName });
        writeYamlFile(entry.filePath, nextRole);
      }
    });

  console.log(`${write ? "Cleaned" : "Checked"} role englishName values.`);
  console.log(`Changes ${write ? "written" : "to write"}: ${changes.length}`);
  changes.forEach((change) => {
    console.log(`${change.id}\t${change.name}\t${change.from || "(empty)"} -> ${change.to}`);
  });

  if (!write && changes.length) {
    console.log("Run with --write to update roles.");
  }
}

main();
