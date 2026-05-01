import { getRoleScriptLabel, sortCatalogRoles } from "./catalog-helpers.js";
import { getRoleTypeSummary } from "./catalog-home.js";
import { app, roleTypeOrder, state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function renderTermIndex() {
  document.title = "术语目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero terms-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">关键词 / 术语</p>
          <h1>先把黑话对齐。</h1>
          <p class="lead">
            中毒、醉酒、疯狂、处决这些词会影响整局判断。这里先按概念查，再去角色详情看它们怎么落到实战里。
          </p>
        </div>
        <div class="collection-stats" aria-label="术语目录概览">
          <strong>${state.terms.length}</strong>
          <span>个术语</span>
        </div>
      </div>
    </section>

    <section class="section terms-section catalog-section" id="terms" aria-labelledby="termsTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">术语目录</p>
          <h2 id="termsTitle">按概念查</h2>
        </div>
      </div>
      <div class="term-grid" id="termGrid"></div>
    </section>
  `;

  renderTerms();
}

export function renderScriptIndex() {
  document.title = "板子目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero scripts-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">剧本 / 板子</p>
          <h1>从入门到混乱。</h1>
          <p class="lead">
            先看板子的节奏、适合玩家和说书人提醒，再决定这一局要开哪一张。
          </p>
        </div>
        <div class="collection-stats" aria-label="板子目录概览">
          <strong>${state.scripts.length}</strong>
          <span>个板子</span>
        </div>
      </div>
    </section>

    <section class="section catalog-section" id="scripts" aria-labelledby="scriptsTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">板子目录</p>
          <h2 id="scriptsTitle">选择今晚的局</h2>
        </div>
      </div>
      <div class="script-grid" id="scriptGrid"></div>
    </section>
  `;

  renderScripts();
}

export function renderRoleIndex() {
  document.title = "角色目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero roles-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">角色百科</p>
          <h1>按身份、板子和关键词查。</h1>
          <p class="lead">
            ${escapeHtml(getRoleTypeSummary())}。输入角色名、能力关键词或所属板子，快速缩小范围。
          </p>
        </div>
        <div class="collection-stats" aria-label="角色目录概览">
          <strong>${state.roles.length}</strong>
          <span>个角色</span>
        </div>
      </div>
    </section>

    <section class="section role-browser catalog-section" id="roles" aria-labelledby="rolesTitle">
      <div class="section-heading role-heading">
        <div>
          <p class="eyebrow">角色目录</p>
          <h2 id="rolesTitle">筛一下再看</h2>
        </div>
        <label class="search-box">
          <span>搜索</span>
          <input id="searchInput" type="search" placeholder="输入角色、能力关键词或板子" />
        </label>
      </div>

      <div class="filters" aria-label="角色筛选">
        <button class="filter active" data-filter="all">全部</button>
        <button class="filter" data-filter="townsfolk">镇民</button>
        <button class="filter" data-filter="outsider">外来者</button>
        <button class="filter" data-filter="minion">爪牙</button>
        <button class="filter" data-filter="demon">恶魔</button>
        <button class="filter" data-filter="fabled">传奇</button>
      </div>

      <div class="role-grid" id="roleGrid"></div>
    </section>
  `;

  renderRoles();
  syncFilterButtons();
}

export function renderTerms() {
  const termGrid = document.querySelector("#termGrid");
  if (!termGrid) {
    return;
  }

  termGrid.innerHTML = state.terms
    .map(
      (term) => `
        <a class="term-card" href="/terms/${escapeHtml(term.id)}" data-link>
          <small>${escapeHtml(term.category)}</small>
          <h3>${escapeHtml(term.name)}</h3>
          <p>${escapeHtml(term.summary)}</p>
          ${(term.aliases || []).length ? `<div class="term-aliases">${term.aliases.map((alias) => `<span>${escapeHtml(alias)}</span>`).join("")}</div>` : ""}
        </a>
      `,
    )
    .join("");
}

export function renderRules() {
  const ruleGrid = document.querySelector("#ruleGrid");
  if (!ruleGrid) {
    return;
  }

  ruleGrid.innerHTML = state.rules
    .map(
      (rule, index) => `
        <details class="rule-card" ${index === 0 ? "open" : ""}>
          <summary>${escapeHtml(rule.title)}</summary>
          <p>${escapeHtml(rule.text)}</p>
        </details>
      `,
    )
    .join("");
}

export function renderScripts() {
  const scriptGrid = document.querySelector("#scriptGrid");
  if (!scriptGrid) {
    return;
  }

  scriptGrid.innerHTML = state.scripts
    .map(
      (script) => `
        <a class="script-card" href="/scripts/${escapeHtml(script.id)}" data-link>
          <img src="${escapeHtml(script.image)}" alt="${escapeHtml(script.name)}氛围图" />
          <div class="script-body">
            <p class="eyebrow">${escapeHtml(script.en)} · ${escapeHtml(script.level)}</p>
            <h3>${escapeHtml(script.name)}</h3>
            <p>${escapeHtml(script.text)}</p>
            <div class="script-meta">
              <span class="tag">${escapeHtml(script.mood)}</span>
              ${script.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </a>
      `,
    )
    .join("");
}

export function roleMatchesSearch(role, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    role.name,
    getRoleScriptLabel(role),
    typeLabels[role.type],
    role.summary,
    role.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function renderRoles() {
  const roleGrid = document.querySelector("#roleGrid");
  if (!roleGrid) {
    return;
  }

  const searchInput = document.querySelector("#searchInput");
  const query = searchInput?.value.trim() || "";
  const visibleRoles = sortCatalogRoles(
    state.roles.filter((role) => {
      const matchesFilter =
        state.activeFilter === "all" || role.type === state.activeFilter;
      return matchesFilter && roleMatchesSearch(role, query);
    }),
  );

  if (!visibleRoles.length) {
    roleGrid.innerHTML = `<div class="empty-state">没有找到匹配角色。换个关键词试试，比如“保护”“恶魔”“开局”。</div>`;
    return;
  }

  if (state.activeFilter !== "all") {
    roleGrid.innerHTML = visibleRoles.map(renderRoleCard).join("");
    return;
  }

  roleGrid.innerHTML = roleTypeOrder
    .map((type) => {
      const roles = visibleRoles.filter((role) => role.type === type);
      if (!roles.length) {
        return "";
      }

      return `
        <section class="role-folder" data-type="${escapeHtml(type)}" aria-labelledby="roleFolder-${escapeHtml(type)}">
          <div class="role-folder-heading">
            <h3 id="roleFolder-${escapeHtml(type)}">${escapeHtml(typeLabels[type] || type)}</h3>
            <span>${roles.length} 个角色</span>
          </div>
          <div class="role-folder-grid">
            ${roles.map(renderRoleCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

export function renderRoleCard(role) {
  return `
    <a class="role-card" href="/roles/${escapeHtml(role.id)}" data-link data-type="${escapeHtml(role.type)}">
      <header>
        <h3>${escapeHtml(role.name)}</h3>
        <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
      </header>
      <p>${escapeHtml(role.summary)}</p>
      <div class="script-name">${escapeHtml(getRoleScriptLabel(role))}</div>
    </a>
  `;
}

export function syncFilterButtons() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}
