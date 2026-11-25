function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSeatValue(value, playerCount) {
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

function normalizeAutoExecutionApplied(applied, playerCount) {
  return Array.isArray(applied)
    ? applied
        .map((entry) => ({
          dayNumber: clampNumber(Number(entry?.dayNumber) || 1, 1, 99),
          seat: normalizeSeatValue(entry?.seat, playerCount),
        }))
        .filter((entry) => entry.seat)
    : [];
}

function getMaxSeatNumber(game) {
  const maxSeat = (game?.players || []).reduce(
    (max, player) => Math.max(max, Number(player.seat) || 0),
    0,
  );
  return Math.max(Number(game?.playerCount) || 0, maxSeat, (game?.players || []).length);
}

function getDayRecord(game, dayNumber) {
  const normalizedDay = clampNumber(Number(dayNumber) || 1, 1, 99);
  return (
    (Array.isArray(game?.dayRecords) ? game.dayRecords : []).find(
      (item) => Number(item?.dayNumber) === normalizedDay,
    ) || null
  );
}

// Mirrors frontend/scripts/notes/notes-day-records.js and notes-death.js.
function getLaterExecutionSeats(game, dayNumber) {
  return new Set(
    normalizeAutoExecutionApplied(game?.autoExecutionApplied, getMaxSeatNumber(game) || game?.playerCount || 15)
      .filter((entry) => Number(entry.dayNumber) >= Number(dayNumber))
      .map((entry) => Number(entry.seat)),
  );
}

// true / false, or null when a dead player's death has no recorded phase.
function isAliveDuringDay(player, dayNumber) {
  if (player?.status === "alive") {
    return true;
  }

  if (!["night-dead", "executed"].includes(player?.status)) {
    return false;
  }

  const phaseNumber = Number.parseInt(player?.death?.phaseNumber, 10);
  const phaseType = player?.death?.phaseType;
  if (!Number.isFinite(phaseNumber) || !["night", "day"].includes(phaseType)) {
    return null;
  }

  const day = Number(dayNumber);
  if (phaseType === "night") {
    return phaseNumber > day;
  }

  const cause = player.death.cause || (player.status === "executed" ? "execution" : "night");
  return phaseNumber > day || (phaseNumber === day && cause === "execution");
}

function countAliveForDay(game, dayNumber) {
  const laterExecutionSeats = getLaterExecutionSeats(game, dayNumber);
  return (game?.players || []).filter((player) => {
    const alive = isAliveDuringDay(player, dayNumber);
    if (alive !== null) {
      return alive;
    }

    return player.status === "executed" && laterExecutionSeats.has(Number(player.seat));
  }).length;
}

function normalizeAliveCount(value) {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count >= 1 && count <= 99 ? count : null;
}

function getDayExecutionThreshold(game, dayNumber, record = null) {
  const aliveCount = normalizeAliveCount(record?.aliveCount) || countAliveForDay(game, dayNumber);
  return Math.max(1, Math.ceil((aliveCount || game?.playerCount || 1) / 2));
}

function resolveAutomaticDayExecution(game, record) {
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

function resolveDayExecution(game, record) {
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

function getDayExecutionSeat(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  const result = resolveDayExecution(game, record);
  return result.seat ? Number(result.seat) : 0;
}

function getDayVotingSeats(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  if (!record) {
    return [];
  }

  return normalizeVoteSeats(
    (record.nominations || []).flatMap((nomination) => nomination.voterSeats || []),
    getMaxSeatNumber(game) || game.playerCount,
  ).map(Number);
}

function getDayNominatorSeats(game, dayNumber) {
  const record = getDayRecord(game, dayNumber);
  if (!record) {
    return [];
  }

  return [
    ...new Set(
      (record.nominations || [])
        .map((nomination) => normalizeSeatValue(nomination.nominatorSeat, getMaxSeatNumber(game) || game.playerCount))
        .filter(Boolean)
        .map(Number),
    ),
  ];
}

function hasDayActionHistory(game, dayNumber, actionType) {
  const record = getDayRecord(game, dayNumber);
  if (!record || !record.nominations?.length) {
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

module.exports = {
  countAliveForDay,
  getDayExecutionSeat,
  resolveDayExecution,
  getDayNominatorSeats,
  getDayVotingSeats,
  hasDayActionHistory,
};
