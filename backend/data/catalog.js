const SCRIPT_NAMES = {
  "trouble-brewing": "暗流涌动",
  "bad-moon-rising": "黯月初升",
  "sects-and-violets": "梦殒春宵",
};

const ROLE_TYPES = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
};

const TERM_REPLACEMENTS = [
  ["市长", "镇长"],
  ["隐士", "陌客"],
  ["猩红女郎", "红唇女郎"],
];

const ROLE_CORRECTIONS = {
  mayor: {
    name: "镇长",
    summary: "残局能力很强，若善良方能保护其可信度，可能直接改变胜负路径。",
    keywords: "残局 胜利 保护 镇长",
  },
  recluse: {
    name: "陌客",
    summary: "在侦测中可能被视作邪恶身份。它会污染信息，但也能解释异常结果。",
    keywords: "误判 信息污染 外来者 陌客",
  },
  "scarlet-woman": {
    name: "红唇女郎",
    summary: "恶魔死亡后可能接替恶魔位置。让善良方不能只满足于一次处决。",
    keywords: "继承 恶魔 续命 爪牙 红唇女郎",
  },
};

const TERMS = [
  term(
    "day",
    "白天",
    ["白昼", "白天阶段"],
    "流程",
    "玩家公开讨论、提名、投票和处决的主要阶段。",
    [
      "白天是全桌共享信息和制造压力的时间。",
      "提名、辩解、投票、处决通常都在白天完成。",
      "死亡玩家仍然可以发言，但只剩一次有效投票。"
    ],
    [
      "把白天只当作聊天时间，忘记用提名和投票创造信息。",
      "过早结束讨论，导致夜晚信息无法被交叉验证。",
      "死亡玩家忘记自己还能参与发言。"
    ],
    ["night", "nomination", "vote", "execution"],
    ["undertaker", "virgin", "slayer", "saint"]
  ),
  term(
    "night",
    "夜晚",
    ["黑天", "夜里", "夜间", "夜晚阶段", "每晚"],
    "流程",
    "玩家闭眼后由说书人依照夜晚顺序处理角色能力的阶段。",
    [
      "很多角色会在夜晚醒来行动或获得信息。",
      "首夜和其他夜晚的行动顺序可能不同。",
      "夜晚死亡、保护、醉酒、中毒等结果会影响第二天讨论。"
    ],
    [
      "把所有死亡都直接归因于恶魔。",
      "忘记首夜与其他夜晚的行动顺序不同。",
      "没有记录夜晚异常，导致白天无法复盘。"
    ],
    ["first-night", "other-night", "poisoned", "drunk"],
    ["monk", "poisoner", "imp", "chambermaid"]
  ),
  term(
    "first-night",
    "首夜",
    ["第一夜", "首个夜晚"],
    "流程",
    "游戏开始后的第一个夜晚，许多开局信息角色会在此时获得线索。",
    [
      "首夜通常用于确认初始配置、开局信息和邪恶方互认。",
      "开局信息不等于绝对真相，仍可能受到角色效果影响。",
      "说书人需要提前准备好首夜顺序和要给出的信息。"
    ],
    [
      "开局信息一出就直接定死身份。",
      "忘记部分角色只在首夜行动。",
      "说书人临场才决定关键信息，导致局面失衡。"
    ],
    ["night", "information", "drunk", "poisoned"],
    ["washerwoman", "librarian", "investigator", "chef", "clockmaker"]
  ),
  term(
    "other-night",
    "其他夜晚",
    ["后续夜晚", "非首夜"],
    "流程",
    "首夜之后的夜晚，更多持续能力、击杀、保护和信息结算会发生。",
    [
      "许多持续型角色每个其他夜晚都会行动。",
      "恶魔击杀、保护、醉酒、中毒和死亡触发常在此阶段交错。",
      "每天记录夜晚结果能帮助复盘能力链。"
    ],
    [
      "沿用首夜顺序处理后续夜晚。",
      "漏掉死亡触发型角色。",
      "没有区分当晚行动和前一晚遗留效果。"
    ],
    ["night", "death", "protected", "poisoned"],
    ["empath", "fortune-teller", "monk", "ravenkeeper"]
  ),
  term(
    "poisoned",
    "中毒",
    ["投毒", "被毒"],
    "状态",
    "角色能力变得不可靠或不能正常生效的状态，通常由其他角色造成。",
    [
      "中毒玩家一般不知道自己中毒。",
      "中毒会让信息、保护、击杀或其他能力出现异常。",
      "中毒不是说玩家变成邪恶，而是能力层面出了问题。"
    ],
    [
      "看到矛盾信息就把玩家直接打成邪恶。",
      "以为中毒一定会产生明显错误结果。",
      "忘记中毒的时间点会影响哪些能力。"
    ],
    ["drunk", "information", "ability"],
    ["poisoner", "pukka", "no-dashii", "vigormortis"]
  ),
  term(
    "drunk",
    "醉酒",
    ["喝醉", "酒鬼状态"],
    "状态",
    "角色能力不可靠或不能正常生效的状态，常用于制造善良方信息污染。",
    [
      "醉酒和中毒很像，都会让能力不可靠。",
      "醉酒玩家通常仍以为自己的能力正常运作。",
      "醉酒可以来自角色本身，也可以来自其他角色效果。"
    ],
    [
      "把醉酒和角色阵营混为一谈。",
      "认为醉酒信息一定完全相反。",
      "忘记醉酒可能只持续一段时间。"
    ],
    ["poisoned", "information", "ability"],
    ["drunk", "sailor", "innkeeper", "courtier", "minstrel"]
  ),
  term(
    "ability",
    "能力",
    ["角色能力", "技能"],
    "规则",
    "角色在特定时机触发、行动或影响局面的规则文本。",
    [
      "能力可能在首夜、其他夜晚、白天、死亡时或整局持续生效。",
      "能力是否正常生效取决于醉酒、中毒、死亡、保护等状态。",
      "说书人需要按时机和优先级处理能力。"
    ],
    [
      "只看能力强弱，不看触发时机。",
      "忽略能力可能被醉酒或中毒影响。",
      "把能力解释成玩家可以自由选择的所有行为。"
    ],
    ["first-night", "other-night", "drunk", "poisoned"],
    ["philosopher", "mathematician", "pit-hag"]
  ),
  term(
    "information",
    "信息",
    ["情报", "线索"],
    "推理",
    "角色、投票、死亡和发言共同提供的可用于推理的内容。",
    [
      "信息不只来自角色能力，也来自投票、提名、死亡顺序和发言变化。",
      "好信息需要交叉验证，而不是孤立使用。",
      "错误信息也可能反向帮助定位醉酒、中毒或邪恶角色。"
    ],
    [
      "只相信角色给出的数字或是非结果。",
      "把所有矛盾都归因于有人说谎。",
      "没有记录信息来源和时间点。"
    ],
    ["poisoned", "drunk", "red-herring", "storyteller"],
    ["savant", "artist", "dreamer", "washerwoman"]
  ),
  term(
    "nomination",
    "提名",
    ["提人", "发起提名"],
    "白天",
    "白天由玩家发起的处决候选流程，通常会进入辩解和投票。",
    [
      "提名能迫使目标和提名者公开立场。",
      "有些角色会因提名触发能力或风险。",
      "提名本身也是行为信息。"
    ],
    [
      "把提名只当作攻击，不用来测试信息。",
      "害怕提名导致白天没有可分析投票。",
      "忽略谁在关键时刻发起或回避提名。"
    ],
    ["day", "vote", "execution"],
    ["virgin", "witch", "town-crier", "saint"]
  ),
  term(
    "vote",
    "投票",
    ["举手", "票型"],
    "白天",
    "玩家对提名对象是否进入处决进行表态的流程。",
    [
      "投票能展示站边、保护和切割关系。",
      "死亡玩家通常只剩一次有效投票，要谨慎使用。",
      "投票轨迹常常比单次发言更难伪装。"
    ],
    [
      "只看谁说了什么，不看谁投了什么。",
      "死亡玩家过早浪费唯一投票。",
      "忽略恶魔或爪牙可能通过投票伪装善良。"
    ],
    ["nomination", "execution", "dead-vote"],
    ["butler", "flowergirl", "mayor"]
  ),
  term(
    "execution",
    "处决",
    ["公投处死", "白天处死"],
    "白天",
    "白天投票结果造成的死亡方式，是善良方主动推进游戏的重要工具。",
    [
      "处决不只是杀人，也是在验证信息和压缩范围。",
      "某些角色会因处决触发额外结果。",
      "是否处决、处决谁、谁推动处决都是重要线索。"
    ],
    [
      "因为怕错而长期不处决。",
      "把夜晚死亡和白天处决触发混淆。",
      "处决后不复盘投票与发言。"
    ],
    ["day", "vote", "death"],
    ["undertaker", "saint", "virgin", "mastermind"]
  ),
  term(
    "death",
    "死亡",
    ["死了", "阵亡"],
    "状态",
    "玩家死亡后失去大多数行动能力，但通常仍可发言并保留一次有效投票。",
    [
      "死亡不等于出局，死者仍能参与讨论。",
      "死亡来源可能来自恶魔、处决、角色能力或说书人选择。",
      "死亡时间点会影响许多角色能力。"
    ],
    [
      "死亡后就不再参与讨论。",
      "把所有死亡都归因于恶魔。",
      "忘记死亡玩家只剩一次有效投票。"
    ],
    ["alive", "dead-vote", "execution", "night"],
    ["ravenkeeper", "undertaker", "tinker", "moonchild"]
  ),
  term(
    "alive",
    "存活",
    ["活着", "生还"],
    "状态",
    "玩家当前没有死亡，仍可正常参与投票和大多数能力互动。",
    [
      "许多能力只影响存活玩家。",
      "存活人数会影响胜负判断和某些角色结算。",
      "异常存活常常是保护、醉酒、中毒或恶魔类型的线索。"
    ],
    [
      "忽略死亡后相邻关系或目标范围变化。",
      "看到没死人就只归因于保护。",
      "没有关注残局存活人数。"
    ],
    ["death", "protected", "mayor-win"],
    ["soldier", "fool", "zombuul", "mayor"]
  ),
  term(
    "dead-vote",
    "死亡投票",
    ["鬼票", "死票"],
    "投票",
    "死亡玩家通常保留的一次有效投票，是残局里非常关键的资源。",
    [
      "死亡玩家可以继续发言，但有效投票通常只有一次。",
      "死票越到残局越珍贵。",
      "死票使用时机能体现玩家对局面的判断。"
    ],
    [
      "死亡后忘记自己还能投一次。",
      "太早使用死票导致残局缺票。",
      "没有记录哪些死亡玩家已经投过有效票。"
    ],
    ["death", "vote", "execution"],
    ["butler", "saint", "mayor"]
  ),
  term(
    "protected",
    "保护",
    ["免死", "保护效果"],
    "状态",
    "角色或能力让玩家免受某些死亡或负面效果影响。",
    [
      "保护通常有来源、范围和时机限制。",
      "无死亡不一定代表保护成功，也可能是醉酒、中毒或恶魔选择导致。",
      "保护信息需要结合死亡结果和公开身份判断。"
    ],
    [
      "把所有无死亡都归功于保护角色。",
      "忘记保护可能只针对特定死亡来源。",
      "公开保护路线后让邪恶方轻松绕开。"
    ],
    ["night", "death", "drunk", "poisoned"],
    ["monk", "innkeeper", "tea-lady", "soldier"]
  ),
  term(
    "alignment",
    "阵营",
    ["善恶", "阵营归属"],
    "身份",
    "玩家属于善良或邪恶一方，决定其胜利目标。",
    [
      "阵营和角色类型相关，但并非永远不可变化。",
      "有些能力会造成阵营变化或阵营误判。",
      "推理时要区分角色身份、阵营、侦测结果三件事。"
    ],
    [
      "把角色类型等同于绝对阵营。",
      "忽略转阵营或侦测误判。",
      "只凭一个角色名判断玩家目标。"
    ],
    ["good", "evil", "townsfolk", "outsider", "minion", "demon"],
    ["goon", "snake-charmer", "fang-gu", "evil-twin"]
  ),
  term(
    "good",
    "善良",
    ["好人", "善良阵营"],
    "阵营",
    "通常以找出并处决恶魔为目标的阵营。",
    [
      "善良玩家不一定都拥有正面能力，外来者也属于善良阵营。",
      "善良方需要整合信息、发言和投票，而不是各自为战。",
      "善良阵营也可能因为醉酒、中毒或误判提供错误信息。"
    ],
    [
      "认为所有善良角色都应该给正确信息。",
      "忽视外来者也有善良胜利目标。",
      "善良方互相不共享关键推理。"
    ],
    ["alignment", "townsfolk", "outsider", "evil"],
    ["washerwoman", "saint", "drunk"]
  ),
  term(
    "evil",
    "邪恶",
    ["坏人", "邪恶阵营"],
    "阵营",
    "通常以保护恶魔、误导善良方并活到胜利条件为目标的阵营。",
    [
      "邪恶方通常知道更多初始信息，但人数更少。",
      "爪牙要帮助恶魔建立可信伪装。",
      "邪恶方也可以通过牺牲、切割和假信息获得空间。"
    ],
    [
      "邪恶方只被动隐藏，不主动构造故事。",
      "爪牙只顾自己活，不帮恶魔。",
      "善良方认为邪恶玩家一定会投票一致。"
    ],
    ["alignment", "minion", "demon", "good"],
    ["spy", "baron", "imp", "vortox"]
  ),
  term(
    "townsfolk",
    "镇民",
    ["镇民角色"],
    "角色类型",
    "善良阵营的主要功能角色，通常提供信息、保护、击杀或残局能力。",
    [
      "镇民能力通常对善良方有帮助。",
      "镇民也可能醉酒、中毒或被其他机制影响。",
      "镇民身份可信度需要靠信息和行为建立。"
    ],
    [
      "镇民一跳身份就被全桌无条件相信。",
      "忽略镇民能力可能失效。",
      "只保护强信息位，忽略残局角色。"
    ],
    ["good", "ability", "information"],
    ["washerwoman", "fortune-teller", "mayor"]
  ),
  term(
    "outsider",
    "外来者",
    ["外来者角色"],
    "角色类型",
    "善良阵营中带有负担、风险或信息干扰的角色类型。",
    [
      "外来者属于善良阵营，但能力常常给善良方制造麻烦。",
      "外来者数量会影响配置判断。",
      "邪恶方常利用外来者身份解释异常。"
    ],
    [
      "把外来者当作不可信或不重要。",
      "只看外来者声明，不看配置数量。",
      "忘记外来者也需要参与推理和投票。"
    ],
    ["good", "drunk", "alignment"],
    ["librarian", "drunk", "recluse", "mutant"]
  ),
  term(
    "minion",
    "爪牙",
    ["爪牙角色"],
    "角色类型",
    "邪恶阵营的辅助角色，负责制造混乱、保护恶魔和扰乱信息。",
    [
      "爪牙通常知道恶魔是谁，并围绕恶魔胜利行动。",
      "爪牙能力常制造错误信息、额外死亡或社交压力。",
      "爪牙可以通过牺牲自己换取恶魔更安全。"
    ],
    [
      "爪牙只追求自己不被处决。",
      "善良方忽略爪牙能力导致的信息污染。",
      "把所有异常都归到恶魔身上，漏掉爪牙。"
    ],
    ["evil", "demon", "poisoned"],
    ["poisoner", "spy", "witch", "mastermind"]
  ),
  term(
    "demon",
    "恶魔",
    ["恶魔角色"],
    "角色类型",
    "邪恶阵营核心，通常负责夜晚死亡，也是善良方最主要的处决目标。",
    [
      "大多数剧本里处决恶魔是善良方核心胜利路线。",
      "不同恶魔会改变死亡节奏、信息可靠性和残局判断。",
      "恶魔可能被接替、转移或伪装成其他身份。"
    ],
    [
      "只按死亡数量判断恶魔类型。",
      "处决疑似恶魔后停止推理。",
      "忽略恶魔可能转移或被爪牙保护。"
    ],
    ["evil", "minion", "death", "night"],
    ["imp", "zombuul", "fang-gu", "vortox"]
  ),
  term(
    "storyteller",
    "说书人",
    ["主持", "主持人", "ST"],
    "规则",
    "主持游戏、结算能力、发放信息并维护游戏体验的人。",
    [
      "说书人不是阵营玩家，目标是让游戏公平、有张力、可复盘。",
      "说书人需要处理夜晚顺序、信息给法、死亡和胜负判断。",
      "很多模糊情况需要说书人根据规则和体验做选择。"
    ],
    [
      "把说书人当作善良方或邪恶方队友。",
      "说书人给信息只追求迷惑，而不考虑可推理性。",
      "玩家忘记向说书人确认规则细节。"
    ],
    ["grimoire", "information", "ability"],
    []
  ),
  term(
    "grimoire",
    "魔典",
    ["说书人面板", "魔法书"],
    "工具",
    "说书人用于记录角色、状态、提示标记和夜晚信息的核心工具。",
    [
      "魔典记录角色身份、阵营、死亡、中毒、醉酒等状态。",
      "说书人依靠魔典维护夜晚顺序和信息一致性。",
      "玩家通常不能查看魔典，少数角色例外。"
    ],
    [
      "说书人不及时更新状态标记。",
      "忘记记录一次性能力是否已使用。",
      "让玩家看到不该公开的信息。"
    ],
    ["storyteller", "poisoned", "drunk", "death"],
    ["spy"]
  ),
  term(
    "red-herring",
    "干扰项",
    ["红鲱鱼", "误导目标"],
    "推理",
    "某些能力中用于制造误导的特殊目标或结果。",
    [
      "干扰项能让善良信息出现合理偏差。",
      "它不是随机捣乱，而是剧本设计的一部分。",
      "识别干扰项需要结合多晚信息和全局行为。"
    ],
    [
      "把干扰项当成说书人随意欺骗。",
      "一次命中就直接处决候选人。",
      "忽略干扰项也可能帮助解释矛盾信息。"
    ],
    ["information", "poisoned", "drunk"],
    ["fortune-teller"]
  ),
  term(
    "madness",
    "疯狂",
    ["疯狂机制", "装作"],
    "社交机制",
    "玩家被要求努力让他人相信某件事，否则可能承担后果的机制。",
    [
      "疯狂关注的是玩家是否真诚努力表现，而不只是说了哪句话。",
      "疯狂常和身份宣称、处决风险、信息混乱有关。",
      "说书人要判断玩家是否在认真维持疯狂。"
    ],
    [
      "把疯狂理解成不能说某个词。",
      "玩家机械重复一句话，缺少真实说服行为。",
      "说书人用疯狂惩罚玩家的正常推理空间。"
    ],
    ["execution", "storyteller", "ability"],
    ["mutant", "cerenovus"]
  ),
  term(
    "traveler",
    "旅行者",
    ["旅行者角色"],
    "角色类型",
    "适合中途加入或离开的特殊角色类型，规则上和普通角色有所不同。",
    [
      "旅行者可以用于处理玩家临时加入或离场。",
      "旅行者阵营通常公开或更容易被处理。",
      "是否使用旅行者取决于局面和说书人安排。"
    ],
    [
      "把旅行者当作普通角色完全同等处理。",
      "没有提前说明旅行者阵营和放逐规则。",
      "用旅行者打乱新手局节奏。"
    ],
    ["alignment", "storyteller", "exile"],
    []
  ),
  term(
    "exile",
    "放逐",
    ["驱逐旅行者"],
    "流程",
    "针对旅行者的特殊移除流程，不等同于普通处决。",
    [
      "放逐主要用于处理旅行者。",
      "放逐和处决在触发能力上通常不是一回事。",
      "进行放逐前应让全桌清楚它与处决的区别。"
    ],
    [
      "把放逐误当成处决触发。",
      "没有说明为什么要放逐旅行者。",
      "把旅行者死亡、放逐和普通处决混在一起记录。"
    ],
    ["traveler", "execution", "day"],
    []
  ),
  term(
    "mayor-win",
    "镇长胜利",
    ["镇长结算", "镇长残局"],
    "胜负",
    "与镇长相关的特殊胜利路径，需要说书人准确判断残局条件。",
    [
      "镇长相关胜利通常发生在特定残局条件下。",
      "镇长是否可信会影响善良方是否愿意走这条路线。",
      "邪恶方通常需要在残局前处理镇长威胁。"
    ],
    [
      "把镇长当作普通无信息镇民。",
      "残局前没有确认存活人数和胜负条件。",
      "所有夜晚异常都强行解释为镇长效果。"
    ],
    ["alive", "demon", "good"],
    ["mayor", "monk", "soldier", "imp"]
  )
];

const ADDITIONAL_ROLES = [
  role("slayer", "猎手", "townsfolk", "trouble-brewing", "可在白天尝试射杀一名玩家；若命中恶魔，能直接造成巨大突破。", "白天 击杀 恶魔 一次性"),

  role("grandmother", "祖母", "townsfolk", "bad-moon-rising", "开局知道一名善良玩家及其角色；如果该玩家被恶魔杀死，祖母也会一同死亡。", "开局 信息 连死 恶魔"),
  role("sailor", "水手", "townsfolk", "bad-moon-rising", "夜晚与一名玩家饮酒，可能让一方醉酒；自身很难死亡。", "醉酒 生存 夜晚"),
  role("chambermaid", "侍女", "townsfolk", "bad-moon-rising", "每晚检查两名存活玩家，得知其中有几人因自身能力被唤醒。", "每晚 唤醒 数字 信息"),
  role("exorcist", "驱魔人", "townsfolk", "bad-moon-rising", "每晚选择一名玩家；若选中恶魔，可阻止其当晚行动并得知自己被选中。", "阻止 恶魔 夜晚"),
  role("innkeeper", "旅店老板", "townsfolk", "bad-moon-rising", "每晚保护两名玩家免死，但其中一人会醉酒。", "保护 醉酒 夜晚"),
  role("gambler", "赌徒", "townsfolk", "bad-moon-rising", "每晚猜一名玩家的角色；猜错会让自己死亡。", "猜测 风险 死亡 信息"),
  role("gossip", "造谣者", "townsfolk", "bad-moon-rising", "白天发表一条公开声明；若为真，夜晚可能额外死亡一名玩家。", "公开 声明 死亡 信息"),
  role("courtier", "侍臣", "townsfolk", "bad-moon-rising", "一次性选择一个角色，使该角色相关玩家醉酒一段时间。", "醉酒 角色 牵制 一次性"),
  role("professor", "教授", "townsfolk", "bad-moon-rising", "一次性尝试复活一名死亡镇民，是强力但需要时机的资源。", "复活 镇民 一次性"),
  role("minstrel", "吟游诗人", "townsfolk", "bad-moon-rising", "爪牙被处决后，可能让所有其他玩家暂时醉酒。", "处决 爪牙 醉酒"),
  role("tea-lady", "茶艺师", "townsfolk", "bad-moon-rising", "若左右相邻存活玩家都为善良，他们可能受到死亡保护。", "邻座 保护 善良"),
  role("pacifist", "和平主义者", "townsfolk", "bad-moon-rising", "善良玩家被处决时，可能不会死亡。", "处决 保护 善良"),
  role("fool", "弄臣", "townsfolk", "bad-moon-rising", "第一次将要死亡时可能不会死亡，能在关键时刻吸收一次风险。", "免死 生存 一次性"),
  role("tinker", "修补匠", "outsider", "bad-moon-rising", "可能在任意时机突然死亡，给死亡来源推理增加噪音。", "随机 死亡 外来者"),
  role("moonchild", "月之子", "outsider", "bad-moon-rising", "死亡后选择一名玩家；若选中善良玩家，可能导致对方死亡。", "死亡 选择 善良 风险"),
  role("goon", "莽夫", "outsider", "bad-moon-rising", "第一个影响他的玩家可能醉酒，且莽夫可能改变阵营。", "醉酒 转阵营 目标"),
  role("lunatic", "疯子", "outsider", "bad-moon-rising", "以为自己是恶魔，并会得到误导性的恶魔体验。", "误导 恶魔 外来者"),
  role("godfather", "教父", "minion", "bad-moon-rising", "知道外来者情况；外来者死亡后可制造额外击杀。", "外来者 击杀 爪牙"),
  role("devils-advocate", "魔鬼代言人", "minion", "bad-moon-rising", "每晚保护一名玩家免于被处决死亡。", "保护 处决 爪牙"),
  role("assassin", "刺客", "minion", "bad-moon-rising", "一次性在夜晚杀死一名玩家，即使目标通常不会死亡。", "击杀 一次性 爪牙"),
  role("mastermind", "主谋", "minion", "bad-moon-rising", "恶魔被处决后可能延长游戏一天，让邪恶方获得最后反打。", "续局 恶魔 处决"),
  role("zombuul", "僵怖", "demon", "bad-moon-rising", "第一次死亡后可能看似死亡但继续作为恶魔行动。", "假死 恶魔 生存"),
  role("pukka", "普卡", "demon", "bad-moon-rising", "通过中毒和延迟死亡制造节奏差，让死亡结果更难判断。", "中毒 延迟死亡 恶魔"),
  role("shabaloth", "沙巴洛斯", "demon", "bad-moon-rising", "每晚可造成多名玩家死亡，也可能让死者复活。", "多杀 复活 恶魔"),
  role("po", "珀", "demon", "bad-moon-rising", "可以蓄力跳过击杀，随后在下一晚造成大量死亡。", "蓄力 多杀 恶魔"),

  role("clockmaker", "钟表匠", "townsfolk", "sects-and-violets", "开局得知恶魔与最近爪牙之间的距离。", "开局 距离 邪恶"),
  role("dreamer", "筑梦师", "townsfolk", "sects-and-violets", "每晚查看一名玩家，得到一个善良身份和一个邪恶身份作为候选。", "每晚 身份 二选一"),
  role("snake-charmer", "舞蛇人", "townsfolk", "sects-and-violets", "每晚选择一名玩家；若选中恶魔，可能与恶魔交换身份和阵营。", "交换 恶魔 夜晚"),
  role("mathematician", "数学家", "townsfolk", "sects-and-violets", "每晚得知有多少角色能力未正常生效。", "每晚 数字 异常"),
  role("flowergirl", "卖花女孩", "townsfolk", "sects-and-violets", "得知白天是否有恶魔参与投票。", "投票 恶魔 信息"),
  role("town-crier", "城镇公告员", "townsfolk", "sects-and-violets", "得知白天是否有爪牙发起过提名。", "提名 爪牙 信息"),
  role("oracle", "神谕者", "townsfolk", "sects-and-violets", "每晚得知死亡玩家中有多少人为邪恶。", "死亡 邪恶 数字"),
  role("savant", "博学者", "townsfolk", "sects-and-violets", "每天得到两条信息，其中一条为真、一条为假。", "每日 信息 真话 假话"),
  role("seamstress", "女裁缝", "townsfolk", "sects-and-violets", "一次性判断两名玩家是否同阵营。", "阵营 一次性 信息"),
  role("philosopher", "哲学家", "townsfolk", "sects-and-violets", "一次性选择获得另一个善良角色能力，并可能让原角色醉酒。", "能力复制 醉酒 一次性"),
  role("artist", "艺术家", "townsfolk", "sects-and-violets", "一次性向说书人提出一个是非问题并得到回答。", "是非问题 一次性 信息"),
  role("juggler", "杂耍艺人", "townsfolk", "sects-and-violets", "白天猜测玩家身份，并在夜晚得知猜对数量。", "猜测 身份 数字"),
  role("sage", "贤者", "townsfolk", "sects-and-violets", "若被恶魔杀死，得知两名玩家中有一名是杀死自己的恶魔。", "死亡 恶魔 二选一"),
  role("mutant", "畸形秀演员", "outsider", "sects-and-violets", "若表现得像外来者，可能被处决；需要处理疯狂机制压力。", "疯狂 外来者 处决"),
  role("sweetheart", "心上人", "outsider", "sects-and-violets", "死亡后会让一名玩家醉酒。", "死亡 醉酒 外来者"),
  role("barber", "理发师", "outsider", "sects-and-violets", "死亡后恶魔可能交换两名玩家的角色。", "死亡 交换 角色"),
  role("klutz", "呆瓜", "outsider", "sects-and-violets", "死亡后必须选择一名存活玩家；若选中邪恶玩家会导致善良方失败。", "死亡 选择 风险"),
  role("evil-twin", "镜像双子", "minion", "sects-and-violets", "与一名善良玩家互为双子，若善良双子被处决可能导致善良方失败。", "双子 处决 爪牙"),
  role("witch", "女巫", "minion", "sects-and-violets", "每晚诅咒一名玩家；若其白天提名，可能死亡。", "诅咒 提名 死亡"),
  role("cerenovus", "洗脑师", "minion", "sects-and-violets", "让玩家疯狂地宣称自己是某个身份，否则可能被处决。", "疯狂 宣称 爪牙"),
  role("pit-hag", "麻脸巫婆", "minion", "sects-and-violets", "每晚改变一名玩家的角色，能重塑整局结构。", "换角色 变形 爪牙"),
  role("fang-gu", "方古", "demon", "sects-and-violets", "攻击外来者时可能转移恶魔身份并改变对方阵营。", "转移 外来者 恶魔"),
  role("vigormortis", "亡骨魔", "demon", "sects-and-violets", "杀死爪牙后可让其能力继续运作，但会污染附近镇民。", "爪牙 中毒 恶魔"),
  role("no-dashii", "诺-达鲺", "demon", "sects-and-violets", "让相邻镇民中毒，制造稳定且隐蔽的信息污染。", "中毒 邻座 恶魔"),
  role("vortox", "涡流", "demon", "sects-and-violets", "让善良玩家获得的信息系统性错误，迫使全桌反向解读。", "错误信息 恶魔 混乱")
];

function role(id, name, type, scriptId, summary, keywords) {
  return {
    id,
    name,
    type,
    script: SCRIPT_NAMES[scriptId],
    scriptId,
    summary,
    keywords,
  };
}

function term(
  id,
  name,
  aliases,
  category,
  summary,
  howItWorks,
  commonMistakes,
  relatedTermIds,
  relatedRoleIds,
) {
  return {
    id,
    name,
    aliases,
    category,
    summary,
    detail: {
      overview: summary,
      howItWorks,
      commonMistakes,
      examples: relatedRoleIds.length
        ? ["可以在关联角色的详情页里看到这个关键词如何影响实际局面。"]
        : ["这是通用规则词，适合先理解概念，再结合具体角色查看。"],
    },
    relatedTermIds,
    relatedRoleIds,
  };
}

function replaceTerms(value) {
  if (typeof value === "string") {
    return TERM_REPLACEMENTS.reduce(
      (result, [from, to]) => result.replaceAll(from, to),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map(replaceTerms);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, replaceTerms(nestedValue)]),
    );
  }

  return value;
}

function makeDetail(roleData) {
  const typeLabel = ROLE_TYPES[roleData.type] || "角色";
  const typeTips = {
    townsfolk: [
      "先判断这条信息或能力适合公开、半公开还是暂时保留。",
      "把能力结果和投票、死亡、提名轨迹合在一起看，不要只靠单点结论。",
      "如果结果与全局冲突，优先考虑醉酒、中毒、伪装或剧本机制。"
    ],
    outsider: [
      "尽早想清楚公开身份会帮善良方排配置，还是会给邪恶方借口。",
      "你的负面能力本身也是线索，别因为角色有副作用就退出讨论。",
      "在残局前说明自己的风险点，避免全桌临时处理导致误判。"
    ],
    minion: [
      "你的任务不是单纯自保，而是给恶魔争取时间和可信伪装。",
      "围绕自己的能力准备一套能解释异常信息的故事。",
      "必要时可以牺牲自己，换取恶魔身份更安全或善良方判断失焦。"
    ],
    demon: [
      "击杀或转移目标要服务于长期伪装，而不是只清掉最显眼的威胁。",
      "主动设计一个能解释死亡、信息异常和投票行为的身份故事。",
      "残局前要确认哪些玩家会阻碍胜利路线，优先处理他们。"
    ],
  };

  const storytellerTips = {
    townsfolk: [
      "让这个角色的信息能够参与推理，而不是直接替玩家给出答案。",
      "若涉及醉酒或中毒，确保错误结果仍有复盘价值。",
      "新手局可以让能力结果更清楚，帮助玩家理解剧本节奏。"
    ],
    outsider: [
      "外来者应制造有趣负担，而不是让玩家完全没有参与感。",
      "处理死亡、醉酒、疯狂或阵营变化时，要及时记录状态。",
      "让外来者信息能与配置、跳身份和邪恶伪装产生联系。"
    ],
    minion: [
      "爪牙能力应给邪恶方创造空间，同时保留善良方可推理的痕迹。",
      "注意能力触发时机，避免漏结算造成局面无法解释。",
      "新手局可以让爪牙效果更集中，方便复盘。"
    ],
    demon: [
      "恶魔能力决定整局节奏，要保证死亡和信息污染路径自洽。",
      "给邪恶方足够伪装空间，也给善良方足够追查线索。",
      "复杂恶魔需要提前理清夜晚顺序和异常结算。"
    ],
  };

  return {
    overview: `${roleData.name}是《${roleData.script}》中的${typeLabel}。${roleData.summary}`,
    abilitySummary: roleData.summary,
    playTips: typeTips[roleData.type] || typeTips.townsfolk,
    storytellerTips: storytellerTips[roleData.type] || storytellerTips.townsfolk,
    commonMistakes: [
      "只看角色能力文本，不结合当前剧本和人数配置。",
      "把一次结果当作绝对结论，忽略信息污染或伪装空间。",
      "没有记录关键时间点，导致后续复盘断线。"
    ],
    relatedRoleIds: [],
  };
}

function normalizeRole(rawRole) {
  const corrected = replaceTerms({
    ...rawRole,
    ...(ROLE_CORRECTIONS[rawRole.id] || {}),
  });

  const normalized = {
    ...corrected,
    scriptId: corrected.scriptId || "trouble-brewing",
  };

  if (!normalized.detail) {
    normalized.detail = makeDetail(normalized);
  }

  normalized.detail = {
    ...makeDetail(normalized),
    ...replaceTerms(normalized.detail),
    relatedRoleIds: normalized.detail.relatedRoleIds || [],
  };

  return normalized;
}

function augmentEncyclopedia(data) {
  const existingRoles = (data.roles || []).map(normalizeRole);
  const byId = new Map(existingRoles.map((item) => [item.id, item]));

  ADDITIONAL_ROLES.map(normalizeRole).forEach((item) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });

  return {
    ...data,
    roles: Array.from(byId.values()),
    terms: TERMS,
  };
}

module.exports = {
  augmentEncyclopedia,
};
