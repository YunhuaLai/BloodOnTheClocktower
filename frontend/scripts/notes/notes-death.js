// Death records: when a player died (phase) and why (cause), plus whether their
// dead vote is spent. `player.status` stays the source of alive/dead; `player.death`
// only adds detail and is null for living players.

export const deathCauseOptions = [
  { value: "execution", label: "处决", short: "处" },
  { value: "night", label: "夜晚死亡", short: "夜" },
  { value: "day", label: "白天死亡（技能等）", short: "白" },
  { value: "unknown", label: "原因不明", short: "死" },
];

const deathCauses = new Set(deathCauseOptions.map((option) => option.value));
const deadStatuses = new Set(["night-dead", "executed"]);

export function isDeadStatus(status) {
  return deadStatuses.has(status);
}

function normalizePhaseNumber(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
}

export function getStatusForDeathCause(cause) {
  return cause === "execution" ? "executed" : "night-dead";
}

function getDefaultCauseForStatus(status) {
  return status === "executed" ? "execution" : "night";
}

export function normalizeDeath(death, status) {
  if (!isDeadStatus(status)) {
    return null;
  }

  const phaseNumber = normalizePhaseNumber(death?.phaseNumber);
  const phaseType = phaseNumber && ["night", "day"].includes(death?.phaseType) ? death.phaseType : "";
  const cause = deathCauses.has(death?.cause) ? death.cause : getDefaultCauseForStatus(status);

  return {
    phaseType,
    phaseNumber: phaseType ? phaseNumber : null,
    cause,
  };
}

// Phase a death most likely belongs to when it is marked during `game`'s current
// phase: night deaths are learned at the start of the following day, executions
// happen at the end of a day.
export function getDefaultDeathPhase(cause, game) {
  const phaseType = game?.phaseType === "night" ? "night" : "day";
  const phaseNumber = normalizePhaseNumber(game?.phaseNumber) || 1;

  if (cause === "night") {
    return { phaseType: "night", phaseNumber };
  }

  if (cause === "execution" || cause === "day") {
    return phaseType === "day"
      ? { phaseType: "day", phaseNumber }
      : { phaseType: "day", phaseNumber: Math.max(phaseNumber - 1, 1) };
  }

  return { phaseType, phaseNumber };
}

// Applies a status change to a player (or draft): fills in a death record when they
// die, keeps an existing record whose cause still fits, clears it when they revive.
export function applyStatusChange(player, status, game) {
  player.status = status;

  if (!isDeadStatus(status)) {
    if (status === "alive") {
      player.death = null;
      player.ghostVoteUsed = false;
    }
    return;
  }

  const current = normalizeDeath(player.death, status);
  const existingCauseFits = player.death && getStatusForDeathCause(current.cause) === status;
  if (existingCauseFits) {
    player.death = current;
    return;
  }

  const cause = getDefaultCauseForStatus(status);
  player.death = { ...getDefaultDeathPhase(cause, game), cause };
}

export function applyDeathCause(player, cause, game) {
  if (!deathCauses.has(cause)) {
    return;
  }

  const status = getStatusForDeathCause(cause);
  const current = normalizeDeath(player.death, status) || { phaseType: "", phaseNumber: null };
  player.status = status;
  player.death = { ...current, cause };
  // Night deaths belong to a night, executions and day deaths to a day.
  const phaseConflicts =
    (cause === "night" && current.phaseType === "day") ||
    (["execution", "day"].includes(cause) && current.phaseType === "night");
  if (!current.phaseType || phaseConflicts) {
    Object.assign(player.death, getDefaultDeathPhase(cause, game));
  }
}

export function formatDeathPhaseValue(death) {
  return death?.phaseType && death.phaseNumber ? `${death.phaseType}-${death.phaseNumber}` : "";
}

export function parseDeathPhaseValue(value) {
  const match = String(value || "").match(/^(night|day)-(\d+)$/);
  if (!match) {
    return { phaseType: "", phaseNumber: null };
  }

  const phaseNumber = normalizePhaseNumber(match[2]);
  return phaseNumber ? { phaseType: match[1], phaseNumber } : { phaseType: "", phaseNumber: null };
}

export function applyDeathPhase(player, value) {
  if (!isDeadStatus(player.status)) {
    return;
  }

  player.death = {
    ...normalizeDeath(player.death, player.status),
    ...parseDeathPhaseValue(value),
  };
}

export function formatDeathPhaseLabel(phaseType, phaseNumber) {
  return `第 ${phaseNumber} ${phaseType === "night" ? "夜" : "天"}`;
}

// Selectable death phases: night 1 up to the game's current phase.
export function getDeathPhaseChoices(game, death = null) {
  const currentNumber = normalizePhaseNumber(game?.phaseNumber) || 1;
  const lastIndex = Math.max(
    (currentNumber - 1) * 2 + (game?.phaseType === "day" ? 1 : 0),
    death?.phaseNumber ? (death.phaseNumber - 1) * 2 + (death.phaseType === "day" ? 1 : 0) : 0,
  );
  const choices = [];
  for (let index = 0; index <= lastIndex; index += 1) {
    const phaseNumber = Math.floor(index / 2) + 1;
    const phaseType = index % 2 === 0 ? "night" : "day";
    choices.push({
      value: `${phaseType}-${phaseNumber}`,
      label: formatDeathPhaseLabel(phaseType, phaseNumber),
    });
  }
  return choices;
}

// Short seat badge such as "夜3" or "处2"; empty for living players.
export function getDeathBadge(player) {
  if (!isDeadStatus(player?.status)) {
    return "";
  }

  const death = normalizeDeath(player.death, player.status);
  const short = deathCauseOptions.find((option) => option.value === death.cause)?.short || "死";
  return `${short}${death.phaseNumber || ""}`;
}

// Whether the player was alive while day `dayNumber`'s votes were cast:
// true / false, or null when their death has no recorded phase.
export function isAliveDuringDay(player, dayNumber) {
  if (player?.status === "alive") {
    return true;
  }

  if (!isDeadStatus(player?.status)) {
    return false;
  }

  const death = normalizeDeath(player.death, player.status);
  if (!death.phaseType) {
    return null;
  }

  const day = Number(dayNumber);
  if (death.phaseType === "night") {
    return death.phaseNumber > day;
  }

  return death.phaseNumber > day || (death.phaseNumber === day && death.cause === "execution");
}

// Whether every vote on day `dayNumber` was certainly cast after the death. A night
// death precedes that night's day; a day death only precedes later days, since the
// records do not say whether a vote came before a same-day death.
function isDeadForWholeDay(player, dayNumber) {
  const death = normalizeDeath(player?.death, player?.status);
  if (!death?.phaseType) {
    return false;
  }

  const day = Number(dayNumber);
  return death.phaseType === "night" ? day >= death.phaseNumber : day > death.phaseNumber;
}

// Days on which the player voted after their death (their dead vote).
export function getGhostVoteDays(game, player) {
  const seat = String(player?.seat || "");
  if (!seat || !isDeadStatus(player?.status)) {
    return [];
  }

  return (Array.isArray(game?.dayRecords) ? game.dayRecords : [])
    .filter((record) =>
      isDeadForWholeDay(player, record?.dayNumber) &&
      (record.nominations || []).some((nomination) =>
        (nomination.voterSeats || []).map(String).includes(seat),
      ),
    )
    .map((record) => Number(record.dayNumber));
}

export function isGhostVoteUsed(game, player) {
  return Boolean(player?.ghostVoteUsed) || getGhostVoteDays(game, player).length > 0;
}
