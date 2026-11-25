import { getRoleScriptLabel, sortCatalogRoles } from "./catalog-helpers.js";
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
    ${renderCollectionHeader("术语目录", `${state.terms.length} 个术语`, "termsTitle")}

    <section class="section terms-section catalog-section" id="terms" aria-labelledby="termsTitle">
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
    ${renderCollectionHeader("板子目录", getScriptCountText(statusCounts), "scriptsTitle")}

    <section class="section catalog-section" id="scripts" aria-labelledby="scriptsTitle">
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
    ${renderCollectionHeader("角色目录", `${state.roles.length} 个角色`, "rolesTitle")}

    <section class="section role-browser catalog-section" id="roles" aria-labelledby="rolesTitle">
      <div class="catalog-toolbar">
        <label class="search-box">
          <span class="visually-hidden">搜索角色</span>
          <input id="searchInput" type="search" placeholder="搜索角色、能力关键词或板子" />
        </label>

        <div class="filters" aria-label="角色筛选">
          <button type="button" class="filter active" data-filter="all">全部</button>
          <button type="button" class="filter" data-filter="townsfolk">镇民</button>
          <button type="button" class="filter" data-filter="outsider">外来者</button>
          <button type="button" class="filter" data-filter="minion">爪牙</button>
          <button type="button" class="filter" data-filter="demon">恶魔</button>
          <button type="button" class="filter" data-filter="traveller">旅行者</button>
          <button type="button" class="filter" data-filter="fabled">传奇</button>
        </div>
      </div>

      <div class="script-result-row role-result-row" aria-live="polite">
        <span id="roleResultCount"></span>
        <button type="button" class="catalog-scope-toggle" id="roleScopeToggle" data-catalog-action="toggle-role-scope"></button>
      </div>

      <div class="role-grid" id="roleGrid"></div>
    </section>
  `;

  renderRoles();
  syncFilterButtons();
}

// Index pages are lookup tools: one compact title row, then the list. The site top bar already links home.
function renderCollectionHeader(title, countText, titleId) {
  return `
    <section class="collection-hero collection-hero--compact">
      <h1 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h1>
      <p class="collection-count">${escapeHtml(countText)}</p>
    </section>
  `;
}

function getScriptCountText(statusCounts) {
  return [
    `${state.scripts.length} 个板子`,
    ...["published", "draft", "review", "archived"]
      .filter((status) => statusCounts[status])
      .map((status) => `${statusCounts[status]} ${scriptStatusLabels[status]}`),
  ].join(" · ");
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
    getRoleAbilityText(role),
    role.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

// The bootstrap catalog carries the full ability text; `summary` only exists on older / detail payloads.
export function getRoleAbilityText(role) {
  return String(role.ability || role.summary || "").trim();
}

let publishedScriptCache = { scripts: null, ids: new Set(), names: new Set() };

function getPublishedScripts() {
  if (publishedScriptCache.scripts !== state.scripts) {
    const published = state.scripts.filter((script) => getScriptStatus(script) === "published");
    publishedScriptCache = {
      scripts: state.scripts,
      ids: new Set(published.map((script) => script.id)),
      names: new Set(published.map((script) => script.name)),
    };
  }

  return publishedScriptCache;
}

export function isRoleInPublishedScript(role) {
  const { ids } = getPublishedScripts();
  return (role.scriptIds || [role.scriptId]).some((id) => ids.has(id));
}

// "暗流涌动、黯月初升 等 87 个板子": published scripts first, the rest as a count.
export function getRoleScriptSummary(role) {
  const names = (role.scriptNames || []).length ? role.scriptNames : [role.script].filter(Boolean);
  if (!names.length) {
    return "未归属板子";
  }

  const published = getPublishedScripts().names;
  const ordered = [...names.filter((name) => published.has(name)), ...names.filter((name) => !published.has(name))];
  const shown = ordered.slice(0, 2).join("、");
  return ordered.length > 2 ? `${shown} 等 ${ordered.length} 个板子` : shown;
}

/**
 * Roles matching the type filter and search, split by scope. Most of the catalog comes from draft homebrew
 * scripts, so the default scope only lists roles that appear in a published script.
 */
export function getRoleMatches(query) {
  const matched = state.roles.filter((role) => {
    const matchesFilter = state.activeFilter === "all" || role.type === state.activeFilter;
    return matchesFilter && roleMatchesSearch(role, query);
  });
  const published = matched.filter(isRoleInPublishedScript);
  const showAll = state.roleScope === "all";
  return {
    visible: sortCatalogRoles(showAll ? matched : published),
    hiddenCount: showAll ? 0 : matched.length - published.length,
    showAll,
  };
}

export function renderRoles() {
  const roleGrid = document.querySelector("#roleGrid");
  if (!roleGrid) {
    return;
  }

  const searchInput = document.querySelector("#searchInput");
  const query = searchInput?.value.trim() || "";
  const { visible: visibleRoles, hiddenCount, showAll } = getRoleMatches(query);
  const resultCount = document.querySelector("#roleResultCount");
  if (resultCount) {
    resultCount.textContent = `${visibleRoles.length} 个角色`;
  }
  const scopeToggle = document.querySelector("#roleScopeToggle");
  if (scopeToggle) {
    scopeToggle.hidden = !showAll && !hiddenCount;
    scopeToggle.textContent = showAll ? "只看已上架板子的角色" : `另有 ${hiddenCount} 个在草稿板子里，显示全部`;
    scopeToggle.setAttribute("aria-pressed", showAll ? "true" : "false");
  }

  if (!visibleRoles.length) {
    roleGrid.innerHTML = `<div class="empty-state">${hiddenCount ? "已上架板子里没有匹配的角色。" : "无匹配角色。"}</div>`;
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
      <p>${escapeHtml(getRoleAbilityText(role))}</p>
      <div class="script-name">${escapeHtml(getRoleScriptSummary(role))}</div>
    </a>
  `;
}

export function syncFilterButtons() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}
