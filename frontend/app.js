const app = document.querySelector("#app");

const typeLabels = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
  fabled: "传奇角色",
};

const typeDescriptions = {
  townsfolk: "善良阵营的主要信息与功能角色",
  outsider: "善良阵营，但能力常带来负担或干扰",
  minion: "邪恶阵营，负责保护恶魔并制造混乱",
  demon: "邪恶阵营核心，通常决定夜晚死亡",
  fabled: "由说书人使用的特殊规则或配置工具",
};

const state = {
  activeFilter: "all",
  rules: [],
  scripts: [],
  roles: [],
  terms: [],
};

const importantAbilityPhrases = [
  "善良方失败",
  "善良方获胜",
  "邪恶方失败",
  "邪恶方获胜",
  "不会死亡",
  "不能死亡",
  "立刻被处决",
  "立即被处决",
  "失去能力",
  "必定为假",
  "不生效",
  "交换角色与阵营",
  "变成恶魔",
  "变成邪恶",
];

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

function getTermById(id) {
  return state.terms.find((term) => term.id === id);
}

function getScriptsForRole(role) {
  const scriptIds = role.scriptIds || [role.scriptId];
  return scriptIds.map(getScriptById).filter(Boolean);
}

function getRoleScriptLabel(role) {
  return (role.scriptNames || []).join(" / ") || role.script || "未归属剧本";
}

function getTermForKeyword(keyword) {
  return state.terms.find((term) => {
    const names = [term.name, ...(term.aliases || [])];
    return names.some((name) => name === keyword);
  });
}

function splitKeywords(keywords) {
  return String(keywords || "")
    .split(/\s+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
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
              <small>${getCompactLabel(item, type)}</small>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function getCompactLabel(item, type) {
  if (type === "roles") {
    return escapeHtml(typeLabels[item.type] || item.type);
  }

  if (type === "terms") {
    return escapeHtml(item.category);
  }

  return escapeHtml(item.level);
}

function renderKeywordLinks(keywords) {
  const tokens = splitKeywords(keywords);
  if (!tokens.length) {
    return `<p class="muted">当前没有关键词。</p>`;
  }

  return `
    <div class="keyword-list">
      ${tokens
        .map((keyword) => {
          const term = getTermForKeyword(keyword);
          if (!term) {
            return `<span class="keyword-chip">${escapeHtml(keyword)}</span>`;
          }

          return `<a class="keyword-chip" href="/terms/${escapeHtml(term.id)}" data-link>${escapeHtml(keyword)}</a>`;
        })
        .join("")}
    </div>
  `;
}

function getInlineTermMatches() {
  return state.terms.flatMap((term) => {
    const names = [term.name, ...(term.aliases || [])];
    return names.map((name) => ({
      text: name,
      type: "term",
      id: term.id,
    }));
  });
}

function renderRichText(value) {
  const source = String(value || "");
  const candidates = [
    ...getInlineTermMatches(),
    ...importantAbilityPhrases.map((text) => ({ text, type: "strong" })),
  ]
    .filter((item) => item.text)
    .sort((a, b) => b.text.length - a.text.length);
  const matches = [];

  candidates.forEach((candidate) => {
    let start = source.indexOf(candidate.text);
    while (start !== -1) {
      const end = start + candidate.text.length;
      const overlaps = matches.some(
        (match) => start < match.end && end > match.start,
      );

      if (!overlaps) {
        matches.push({ ...candidate, start, end });
      }

      start = source.indexOf(candidate.text, end);
    }
  });

  matches.sort((a, b) => a.start - b.start);

  let html = "";
  let cursor = 0;
  matches.forEach((match) => {
    html += escapeHtml(source.slice(cursor, match.start));
    const text = escapeHtml(source.slice(match.start, match.end));

    if (match.type === "term") {
      html += `<a class="inline-term" href="/terms/${escapeHtml(match.id)}" data-link>${text}</a>`;
    } else {
      html += `<strong>${text}</strong>`;
    }

    cursor = match.end;
  });

  html += escapeHtml(source.slice(cursor));
  return html;
}

function abilityBlock(role) {
  return `
    <section class="ability-block">
      <p class="eyebrow">角色能力</p>
      <p>${renderRichText(role.ability || role.detail.abilitySummary)}</p>
    </section>
  `;
}

function getRoleTypeSummary() {
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
        <a class="directory-card" href="${card.href}" data-link>
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

function renderHome() {
  document.title = "血染钟楼百科";
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">社交推理 · 说书人 · 阵营博弈</p>
        <h1>查规则、看板子、找角色，一局开始前够用了。</h1>
        <p class="lead">
          开局前先定位问题：查角色能力、挑今晚的板子，或把容易混淆的术语对齐。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link" href="/roles" data-link>直接查角色</a>
          <a class="secondary-link" href="/scripts" data-link>看板子目录</a>
        </div>
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
            <strong>${state.terms.length}</strong>
            <span>个术语</span>
          </div>
          <div>
            <strong>${Object.keys(typeLabels).length}</strong>
            <span>类阵营/身份</span>
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
          <p class="eyebrow">从哪开始</p>
          <h2 id="directoryTitle">先选一个方向</h2>
        </div>
        <p class="section-note">遇到角色、板子、术语，直接进对应目录。</p>
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

function renderTermIndex() {
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

function renderScriptIndex() {
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

function renderRoleIndex() {
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

function renderRules() {
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

function renderScripts() {
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

function renderRoles() {
  const roleGrid = document.querySelector("#roleGrid");
  if (!roleGrid) {
    return;
  }

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
          <div class="script-name">${escapeHtml(getRoleScriptLabel(role))}</div>
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

  const roles = state.roles.filter((role) =>
    (role.scriptIds || [role.scriptId]).includes(script.id),
  );
  document.title = `${script.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero">
      <a class="back-link" href="/scripts" data-link>返回板子目录</a>
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

  const scripts = getScriptsForRole(role);
  const relatedRoles = (role.detail.relatedRoleIds || [])
    .map(getRoleById)
    .filter(Boolean);

  document.title = `${role.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero role-detail-hero" data-type="${escapeHtml(role.type)}">
      <a class="back-link" href="/roles" data-link>返回角色目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(getRoleScriptLabel(role))} · ${escapeHtml(typeLabels[role.type] || role.type)}</p>
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
        ${abilityBlock(role)}
        ${detailBlock("玩家玩法提示", role.detail.playTips)}
        ${detailBlock("说书人注意", role.detail.storytellerTips)}
        ${detailBlock("常见误区", role.detail.commonMistakes)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">所属剧本</p>
          ${
            scripts.length
              ? compactListLinks(scripts, "scripts")
              : `<h2>${escapeHtml(getRoleScriptLabel(role))}</h2>`
          }
        </section>
        <section class="side-panel">
          <p class="eyebrow">关键词</p>
          ${renderKeywordLinks(role.keywords)}
        </section>
        <section class="side-panel">
          <p class="eyebrow">关联角色</p>
          ${compactListLinks(relatedRoles, "roles")}
        </section>
      </aside>
    </section>
  `;
}

function renderTermDetail(id) {
  const term = getTermById(id);

  if (!term) {
    renderNotFound("没有找到这个术语。");
    return;
  }

  const relatedTerms = (term.relatedTermIds || []).map(getTermById).filter(Boolean);
  const relatedRoles = (term.relatedRoleIds || []).map(getRoleById).filter(Boolean);

  document.title = `${term.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero term-detail-hero">
      <a class="back-link" href="/terms" data-link>返回术语目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(term.category)}</p>
          <h1>${escapeHtml(term.name)}</h1>
          <p class="lead">${escapeHtml(term.detail.overview)}</p>
          ${
            (term.aliases || []).length
              ? `<div class="script-meta detail-tags">${term.aliases.map((alias) => `<span class="tag">${escapeHtml(alias)}</span>`).join("")}</div>`
              : ""
          }
        </div>
        <div class="term-token">
          <span>${escapeHtml(term.name.slice(0, 1))}</span>
          <strong>${escapeHtml(term.category)}</strong>
        </div>
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${detailBlock("怎么理解", term.detail.howItWorks)}
        ${detailBlock("常见误区", term.detail.commonMistakes)}
        ${detailBlock("实战提示", term.detail.examples)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">关联术语</p>
          ${compactListLinks(relatedTerms, "terms")}
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

  if (segments.length === 1 && segments[0] === "scripts") {
    renderScriptIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "roles") {
    renderRoleIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "terms") {
    renderTermIndex();
    return;
  }

  if (segments.length === 2 && segments[0] === "scripts") {
    renderScriptDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "roles") {
    renderRoleDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "terms") {
    renderTermDetail(segments[1]);
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
    state.terms = data.terms || [];
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
