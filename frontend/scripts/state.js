const app = document.querySelector("#app");

const typeLabels = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
  fabled: "传奇角色",
};

const typeDescriptions = {
  townsfolk: "善良阵营的主要信息与功能角色",
  outsider: "善良阵营，但能力常带来负担或干扰",
  minion: "邪恶阵营，负责保护恶魔并制造混乱",
  demon: "邪恶阵营核心，通常决定夜晚死亡",
  fabled: "由说书人使用的特殊规则或配置工具",
};

const notesStorageKey = "botc-game-notes-v1";

const noteAlignmentOptions = [
  { value: "unknown", label: "未知" },
  { value: "good", label: "好" },
  { value: "evil", label: "坏" },
  { value: "suspect", label: "疑" },
];

const noteStatusOptions = [
  { value: "alive", label: "存" },
  { value: "night-dead", label: "夜" },
  { value: "executed", label: "处" },
  { value: "unclear", label: "?" },
];

const noteConditionOptions = [
  { value: "unknown", label: "?" },
  { value: "sober", label: "清" },
  { value: "poisoned", label: "毒" },
  { value: "drunk", label: "醉" },
];

const noteModeOptions = [
  { value: "player", label: "玩家" },
  { value: "storyteller", label: "说书人" },
];

const noteTabOptions = [
  { value: "overview", label: "总览" },
  { value: "players", label: "玩家" },
  { value: "timeline", label: "时间线" },
  { value: "deduction", label: "推理" },
];

const phaseTypeOptions = [
  { value: "day", label: "白天" },
  { value: "night", label: "夜晚" },
];

const timelineTypeOptions = [
  { value: "info", label: "信息" },
  { value: "claim", label: "身份声明" },
  { value: "nomination", label: "提名" },
  { value: "vote", label: "投票" },
  { value: "death", label: "死亡" },
];

const noteTagOptions = [
  { value: "trusted", label: "可信" },
  { value: "suspicious", label: "可疑" },
  { value: "info", label: "信息位" },
  { value: "outsider", label: "外来者候选" },
  { value: "demon", label: "恶魔候选" },
  { value: "minion", label: "爪牙候选" },
  { value: "conflict", label: "说法冲突" },
  { value: "confirmed-dead", label: "已确认死亡" },
];

const oneInOneOutRoleOrder = [
  "steward",
  "knight",
  "high-priestess",
  "village-idiot",
  "snake-charmer",
  "fortune-teller",
  "oracle",
  "fisherman",
  "seamstress",
  "monk",
  "amnesiac",
  "farmer",
  "cannibal",
  "ogre",
  "goon",
  "recluse",
  "drunk",
  "poisoner",
  "harpy",
  "spy",
  "mezepheles",
  "kazali",
  "imp",
  "ojo",
  "fang-gu",
  "spirit-of-ivory",
];

const roleTypeOrder = ["townsfolk", "outsider", "minion", "demon", "fabled"];

const state = {
  activeFilter: "all",
  currentPath: "",
  notes: {
    activeGameId: "",
    games: [],
    loaded: false,
    ui: {
      screen: "home",
      activeTab: "overview",
      selectedPlayerId: "",
      creatingGame: false,
      setupDraft: null,
    },
  },
  rules: [],
  scripts: [],
  roles: [],
  terms: [],
};

const importantAbilityPhrases = [
  "善良方失败",
  "善良方获胜",
  "邪恶方失败",
  "邪恶方获胜",
  "不会死亡",
  "不能死亡",
  "立刻被处决",
  "立即被处决",
  "失去能力",
  "必定为假",
  "不生效",
  "交换角色与阵营",
  "变成恶魔",
  "变成邪恶",
];
