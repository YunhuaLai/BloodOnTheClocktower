const typeLabels = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
};

const state = {
  activeFilter: "all",
  rules: [],
  scripts: [],
  roles: [],
};

const ruleGrid = document.querySelector("#ruleGrid");
const scriptGrid = document.querySelector("#scriptGrid");
const roleGrid = document.querySelector("#roleGrid");
const searchInput = document.querySelector("#searchInput");
const filters = document.querySelectorAll(".filter");
const roleCount = document.querySelector("#roleCount");
const scriptCount = document.querySelector("#scriptCount");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRules() {
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
  scriptGrid.innerHTML = state.scripts
    .map(
      (script) => `
        <article class="script-card">
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
        </article>
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
  const query = searchInput.value.trim();
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
        <article class="role-card" data-type="${escapeHtml(role.type)}">
          <header>
            <h3>${escapeHtml(role.name)}</h3>
            <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
          </header>
          <p>${escapeHtml(role.summary)}</p>
          <div class="script-name">${escapeHtml(role.script)}</div>
        </article>
      `,
    )
    .join("");
}

function renderAll() {
  scriptCount.textContent = state.scripts.length;
  roleCount.textContent = state.roles.length;
  renderRules();
  renderScripts();
  renderRoles();
}

function renderLoadError() {
  ruleGrid.innerHTML = `
    <div class="empty-state">
      资料加载失败。请用后端服务打开页面：在项目根目录运行 npm start。
    </div>
  `;
  scriptGrid.innerHTML = "";
  roleGrid.innerHTML = "";
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
    renderAll();
  } catch (error) {
    console.error(error);
    renderLoadError();
  }
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.activeFilter = button.dataset.filter;
    renderRoles();
  });
});

searchInput.addEventListener("input", renderRoles);

loadEncyclopedia();
