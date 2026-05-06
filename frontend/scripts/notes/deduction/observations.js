import { normalizeMatchText } from "../../notes-claims.js";
import { getDraftOrPlayer } from "../../notes-state.js";
import { state } from "../../state.js";
import { getClaimedRole } from "../notes-role-info.js";

const yesValues = new Set(["yes", "true", "1", "是", "有", "命中"]);
const noValues = new Set(["no", "false", "0", "否", "无", "没有", "未命中"]);

export function getAnalysisPlayers(game) {
  return game.players.map((player) => getDraftOrPlayer(player));
}

export function getRoleByName(name) {
  const query = normalizeMatchText(name);
  if (!query) {
    return null;
  }

  return (
    state.roles.find((role) =>
      [role.name, role.en, role.englishName, role.id].some(
        (value) => normalizeMatchText(value) === query,
      ),
    ) || null
  );
}

export function getPlayerRole(player, game) {
  return getClaimedRole(player, game) || getRoleByName(player?.claim);
}

export function getPlayerBySeat(players, seat) {
  return players.find((player) => Number(player.seat) === Number(seat)) || null;
}

export function normalizeSeat(value, playerCount) {
  const seat = Number.parseInt(value, 10);
  if (!Number.isFinite(seat) || seat < 1 || seat > playerCount) {
    return 0;
  }

  return seat;
}

export function describeSeats(seats) {
  return seats.map((seat) => `${seat}号`).join("、");
}

function getRows(player) {
  const targetEntries = Array.isArray(player.roleInfo?.targetEntries)
    ? player.roleInfo.targetEntries
    : [];
  const resultEntries = Array.isArray(player.roleInfo?.resultEntries)
    ? player.roleInfo.resultEntries
    : [];
  const rowCount = Math.max(targetEntries.length, resultEntries.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    target: targetEntries[index] || {},
    result: resultEntries[index] || {},
    index,
  }));
}

function hasRecordedValue(row) {
  return [...Object.values(row.target || {}), ...Object.values(row.result || {})].some(
    (value) => String(value ?? "").trim(),
  );
}

function firstValue(entry, keys) {
  for (const key of keys) {
    const value = entry?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function numberValue(entry, keys) {
  const value = firstValue(entry, keys);
  if (value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(entry, keys) {
  const value = normalizeMatchText(firstValue(entry, keys));
  if (!value) {
    return null;
  }

  if (yesValues.has(value)) {
    return true;
  }

  if (noValues.has(value)) {
    return false;
  }

  return null;
}

function uniqueSeats(values, playerCount) {
  return [...new Set(values.map((value) => normalizeSeat(value, playerCount)).filter(Boolean))];
}

function aliveNeighborSeats(players, seat, playerCount) {
  const currentSeat = normalizeSeat(seat, playerCount);
  if (!currentSeat) {
    return [];
  }

  const aliveSeats = new Set(
    players
      .filter((player) => player.status === "alive" || Number(player.seat) === currentSeat)
      .map((player) => Number(player.seat)),
  );
  const result = [];

  for (let offset = 1; offset < playerCount; offset += 1) {
    const left = ((currentSeat - offset - 1 + playerCount) % playerCount) + 1;
    if (aliveSeats.has(left)) {
      result.push(left);
      break;
    }
  }

  for (let offset = 1; offset < playerCount; offset += 1) {
    const right = ((currentSeat + offset - 1) % playerCount) + 1;
    if (aliveSeats.has(right)) {
      result.push(right);
      break;
    }
  }

  return [...new Set(result)];
}

function clockwiseSeatsBetween(startSeat, endSeat, playerCount) {
  const start = normalizeSeat(startSeat, playerCount);
  const end = normalizeSeat(endSeat, playerCount);
  if (!start || !end || start === end) {
    return [];
  }

  const seats = [];
  let seat = start === playerCount ? 1 : start + 1;
  while (seat !== end) {
    seats.push(seat);
    seat = seat === playerCount ? 1 : seat + 1;
  }

  return seats;
}

function roleLabel(role) {
  return role?.name || "某身份";
}

function boolLabel(value) {
  return value ? "是" : "否";
}

function baseObservation(source, role, row, kind, label, extra = {}) {
  return {
    id: `${source.id}:${role?.id || "unknown"}:${row.index}:${kind}:${label}`,
    sourceId: source.id,
    sourceSeat: Number(source.seat),
    sourceRoleName: role?.name || source.claim || "未填身份",
    sourceRoleType: role?.type || "",
    rowIndex: row.index + 1,
    kind,
    label,
    ...extra,
  };
}

function sourceLabel(source, role) {
  return `${source.seat}号${role?.name || source.claim || "信息位"}`;
}

function buildRoleObservation(source, role, row, players, game) {
  const name = role?.name || "";
  const playerCount = game.playerCount;

  if (name.includes("厨师")) {
    const count = numberValue(row.result, ["count", "evilCount", "number", "value"]);
    return count === null
      ? null
      : baseObservation(source, role, row, "adjacent_evil_pair_count", `${sourceLabel(source, role)}报相邻邪恶对数为${count}`, { value: count });
  }

  if (name.includes("共情者")) {
    const count = numberValue(row.result, ["count", "evilCount", "number", "value"]);
    const targets = aliveNeighborSeats(players, source.seat, playerCount);
    return count === null || !targets.length
      ? null
      : baseObservation(source, role, row, "evil_count_group", `${sourceLabel(source, role)}报${describeSeats(targets)}中有${count}红`, { targets, value: count });
  }

  if (name.includes("植物学家")) {
    const targetSeat = normalizeSeat(firstValue(row.target, ["seat", "player", "target"]), playerCount);
    const targets = aliveNeighborSeats(players, targetSeat, playerCount);
    const count = numberValue(row.result, ["count", "evilCount", "number", "value"]);
    return count === null || !targetSeat || !targets.length
      ? null
      : baseObservation(source, role, row, "evil_count_group", `${sourceLabel(source, role)}报${targetSeat}号两侧存活玩家有${count}红`, { targets, value: count });
  }

  if (name.includes("提夫林")) {
    const targetSeat = normalizeSeat(firstValue(row.target, ["seat", "player", "target"]), playerCount);
    const count = numberValue(row.result, ["count", "evilCount", "number", "value"]);
    const targets = clockwiseSeatsBetween(source.seat, targetSeat, playerCount);
    return count === null || !targetSeat || !targets.length
      ? null
      : baseObservation(source, role, row, "clockwise_evil_count", `${sourceLabel(source, role)}报到${targetSeat}号之间有${count}红`, {
          targets,
          value: count,
          targetSeat,
          targetMustBeGood: true,
        });
  }

  if (name.includes("贵族")) {
    const targets = uniqueSeats([row.result.seat1, row.result.seat2, row.result.seat3], playerCount);
    return targets.length
      ? baseObservation(source, role, row, "evil_count_group", `${sourceLabel(source, role)}报${describeSeats(targets)}中恰好1红`, { targets, value: 1 })
      : null;
  }

  if (name.includes("祖母")) {
    const targetSeat = normalizeSeat(firstValue(row.result, ["seat", "player", "target"]), playerCount);
    const targetRole = getRoleByName(firstValue(row.result, ["role", "character", "claim"]));
    return targetSeat
      ? baseObservation(source, role, row, "good_player", `${sourceLabel(source, role)}报${targetSeat}号是善良${roleLabel(targetRole)}`, { targetSeat, role: targetRole })
      : null;
  }

  if (name.includes("筑梦师")) {
    const targetSeat = normalizeSeat(firstValue(row.target, ["seat", "player", "target"]), playerCount);
    const goodRole = getRoleByName(firstValue(row.result, ["good_role", "goodRole", "good"]));
    const evilRole = getRoleByName(firstValue(row.result, ["evil_role", "evilRole", "evil"]));
    return targetSeat && (goodRole || evilRole)
      ? baseObservation(source, role, row, "either_role", `${sourceLabel(source, role)}给${targetSeat}号筑梦：${roleLabel(goodRole)} / ${roleLabel(evilRole)}`, { targetSeat, goodRole, evilRole })
      : null;
  }

  if (name.includes("牧师")) {
    const targets = uniqueSeats([row.target.seat1, row.target.seat2, row.target.first, row.target.second], playerCount);
    const targetRole = getRoleByName(firstValue(row.result, ["role", "character"]));
    return targets.length && targetRole
      ? baseObservation(source, role, row, "not_role_type_group", `${sourceLabel(source, role)}报${describeSeats(targets)}都不是${targetRole.name}`, { targets, role: targetRole })
      : null;
  }

  if (["洗衣妇", "图书管理员", "调查员"].some((roleName) => name.includes(roleName))) {
    const targets = uniqueSeats([row.result.seat1, row.result.seat2], playerCount);
    const targetRole = getRoleByName(firstValue(row.result, ["role", "character", "claim"]));
    return targets.length && targetRole
      ? baseObservation(source, role, row, "role_in_group", `${sourceLabel(source, role)}报${describeSeats(targets)}里有${targetRole.name}`, { targets, role: targetRole })
      : null;
  }

  if (name.includes("占卜师")) {
    const targets = uniqueSeats([row.target.seat1, row.target.seat2], playerCount);
    const value = booleanValue(row.result, ["has_demon", "answer", "value"]);
    return targets.length && value !== null
      ? baseObservation(source, role, row, "demon_in_group", `${sourceLabel(source, role)}查${describeSeats(targets)}含恶魔：${boolLabel(value)}`, { targets, value })
      : null;
  }

  if (name.includes("骑士")) {
    const targets = uniqueSeats([row.result.seat1, row.result.seat2], playerCount);
    return targets.length
      ? baseObservation(source, role, row, "not_demon_group", `${sourceLabel(source, role)}报${describeSeats(targets)}都不是恶魔`, { targets })
      : null;
  }

  if (name.includes("女裁缝")) {
    const targets = uniqueSeats([row.target.seat1, row.target.seat2], playerCount);
    const value = booleanValue(row.result, ["same_team", "answer", "value"]);
    return targets.length === 2 && value !== null
      ? baseObservation(source, role, row, "team_relation", `${sourceLabel(source, role)}报${describeSeats(targets)}同阵营：${boolLabel(value)}`, { targets, value })
      : null;
  }

  if (name.includes("神谕者")) {
    const count = numberValue(row.result, ["count", "evilCount", "number", "value"]);
    return count === null
      ? null
      : baseObservation(source, role, row, "evil_dead_count", `${sourceLabel(source, role)}报死亡邪恶数为${count}`, { value: count });
  }

  if (name.includes("钟表匠")) {
    const distance = numberValue(row.result, ["distance", "count", "number", "value"]);
    return distance === null
      ? null
      : baseObservation(source, role, row, "demon_minion_distance", `${sourceLabel(source, role)}报恶魔到最近爪牙距离为${distance}`, { value: distance });
  }

  if (name.includes("赌徒")) {
    const targetSeat = normalizeSeat(firstValue(row.target, ["seat", "player", "target"]), playerCount);
    const targetRole = getRoleByName(firstValue(row.target, ["role", "character", "claim"]));
    const value = booleanValue(row.result, ["correct", "answer", "value"]);
    return targetSeat && targetRole && value !== null
      ? baseObservation(source, role, row, "role_guess", `${sourceLabel(source, role)}赌${targetSeat}号是${targetRole.name}：${boolLabel(value)}`, { targetSeat, role: targetRole, value })
      : null;
  }

  return null;
}

export function extractObservations(game) {
  const players = getAnalysisPlayers(game);
  const observations = [];
  const unsupported = [];

  players.forEach((source) => {
    const role = getPlayerRole(source, game);
    const rows = getRows(source).filter(hasRecordedValue);
    if (!role || !rows.length) {
      return;
    }

    rows.forEach((row) => {
      const observation = buildRoleObservation(source, role, row, players, game);
      if (observation) {
        observations.push(observation);
      } else {
        unsupported.push({
          id: `${source.id}:${row.index}:unsupported`,
          sourceSeat: Number(source.seat),
          label: `${sourceLabel(source, role)}有记录，但暂未接入自动推理`,
        });
      }
    });
  });

  return { players, observations, unsupported };
}
