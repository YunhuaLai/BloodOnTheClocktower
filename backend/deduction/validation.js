const MIN_PLAYER_COUNT = 5;
const MAX_PLAYER_COUNT = 15;
const MAX_TRAVELLER_COUNT = 5;
const MAX_TIMELINE_ENTRIES = 500;
const MAX_DAY_RECORDS = 50;
const MAX_ROLE_INFO_ROWS = 30;
const MAX_NOMINATIONS_PER_DAY = 30;
const MAX_ABILITY_RECORDS_PER_DAY = 50;

function isTraveller(player) {
  return Boolean(player?.isTraveller || player?.seatType === "traveller");
}

function validateDeductionGame(game) {
  const errors = [];
  const playerCount = Number(game?.playerCount);
  const players = Array.isArray(game?.players) ? game.players : null;

  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYER_COUNT || playerCount > MAX_PLAYER_COUNT) {
    errors.push(`playerCount must be an integer between ${MIN_PLAYER_COUNT} and ${MAX_PLAYER_COUNT}`);
  }

  if (!players) {
    errors.push("players must be an array");
    return errors;
  }

  if (players.length > MAX_PLAYER_COUNT + MAX_TRAVELLER_COUNT) {
    errors.push(`players cannot contain more than ${MAX_PLAYER_COUNT + MAX_TRAVELLER_COUNT} entries`);
  }

  players.forEach((player, index) => {
    const targetEntries = Array.isArray(player?.roleInfo?.targetEntries)
      ? player.roleInfo.targetEntries.length
      : 0;
    const resultEntries = Array.isArray(player?.roleInfo?.resultEntries)
      ? player.roleInfo.resultEntries.length
      : 0;
    if (Math.max(targetEntries, resultEntries) > MAX_ROLE_INFO_ROWS) {
      errors.push(`players[${index}].roleInfo cannot contain more than ${MAX_ROLE_INFO_ROWS} rows`);
    }
  });

  if (Number.isInteger(playerCount)) {
    const basePlayers = players.filter((player) => !isTraveller(player));
    if (basePlayers.length !== playerCount) {
      errors.push("non-traveller player count must match playerCount");
    }

    const seats = basePlayers.map((player) => Number(player?.seat));
    const expectedSeats = Array.from({ length: playerCount }, (_, index) => index + 1);
    const uniqueSeats = [...new Set(seats)].sort((left, right) => left - right);
    if (
      seats.some((seat) => !Number.isInteger(seat)) ||
      uniqueSeats.length !== expectedSeats.length ||
      uniqueSeats.some((seat, index) => seat !== expectedSeats[index])
    ) {
      errors.push("non-traveller seats must be unique consecutive integers starting at 1");
    }
  }

  if (Array.isArray(game?.timeline) && game.timeline.length > MAX_TIMELINE_ENTRIES) {
    errors.push(`timeline cannot contain more than ${MAX_TIMELINE_ENTRIES} entries`);
  }

  if (Array.isArray(game?.dayRecords) && game.dayRecords.length > MAX_DAY_RECORDS) {
    errors.push(`dayRecords cannot contain more than ${MAX_DAY_RECORDS} entries`);
  }

  if (Array.isArray(game?.dayRecords)) {
    game.dayRecords.forEach((record, index) => {
      if (Array.isArray(record?.nominations) && record.nominations.length > MAX_NOMINATIONS_PER_DAY) {
        errors.push(`dayRecords[${index}].nominations cannot contain more than ${MAX_NOMINATIONS_PER_DAY} entries`);
      }
      if (Array.isArray(record?.abilityRecords) && record.abilityRecords.length > MAX_ABILITY_RECORDS_PER_DAY) {
        errors.push(`dayRecords[${index}].abilityRecords cannot contain more than ${MAX_ABILITY_RECORDS_PER_DAY} entries`);
      }
    });
  }

  return errors;
}

module.exports = {
  MAX_PLAYER_COUNT,
  MAX_TRAVELLER_COUNT,
  MIN_PLAYER_COUNT,
  validateDeductionGame,
};
