import { renderRules } from "./catalog-indexes.js";
import { getNotesGameCount } from "./notes-state.js";
import { scrollToHash } from "./router.js";
import { app, state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function getRoleTypeSummary() {
  return Object.entries(typeLabels)
    .map(([type, label]) => {
      const count = state.roles.filter((role) => role.type === type).length;
      return count ? `${label} ${count}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function renderHomeDirectory() {
  const cards = [
    {
      eyebrow: "对局房间",
      title: "创建新房间",
      href: "/notes?create=1",
      count: getNotesGameCount(),
      countLabel: "个本地对局",
      text: "选剧本、人数和视角。",
      action: "立即创建",
      featured: true,
    },
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: state.roles.length,
      countLabel: "个角色",
      text: "按身份或关键词查。",
      action: "查角色",
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: state.scripts.length,
      countLabel: "个板子",
      text: "查看板子与角色表。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: state.terms.length,
      countLabel: "个术语",
      text: "查规则关键词。",
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

export function renderHome() {
  document.title = "血染钟楼对局房间";
  const savedGameCount = getNotesGameCount();
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">对局房间 · 本地记录 · 快速推理</p>
        <h1>
          <span class="home-title-line">开房间是第一步，</span>
          <span class="home-title-line">百科只是随手查。</span>
        </h1>
        <p class="lead">
          创建房间，记录座位、声明和每日信息。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link primary-link--hero" href="/notes?create=1" data-link>创建房间</a>
          <a class="secondary-link" href="/notes" data-link>继续对局</a>
        </div>
        <div class="quick-stats quick-stats--compact" aria-label="对局与资料概览">
          <div>
            <strong>${savedGameCount}</strong>
            <span>个本地对局</span>
          </div>
          <div>
            <strong>${state.scripts.length}</strong>
            <span>个附属板子</span>
          </div>
          <div>
            <strong>${state.roles.length}</strong>
            <span>个附属角色</span>
          </div>
          <div>
            <strong>${state.terms.length}</strong>
            <span>个附属术语</span>
          </div>
        </div>
      </div>

      <aside class="room-launch-panel" aria-labelledby="roomLaunchTitle">
        <p class="eyebrow">开局入口</p>
        <h2 id="roomLaunchTitle">创建对局房间</h2>
        <p>选剧本、人数和视角。</p>
        <a class="primary-link room-launch-action" href="/notes?create=1" data-link>立即创建房间</a>
        <div class="room-launch-steps" aria-label="创建房间会记录的内容">
          <span>剧本</span>
          <span>人数</span>
          <span>视角</span>
          <span>座位</span>
        </div>
        <a class="room-continue-link" href="/notes" data-link>
          ${savedGameCount ? `继续 ${savedGameCount} 个已保存对局` : "查看对局房间"}
        </a>
      </aside>
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">附属资料</p>
          <h2 id="directoryTitle">百科资料</h2>
        </div>
        <p class="section-note">角色、板子、术语。</p>
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
        <p class="section-note">常用规则点。</p>
      </div>
      <div class="rule-grid" id="ruleGrid"></div>
    </section>
  `;

  renderRules();
  scrollToHash();
}
