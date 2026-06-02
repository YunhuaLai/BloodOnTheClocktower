import { getNotesGameCount } from "./notes-state.js";
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
  const cards = [
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: state.roles.length,
      countLabel: "个角色",
      text: "按身份、能力关键词或所属剧本查角色。",
      action: "查角色",
      featured: true,
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: state.scripts.length,
      countLabel: "个板子",
      text: "查看剧本介绍、角色表、首夜与其他夜顺序。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: state.terms.length,
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

export function renderHome() {
  document.title = "血染钟楼对局房间";
  const savedGameCount = getNotesGameCount();
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">对局房间</p>
        <h1>
          <span class="home-title-line">今晚的局，</span>
          <span class="home-title-line">从房间开始。</span>
        </h1>
        <p class="lead">
          创建或继续本地对局，记录座位、身份声明、投票、死亡和每日信息；需要时再打开角色、板子和术语资料。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link primary-link--hero" href="/notes?create=1" data-link>创建房间</a>
          <a class="secondary-link" href="/notes" data-link>继续对局</a>
        </div>
      </div>

      <aside class="room-launch-panel" aria-labelledby="roomLaunchTitle">
        <p class="eyebrow">开局检查</p>
        <h2 id="roomLaunchTitle">先定四件事</h2>
        <p>把对局骨架定下来，后面的记录才不会散。</p>
        <div class="room-launch-checks" aria-label="开局检查项">
          <div>
            <strong>剧本</strong>
            <span>固定板子或自定义角色池</span>
          </div>
          <div>
            <strong>人数</strong>
            <span>自动带出基础阵营配置</span>
          </div>
          <div>
            <strong>视角</strong>
            <span>玩家记录或说书人记录</span>
          </div>
          <div>
            <strong>座位</strong>
            <span>身份声明、状态和信息落点</span>
          </div>
        </div>
        <a class="room-continue-link" href="/notes" data-link>
          ${savedGameCount ? `继续 ${savedGameCount} 个已保存对局` : "查看对局房间"}
        </a>
      </aside>
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">资料入口</p>
          <h2 id="directoryTitle">查需要的资料</h2>
        </div>
        <p class="section-note">角色、板子和术语分开查；统计只保留在各自入口里。</p>
      </div>
      <div class="directory-grid">
        ${renderHomeDirectory()}
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">规则速览</p>
          <h2 id="rulesTitle">游戏速览</h2>
        </div>
        <p class="section-note">给新玩家开局前快速过一遍：先看流程，再看容易忘的规则点。</p>
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
