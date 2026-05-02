import { getClaimRoleOptions, getGameScript, normalizeMatchText } from "../notes-claims.js";
import { state, typeLabels } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getStandardSetup } from "./notes-core.js";
import { getClaimedRole } from "./notes-role-info.js";

const targetScriptId = "s029";
const targetScriptNames = new Set(["超越世界线"]);

const demonRoleNames = new Set(["涡流", "小恶魔", "门之钥"]);
const minionRoleNames = new Set(["红唇女郎", "隙间", "刺客★", "刺客", "巫师★", "巫师"]);

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

function getDuplicateClaims(game) {
  const counts = new Map();
  game.players.forEach((player) => {
    const role = getClaimedRole(player, game) || getRoleByName(player.claim);
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

function analyzePlayer(player, game, duplicateClaims) {
  const role = getClaimedRole(player, game) || getRoleByName(player.claim);
  const text = getPlayerText(player);
  const normalizedText = normalizeMatchText(text);
  const reasons = [];
  let demonScore = 22;
  let minionScore = 22;

  if (role?.type === "demon") {
    demonScore += 38;
    addReason(reasons, `自称${role.name}，这是恶魔角色`, 38);
  } else if (role?.type === "minion") {
    minionScore += 36;
    addReason(reasons, `自称${role.name}，这是爪牙角色`, 36);
  } else if (role?.type === "outsider") {
    demonScore += 8;
    minionScore += 6;
    addReason(reasons, `自称外来者，容易成为邪恶伪装位`, 8);
  } else if (role?.type === "townsfolk") {
    demonScore -= 7;
    minionScore -= 5;
    addReason(reasons, `自称镇民，基础邪恶权重略降`, 7);
  } else if (!String(player.claim || "").trim()) {
    demonScore += 10;
    minionScore += 9;
    addReason(reasons, "尚未录入身份声明", 10);
  }

  if (role?.id && duplicateClaims.get(role.id) > 1) {
    demonScore += 15;
    minionScore += 15;
    addReason(reasons, `${role.name}出现多人对跳`, 15);
  }

  if (player.alignment === "evil") {
    demonScore += 18;
    minionScore += 18;
    addReason(reasons, "手动判断为坏", 18);
  } else if (player.alignment === "suspect") {
    demonScore += 12;
    minionScore += 12;
    addReason(reasons, "手动判断为疑", 12);
  } else if (player.alignment === "good") {
    demonScore -= 16;
    minionScore -= 14;
    addReason(reasons, "手动判断为好", 16);
  }

  if (player.condition === "poisoned" || player.condition === "drunk") {
    demonScore -= 4;
    minionScore -= 2;
    addReason(reasons, "被标记为醉/毒，信息冲突优先解释为失真", 4);
  }

  if (textHasAny(normalizedText, suspicionKeywords)) {
    demonScore += 13;
    minionScore += 13;
    addReason(reasons, "备注中存在可疑或冲突信号", 13);
  }

  if (textHasAny(normalizedText, trustKeywords)) {
    demonScore -= 8;
    minionScore -= 8;
    addReason(reasons, "备注中存在可信/确认信号", 8);
  }

  if (textHasAny(normalizedText, poisonKeywords)) {
    demonScore += 4;
    minionScore += 6;
    addReason(reasons, "备注涉及醉毒或错误信息，需要保留邪恶可能", 6);
  }

  if (player.status === "executed") {
    minionScore += 3;
    demonScore -= 3;
  }

  if (player.status === "night-dead") {
    demonScore -= 10;
    minionScore -= 6;
    addReason(reasons, "夜晚死亡，通常降低当前恶魔嫌疑", 10);
  }

  return {
    player,
    role,
    demonScore: clampScore(demonScore),
    minionScore: clampScore(minionScore),
    evilScore: clampScore((demonScore + minionScore) / 2),
    reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 3),
  };
}

function normalizePercent(items, field, targetCount) {
  const total = items.reduce((sum, item) => sum + item[field], 0) || 1;
  return items.map((item) => ({
    ...item,
    [`${field}Percent`]: clampScore((item[field] / total) * targetCount * 100),
  }));
}

export function buildBeyondWorldlineAnalysis(game) {
  const setup = getStandardSetup(game.playerCount);
  const duplicateClaims = getDuplicateClaims(game);
  let items = game.players.map((player) => analyzePlayer(player, game, duplicateClaims));

  items = normalizePercent(items, "demonScore", setup.demon);
  items = normalizePercent(items, "minionScore", setup.minion);

  const demonCandidates = [...items]
    .sort((a, b) => b.demonScorePercent - a.demonScorePercent)
    .slice(0, 5);
  const minionCandidates = [...items]
    .sort((a, b) => b.minionScorePercent - a.minionScorePercent)
    .slice(0, Math.max(5, setup.minion + 2));
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
    groups: getRoleGroups(game),
    items,
    demonCandidates,
    minionCandidates,
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
          <h3>恶魔 / 爪牙候选</h3>
        </div>
        <span>${game.playerCount}人局：爪牙 ${analysis.setup.minion} / 恶魔 ${analysis.setup.demon}</span>
      </div>

      <div class="notes-analysis-grid">
        <section>
          <h4>恶魔候选</h4>
          ${analysis.demonCandidates.map((candidate) => renderCandidate(candidate, "demonScore")).join("")}
        </section>
        <section>
          <h4>爪牙候选</h4>
          ${analysis.minionCandidates.map((candidate) => renderCandidate(candidate, "minionScore")).join("")}
        </section>
      </div>

      <section class="notes-analysis-pairs">
        <h4>可能邪恶组合</h4>
        ${analysis.pairCandidates
          .map(
            (pair) => `
              <div>
                <strong>${escapeHtml(`${pair.demon.player.seat}号恶魔 + ${pair.minion.player.seat}号爪牙`)}</strong>
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
