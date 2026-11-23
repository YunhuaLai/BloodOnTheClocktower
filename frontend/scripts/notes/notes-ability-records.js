import { getGameScript } from "../notes-claims.js";
import { getDayRecord } from "./notes-day-records.js";
import { acquiredCertaintyLabels, findAcquiredRole, getAcquiredAbilities } from "./notes-acquired-abilities.js";
import {
  ensureRoleInfoMatchesClaim,
  formatRoleInfoEntrySummary,
  getClaimedRole,
  getRoleInfoNode,
  getRoleInfoRows,
} from "./notes-role-info.js";
import { isPhased } from "./notes-role-info-records.js";

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

// One timeline item per filled row, attached to the phase the row belongs to.
// Rows with an unknown phase (migrated legacy data) are not placed on the timeline.
function buildAbilityRecordsForPlayer(game, player, source, role) {
  const abilityData = role?.abilityData || null;
  if (!role || !abilityData?.abilityMeta?.recordable) {
    return [];
  }

  const subject = getRoleInfoSubject(player, source);
  const roleInfo = ensureRoleInfoMatchesClaim(subject, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");

  return getRoleInfoRows(roleInfo)
    .filter((row) => isPhased(row.phaseType))
    .map((row) => {
      const targetText = formatRoleInfoEntrySummary(row.target, targetNode.fields);
      const resultText = formatRoleInfoEntrySummary(row.result, resultNode.fields);
      const text = [
        targetText ? `目标 ${targetText}` : "",
        resultText ? `结果 ${resultText}` : "",
      ]
        .filter(Boolean)
        .join(" / ");
      if (!text) {
        return null;
      }

      const phaseGame = { ...game, phaseType: row.phaseType, phaseNumber: row.phaseNumber };
      return {
        dayNumber: row.phaseNumber,
        item: {
          id: `${source}:${row.phaseType}:${row.phaseNumber}:${player.id}:${role.id}:${row.entryIndex}`,
          source,
          phaseType: row.phaseType,
          order: getRoleActionOrder(phaseGame, player, role, source) + row.entryIndex / 100,
          playerId: player.id,
          seat: String(player.seat),
          playerName: player.name || "",
          roleId: role.id,
          roleName: role.name,
          rowIndex: row.entryIndex + 1,
          text,
          updatedAt: new Date().toISOString(),
        },
      };
    })
    .filter(Boolean);
}

function sortAbilityRecords(day) {
  day.abilityRecords.sort((left, right) => left.order - right.order || Number(left.seat) - Number(right.seat));
}

export function syncAbilityRecordsForPlayer(game, player, source = "player") {
  if (!game || !player) {
    return;
  }

  const normalizedSource = source === "storyteller" ? "storyteller" : "player";
  const phaseType = game.phaseType === "night" ? "night" : "day";
  const phaseNumber = Number(game.phaseNumber) || 1;
  const role = getRoleForRecord(player, game, normalizedSource);
  const nextRecords = buildAbilityRecordsForPlayer(game, player, normalizedSource, role);

  // Rebuild this player's main-ability items from the phased records. Items of the current role are
  // replaced everywhere (this also removes copies an older version duplicated into later days);
  // items of a previously claimed role are kept as history, except in the current phase.
  for (const day of game.dayRecords || []) {
    day.abilityRecords = (day.abilityRecords || []).filter(
      (item) =>
        item.acquiredAbilityId ||
        item.playerId !== player.id ||
        item.source !== normalizedSource ||
        (!(role && item.roleId === role.id) &&
          !(item.phaseType === phaseType && Number(day.dayNumber) === phaseNumber)),
    );
  }
  nextRecords.forEach(({ dayNumber, item }) => {
    getDayRecord(game, dayNumber, true).abilityRecords.push(item);
  });
  syncAcquiredAbilityRecords(game, player, normalizedSource);
}

function syncAcquiredAbilityRecords(game, player, source) {
  // Rebuild by each action's original phase, including ended abilities.
  for (const day of game.dayRecords || []) {
    day.abilityRecords = (day.abilityRecords || []).filter((item) =>
      !item.acquiredAbilityId || item.playerId !== player.id || item.source !== source,
    );
  }
  for (const ability of getAcquiredAbilities(player, source)) {
    const role = findAcquiredRole(ability.role);
    if (!role) continue;
    for (const action of ability.records || []) {
      const phaseGame = { ...game, phaseType: action.phaseType, phaseNumber: action.phaseNumber };
      const targetFields = getRoleInfoNode(role.abilityData, "target").fields;
      const resultFields = getRoleInfoNode(role.abilityData, "result").fields;
      const targets = action.roleInfo.targetEntries || [];
      const results = action.roleInfo.resultEntries || [];
      for (let index = 0; index < Math.max(targets.length, results.length); index += 1) {
        const target = formatRoleInfoEntrySummary(targets[index], targetFields);
        const result = formatRoleInfoEntrySummary(results[index], resultFields);
        if (!target && !result) continue;
        const day = getDayRecord(game, action.phaseNumber, true);
        const uncertainty = source === "player" && ability.certainty !== "known" ? `（${acquiredCertaintyLabels[ability.certainty]}）` : "";
        day.abilityRecords.push({
          id: `acquired:${source}:${player.id}:${ability.id}:${action.phaseType}:${action.phaseNumber}:${index}`,
          acquiredAbilityId: ability.id, source, phaseType: action.phaseType,
          order: getRoleActionOrder(phaseGame, player, role, source) + index / 100,
          playerId: player.id, seat: String(player.seat), playerName: player.name || "",
          roleId: role.id, roleName: `${ability.ownerRole || "获得能力"} · ${role.name}${uncertainty}`,
          rowIndex: index + 1,
          text: [target ? `目标 ${target}` : "", result ? `结果 ${result}` : ""].filter(Boolean).join(" / "),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
  for (const day of game.dayRecords || []) {
    sortAbilityRecords(day);
  }
}
