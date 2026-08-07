export const NOTES_SCHEMA_VERSION = 2;

export function createGameBackupEnvelope(game, exportedAt = new Date().toISOString()) {
  return {
    type: "botc-game-backup",
    schemaVersion: NOTES_SCHEMA_VERSION,
    exportedAt,
    game,
  };
}

export function createNotesBackupEnvelope(
  games,
  activeGameId,
  exportedAt = new Date().toISOString(),
) {
  return {
    type: "botc-notes-backup",
    schemaVersion: NOTES_SCHEMA_VERSION,
    exportedAt,
    activeGameId,
    games,
  };
}

export function getImportableGames(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("备份文件格式无效。");
  }

  const schemaVersion = Number(payload.schemaVersion) || 1;
  if (schemaVersion > NOTES_SCHEMA_VERSION) {
    throw new Error("这个备份由更新版本创建，请先更新应用后再导入。");
  }

  let games = [];
  if (payload.type === "botc-game-backup" && payload.game) {
    games = [payload.game];
  } else if (Array.isArray(payload.games)) {
    games = payload.games;
  } else if (Array.isArray(payload.players)) {
    games = [payload];
  }

  const validGames = games.filter(
    (game) =>
      game &&
      typeof game === "object" &&
      !Array.isArray(game) &&
      Array.isArray(game.players),
  );
  if (!validGames.length) {
    throw new Error("备份中没有可恢复的对局。");
  }

  return validGames;
}
