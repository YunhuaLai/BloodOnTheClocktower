import { abilityBlock, compactListLinks, detailBlock, getRoleById, getRoleScriptLabel, getScriptById, getScriptsForRole, getTermById, renderKeywordLinks, renderScriptRoleList } from "./catalog-helpers.js";
import { app, state, typeDescriptions, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function renderScriptDetail(id) {
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
          ${renderScriptRoleList(script, roles)}
        </section>
      </aside>
    </section>
  `;
}

export function renderRoleDetail(id) {
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

export function renderTermDetail(id) {
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

export function renderNotFound(message = "这个页面不存在。") {
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

export function renderLoadError() {
  document.title = "资料加载失败 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">加载失败</p>
      <h1>资料加载失败。</h1>
      <p class="lead">请确认后端服务正在运行，然后刷新页面。</p>
    </section>
  `;
}
