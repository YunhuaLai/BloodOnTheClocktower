import { normalizeMatchText } from "../../notes-claims.js";
import { getDraftOrPlayer } from "../../notes-state.js";
import { state } from "../../state.js";
import { getClaimedRole } from "../notes-role-info.js";
import { getRoleDeductionProfile, getRoleDeductionReview, templateLabels } from "./profiles.js";

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

function entryFor(row, source) {
  return source === "target" ? row.target : row.result;
}

function valueFrom(row, spec) {
  return firstValue(entryFor(row, spec?.source || "result"), spec?.keys || []);
}

function numberFrom(row, spec) {
  const value = valueFrom(row, spec);
  if (value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanFrom(row, spec) {
  const value = normalizeMatchText(valueFrom(row, spec));
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

function roleFrom(row, spec) {
  return getRoleByName(valueFrom(row, spec));
}

function uniqueSeats(values, playerCount) {
  return [...new Set(values.map((value) => normalizeSeat(value, playerCount)).filter(Boolean))];
}

function seatsFrom(row, spec, playerCount) {
  return uniqueSeats((spec?.keys || []).map((key) => entryFor(row, spec.source || "result")?.[key]), playerCount);
}

function seatFrom(row, spec, playerCount) {
  return normalizeSeat(valueFrom(row, spec), playerCount);
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

function directionLabel(value) {
  if (value === "clockwise") {
    return "顺时针";
  }

  if (value === "counterclockwise") {
    return "逆时针";
  }

  return "说书人选择";
}

function baseObservation(source, role, row, template, label, extra = {}) {
  return {
    id: `${source.id}:${role?.id || "unknown"}:${row.index}:${template.type}:${label}`,
    sourceId: source.id,
    sourceSeat: Number(source.seat),
    sourceRoleName: role?.name || source.claim || "未填身份",
    sourceRoleType: role?.type || "",
    rowIndex: row.index + 1,
    kind: template.type,
    templateType: template.type,
    templateLabel: templateLabels[template.type] || template.type,
    label,
    ...extra,
  };
}

function sourceLabel(source, role) {
  return `${source.seat}号${role?.name || source.claim || "信息位"}`;
}

function groupFromTemplate(template, source, row, players, game) {
  const playerCount = game.playerCount;

  if (template.group === "source_alive_neighbors") {
    return {
      targets: aliveNeighborSeats(players, source.seat, playerCount),
    };
  }

  if (template.group === "target_alive_neighbors") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    return {
      targets: aliveNeighborSeats(players, targetSeat, playerCount),
      targetSeat,
    };
  }

  if (template.group === "clockwise_between_source_and_target") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    return {
      targets: clockwiseSeatsBetween(source.seat, targetSeat, playerCount),
      targetSeat,
    };
  }

  return {
    targets: seatsFrom(row, template.seats, playerCount),
  };
}

function numericValue(row, template) {
  if (template.fixedValue !== undefined) {
    return template.fixedValue;
  }

  return numberFrom(row, template.value);
}

function booleanValue(row, template) {
  if (template.fixedValue !== undefined) {
    return template.fixedValue;
  }

  return booleanFrom(row, template.value);
}

function buildRowObservation(template, source, role, row, players, game) {
  const sourceText = sourceLabel(source, role);
  const playerCount = game.playerCount;

  if (template.type === "adjacent_evil_pair_count") {
    const value = numericValue(row, template);
    return value === null
      ? null
      : baseObservation(source, role, row, template, `${sourceText}报相邻邪恶对数为${value}`, { value });
  }

  if (template.type === "evil_count_group" || template.type === "clockwise_evil_count") {
    const { targets, targetSeat } = groupFromTemplate(template, source, row, players, game);
    const value = numericValue(row, template);
    if (value === null || !targets.length) {
      return null;
    }

    const label =
      template.type === "clockwise_evil_count"
        ? `${sourceText}报到${targetSeat}号之间有${value}红`
        : `${sourceText}报${describeSeats(targets)}中有${value}红`;

    return baseObservation(source, role, row, template, label, {
      targets,
      targetSeat,
      targetMustBeGood: Boolean(template.targetMustBeGood),
      value,
    });
  }

  if (template.type === "good_player") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    const targetRole = roleFrom(row, template.role);
    return targetSeat
      ? baseObservation(
          source,
          role,
          row,
          template,
          `${sourceText}报${targetSeat}号是善良${targetRole ? roleLabel(targetRole) : "玩家"}`,
          { targetSeat, role: targetRole },
        )
      : null;
  }

  if (template.type === "role_in_group" || template.type === "not_role_type_group") {
    const targets = seatsFrom(row, template.seats, playerCount);
    const targetRole = roleFrom(row, template.role);
    if (!targets.length || !targetRole) {
      return null;
    }

    const relationText =
      template.type === "role_in_group"
        ? `${describeSeats(targets)}里有${targetRole.name}`
        : `${describeSeats(targets)}都不是${targetRole.name}`;

    return baseObservation(source, role, row, template, `${sourceText}报${relationText}`, {
      targets,
      role: targetRole,
    });
  }

  if (template.type === "role_at_seat") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    const targetRole = roleFrom(row, template.role);
    return targetSeat && targetRole
      ? baseObservation(source, role, row, template, `${sourceText}报${targetSeat}号是${targetRole.name}`, {
          targetSeat,
          role: targetRole,
        })
      : null;
  }

  if (template.type === "demon_in_group") {
    const targets = seatsFrom(row, template.seats, playerCount);
    const value = booleanValue(row, template);
    return targets.length && value !== null
      ? baseObservation(source, role, row, template, `${sourceText}查${describeSeats(targets)}含恶魔：${boolLabel(value)}`, {
          targets,
          value,
        })
      : null;
  }

  if (template.type === "not_demon_group") {
    const targets = seatsFrom(row, template.seats, playerCount);
    return targets.length
      ? baseObservation(source, role, row, template, `${sourceText}报${describeSeats(targets)}都不是恶魔`, { targets })
      : null;
  }

  if (template.type === "team_relation") {
    const targets = seatsFrom(row, template.seats, playerCount);
    const value = booleanValue(row, template);
    return targets.length === 2 && value !== null
      ? baseObservation(source, role, row, template, `${sourceText}报${describeSeats(targets)}同阵营：${boolLabel(value)}`, {
          targets,
          value,
        })
      : null;
  }

  if (template.type === "either_role") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    const goodRole = roleFrom(row, template.goodRole);
    const evilRole = roleFrom(row, template.evilRole);
    return targetSeat && (goodRole || evilRole)
      ? baseObservation(source, role, row, template, `${sourceText}给${targetSeat}号筑梦：${roleLabel(goodRole)} / ${roleLabel(evilRole)}`, {
          targetSeat,
          goodRole,
          evilRole,
        })
      : null;
  }

  if (template.type === "evil_dead_count") {
    const value = numericValue(row, template);
    return value === null
      ? null
      : baseObservation(source, role, row, template, `${sourceText}报死亡邪恶数为${value}`, { value });
  }

  if (template.type === "demon_minion_distance") {
    const value = numericValue(row, template);
    return value === null
      ? null
      : baseObservation(source, role, row, template, `${sourceText}报恶魔到最近爪牙距离为${value}`, { value });
  }

  if (template.type === "role_guess") {
    const targetSeat = seatFrom(row, template.seat, playerCount);
    const targetRole = roleFrom(row, template.role);
    const value = booleanValue(row, template);
    return targetSeat && targetRole && value !== null
      ? baseObservation(source, role, row, template, `${sourceText}猜${targetSeat}号是${targetRole.name}：${boolLabel(value)}`, {
          targetSeat,
          role: targetRole,
          value,
        })
      : null;
  }

  if (template.type === "nearest_evil_direction") {
    const value = normalizeMatchText(valueFrom(row, template.value));
    return value
      ? baseObservation(source, role, row, template, `${sourceText}报最近邪恶在${directionLabel(value)}`, { value })
      : null;
  }

  return null;
}

function buildAllTargetsObservation(template, source, role, rows, game) {
  if (template.type !== "role_guess_count") {
    return null;
  }

  const playerCount = game.playerCount;
  const guesses = rows
    .map((row) => ({
      seat: seatFrom(row, template.guesses.seat, playerCount),
      role: roleFrom(row, template.guesses.role),
    }))
    .filter((guess) => guess.seat && guess.role);
  const value = numberFrom(rows[0] || {}, template.value);

  return guesses.length && value !== null
    ? baseObservation(source, role, rows[0] || { index: 0 }, template, `${sourceLabel(source, role)}报${guesses.length}个猜测中猜中${value}个`, {
        guesses,
        value,
      })
    : null;
}

function buildTemplateObservations(template, source, role, rows, players, game) {
  if (template.rowMode === "all_targets") {
    return [buildAllTargetsObservation(template, source, role, rows, game)].filter(Boolean);
  }

  return rows
    .map((row) => buildRowObservation(template, source, role, row, players, game))
    .filter(Boolean);
}

function unsupportedEntry(source, role, row, review) {
  const rowSuffix = row ? `第${row.index + 1}条` : "已记录";
  return {
    id: `${source.id}:${role?.id || "unknown"}:${row?.index ?? "all"}:unsupported`,
    sourceSeat: Number(source.seat),
    status: review.status,
    label: `${sourceLabel(source, role)}${rowSuffix}：${review.label}`,
  };
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

    const profile = getRoleDeductionProfile(role);
    const review = getRoleDeductionReview(role);
    if (profile?.status !== "supported" || !profile.templates?.length) {
      rows.forEach((row) => unsupported.push(unsupportedEntry(source, role, row, review)));
      return;
    }

    let matchedCount = 0;
    profile.templates.forEach((template) => {
      const nextObservations = buildTemplateObservations(template, source, role, rows, players, game);
      matchedCount += nextObservations.length;
      observations.push(...nextObservations);
    });

    if (!matchedCount) {
      rows.forEach((row) => unsupported.push(unsupportedEntry(source, role, row, review)));
    }
  });

  return { players, observations, unsupported };
}
