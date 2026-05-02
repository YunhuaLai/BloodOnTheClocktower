import { getClaimRoleOptions, getGameScript, normalizeMatchText } from "../notes-claims.js";
import { getDraftOrPlayer } from "../notes-state.js";
import { state, typeLabels } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getStandardSetup } from "./notes-core.js";
import { getClaimedRole } from "./notes-role-info.js";

const targetScriptId = "s029";
const targetScriptNames = new Set(["超越世界线"]);

const demonRoleNames = new Set(["涡流", "小恶魔", "门之钥"]);
const minionRoleNames = new Set(["红唇女郎", "隙间", "刺客★", "刺客", "巫师★", "巫师"]);
const deadStatuses = new Set(["night-dead", "executed"]);

const suspicionKeywords = [
  "可疑",
  "冲突",
  "像坏",
  "像恶",
  "恶魔候选",
  "爪牙候选",
  "不可信",
  "说谎",
  "保人链",
  "抗推",
];

const trustKeywords = ["可信", "坐实", "确认", "保好", "信息位", "首夜信息", "死后信息"];
const poisonKeywords = ["醉", "毒", "错误信息", "中毒", "酒鬼", "涡流", "门之钥"];

function getAnalysisPlayers(game) {
  return game.players.map((player) => getDraftOrPlayer(player));
}

function getRoleByName(name) {
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

function getPlayerRole(player, game) {
  return getClaimedRole(player, game) || getRoleByName(player.claim);
}

function isBeyondWorldlineGame(game) {
  const script = getGameScript(game);
  const scriptName = normalizeMatchText(game?.scriptName);
  return (
    script?.id === targetScriptId ||
    targetScriptNames.has(script?.name) ||
    targetScriptNames.has(game?.scriptName) ||
    scriptName.includes(normalizeMatchText("超越世界线"))
  );
}

function clampScore(score) {
  return Math.max(1, Math.min(99, Math.round(score)));
}

function addReason(reasons, text, weight) {
  reasons.push({ text, weight: Math.abs(weight) });
}

function textHasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isDead(player) {
  return deadStatuses.has(player.status);
}

function isAlive(player) {
  return player.status === "alive";
}

function getPlayerText(player) {
  return [
    player.claim,
    player.extraInfo,
    player.notes,
    ...(player.externalReports || []).map((report) => report.note),
  ]
    .filter(Boolean)
    .join(" ");
}

function getDuplicateClaims(players, game) {
  const counts = new Map();
  players.forEach((player) => {
    const role = getPlayerRole(player, game);
    if (!role?.id) {
      return;
    }
    counts.set(role.id, (counts.get(role.id) || 0) + 1);
  });
  return counts;
}

function getRoleGroups(game) {
  const roles = getClaimRoleOptions(game).filter((role) => role.type !== "fabled");
  return ["townsfolk", "outsider", "minion", "demon"].map((type) => ({
    type,
    roles: roles.filter((role) => role.type === type),
  }));
}

function getPlayerBySeat(players, seat) {
  return players.find((player) => Number(player.seat) === Number(seat)) || null;
}

function normalizeSeat(value, playerCount) {
  const seat = Number.parseInt(value, 10);
  if (!Number.isFinite(seat) || seat < 1 || seat > playerCount) {
    return 0;
  }

  return seat;
}

function getNeighborSeats(seat, playerCount) {
  const currentSeat = normalizeSeat(seat, playerCount);
  if (!currentSeat) {
    return [];
  }

  const left = currentSeat === 1 ? playerCount : currentSeat - 1;
  const right = currentSeat === playerCount ? 1 : currentSeat + 1;
  return left === right ? [left] : [left, right];
}

function getClockwiseSeatsBetween(startSeat, endSeat, playerCount) {
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

function getFirstValue(entry, keys) {
  for (const key of keys) {
    const value = entry?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function getNumericValue(entry, keys) {
  const value = getFirstValue(entry, keys);
  if (value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getSourceReliability(source, role) {
  let reliability = role?.type === "townsfolk" ? 0.72 : 0.42;

  if (source.alignment === "good") {
    reliability += 0.18;
  } else if (source.alignment === "suspect") {
    reliability -= 0.3;
  } else if (source.alignment === "evil") {
    reliability -= 0.5;
  }

  if (source.condition === "sober") {
    reliability += 0.12;
  } else if (source.condition === "poisoned" || source.condition === "drunk") {
    reliability = Math.min(reliability, 0.22);
  }

  if (isDead(source)) {
    reliability -= 0.08;
  }

  return Math.max(0.12, Math.min(1, reliability));
}

function createAdjustment() {
  return {
    demonScore: 0,
    minionScore: 0,
    formerDemonScore: 0,
    reasons: [],
  };
}

function getAdjustment(adjustments, playerId) {
  if (!adjustments.has(playerId)) {
    adjustments.set(playerId, createAdjustment());
  }

  return adjustments.get(playerId);
}

function addSeatAdjustment({
  adjustments,
  players,
  seat,
  demonScore = 0,
  minionScore = 0,
  formerDemonScore = 0,
  reason,
  weight,
}) {
  const player = getPlayerBySeat(players, seat);
  if (!player) {
    return;
  }

  const adjustment = getAdjustment(adjustments, player.id);
  adjustment.demonScore += demonScore;
  adjustment.minionScore += minionScore;
  adjustment.formerDemonScore += formerDemonScore;
  if (reason) {
    addReason(adjustment.reasons, reason, weight ?? Math.max(Math.abs(demonScore), Math.abs(minionScore), Math.abs(formerDemonScore)));
  }
}

function describeSeats(seats) {
  return seats.map((seat) => `${seat}号`).join("、");
}

function sourceLabel(source, role) {
  return `${source.seat}号${role?.name || source.claim || "信息位"}`;
}

function applyEvilCountConstraint({
  adjustments,
  players,
  source,
  role,
  seats,
  count,
  reliability,
  note,
}) {
  const relevantSeats = seats.filter((seat) => getPlayerBySeat(players, seat));
  if (!relevantSeats.length || count === null) {
    return null;
  }

  const strength = reliability;
  const label = note || `${sourceLabel(source, role)}报${describeSeats(relevantSeats)}中有${count}红`;

  if (count <= 0) {
    relevantSeats.forEach((seat) => {
      addSeatAdjustment({
        adjustments,
        players,
        seat,
        demonScore: -24 * strength,
        minionScore: -22 * strength,
        formerDemonScore: -12 * strength,
        reason: `${label}，若其清醒且为好，该座位偏好`,
        weight: 24 * strength,
      });
    });
    return label;
  }

  if (count >= relevantSeats.length) {
    relevantSeats.forEach((seat) => {
      addSeatAdjustment({
        adjustments,
        players,
        seat,
        demonScore: 22 * strength,
        minionScore: 20 * strength,
        formerDemonScore: 10 * strength,
        reason: `${label}，若其清醒且为好，该座位在红区内`,
        weight: 22 * strength,
      });
    });
    return label;
  }

  relevantSeats.forEach((seat) => {
    addSeatAdjustment({
      adjustments,
      players,
      seat,
      demonScore: 7 * strength,
      minionScore: 7 * strength,
      reason: `${label}，该组需要容纳${count}个红`,
      weight: 7 * strength,
    });
  });
  return label;
}

function applyGrandmotherConstraint({ adjustments, players, source, role, row, reliability }) {
  const seat = normalizeSeat(getFirstValue(row.result, ["seat", "player", "target"]), players.length);
  if (!seat) {
    return null;
  }

  const resultRole = getRoleByName(getFirstValue(row.result, ["role", "character", "claim"]));
  const label = `${sourceLabel(source, role)}得知${seat}号是善良${resultRole?.name || "玩家"}`;
  addSeatAdjustment({
    adjustments,
    players,
    seat,
    demonScore: -20 * reliability,
    minionScore: -20 * reliability,
    formerDemonScore: -12 * reliability,
    reason: `${label}，若其清醒且为好，该座位偏好`,
    weight: 20 * reliability,
  });
  return label;
}

function applyDreamerConstraint({ adjustments, players, source, role, row, game, reliability }) {
  const seat = normalizeSeat(getFirstValue(row.target, ["seat", "player", "target"]), game.playerCount);
  const target = getPlayerBySeat(players, seat);
  if (!target) {
    return null;
  }

  const goodRole = getRoleByName(getFirstValue(row.result, ["good_role", "goodRole", "good"]));
  const evilRole = getRoleByName(getFirstValue(row.result, ["evil_role", "evilRole", "evil"]));
  if (!goodRole && !evilRole) {
    return null;
  }

  const targetRole = getPlayerRole(target, game);
  const label = `${sourceLabel(source, role)}给${seat}号筑梦：${goodRole?.name || "好身份"} / ${evilRole?.name || "坏身份"}`;

  if (targetRole?.id && goodRole?.id === targetRole.id) {
    addSeatAdjustment({
      adjustments,
      players,
      seat,
      demonScore: -18 * reliability,
      minionScore: -18 * reliability,
      formerDemonScore: -10 * reliability,
      reason: `${label}，且目标自称落在好身份上`,
      weight: 18 * reliability,
    });
    return label;
  }

  if (targetRole?.id && evilRole?.id === targetRole.id) {
    addSeatAdjustment({
      adjustments,
      players,
      seat,
      demonScore: evilRole.type === "demon" ? 24 * reliability : 10 * reliability,
      minionScore: evilRole.type === "minion" ? 24 * reliability : 10 * reliability,
      formerDemonScore: evilRole.type === "demon" ? 14 * reliability : 4 * reliability,
      reason: `${label}，且目标自称落在坏身份上`,
      weight: 24 * reliability,
    });
    return label;
  }

  addSeatAdjustment({
    adjustments,
    players,
    seat,
    demonScore: evilRole?.type === "demon" ? 11 * reliability : 3 * reliability,
    minionScore: evilRole?.type === "minion" ? 11 * reliability : 3 * reliability,
    formerDemonScore: evilRole?.type === "demon" ? 6 * reliability : 2 * reliability,
    reason: `${label}，目标需要在二选一里解释`,
    weight: 11 * reliability,
  });
  return label;
}

function applyPriestConstraint({ adjustments, players, source, role, row, reliability }) {
  const seats = ["seat1", "seat2", "first", "second"]
    .map((key) => normalizeSeat(row.target?.[key], players.length))
    .filter(Boolean);
  const resultRole = getRoleByName(getFirstValue(row.result, ["role", "character"]));
  if (!seats.length || !resultRole) {
    return null;
  }

  const label = `${sourceLabel(source, role)}得知${describeSeats(seats)}都不是${resultRole.name}`;
  seats.forEach((seat) => {
    addSeatAdjustment({
      adjustments,
      players,
      seat,
      demonScore: resultRole.type === "demon" ? -18 * reliability : 0,
      minionScore: resultRole.type === "minion" ? -18 * reliability : 0,
      formerDemonScore: resultRole.type === "demon" ? -10 * reliability : 0,
      reason: `${label}，若其清醒且为好，可排除该类型`,
      weight: 18 * reliability,
    });
  });
  return label;
}

function buildSkillAdjustments(players, game) {
  const adjustments = new Map();
  const notes = [];

  players.forEach((source) => {
    const role = getPlayerRole(source, game);
    if (!role) {
      return;
    }

    const rows = getRows(source);
    const reliability = getSourceReliability(source, role);
    const roleName = role.name || "";

    rows.forEach((row) => {
      let note = null;

      if (roleName.includes("共情者")) {
        const count = getNumericValue(row.result, ["count", "evilCount", "number", "value"]);
        note = applyEvilCountConstraint({
          adjustments,
          players,
          source,
          role,
          seats: getNeighborSeats(source.seat, game.playerCount),
          count,
          reliability,
        });
      } else if (roleName.includes("植物学家")) {
        const targetSeat = normalizeSeat(getFirstValue(row.target, ["seat", "player", "target"]), game.playerCount);
        const count = getNumericValue(row.result, ["count", "evilCount", "number", "value"]);
        note = applyEvilCountConstraint({
          adjustments,
          players,
          source,
          role,
          seats: getNeighborSeats(targetSeat, game.playerCount),
          count,
          reliability,
          note: `${sourceLabel(source, role)}报${targetSeat}号邻座有${count}红`,
        });
      } else if (roleName.includes("提夫林")) {
        const targetSeat = normalizeSeat(getFirstValue(row.target, ["seat", "player", "target"]), game.playerCount);
        const count = getNumericValue(row.result, ["count", "evilCount", "number", "value"]);
        note = applyEvilCountConstraint({
          adjustments,
          players,
          source,
          role,
          seats: getClockwiseSeatsBetween(source.seat, targetSeat, game.playerCount),
          count,
          reliability: reliability * 0.82,
          note: `${sourceLabel(source, role)}报到${targetSeat}号顺时针之间有${count}红`,
        });
      } else if (roleName.includes("祖母")) {
        note = applyGrandmotherConstraint({ adjustments, players, source, role, row, reliability });
      } else if (roleName.includes("筑梦师")) {
        note = applyDreamerConstraint({ adjustments, players, source, role, row, game, reliability });
      } else if (roleName.includes("牧师")) {
        note = applyPriestConstraint({ adjustments, players, source, role, row, reliability });
      }

      if (note) {
        notes.push({
          text: `${note}（可靠度${Math.round(reliability * 100)}%）`,
          reliability,
        });
      }
    });
  });

  return { adjustments, notes };
}

function analyzePlayer(player, game, duplicateClaims, transferPressure) {
  const role = getPlayerRole(player, game);
  const text = getPlayerText(player);
  const normalizedText = normalizeMatchText(text);
  const reasons = [];
  let demonScore = 20;
  let minionScore = 20;
  let formerDemonScore = 10;

  if (role?.type === "demon") {
    demonScore += 40;
    formerDemonScore += 22;
    addReason(reasons, `自称${role.name}，这是恶魔角色`, 40);
  } else if (role?.type === "minion") {
    minionScore += 36;
    addReason(reasons, `自称${role.name}，这是爪牙角色`, 36);
    if (role.name === "红唇女郎" && transferPressure) {
      demonScore += 12;
      addReason(reasons, "局面存在死亡恶魔交接可能，红唇女郎可变成恶魔", 12);
    }
  } else if (role?.type === "outsider") {
    demonScore += 8;
    minionScore += 6;
    addReason(reasons, "自称外来者，容易成为邪恶伪装位", 8);
  } else if (role?.type === "townsfolk") {
    demonScore -= 7;
    minionScore -= 5;
    formerDemonScore -= 4;
    addReason(reasons, "自称镇民，基础邪恶权重略降", 7);
  } else if (!String(player.claim || "").trim()) {
    demonScore += 10;
    minionScore += 9;
    addReason(reasons, "尚未录入身份声明", 10);
  }

  if (role?.id && duplicateClaims.get(role.id) > 1) {
    demonScore += 15;
    minionScore += 15;
    formerDemonScore += 8;
    addReason(reasons, `${role.name}出现多人对跳`, 15);
  }

  if (player.alignment === "evil") {
    demonScore += 20;
    minionScore += 20;
    formerDemonScore += 12;
    addReason(reasons, "手动判断为坏", 20);
  } else if (player.alignment === "suspect") {
    demonScore += 12;
    minionScore += 12;
    formerDemonScore += 7;
    addReason(reasons, "手动判断为疑", 12);
  } else if (player.alignment === "good") {
    demonScore -= 18;
    minionScore -= 16;
    formerDemonScore -= 10;
    addReason(reasons, "手动判断为好", 18);
  }

  if (player.condition === "poisoned" || player.condition === "drunk") {
    demonScore -= 4;
    minionScore -= 2;
    addReason(reasons, "被标记为醉/毒，信息冲突优先解释为失真", 4);
  }

  if (textHasAny(normalizedText, suspicionKeywords)) {
    demonScore += 13;
    minionScore += 13;
    formerDemonScore += 8;
    addReason(reasons, "备注中存在可疑或冲突信号", 13);
  }

  if (textHasAny(normalizedText, trustKeywords)) {
    demonScore -= 8;
    minionScore -= 8;
    formerDemonScore -= 5;
    addReason(reasons, "备注中存在可信/确认信号", 8);
  }

  if (textHasAny(normalizedText, poisonKeywords)) {
    demonScore += 4;
    minionScore += 6;
    addReason(reasons, "备注涉及醉毒或错误信息，需要保留邪恶可能", 6);
  }

  if (player.status === "executed") {
    demonScore -= 24;
    minionScore -= 10;
    formerDemonScore += 18;
    addReason(reasons, "已被处决，通常排除现任恶魔，但保留原恶魔/交接线", 24);
  }

  if (player.status === "night-dead") {
    demonScore -= 30;
    minionScore -= 12;
    formerDemonScore += 20;
    addReason(reasons, "夜晚死亡，现任恶魔嫌疑大降；小恶魔自刀等原恶魔线保留", 30);
  }

  if (!isAlive(player)) {
    demonScore -= 10;
  }

  return {
    player,
    role,
    demonScore,
    minionScore,
    formerDemonScore,
    evilScore: (demonScore + minionScore) / 2,
    reasons,
  };
}

function applyAdjustments(items, adjustments) {
  return items.map((item) => {
    const adjustment = adjustments.get(item.player.id);
    if (!adjustment) {
      return item;
    }

    return {
      ...item,
      demonScore: item.demonScore + adjustment.demonScore,
      minionScore: item.minionScore + adjustment.minionScore,
      formerDemonScore: item.formerDemonScore + adjustment.formerDemonScore,
      reasons: [...item.reasons, ...adjustment.reasons],
    };
  });
}

function applyEvilBudget(items, setup) {
  const evilSlots = setup.minion + setup.demon;
  const markedEvil = items.filter((item) => item.player.alignment === "evil").length;
  const openItems = items.filter((item) => !["good", "evil"].includes(item.player.alignment));
  const remainingEvilSlots = Math.max(evilSlots - markedEvil, 0);

  return items.map((item) => {
    let demonScore = item.demonScore;
    let minionScore = item.minionScore;
    const reasons = [...item.reasons];

    if (markedEvil >= evilSlots && item.player.alignment !== "evil") {
      demonScore -= 14;
      minionScore -= 14;
      addReason(reasons, `已标红人数达到${evilSlots}个邪恶名额，其余人降权`, 14);
    } else if (
      remainingEvilSlots > 0 &&
      openItems.length > 0 &&
      openItems.length <= remainingEvilSlots + 1 &&
      openItems.some((openItem) => openItem.player.id === item.player.id)
    ) {
      demonScore += 10;
      minionScore += 10;
      addReason(reasons, `剩余开放位接近${remainingEvilSlots}个邪恶名额，需要在其中找红`, 10);
    }

    return {
      ...item,
      demonScore,
      minionScore,
      reasons,
    };
  });
}

function applyDeathCaps(items) {
  return items.map((item) => {
    if (!isDead(item.player)) {
      return item;
    }

    const demonCap = item.role?.type === "demon" || item.player.alignment === "evil" ? 12 : 7;
    const minionCap = item.player.alignment === "evil" ? 20 : 12;
    const reasons = [...item.reasons];
    addReason(reasons, "死亡玩家不再作为现任恶魔主候选，只保留原恶魔/交接可能", 28);

    return {
      ...item,
      demonScore: Math.min(item.demonScore, demonCap),
      minionScore: Math.min(item.minionScore, minionCap),
      reasons,
    };
  });
}

function finalizeItems(items) {
  return items.map((item) => ({
    ...item,
    demonScore: clampScore(item.demonScore),
    minionScore: clampScore(item.minionScore),
    formerDemonScore: clampScore(item.formerDemonScore),
    evilScore: clampScore((item.demonScore + item.minionScore) / 2),
    reasons: item.reasons.sort((a, b) => b.weight - a.weight).slice(0, 4),
  }));
}

function normalizePercent(items, field, targetCount) {
  const total = items.reduce((sum, item) => sum + Math.max(1, item[field]), 0) || 1;
  return items.map((item) => ({
    ...item,
    [`${field}Percent`]: clampScore((Math.max(1, item[field]) / total) * targetCount * 100),
  }));
}

export function buildBeyondWorldlineAnalysis(game) {
  const setup = getStandardSetup(game.playerCount);
  const players = getAnalysisPlayers(game);
  const duplicateClaims = getDuplicateClaims(players, game);
  const transferPressure = players.some((player) => isDead(player));
  const skillResult = buildSkillAdjustments(players, game);
  let items = players.map((player) =>
    analyzePlayer(player, game, duplicateClaims, transferPressure),
  );

  items = applyAdjustments(items, skillResult.adjustments);
  items = applyEvilBudget(items, setup);
  items = applyDeathCaps(items);
  items = finalizeItems(items);
  items = normalizePercent(items, "demonScore", setup.demon);
  items = normalizePercent(items, "minionScore", setup.minion);
  items = normalizePercent(items, "formerDemonScore", setup.demon);

  const demonCandidates = [...items]
    .sort((a, b) => b.demonScorePercent - a.demonScorePercent)
    .slice(0, 5);
  const minionCandidates = [...items]
    .sort((a, b) => b.minionScorePercent - a.minionScorePercent)
    .slice(0, Math.max(5, setup.minion + 2));
  const formerDemonCandidates = [...items]
    .filter((item) => isDead(item.player) || item.formerDemonScorePercent >= 8)
    .sort((a, b) => b.formerDemonScorePercent - a.formerDemonScorePercent)
    .slice(0, 4);
  const pairCandidates = [];

  demonCandidates.slice(0, 4).forEach((demon) => {
    minionCandidates
      .filter((minion) => minion.player.id !== demon.player.id)
      .slice(0, Math.max(3, setup.minion + 1))
      .forEach((minion) => {
        pairCandidates.push({
          demon,
          minion,
          score: demon.demonScorePercent + minion.minionScorePercent,
        });
      });
  });

  return {
    enabled: isBeyondWorldlineGame(game),
    setup,
    evilSlots: setup.minion + setup.demon,
    markedEvil: players.filter((player) => player.alignment === "evil").length,
    groups: getRoleGroups(game),
    items,
    notes: skillResult.notes.sort((a, b) => b.reliability - a.reliability).slice(0, 6),
    demonCandidates,
    minionCandidates,
    formerDemonCandidates,
    pairCandidates: pairCandidates.sort((a, b) => b.score - a.score).slice(0, 5),
  };
}

function renderCandidate(candidate, field) {
  const player = candidate.player;
  const percent = candidate[`${field}Percent`];
  const label = `${player.seat}号 ${player.name || player.claim || "未命名"}`;
  const claim = candidate.role?.name || player.claim || "未填身份";

  return `
    <article class="notes-analysis-candidate">
      <div class="notes-analysis-candidate-main">
        <strong>${escapeHtml(label)}</strong>
        <span>${percent}%</span>
      </div>
      <p>${escapeHtml(claim)}</p>
      <ul>
        ${
          candidate.reasons.length
            ? candidate.reasons.map((reason) => `<li>${escapeHtml(reason.text)}</li>`).join("")
            : "<li>暂无明显冲突，按基础世界线权重保留</li>"
        }
      </ul>
    </article>
  `;
}

function renderRoleGroup(group) {
  return `
    <section class="notes-analysis-role-group notes-analysis-role-group--${escapeHtml(group.type)}">
      <h4>${escapeHtml(typeLabels[group.type] || group.type)}</h4>
      <div>
        ${group.roles
          .map((role) => {
            const important =
              demonRoleNames.has(role.name) || minionRoleNames.has(role.name);
            return `<span class="${important ? "is-evil-role" : ""}">${escapeHtml(role.name)}</span>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSkillNotes(notes) {
  if (!notes.length) {
    return `
      <section class="notes-analysis-signals">
        <h4>已读取技能约束</h4>
        <p>还没有可结构化使用的技能结果；先录入如“邻座红数”“筑梦二选一”“祖母信息”等。</p>
      </section>
    `;
  }

  return `
    <section class="notes-analysis-signals">
      <h4>已读取技能约束</h4>
      <ul>
        ${notes.map((note) => `<li>${escapeHtml(note.text)}</li>`).join("")}
      </ul>
    </section>
  `;
}

export function renderBeyondWorldlineAnalysis(game) {
  const analysis = buildBeyondWorldlineAnalysis(game);
  if (!analysis.enabled) {
    return "";
  }

  return `
    <section class="notes-analysis-panel">
      <div class="notes-analysis-header">
        <div>
          <p class="eyebrow">超越世界线分析</p>
          <h3>现任恶魔 / 爪牙 / 原恶魔</h3>
        </div>
        <span>${game.playerCount}人局：邪恶 ${analysis.evilSlots}（爪牙 ${analysis.setup.minion} / 恶魔 ${analysis.setup.demon}），已标红 ${analysis.markedEvil}</span>
      </div>

      ${renderSkillNotes(analysis.notes)}

      <div class="notes-analysis-grid">
        <section>
          <h4>现任恶魔候选</h4>
          ${analysis.demonCandidates.map((candidate) => renderCandidate(candidate, "demonScore")).join("")}
        </section>
        <section>
          <h4>爪牙候选</h4>
          ${analysis.minionCandidates.map((candidate) => renderCandidate(candidate, "minionScore")).join("")}
        </section>
        <section>
          <h4>原恶魔/交接线</h4>
          ${
            analysis.formerDemonCandidates.length
              ? analysis.formerDemonCandidates
                  .map((candidate) => renderCandidate(candidate, "formerDemonScore"))
                  .join("")
              : "<p class=\"notes-analysis-empty\">暂无明显原恶魔线。</p>"
          }
        </section>
      </div>

      <section class="notes-analysis-pairs">
        <h4>可能邪恶组合</h4>
        ${analysis.pairCandidates
          .map(
            (pair) => `
              <div>
                <strong>${escapeHtml(`${pair.demon.player.seat}号现任恶魔 + ${pair.minion.player.seat}号爪牙`)}</strong>
                <span>${escapeHtml(`${pair.demon.demonScorePercent}% / ${pair.minion.minionScorePercent}%`)}</span>
              </div>
            `,
          )
          .join("")}
      </section>

      <div class="notes-analysis-roles">
        ${analysis.groups.map(renderRoleGroup).join("")}
      </div>
    </section>
  `;
}
