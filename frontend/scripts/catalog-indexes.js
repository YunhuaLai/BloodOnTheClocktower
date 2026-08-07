import { getRoleScriptLabel, sortCatalogRoles } from "./catalog-helpers.js";
import { getRoleTypeSummary } from "./catalog-home.js";
import { app, roleTypeOrder, state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

const scriptStatusLabels = {
  draft: "草稿",
  review: "待复查",
  published: "已上架",
  archived: "归档",
};

const scriptStatusOptions = [
  { value: "published", label: "已上架" },
  { value: "draft", label: "草稿" },
  { value: "review", label: "待复查" },
  { value: "archived", label: "归档" },
  { value: "all", label: "全部状态" },
];

const scriptSortOptions = [
  { value: "default", label: "默认顺序" },
  { value: "name", label: "按名称" },
  { value: "level", label: "按难度" },
  { value: "status", label: "按状态" },
  { value: "role-count", label: "按角色数" },
];

const SCRIPT_PAGE_SIZE = 60;
const ROLE_PAGE_SIZE = 60;
let scriptRenderLimit = SCRIPT_PAGE_SIZE;
let roleRenderLimit = ROLE_PAGE_SIZE;

export function resetScriptRenderLimit() {
  scriptRenderLimit = SCRIPT_PAGE_SIZE;
}

export function resetRoleRenderLimit() {
  roleRenderLimit = ROLE_PAGE_SIZE;
}

export function showMoreScripts() {
  scriptRenderLimit += SCRIPT_PAGE_SIZE;
  renderScripts();
}

export function showMoreRoles() {
  roleRenderLimit += ROLE_PAGE_SIZE;
  renderRoles();
}

export function renderTermIndex() {
  document.title = "术语目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero terms-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">关键词 / 术语</p>
          <h1>术语目录</h1>
          <p class="lead">
            按关键词查规则概念。
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
  resetScriptRenderLimit();
  document.title = "板子目录 · 血染钟楼百科";
  const statusCounts = getScriptStatusCounts();
  app.innerHTML = `
    <section class="collection-hero scripts-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">剧本 / 板子</p>
          <h1>板子目录</h1>
          <p class="lead">
            查板子、作者和角色表。
          </p>
        </div>
        <div class="collection-stats" aria-label="板子目录概览">
          <strong>${state.scripts.length}</strong>
          <span>个板子</span>
          <div class="script-status-summary">
            <span>${statusCounts.published} 已上架</span>
            <span>${statusCounts.draft} 草稿</span>
            <span>${statusCounts.review} 待复查</span>
            <span>${statusCounts.archived} 归档</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section catalog-section" id="scripts" aria-labelledby="scriptsTitle">
      <div class="section-heading scripts-heading">
        <div>
          <p class="eyebrow">板子目录</p>
          <h2 id="scriptsTitle">选择今晚的局</h2>
        </div>
      </div>
      ${renderScriptControls()}
      <div class="script-result-row">
        <span id="scriptResultCount"></span>
      </div>
      <div class="script-grid" id="scriptGrid"></div>
    </section>
  `;

  renderScripts();
}

export function renderRoleIndex() {
  resetRoleRenderLimit();
  document.title = "角色目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero roles-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">角色百科</p>
          <h1>角色目录</h1>
          <p class="lead">
            ${escapeHtml(getRoleTypeSummary())}。
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
        <button type="button" class="filter active" data-filter="all">全部</button>
        <button type="button" class="filter" data-filter="townsfolk">镇民</button>
        <button type="button" class="filter" data-filter="outsider">外来者</button>
        <button type="button" class="filter" data-filter="minion">爪牙</button>
        <button type="button" class="filter" data-filter="demon">恶魔</button>
        <button type="button" class="filter" data-filter="traveller">旅行者</button>
        <button type="button" class="filter" data-filter="fabled">传奇</button>
      </div>

      <div class="script-result-row" aria-live="polite">
        <span id="roleResultCount"></span>
      </div>

      <div class="role-grid" id="roleGrid"></div>
    </section>
  `;

  renderRoles();
  syncFilterButtons();
}

function renderTerms() {
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

function getScriptStatus(script) {
  return script.status || "published";
}

function getScriptStatusCounts() {
  return state.scripts.reduce(
    (counts, script) => {
      const status = getScriptStatus(script);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    { draft: 0, review: 0, published: 0, archived: 0 },
  );
}

function getScriptRoleCount(script) {
  return [
    ...(script.roleIds || []),
    ...(script.travellerIds || []),
    ...(script.fabledIds || []),
    ...(script.tokenIds || []),
  ].length;
}

function getScriptLevels() {
  return Array.from(new Set(state.scripts.map((script) => script.level).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "zh-Hans-CN"),
  );
}

function renderOption(option, selectedValue) {
  return `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`;
}

function renderScriptControls() {
  const levelOptions = [
    { value: "all", label: "全部难度" },
    ...getScriptLevels().map((level) => ({ value: level, label: level })),
  ];

  return `
    <div class="script-tools" aria-label="板子筛选">
      <label class="search-box script-search">
        <span>搜索</span>
        <input id="scriptSearchInput" type="search" value="${escapeHtml(state.scriptQuery)}" placeholder="输入板子、作者、风格或标签" />
      </label>
      <label class="select-box">
        <span>状态</span>
        <select id="scriptStatusFilter">
          ${scriptStatusOptions.map((option) => renderOption(option, state.scriptStatusFilter)).join("")}
        </select>
      </label>
      <label class="select-box">
        <span>难度</span>
        <select id="scriptLevelFilter">
          ${levelOptions.map((option) => renderOption(option, state.scriptLevelFilter)).join("")}
        </select>
      </label>
      <label class="select-box">
        <span>排序</span>
        <select id="scriptSort">
          ${scriptSortOptions.map((option) => renderOption(option, state.scriptSort)).join("")}
        </select>
      </label>
    </div>
  `;
}

function scriptMatchesSearch(script, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    script.name,
    script.en,
    script.englishName,
    script.author,
    script.level,
    script.mood,
    script.text,
    script.description,
    scriptStatusLabels[getScriptStatus(script)],
    ...(script.tags || []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function getVisibleScripts() {
  const query = state.scriptQuery.trim();
  const indexedScripts = state.scripts.map((script, index) => ({ script, index }));
  const visibleScripts = indexedScripts.filter(({ script }) => {
    const status = getScriptStatus(script);
    const matchesStatus =
      state.scriptStatusFilter === "all" || status === state.scriptStatusFilter;
    const matchesLevel =
      state.scriptLevelFilter === "all" || script.level === state.scriptLevelFilter;
    return matchesStatus && matchesLevel && scriptMatchesSearch(script, query);
  });

  visibleScripts.sort((left, right) => {
    if (state.scriptSort === "name") {
      return String(left.script.name || "").localeCompare(
        String(right.script.name || ""),
        "zh-Hans-CN",
      );
    }

    if (state.scriptSort === "level") {
      return String(left.script.level || "").localeCompare(
        String(right.script.level || ""),
        "zh-Hans-CN",
      );
    }

    if (state.scriptSort === "status") {
      return getScriptStatus(left.script).localeCompare(getScriptStatus(right.script), "zh-Hans-CN");
    }

    if (state.scriptSort === "role-count") {
      return getScriptRoleCount(right.script) - getScriptRoleCount(left.script);
    }

    return left.index - right.index;
  });

  return visibleScripts.map(({ script }) => script);
}

export function renderScripts() {
  const scriptGrid = document.querySelector("#scriptGrid");
  if (!scriptGrid) {
    return;
  }

  const visibleScripts = getVisibleScripts();
  const renderedScripts = visibleScripts.slice(0, scriptRenderLimit);
  const resultCount = document.querySelector("#scriptResultCount");
  if (resultCount) {
    resultCount.textContent = `显示 ${renderedScripts.length} / 匹配 ${visibleScripts.length} / 共 ${state.scripts.length} 个板子`;
  }

  if (!visibleScripts.length) {
    scriptGrid.innerHTML = `<div class="empty-state">无匹配板子。</div>`;
    return;
  }

  scriptGrid.innerHTML = renderedScripts
    .map(
      (script) => {
        const status = getScriptStatus(script);
        return `
        <a class="script-card" href="/scripts/${escapeHtml(script.id)}" data-link>
          <img src="${escapeHtml(script.image)}" alt="${escapeHtml(script.name)}氛围图" loading="lazy" decoding="async" />
          <div class="script-body">
            <p class="eyebrow">${escapeHtml(script.en || script.englishName || "未命名")} · ${escapeHtml(script.level || "未分级")}</p>
            <div class="script-card-title">
              <h3>${escapeHtml(script.name)}</h3>
              <span class="status-chip status-chip--${escapeHtml(status)}">${escapeHtml(scriptStatusLabels[status] || status)}</span>
            </div>
            <p>${escapeHtml(script.text || script.description || "")}</p>
            <div class="script-meta">
              ${script.mood ? `<span class="tag">${escapeHtml(script.mood)}</span>` : ""}
              <span class="tag">${getScriptRoleCount(script)} 角色</span>
              ${(script.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </a>
      `;
      },
    )
    .join("") + (renderedScripts.length < visibleScripts.length
      ? `<button type="button" class="catalog-load-more" data-catalog-action="more-scripts">继续显示板子</button>`
      : "");
}

function roleMatchesSearch(role, query) {
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
  const resultCount = document.querySelector("#roleResultCount");
  if (resultCount) {
    resultCount.textContent = `匹配 ${visibleRoles.length} / 共 ${state.roles.length} 个角色`;
  }

  if (!visibleRoles.length) {
    roleGrid.innerHTML = `<div class="empty-state">无匹配角色。</div>`;
    return;
  }

  if (state.activeFilter !== "all") {
    const renderedRoles = visibleRoles.slice(0, roleRenderLimit);
    roleGrid.innerHTML = renderedRoles.map(renderRoleCard).join("") +
      (renderedRoles.length < visibleRoles.length
        ? `<button type="button" class="catalog-load-more" data-catalog-action="more-roles">继续显示角色</button>`
        : "");
    return;
  }

  let renderedRoleCount = 0;
  roleGrid.innerHTML = roleTypeOrder
    .map((type) => {
      const matchingRoles = visibleRoles.filter((role) => role.type === type);
      if (!matchingRoles.length) {
        return "";
      }
      const roles = matchingRoles.slice(0, roleRenderLimit);
      renderedRoleCount += roles.length;

      return `
        <section class="role-folder" data-type="${escapeHtml(type)}" aria-labelledby="roleFolder-${escapeHtml(type)}">
          <div class="role-folder-heading">
            <h3 id="roleFolder-${escapeHtml(type)}">${escapeHtml(typeLabels[type] || type)}</h3>
            <span>显示 ${roles.length} / ${matchingRoles.length} 个角色</span>
          </div>
          <div class="role-folder-grid">
            ${roles.map(renderRoleCard).join("")}
          </div>
        </section>
      `;
    })
    .join("") + (renderedRoleCount < visibleRoles.length
      ? `<button type="button" class="catalog-load-more" data-catalog-action="more-roles">继续显示各分类角色</button>`
      : "");
}

function renderRoleCard(role) {
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
