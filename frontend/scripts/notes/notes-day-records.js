import { createId } from "../utils.js";

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeSeatValue(value, playerCount) {
  const seat = Number.parseInt(value, 10);
  if (!Number.isFinite(seat) || seat < 1 || seat > playerCount) {
    return "";
  }

  return String(seat);
}

function normalizeVoteSeats(value, playerCount) {
  const seats = Array.isArray(value) ? value : [];
  return [
    ...new Set(
      seats
        .map((seat) => normalizeSeatValue(seat, playerCount))
        .filter(Boolean),
    ),
  ].sort((left, right) => Number(left) - Number(right));
}

function normalizeExecutionOverride(value, playerCount) {
  if (value === "none") {
    return "none";
  }

  return normalizeSeatValue(value, playerCount);
}

export function createDayRecord(dayNumber) {
  return {
    id: createId("day"),
    dayNumber: clampNumber(Number(dayNumber) || 1, 1, 99),
    nominations: [],
    executionOverride: "",
  };
}

export function createNominationRecord() {
  return {
    id: createId("nomination"),
    nominatorSeat: "",
    nomineeSeat: "",
    voterSeats: [],
    note: "",
    createdAt: new Date().toISOString(),
  };
}

function normalizeNomination(nomination, playerCount) {
  return {
    id: nomination?.id || createId("nomination"),
    nominatorSeat: normalizeSeatValue(nomination?.nominatorSeat, playerCount),
    nomineeSeat: normalizeSeatValue(nomination?.nomineeSeat, playerCount),
    voterSeats: normalizeVoteSeats(nomination?.voterSeats, playerCount),
    note: String(nomination?.note || ""),
    createdAt: nomination?.createdAt || new Date().toISOString(),
  };
}

export function normalizeAutoExecutionApplied(applied, playerCount) {
  return Array.isArray(applied)
    ? applied
        .map((entry) => ({
          dayNumber: clampNumber(Number(entry?.dayNumber) || 1, 1, 99),
          seat: normalizeSeatValue(entry?.seat, playerCount),
        }))
        .filter((entry) => entry.seat)
    : [];
}

export function normalizeDayRecords(records, playerCount) {
  const normalized = [];

  (Array.isArray(records) ? records : []).forEach((record) => {
    const dayNumber = clampNumber(Number(record?.dayNumber) || 1, 1, 99);
    const dayRecord =
      normalized.find((item) => item.dayNumber === dayNumber) || createDayRecord(dayNumber);

    if (!normalized.includes(dayRecord)) {
      dayRecord.id = record?.id || dayRecord.id;
      normalized.push(dayRecord);
    }

    dayRecord.nominations.push(
      ...(Array.isArray(record?.nominations)
        ? record.nominations.map((nomination) =>
            normalizeNomination(nomination, playerCount),
          )
        : []),
    );

    const override = normalizeExecutionOverride(record?.executionOverride, playerCount);
    if (override || record?.executionOverride === "none") {
      dayRecord.executionOverride = override || "none";
    }
  });

  return normalized.sort((left, right) => left.dayNumber - right.dayNumber);
}

export function ensureDayRecords(game) {
  if (!game) {
    return [];
  }

  game.dayRecords = normalizeDayRecords(game.dayRecords, game.playerCount);
  game.autoExecutionApplied = normalizeAutoExecutionApplied(
    game.autoExecutionApplied,
    game.playerCount,
  );
  return game.dayRecords;
}

export function getDayRecord(game, dayNumber, createIfMissing = false) {
  const records = ensureDayRecords(game);
  const normalizedDay = clampNumber(Number(dayNumber) || 1, 1, 99);
  let record = records.find((item) => item.dayNumber === normalizedDay) || null;

  if (!record && createIfMissing) {
    record = createDayRecord(normalizedDay);
    records.push(record);
    records.sort((left, right) => left.dayNumber - right.dayNumber);
  }

  return record;
}

function getSameDayAutoExecutionSeats(game, dayNumber) {
  return new Set(
    normalizeAutoExecutionApplied(game?.autoExecutionApplied, game?.playerCount || 15)
      .filter((entry) => Number(entry.dayNumber) === Number(dayNumber))
      .map((entry) => Number(entry.seat)),
  );
}

export function getDayExecutionThreshold(game, dayNumber) {
  const sameDayAutoSeats = getSameDayAutoExecutionSeats(game, dayNumber);
  const aliveCount = (game?.players || []).filter((player) => {
    const seat = Number(player.seat);
    return (
      player.status === "alive" ||
      (player.status === "executed" && sameDayAutoSeats.has(seat))
    );
  }).length;

  return Math.max(1, Math.ceil((aliveCount || game?.playerCount || 1) / 2));
}

export function resolveAutomaticDayExecution(game, record) {
  if (!game || !record) {
    return {
      mode: "auto",
      seat: "",
      votes: 0,
      threshold: 1,
      nominationId: "",
    };
  }

  const threshold = getDayExecutionThreshold(game, record.dayNumber);
  return (record.nominations || []).reduce(
    (current, nomination) => {
      const nomineeSeat = normalizeSeatValue(nomination.nomineeSeat, game.playerCount);
      const votes = normalizeVoteSeats(nomination.voterSeats, game.playerCount).length;
      if (!nomineeSeat || votes < threshold || votes <= current.votes) {
        return current;
      }

      return {
        mode: "auto",
        seat: nomineeSeat,
        votes,
        threshold,
        nominationId: nomination.id,
      };
    },
    {
      mode: "auto",
      seat: "",
      votes: 0,
      threshold,
      nominationId: "",
    },
  );
}

export function resolveDayExecution(game, record) {
  if (!game || !record) {
    return resolveAutomaticDayExecution(game, record);
  }

  const threshold = getDayExecutionThreshold(game, record.dayNumber);

  if (record.executionOverride === "none") {
    return {
      mode: "manual-none",
      seat: "",
      votes: 0,
      threshold,
      nominationId: "",
    };
  }

  const overrideSeat = normalizeSeatValue(record.executionOverride, game.playerCount);
  if (overrideSeat) {
    return {
      mode: "manual-seat",
      seat: overrideSeat,
      votes: 0,
      threshold,
      nominationId: "",
    };
  }

  return resolveAutomaticDayExecution(game, record);
}

function getPlayerBySeat(game, seat) {
  return (game?.players || []).find((player) => Number(player.seat) === Number(seat)) || null;
}

export function syncAutoExecutionStatuses(game) {
  if (!game) {
    return [];
  }

  const previous = normalizeAutoExecutionApplied(
    game.autoExecutionApplied,
    game.playerCount,
  );

  previous.forEach((entry) => {
    const player = getPlayerBySeat(game, entry.seat);
    if (player?.status === "executed") {
      player.status = "alive";
    }
  });

  game.autoExecutionApplied = [];

  const applied = [];
  ensureDayRecords(game).forEach((record) => {
    const result = resolveDayExecution(game, record);
    if (!result.seat) {
      return;
    }

    const player = getPlayerBySeat(game, result.seat);
    if (player && player.status !== "night-dead") {
      player.status = "executed";
    }

    applied.push({
      dayNumber: record.dayNumber,
      seat: result.seat,
    });
  });

  game.autoExecutionApplied = applied;
  return applied;
}

export function getDayVotingSeats(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  if (!record) {
    return [];
  }

  return normalizeVoteSeats(
    record.nominations.flatMap((nomination) => nomination.voterSeats || []),
    game.playerCount,
  ).map(Number);
}

export function getDayNominatorSeats(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  if (!record) {
    return [];
  }

  return [
    ...new Set(
      record.nominations
        .map((nomination) => normalizeSeatValue(nomination.nominatorSeat, game.playerCount))
        .filter(Boolean)
        .map(Number),
    ),
  ];
}

export function hasDayActionHistory(game, dayNumber, actionType) {
  const record = getDayRecord(game, dayNumber);
  if (!record || !record.nominations.length) {
    return false;
  }

  if (actionType === "vote") {
    return record.nominations.some(
      (nomination) =>
        nomination.nominatorSeat ||
        nomination.nomineeSeat ||
        (nomination.voterSeats || []).length,
    );
  }

  if (actionType === "nomination") {
    return record.nominations.some(
      (nomination) => nomination.nominatorSeat || nomination.nomineeSeat,
    );
  }

  return true;
}
