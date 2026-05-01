import { getClaimRoleOptions, getGameScript } from "../notes-claims.js";
import { clearPlayerDraft, createDefaultStorytellerState, createEmptyRoleInfo, getActiveGame, saveNotesState } from "../notes-state.js";
import { roleTypeOrder, state, typeLabels } from "../state.js";
import { createId } from "../utils.js";
import { formatPhaseLabel, getStandardSetup } from "./notes-core.js";
import { normalizeRoleName } from "./notes-role-info.js";
import { renderNotesPage } from "./notes-shell.js";

// Split from notes-actions.js. Keep script order in index.html.

export function getRoleAlignmentValue(role) {
  if (["townsfolk", "outsider"].includes(role?.type)) {
    return "good";
  }

  if (["minion", "demon"].includes(role?.type)) {
    return "evil";
  }

  return "unknown";
}

export function getRoleByLooseName(value, game = getActiveGame()) {
  const normalizedValue = normalizeRoleName(value);
  if (!normalizedValue) {
    return null;
  }

  const roleOptions = game ? getClaimRoleOptions(game) : state.roles;
  const matchesRole = (role) =>
    [role.name, role.en, role.id, role.englishName].some(
      (name) => normalizeRoleName(name) === normalizedValue,
    );

  return roleOptions.find(matchesRole) || state.roles.find(matchesRole) || null;
}

export function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function takeRandomRoles(roles, count) {
  return shuffleItems(roles).slice(0, count);
}

export function getScriptRolesByType(game) {
  const roles = getClaimRoleOptions(game).filter((role) => role.type !== "fabled");
  return roleTypeOrder.reduce((result, type) => {
    result[type] = roles.filter((role) => role.type === type);
    return result;
  }, {});
}

export function assignRandomStorytellerRoles() {
  const game = getActiveGame();
  const script = getGameScript(game);
  if (!game || !script) {
    window.alert("先选择剧本，再随机分配身份。");
    return;
  }

  const config = getStandardSetup(game.playerCount);
  const rolesByType = getScriptRolesByType(game);
  const missingType = ["townsfolk", "outsider", "minion", "demon"].find(
    (type) => rolesByType[type].length < config[type],
  );

  if (missingType) {
    window.alert(`《${script.name}》的${typeLabels[missingType]}数量不足，无法按 ${game.playerCount} 人配置随机。`);
    return;
  }

  const selectedRoles = [
    ...takeRandomRoles(rolesByType.townsfolk, config.townsfolk),
    ...takeRandomRoles(rolesByType.outsider, config.outsider),
    ...takeRandomRoles(rolesByType.minion, config.minion),
    ...takeRandomRoles(rolesByType.demon, config.demon),
  ];
  const shuffledRoles = shuffleItems(selectedRoles);

  game.players.forEach((player, index) => {
    const role = shuffledRoles[index];
    clearPlayerDraft(player.id);
    player.trueRole = role?.name || "";
    player.trueAlignment = getRoleAlignmentValue(role);
    player.status = "alive";
    player.condition = "unknown";
    player.claim = "";
    player.alignment = "unknown";
    player.storytellerNotes = "";
    player.roleInfo = createEmptyRoleInfo();
    player.newRoleFirstNight = false;
  });

  const selectedRoleIds = new Set(selectedRoles.map((role) => role.id));
  const bluffRoles = shuffleItems(
    getClaimRoleOptions(game).filter(
      (role) => role.type !== "fabled" && !selectedRoleIds.has(role.id),
    ),
  ).slice(0, 3);

  game.storyteller = {
    ...createDefaultStorytellerState(),
    ...(game.storyteller || {}),
    bluffs: bluffRoles.map((role) => role.name),
  };
  game.timeline.unshift({
    id: createId("note"),
    type: "info",
    phase: formatPhaseLabel(game.phaseType, game.phaseNumber),
    text: `说书人随机分配了 ${game.playerCount} 个身份。`,
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
  renderNotesPage();
}

export function clearStorytellerAssignments() {
  const game = getActiveGame();
  if (!game || !window.confirm("清空真实身份、真实阵营和恶魔伪装？")) {
    return;
  }

  game.players.forEach((player) => {
    clearPlayerDraft(player.id);
    player.trueRole = "";
    player.trueAlignment = "unknown";
    player.storytellerNotes = "";
    player.newRoleFirstNight = false;
  });
  game.storyteller = {
    ...createDefaultStorytellerState(),
    ...(game.storyteller || {}),
    bluffs: [],
  };
  saveNotesState();
  renderNotesPage();
}
