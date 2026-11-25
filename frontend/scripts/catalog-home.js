import { ensureNotesState } from "./notes-state.js";
import { formatPhaseLabel, getAliveCount, getTotalPlayerCount } from "./notes/notes-core.js";
import { scrollToHash } from "./router.js";
import { app, roleTypeOrder, state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function getRoleTypeSummary() {
  return roleTypeOrder
    .map((type) => {
      const count = state.roles.filter((role) => role.type === type).length;
      return count ? `${typeLabels[type] || type} ${count}` : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function renderHomeDirectory() {
  const counts = state.catalog.counts || {};
  const cards = [
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: counts.roles || state.roles.length,
      countLabel: "个角色",
      text: "按身份、能力关键词或所属剧本查角色。",
      action: "查角色",
      featured: true,
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: counts.scripts || state.scripts.length,
      countLabel: "个板子",
      text: "查看剧本介绍、角色表、首夜与其他夜顺序。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: counts.terms || state.terms.length,
      countLabel: "个术语",
      text: "查常见机制、状态和能力用语。",
      action: "查术语",
    },
  ];

  return cards
    .map(
      (card) => `
        <a class="directory-card${card.featured ? " directory-card--featured" : ""}" href="${card.href}" data-link>
          <p class="eyebrow">${escapeHtml(card.eyebrow)}</p>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.text)}</p>
          <div class="directory-meta">
            <strong>${card.count}</strong>
            <span>${escapeHtml(card.countLabel)}</span>
          </div>
          <span class="card-action">${escapeHtml(card.action)}</span>
        </a>
      `,
    )
    .join("");
}

function renderHomeFlow() {
  const steps = [
    {
      title: "开局",
      text: "选定剧本和人数，确认旅行者、传奇角色与特殊开局说明。",
    },
    {
      title: "首夜",
      text: "说书人按夜晚顺序唤醒角色，记录身份信息、醉酒中毒和配置变化。",
    },
    {
      title: "白天",
      text: "玩家自由讨论、提名和投票；通常每天最多处决一名玩家。",
    },
    {
      title: "胜负",
      text: "善良方找出并处决恶魔；邪恶方隐藏恶魔并把局面拖到残局。",
    },
  ];

  return steps
    .map(
      (step, index) => `
        <article class="game-flow-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.text)}</p>
        </article>
      `,
    )
    .join("");
}

function renderHomeRules() {
  return state.rules
    .map(
      (rule) => `
        <article class="quick-rule-card">
          <h3>${escapeHtml(rule.title)}</h3>
          <p>${escapeHtml(rule.text)}</p>
        </article>
      `,
    )
    .join("");
}

const HOME_RECENT_GAME_LIMIT = 3;

// Starred games first, then the most recently touched: the same order as the saved-games list.
export function getRecentGames(games, limit = HOME_RECENT_GAME_LIMIT) {
  return [...games]
    .sort((left, right) => {
      if (Boolean(left.favorite) !== Boolean(right.favorite)) {
        return left.favorite ? -1 : 1;
      }

      return (
        new Date(right.updatedAt || right.createdAt).getTime() -
        new Date(left.updatedAt || left.createdAt).getTime()
      );
    })
    .slice(0, limit);
}

export function renderHomeRecentGames(games) {
  if (!games.length) {
    return "";
  }

  return `
    <aside class="home-recent" aria-labelledby="homeRecentTitle">
      <h2 class="eyebrow" id="homeRecentTitle">继续对局</h2>
      <div class="home-recent-list">
        ${getRecentGames(games)
          .map(
            (game) => `
              <a class="home-recent-game" href="/notes?game=${encodeURIComponent(game.id)}" data-link>
                <strong>${escapeHtml(game.title)}</strong>
                <span>${escapeHtml(
                  [
                    game.scriptName,
                    formatPhaseLabel(game.phaseType, game.phaseNumber),
                    `存活 ${getAliveCount(game)} / ${getTotalPlayerCount(game)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                )}</span>
              </a>
            `,
          )
          .join("")}
      </div>
      ${
        games.length > HOME_RECENT_GAME_LIMIT
          ? `<a class="home-recent-all" href="/notes" data-link>全部 ${games.length} 个对局</a>`
          : ""
      }
    </aside>
  `;
}

export function renderHome() {
  document.title = "血染钟楼对局房间";
  const savedGames = ensureNotesState().games;
  app.innerHTML = `
    <section class="workspace${savedGames.length ? "" : " workspace--single"}" id="overview">
      <div class="intro-panel">
        <h1>
          <span class="home-title-line">今晚的局，</span>
          <span class="home-title-line">从房间开始。</span>
        </h1>
        <p class="lead">
          记录座位、身份声明、投票和每日信息，需要时查角色、板子和术语。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link primary-link--hero" href="/notes?create=1" data-link>创建对局</a>
          ${savedGames.length ? "" : `<a class="secondary-link" href="/notes" data-link>导入备份</a>`}
        </div>
      </div>

      ${renderHomeRecentGames(savedGames)}
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <h2 class="eyebrow" id="directoryTitle">查资料</h2>
      <div class="directory-grid">
        ${renderHomeDirectory()}
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <h2 id="rulesTitle">规则速览</h2>
        <p class="section-note">开局前快速过一遍：先看流程，再看容易忘的规则点。</p>
      </div>
      <div class="game-overview-grid">
        <div class="game-flow" aria-label="对局流程">
          ${renderHomeFlow()}
        </div>
        <div class="quick-rule-grid" aria-label="常用规则点">
          ${renderHomeRules()}
        </div>
      </div>
    </section>
  `;

  scrollToHash();
}
