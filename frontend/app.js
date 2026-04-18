const app = document.querySelector("#app");

const typeLabels = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
};

const typeDescriptions = {
  townsfolk: "善良阵营的主要信息与功能角色",
  outsider: "善良阵营，但能力常带来负担或干扰",
  minion: "邪恶阵营，负责保护恶魔并制造混乱",
  demon: "邪恶阵营核心，通常决定夜晚死亡",
};

const state = {
  activeFilter: "all",
  rules: [],
  scripts: [],
  roles: [],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getScriptById(id) {
  return state.scripts.find((script) => script.id === id);
}

function getRoleById(id) {
  return state.roles.find((role) => role.id === id);
}

function listItems(items) {
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function detailBlock(title, content) {
  const body = Array.isArray(content)
    ? listItems(content)
    : `<p>${escapeHtml(content)}</p>`;

  return `
    <section class="detail-block">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

function compactListLinks(items, type) {
  if (!items.length) {
    return `<p class="muted">当前还没有录入关联条目。</p>`;
  }

  return `
    <div class="compact-list">
      ${items
        .map(
          (item) => `
            <a href="/${type}/${escapeHtml(item.id)}" data-link>
              <span>${escapeHtml(item.name)}</span>
              <small>${type === "roles" ? escapeHtml(typeLabels[item.type] || item.type) : escapeHtml(item.level)}</small>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderHome() {
  document.title = "血染钟楼百科";
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">社交推理 · 说书人 · 阵营博弈</p>
        <h1>查规则、看板子、找角色，一局开始前够用了。</h1>
        <p class="lead">
          这里先整理《血染钟楼》的基础概念、官方入门板子和常见角色定位。所有能力说明都采用概括性转述，方便快速理解，不替代官方规则书。
        </p>
        <div class="quick-stats" aria-label="资料概览">
          <div>
            <strong>${state.scripts.length}</strong>
            <span>个板子</span>
          </div>
          <div>
            <strong>${state.roles.length}</strong>
            <span>个角色</span>
          </div>
          <div>
            <strong>4</strong>
            <span>类阵营/身份</span>
          </div>
        </div>
      </div>

      <div class="image-strip" aria-label="氛围图">
        <img
          src="https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=80"
          alt="夜晚烛光"
        />
        <img
          src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
          alt="山谷村庄"
        />
        <img
          src="https://images.unsplash.com/photo-1518562180175-34a163b1a9a6?auto=format&fit=crop&w=900&q=80"
          alt="旧书与桌面"
        />
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <p class="eyebrow">先懂这几个词</p>
        <h2 id="rulesTitle">游戏速览</h2>
      </div>
      <div class="rule-grid" id="ruleGrid"></div>
    </section>

    <section class="section" id="scripts" aria-labelledby="scriptsTitle">
      <div class="section-heading">
        <p class="eyebrow">剧本 / 板子</p>
        <h2 id="scriptsTitle">从入门到混乱</h2>
      </div>
      <div class="script-grid" id="scriptGrid"></div>
    </section>

    <section class="section role-browser" id="roles" aria-labelledby="rolesTitle">
      <div class="section-heading role-heading">
        <div>
          <p class="eyebrow">角色百科</p>
          <h2 id="rolesTitle">按板子、身份和关键词筛选</h2>
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
      </div>

      <div class="role-grid" id="roleGrid"></div>
    </section>
  `;

  renderRules();
  renderScripts();
  renderRoles();
  syncFilterButtons();
  scrollToHash();
}

function renderRules() {
  const ruleGrid = document.querySelector("#ruleGrid");
  ruleGrid.innerHTML = state.rules
    .map(
      (rule) => `
        <article class="rule-card">
          <h3>${escapeHtml(rule.title)}</h3>
          <p>${escapeHtml(rule.text)}</p>
        </article>
      `,
    )
    .join("");
}

function renderScripts() {
  const scriptGrid = document.querySelector("#scriptGrid");
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

function roleMatchesSearch(role, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    role.name,
    role.script,
    typeLabels[role.type],
    role.summary,
    role.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function renderRoles() {
  const roleGrid = document.querySelector("#roleGrid");
  const searchInput = document.querySelector("#searchInput");
  const query = searchInput?.value.trim() || "";
  const visibleRoles = state.roles.filter((role) => {
    const matchesFilter =
      state.activeFilter === "all" || role.type === state.activeFilter;
    return matchesFilter && roleMatchesSearch(role, query);
  });

  if (!visibleRoles.length) {
    roleGrid.innerHTML = `<div class="empty-state">没有找到匹配角色。换个关键词试试，比如“保护”“恶魔”“开局”。</div>`;
    return;
  }

  roleGrid.innerHTML = visibleRoles
    .map(
      (role) => `
        <a class="role-card" href="/roles/${escapeHtml(role.id)}" data-link data-type="${escapeHtml(role.type)}">
          <header>
            <h3>${escapeHtml(role.name)}</h3>
            <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
          </header>
          <p>${escapeHtml(role.summary)}</p>
          <div class="script-name">${escapeHtml(role.script)}</div>
        </a>
      `,
    )
    .join("");
}

function syncFilterButtons() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}

function renderScriptDetail(id) {
  const script = getScriptById(id);

  if (!script) {
    renderNotFound("没有找到这个剧本。");
    return;
  }

  const roles = state.roles.filter((role) => role.scriptId === script.id);
  document.title = `${script.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero">
      <a class="back-link" href="/#scripts" data-link>返回板子列表</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(script.en)} · ${escapeHtml(script.level)}</p>
          <h1>${escapeHtml(script.name)}</h1>
          <p class="lead">${escapeHtml(script.detail.overview)}</p>
          <div class="script-meta detail-tags">
            <span class="tag">${escapeHtml(script.mood)}</span>
            ${script.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <img class="detail-image" src="${escapeHtml(script.image)}" alt="${escapeHtml(script.name)}氛围图" />
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${detailBlock("适合玩家", script.detail.bestFor)}
        ${detailBlock("核心体验", script.detail.playStyle)}
        ${detailBlock("说书人提示", script.detail.storytellerNotes)}
        ${detailBlock("常见坑", script.detail.commonPitfalls)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">当前资料</p>
          <h2>${roles.length} 个已录入角色</h2>
          ${compactListLinks(roles, "roles")}
        </section>
      </aside>
    </section>
  `;
}

function renderRoleDetail(id) {
  const role = getRoleById(id);

  if (!role) {
    renderNotFound("没有找到这个角色。");
    return;
  }

  const script = getScriptById(role.scriptId);
  const relatedRoles = (role.detail.relatedRoleIds || [])
    .map(getRoleById)
    .filter(Boolean);

  document.title = `${role.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero role-detail-hero" data-type="${escapeHtml(role.type)}">
      <a class="back-link" href="/#roles" data-link>返回角色列表</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(role.script)} · ${escapeHtml(typeLabels[role.type] || role.type)}</p>
          <h1>${escapeHtml(role.name)}</h1>
          <p class="lead">${escapeHtml(role.detail.overview)}</p>
          <div class="script-meta detail-tags">
            <span class="tag">${escapeHtml(typeLabels[role.type] || role.type)}</span>
            <span class="tag">${escapeHtml(typeDescriptions[role.type] || "角色资料")}</span>
          </div>
        </div>
        <div class="role-token">
          <span>${escapeHtml(role.name.slice(0, 1))}</span>
          <strong>${escapeHtml(typeLabels[role.type] || role.type)}</strong>
        </div>
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${detailBlock("能力概括", role.detail.abilitySummary)}
        ${detailBlock("玩家玩法提示", role.detail.playTips)}
        ${detailBlock("说书人注意", role.detail.storytellerTips)}
        ${detailBlock("常见误区", role.detail.commonMistakes)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">所属剧本</p>
          ${
            script
              ? `<h2><a href="/scripts/${escapeHtml(script.id)}" data-link>${escapeHtml(script.name)}</a></h2><p>${escapeHtml(script.text)}</p>`
              : `<h2>${escapeHtml(role.script)}</h2>`
          }
        </section>
        <section class="side-panel">
          <p class="eyebrow">关联角色</p>
          ${compactListLinks(relatedRoles, "roles")}
        </section>
      </aside>
    </section>
  `;
}

function renderNotFound(message = "这个页面不存在。") {
  document.title = "未找到 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">404</p>
      <h1>${escapeHtml(message)}</h1>
      <p class="lead">可能是链接写错了，也可能是这条资料还没录入。</p>
      <a class="primary-link" href="/" data-link>回到百科首页</a>
    </section>
  `;
}

function renderLoadError() {
  document.title = "资料加载失败 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">加载失败</p>
      <h1>资料加载失败。</h1>
      <p class="lead">请确认后端服务正在运行，然后刷新页面。</p>
    </section>
  `;
}

function scrollToHash() {
  if (!window.location.hash) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  requestAnimationFrame(() => {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView();
    }
  });
}

function renderRoute() {
  const segments = window.location.pathname.split("/").filter(Boolean);

  if (!segments.length) {
    renderHome();
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (segments.length === 2 && segments[0] === "scripts") {
    renderScriptDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "roles") {
    renderRoleDetail(segments[1]);
    return;
  }

  renderNotFound();
}

function navigateTo(url) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (url !== current) {
    window.history.pushState({}, "", url);
  }
  renderRoute();
}

async function loadEncyclopedia() {
  try {
    const response = await fetch("/api/encyclopedia");
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    state.rules = data.rules || [];
    state.scripts = data.scripts || [];
    state.roles = data.roles || [];
    renderRoute();
  } catch (error) {
    console.error(error);
    renderLoadError();
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) {
    return;
  }

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  navigateTo(`${url.pathname}${url.search}${url.hash}`);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) {
    return;
  }

  state.activeFilter = button.dataset.filter;
  syncFilterButtons();
  renderRoles();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "searchInput") {
    renderRoles();
  }
});

window.addEventListener("popstate", renderRoute);

loadEncyclopedia();
