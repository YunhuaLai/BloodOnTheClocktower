import { getGameScript } from "../notes-claims.js";
import { getDayRecord } from "./notes-day-records.js";
import {
  ensureRoleInfoMatchesClaim,
  formatRoleInfoEntrySummary,
  getClaimedRole,
  getRoleInfoEntries,
  getRoleInfoNode,
  isRoleInfoEntryFilled,
} from "./notes-role-info.js";

const dayTimingOrder = {
  day: 10,
  each_day: 20,
  on_nomination: 30,
  on_vote: 40,
  on_execution: 50,
  on_death: 60,
  passive: 80,
  special: 90,
};

function getRoleInfoSubject(player, source) {
  if (source === "storyteller" && player?.trueRole) {
    return {
      ...player,
      claim: player.trueRole,
    };
  }

  return player;
}

function getRoleForRecord(player, game, source) {
  return getClaimedRole(getRoleInfoSubject(player, source), game);
}

function getNightOrderIndex(game, player, role) {
  const script = getGameScript(game);
  const isFirstNight = Number(game.phaseNumber) <= 1 || Boolean(player?.newRoleFirstNight);
  const order = isFirstNight
    ? script?.nightOrder?.first || []
    : script?.nightOrder?.other || [];

  return Array.isArray(order) ? order.indexOf(role?.id) : -1;
}

function getRoleActionOrder(game, player, role, source) {
  const seat = Number(player?.seat) || 99;
  if (game.phaseType === "night") {
    const nightIndex = getNightOrderIndex(game, player, role);
    return (nightIndex >= 0 ? nightIndex : 900) * 100 + seat;
  }

  const meta = role?.abilityData?.abilityMeta || {};
  const timing = meta.eventTiming || meta.phaseTiming || "";
  return (dayTimingOrder[timing] || 900) * 100 + seat + (source === "storyteller" ? 0.5 : 0);
}

function buildAbilityRecordsForPlayer(game, player, source) {
  const role = getRoleForRecord(player, game, source);
  const abilityData = role?.abilityData || null;
  if (!role || !abilityData?.abilityMeta?.recordable) {
    return [];
  }

  const subject = getRoleInfoSubject(player, source);
  const roleInfo = ensureRoleInfoMatchesClaim(subject, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const targetEntries = getRoleInfoEntries(roleInfo, "target");
  const resultEntries = getRoleInfoEntries(roleInfo, "result");
  const rowCount = Math.max(targetEntries.length, resultEntries.length);
  const order = getRoleActionOrder(game, player, role, source);
  const records = [];

  for (let index = 0; index < rowCount; index += 1) {
    const targetEntry = targetEntries[index] || {};
    const resultEntry = resultEntries[index] || {};
    if (!isRoleInfoEntryFilled(targetEntry) && !isRoleInfoEntryFilled(resultEntry)) {
      continue;
    }

    const targetText = formatRoleInfoEntrySummary(targetEntry, targetNode.fields);
    const resultText = formatRoleInfoEntrySummary(resultEntry, resultNode.fields);
    const text = [
      targetText ? `目标 ${targetText}` : "",
      resultText ? `结果 ${resultText}` : "",
    ]
      .filter(Boolean)
      .join(" / ");

    if (!text) {
      continue;
    }

    records.push({
      id: `${source}:${game.phaseType}:${player.id}:${role.id}:${index}`,
      source,
      phaseType: game.phaseType === "night" ? "night" : "day",
      order: order + index / 100,
      playerId: player.id,
      seat: String(player.seat),
      playerName: player.name || "",
      roleId: role.id,
      roleName: role.name,
      rowIndex: index + 1,
      text,
      updatedAt: new Date().toISOString(),
    });
  }

  return records;
}

export function syncAbilityRecordsForPlayer(game, player, source = "player") {
  if (!game || !player) {
    return;
  }

  const record = getDayRecord(game, game.phaseNumber || 1, true);
  const normalizedSource = source === "storyteller" ? "storyteller" : "player";
  const phaseType = game.phaseType === "night" ? "night" : "day";
  const nextRecords = buildAbilityRecordsForPlayer(game, player, normalizedSource);

  record.abilityRecords = [
    ...(record.abilityRecords || []).filter(
      (item) =>
        item.playerId !== player.id ||
        item.source !== normalizedSource ||
        item.phaseType !== phaseType,
    ),
    ...nextRecords,
  ].sort((left, right) => left.order - right.order || Number(left.seat) - Number(right.seat));
}
