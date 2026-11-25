import { createId } from "../utils.js";
import { getMaxSeatNumber } from "./notes-core.js";

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
    abilityRecords: [],
    nominations: [],
    executionOverride: "",
    // Alive count frozen when the game moves past this day, so later deaths
    // do not change the vote threshold of a day that is already over.
    aliveCount: null,
    publicRecordSavedAt: "",
  };
}

export function normalizeAliveCount(value) {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count >= 1 && count <= 99 ? count : null;
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

function normalizePhaseType(value) {
  return value === "night" ? "night" : "day";
}

function normalizeAbilityRecord(record, playerCount) {
  const source = record?.source === "storyteller" ? "storyteller" : "player";

  return {
    id: record?.id || createId("ability"),
    source,
    phaseType: normalizePhaseType(record?.phaseType),
    order: Number.isFinite(Number(record?.order)) ? Number(record.order) : 9999,
    playerId: String(record?.playerId || ""),
    seat: normalizeSeatValue(record?.seat, playerCount),
    playerName: String(record?.playerName || ""),
    roleId: String(record?.roleId || ""),
    acquiredAbilityId: String(record?.acquiredAbilityId || ""),
    roleName: String(record?.roleName || ""),
    rowIndex: Math.max(Number(record?.rowIndex) || 1, 1),
    text: String(record?.text || ""),
    updatedAt: record?.updatedAt || "",
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

    dayRecord.abilityRecords.push(
      ...(Array.isArray(record?.abilityRecords)
        ? record.abilityRecords
            .map((abilityRecord) =>
              normalizeAbilityRecord(abilityRecord, playerCount),
            )
            .filter((abilityRecord) => abilityRecord.seat && abilityRecord.text)
        : []),
    );

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

    const aliveCount = normalizeAliveCount(record?.aliveCount);
    if (aliveCount) {
      dayRecord.aliveCount = aliveCount;
    }

    if (record?.publicRecordSavedAt) {
      dayRecord.publicRecordSavedAt = String(record.publicRecordSavedAt);
    }
  });

  return normalized.sort((left, right) => left.dayNumber - right.dayNumber);
}

export function ensureDayRecords(game) {
  if (!game) {
    return [];
  }

  const seatCount = getMaxSeatNumber(game) || game.playerCount;
  game.dayRecords = normalizeDayRecords(game.dayRecords, seatCount);
  game.autoExecutionApplied = normalizeAutoExecutionApplied(
    game.autoExecutionApplied,
    seatCount,
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

// Seats executed on this day or later: they were still alive during this day.
function getLaterExecutionSeats(game, dayNumber) {
  return new Set(
    normalizeAutoExecutionApplied(game?.autoExecutionApplied, getMaxSeatNumber(game) || game?.playerCount || 15)
      .filter((entry) => Number(entry.dayNumber) >= Number(dayNumber))
      .map((entry) => Number(entry.seat)),
  );
}

// Alive count derived from current statuses. Night deaths carry no day, so this
// is only exact for the day currently being played.
export function countAliveForDay(game, dayNumber) {
  const laterExecutionSeats = getLaterExecutionSeats(game, dayNumber);
  return (game?.players || []).filter((player) => {
    const seat = Number(player.seat);
    return (
      player.status === "alive" ||
      (player.status === "executed" && laterExecutionSeats.has(seat))
    );
  }).length;
}

export function getDayAliveCount(game, dayNumber, record = null) {
  return normalizeAliveCount(record?.aliveCount) || countAliveForDay(game, dayNumber);
}

export function getDayExecutionThreshold(game, dayNumber, record = null) {
  const aliveCount = getDayAliveCount(game, dayNumber, record);
  return Math.max(1, Math.ceil((aliveCount || game?.playerCount || 1) / 2));
}

// Freezes the alive count of days the game has just moved past (day N ends when
// the phase number goes above N). Already frozen days keep their value.
export function freezePassedDayAliveCounts(game, previousPhaseNumber) {
  if (!game) {
    return;
  }

  const currentPhaseNumber = Number(game.phaseNumber) || 1;
  const fromDay = Number(previousPhaseNumber) || 1;
  ensureDayRecords(game).forEach((record) => {
    if (
      record.dayNumber >= fromDay &&
      record.dayNumber < currentPhaseNumber &&
      !normalizeAliveCount(record.aliveCount)
    ) {
      record.aliveCount = countAliveForDay(game, record.dayNumber);
    }
  });
}

export function resolveAutomaticDayExecution(game, record) {
  if (!game || !record) {
    return {
      mode: "auto",
      seat: "",
      votes: 0,
      threshold: 1,
      nominationId: "",
      tied: false,
    };
  }

  const threshold = getDayExecutionThreshold(game, record.dayNumber, record);
  const seatCount = getMaxSeatNumber(game) || game.playerCount;
  const best = {
    mode: "auto",
    seat: "",
    votes: 0,
    threshold,
    nominationId: "",
    tied: false,
  };

  (record.nominations || []).forEach((nomination) => {
    const nomineeSeat = normalizeSeatValue(nomination.nomineeSeat, seatCount);
    const votes = normalizeVoteSeats(nomination.voterSeats, seatCount).length;
    if (!nomineeSeat || votes < threshold) {
      return;
    }

    if (votes > best.votes) {
      Object.assign(best, { seat: nomineeSeat, votes, nominationId: nomination.id, tied: false });
    } else if (votes === best.votes && nomineeSeat !== best.seat) {
      best.tied = true;
    }
  });

  // A tie for the most votes means nobody is about to die.
  if (best.tied) {
    return { ...best, seat: "", nominationId: "" };
  }

  return best;
}

export function resolveDayExecution(game, record) {
  if (!game || !record) {
    return resolveAutomaticDayExecution(game, record);
  }

  const threshold = getDayExecutionThreshold(game, record.dayNumber, record);

  if (record.executionOverride === "none") {
    return {
      mode: "manual-none",
      seat: "",
      votes: 0,
      threshold,
      nominationId: "",
    };
  }

  const overrideSeat = normalizeSeatValue(record.executionOverride, getMaxSeatNumber(game) || game.playerCount);
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

export function getDayExecutionSeat(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  const result = resolveDayExecution(game, record);
  return result.seat ? Number(result.seat) : 0;
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
    getMaxSeatNumber(game) || game.playerCount,
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
    getMaxSeatNumber(game) || game.playerCount,
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
        .map((nomination) => normalizeSeatValue(nomination.nominatorSeat, getMaxSeatNumber(game) || game.playerCount))
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
