import { state } from "../state.js";

export const acquiredStatusLabels = { pending: "待触发", active: "已获得", ended: "已结束" };
export const acquiredCertaintyLabels = { known: "已知", suspected: "推测", unknown: "未知" };

export function getAcquiredMinimumRows(node) {
  // Recurring schemas reserve several nights in the base panel; each acquired record is one phase.
  return ["sequence", "variable"].includes(node.repeatMode) ? 1 : Math.max(node.defaultRows || 0, 1);
}

export function findAcquiredRole(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  return state.roles.find((role) =>
    !["fabled", "token"].includes(role.type) &&
    [role.id, role.name, role.englishName, role.en].some((name) => String(name || "").trim().toLowerCase() === text),
  ) || null;
}

export function getAcquisitionKind(ownerRole) {
  const role = findAcquiredRole(ownerRole);
  const names = [ownerRole, role?.name, role?.englishName, role?.en].map((name) => String(name || "").toLowerCase());
  if (names.some((name) => ["食人族", "cannibal"].includes(name))) return "cannibal";
  if (names.some((name) => ["小精灵", "pixie"].includes(name))) return "pixie";
  if (names.some((name) => ["哲学家", "philosopher"].includes(name))) return "philosopher";
  return "other";
}

export function acquiredPhaseIndex(type, number) {
  return (Number(number) || 1) * 2 + (type === "day" ? 1 : 0);
}

export function acquiredPhaseLabel(type, number) {
  return `第${number}${type === "day" ? "日" : "夜"}`;
}

export function isAcquiredAbilityActive(ability, game) {
  if (ability.status === "pending") return false;
  const current = acquiredPhaseIndex(game.phaseType, game.phaseNumber);
  const start = acquiredPhaseIndex(ability.startPhaseType, ability.startPhaseNumber);
  const end = ability.endPhaseNumber
    ? acquiredPhaseIndex(ability.endPhaseType, ability.endPhaseNumber)
    : Infinity;
  return current >= start && current < end && (ability.status === "active" || end !== Infinity);
}

export function getAcquiredAbilities(player, source = "player") {
  return (player?.acquiredAbilities || []).filter((ability) => ability.source === source);
}

export function getCurrentAcquiredAbilities(player, game, source = "player") {
  const owner = source === "storyteller" ? player.trueRole : player.claim;
  const ownerId = findAcquiredRole(owner)?.id;
  return getAcquiredAbilities(player, source).filter((ability) =>
    (ability.ownerRole === owner || (ownerId && findAcquiredRole(ability.ownerRole)?.id === ownerId)) &&
    (ability.status === "pending" || isAcquiredAbilityActive(ability, game)),
  );
}

export function getAcquiredAbilitySummary(player, game, source = "player") {
  return getCurrentAcquiredAbilities(player, game, source).map((ability) => {
    const roleName = findAcquiredRole(ability.role)?.name || ability.role || "未知能力";
    const prefix = ability.status === "pending" ? "待获得" : "能力：";
    const uncertainty = source === "player" && ability.certainty !== "known" ? `（${acquiredCertaintyLabels[ability.certainty]}）` : "";
    return `${prefix}${roleName}${uncertainty}`;
  }).join(" / ");
}

export function hasAcquiredRecords(ability) {
  return (ability.records || []).some((record) =>
    [...(record.roleInfo?.targetEntries || []), ...(record.roleInfo?.resultEntries || [])]
      .some((entry) => Object.values(entry || {}).some((value) => String(value ?? "").trim())),
  );
}
