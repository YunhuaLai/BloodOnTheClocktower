import { phaseTypeOptions } from "../state.js";
import { getOptionLabel } from "../utils.js";

export function formatPhaseLabel(phaseType, phaseNumber) {
  return `${getOptionLabel(phaseTypeOptions, phaseType)} ${phaseNumber}`;
}

export function getStandardSetup(playerCount) {
  const setups = {
    5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
    6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
    7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
    8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
    9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
    10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
    11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
    12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
    13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
    14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
    15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
  };

  return setups[playerCount] || setups[10];
}

export function isTravellerPlayer(player) {
  return Boolean(player?.isTraveller || player?.seatType === "traveller");
}

export function getResidentPlayers(game) {
  return (game?.players || []).filter((player) => !isTravellerPlayer(player));
}

export function getTravellerPlayers(game) {
  return (game?.players || []).filter(isTravellerPlayer);
}

export function getTotalPlayerCount(game) {
  return (game?.players || []).length || Number(game?.playerCount) || 0;
}

export function getMaxSeatNumber(game) {
  const maxSeat = (game?.players || []).reduce(
    (max, player) => Math.max(max, Number(player.seat) || 0),
    0,
  );
  return Math.max(Number(game?.playerCount) || 0, maxSeat, getTotalPlayerCount(game));
}

export function getAliveCount(game) {
  return game.players.filter((player) => player.status === "alive").length;
}

export function getPlayerLabel(player, game) {
  const name = String(player.name || "").trim();
  const seatLabel = isTravellerPlayer(player)
    ? `${player.seat}号旅行者`
    : `${player.seat}号位`;
  if (name) {
    return `${seatLabel} ${name}`;
  }

  if (player.seat === game.selfSeat) {
    return `${seatLabel} 我`;
  }

  return seatLabel;
}

export function getClaimAbbreviation(claim) {
  const text = String(claim || "").trim();
  if (!text) {
    return "--";
  }

  const compact = text.replace(/\s+/g, "");
  const chineseMatches = compact.match(/[\u4e00-\u9fff]/g);
  if (chineseMatches?.length) {
    return chineseMatches.slice(0, 2).join("");
  }

  if (compact.includes("-")) {
    return compact
      .split("-")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  return compact.slice(0, 2).toUpperCase();
}

export function getSeatLabel(player) {
  return `${player.seat}号位`;
}

export function getOverviewSecondaryText(player) {
  if (player.extraInfo) {
    return String(player.extraInfo).trim().replace(/\s+/g, " ");
  }

  return "--";
}
