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

export function renderHomeDirectory() {
  const cards = [
    {
      eyebrow: "对局房间",
      title: "新建或继续一局",
      href: "/notes",
      count: getNotesGameCount(),
      countLabel: "个本地对局",
      text: "先把座位、声明、标签和每天得到的信息按局保存下来；之后可以扩展成创建房间，让玩家进入同一局。",
      action: "进入对局房间",
      featured: true,
    },
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: state.roles.length,
      countLabel: "个角色",
      text: "按身份筛选，或直接搜索能力、板子和关键词。",
      action: "查角色",
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: state.scripts.length,
      countLabel: "个板子",
      text: "先看每个板子的节奏、适合人群和常见坑。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: state.terms.length,
      countLabel: "个术语",
      text: "把中毒、醉酒、疯狂等容易混淆的词先对齐。",
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
  document.title = "血染钟楼百科";
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">对局房间 · 本地记录 · 多人房间预留</p>
        <h1>先开一局，再把线索和判断都放进同一个房间。</h1>
        <p class="lead">
          现在可以本地记录座位、声明、标签和每日信息；后续再接上创建房间，让不同玩家进入同一个对局空间。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link" href="/notes" data-link>进入对局房间</a>
          <a class="secondary-link" href="/roles" data-link>查角色百科</a>
          <a class="secondary-link" href="/scripts" data-link>看板子目录</a>
        </div>
        <div class="quick-stats" aria-label="对局与资料概览">
          <div>
            <strong>${getNotesGameCount()}</strong>
            <span>个本地对局</span>
          </div>
          <div>
            <strong>${state.scripts.length}</strong>
            <span>个板子</span>
          </div>
          <div>
            <strong>${state.roles.length}</strong>
            <span>个角色</span>
          </div>
          <div>
            <strong>${state.terms.length}</strong>
            <span>个术语</span>
          </div>
        </div>
      </div>

      <div class="image-strip" aria-label="氛围图">
        <img
          src="/assets/clock-tower-night.jpg"
          alt="夜色中的钟楼"
          width="1200"
          height="1600"
          decoding="async"
          fetchpriority="high"
        />
        <img
          src="/assets/medieval-town-night.jpg"
          alt="夜晚的中世纪街巷"
          width="1280"
          height="887"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/assets/candle-book.jpg"
          alt="烛光下的旧书"
          width="1280"
          height="853"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">主要入口</p>
          <h2 id="directoryTitle">对局在前，百科在后</h2>
        </div>
        <p class="section-note">先进入当前对局；需要查角色、板子或术语时，再去下面的资料目录。</p>
      </div>
      <div class="directory-grid">
        ${renderHomeDirectory()}
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">先懂这几个词</p>
          <h2 id="rulesTitle">游戏速览</h2>
        </div>
        <p class="section-note">点开当下需要的规则点，先把开局会用到的概念看明白。</p>
      </div>
      <div class="rule-grid" id="ruleGrid"></div>
    </section>
  `;

  renderRules();
  scrollToHash();
}
