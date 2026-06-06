import { abilityBlock, compactListLinks, detailBlock, getJinxesForScript, getJinxRoleLabel, getRoleById, getRoleScriptLabel, getScriptById, getScriptsForRole, getTermById, renderKeywordLinks, sortScriptRoles } from "./catalog-helpers.js";
import { app, roleTypeOrder, state, typeDescriptions, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

const scriptRoleGroupTypes = ["townsfolk", "outsider", "minion", "demon", "traveller", "fabled"];

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const text = cleanText(nestedValue);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("；");
  }

  const text = String(value).trim();
  return text && text !== "undefined" && text !== "null" && !text.startsWith("这里填写") ? text : "";
}

function asTextList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  const text = cleanText(value);
  return text ? [text] : [];
}

function getScriptRoles(script) {
  const roles = state.roles.filter((role) =>
    (role.scriptIds || [role.scriptId]).includes(script.id),
  );

  return sortScriptRoles(script, roles);
}

function getTypeCountText(roles) {
  return roleTypeOrder
    .map((type) => {
      const count = roles.filter((role) => role.type === type).length;
      return count ? `${count} ${typeLabels[type] || type}` : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function getScriptOverview(script, roles) {
  const detailOverview = cleanText(script.detail?.overview);
  if (detailOverview) {
    return detailOverview;
  }

  const summary = cleanText(script.text) || cleanText(script.description);
  if (summary) {
    return summary;
  }

  const typeCountText = getTypeCountText(roles);
  const roleNames = roles.slice(0, 4).map((role) => role.name).join("、");
  return `《${script.name}》收录${roles.length}个已录入角色${typeCountText ? `，包括${typeCountText}` : ""}。${roleNames ? `它围绕${roleNames}等角色的能力互动展开，适合先按角色表和夜晚顺序把整体结构读清楚。` : "它适合先按角色表和夜晚顺序把整体结构读清楚。"}`;
}

function getCoreExperience(script, roles) {
  const playStyle = asTextList(script.detail?.playStyle);
  if (playStyle.length) {
    return playStyle;
  }

  const typeCountText = getTypeCountText(roles);
  return [
    `这张剧本的核心体验来自${typeCountText || `${roles.length}个角色`}之间的互证与干扰：先看信息链如何形成，再判断醉酒、中毒、配置变化或邪恶伪装是否解释得通。`,
  ];
}

function isSpecialRole(role) {
  const ability = cleanText(role.ability || role.summary);
  return (
    role.type === "fabled" ||
    role.type === "traveller" ||
    role.type === "traveler" ||
    /\[[^\]]+\]/.test(ability) ||
    /疯狂|变成|阵营|复活|不会死亡|不能死亡|额外|互认|错误信息/.test(ability)
  );
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSpecialSummary(script, roles) {
  const fabledRoles = roles.filter((role) => role.type === "fabled");
  const travellerRoles = roles.filter((role) => role.type === "traveller" || role.type === "traveler");
  const specialRoles = uniqueValues([
    ...fabledRoles.map((role) => role.name),
    ...travellerRoles.map((role) => role.name),
    ...roles.filter(isSpecialRole).map((role) => role.name),
  ]).slice(0, 7);
  const lines = [];

  if (specialRoles.length) {
    lines.push(`特殊关注：${specialRoles.join("、")}。这些角色可能影响配置、阵营、死亡、信息可靠性或开局说明。`);
  }

  if (fabledRoles.length) {
    lines.push(`传奇角色：${fabledRoles.map((role) => role.name).join("、")}；开局前最好先说明它们如何改变规则边界。`);
  } else if (!specialRoles.length) {
    lines.push("本剧本没有单独列出的传奇角色；重点放在常规角色能力之间的互证、污染和伪装空间。");
  }

  const additionalRules = asTextList(script.additional);
  if (additionalRules.length) {
    lines.push(`额外规则：${additionalRules.join("；")}`);
  }

  return lines;
}

function renderMaybeDetailBlock(title, content) {
  const items = asTextList(content);
  if (!items.length) {
    return "";
  }

  return detailBlock(title, items.length === 1 ? items[0] : items);
}

function getNightOrderRoles(orderIds = []) {
  return (Array.isArray(orderIds) ? orderIds : []).map(getRoleById).filter(Boolean);
}

function renderNightOrderColumn(title, emptyText, orderIds = []) {
  const roles = getNightOrderRoles(orderIds);

  return `
    <section class="script-night-column">
      <div class="script-sheet-heading">
        <p class="eyebrow">夜晚流程</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${
        roles.length
          ? `<ol class="script-night-list">
              ${roles
                .map(
                  (role, index) => `
                    <li>
                      <span class="script-night-index">${String(index + 1).padStart(2, "0")}</span>
                      <a href="/roles/${escapeHtml(role.id)}" data-link data-type="${escapeHtml(role.type)}">
                        <strong>${escapeHtml(role.name)}</strong>
                        <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
                      </a>
                    </li>
                  `,
                )
                .join("")}
            </ol>`
          : `<p class="muted">${escapeHtml(emptyText)}</p>`
      }
    </section>
  `;
}

function renderScriptRoleCard(role) {
  const ability = cleanText(role.ability || role.summary) || "暂无能力摘要。";

  return `
    <a class="script-role-card" href="/roles/${escapeHtml(role.id)}" data-link data-type="${escapeHtml(role.type)}">
      <header>
        <strong>${escapeHtml(role.name)}</strong>
        <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
      </header>
      <p>${escapeHtml(ability)}</p>
    </a>
  `;
}

function roleMatchesGroup(role, type) {
  if (type === "traveller") {
    return role.type === "traveller" || role.type === "traveler";
  }

  return role.type === type;
}

function renderScriptRoleSheet(roles) {
  const groups = scriptRoleGroupTypes
    .map((type) => ({
      type,
      label: typeLabels[type] || type,
      roles: roles.filter((role) => roleMatchesGroup(role, type)),
    }))
    .filter((group) => group.roles.length);

  return `
    <section class="script-role-sheet">
      <div class="script-sheet-heading script-role-sheet-heading">
        <p class="eyebrow">玩家剧本</p>
        <h2>${roles.length} 个已录入角色</h2>
      </div>
      <div class="script-role-groups">
        ${groups
          .map(
            (group) => `
              <section class="script-role-group" data-type="${escapeHtml(group.type)}">
                <div class="script-role-group-heading">
                  <h3>${escapeHtml(group.label)}</h3>
                  <span>${group.roles.length}</span>
                </div>
                <div class="script-role-grid">
                  ${group.roles.map(renderScriptRoleCard).join("")}
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderScriptJinxRules(jinxes) {
  if (!jinxes.length) {
    return "";
  }

  return `
    <section class="script-jinx-rules">
      <div class="script-sheet-heading script-role-sheet-heading">
        <p class="eyebrow">相克规则</p>
        <h2>${jinxes.length} 条当前剧本相克</h2>
      </div>
      <div class="script-jinx-grid">
        ${jinxes
          .map((jinx) => {
            const roleLabel = getJinxRoleLabel(jinx) || jinx.name;
            const unresolved = (jinx.unresolvedRoleNames || []).filter(Boolean);
            return `
              <article class="script-jinx-card">
                <header>
                  <strong>${escapeHtml(jinx.name || roleLabel)}</strong>
                  <small>${escapeHtml(roleLabel || "相克规则")}</small>
                </header>
                <p>${escapeHtml(jinx.rule || "暂无规则文本。")}</p>
                ${
                  unresolved.length
                    ? `<div class="script-jinx-note">未解析：${escapeHtml(unresolved.join("、"))}</div>`
                    : ""
                }
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderScriptDetail(id) {
  const script = getScriptById(id);

  if (!script) {
    renderNotFound("剧本不存在。");
    return;
  }

  const roles = getScriptRoles(script);
  const jinxes = getJinxesForScript(script);
  const overview = getScriptOverview(script, roles);
  const heroTags = [
    cleanText(script.mood),
    ...((script.tags || []).map(cleanText).filter(Boolean)),
  ].filter(Boolean);
  const scriptImage = cleanText(script.image) || "/assets/clock-tower-night.jpg";
  document.title = `${script.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero">
      <a class="back-link" href="/scripts" data-link>返回板子目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(cleanText(script.en) || cleanText(script.englishName) || script.name)} · ${escapeHtml(cleanText(script.level) || "未分级")}</p>
          <h1>${escapeHtml(script.name)}</h1>
          <p class="lead">${escapeHtml(overview)}</p>
          ${
            heroTags.length
              ? `<div class="script-meta detail-tags">${heroTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
              : ""
          }
        </div>
        <img class="detail-image" src="${escapeHtml(scriptImage)}" alt="${escapeHtml(script.name)}氛围图" />
      </div>
    </section>

    <section class="detail-layout script-detail-layout">
      <article class="detail-main">
        <div class="script-sheet-layout">
          ${renderNightOrderColumn("首夜顺序", "无固定首夜行动。", script.nightOrder?.first)}
          ${renderScriptRoleSheet(roles)}
          ${renderNightOrderColumn("其他夜晚", "无固定其他夜晚行动。", script.nightOrder?.other)}
        </div>
        ${renderScriptJinxRules(jinxes)}
      </article>

      <aside class="detail-side script-detail-side">
        ${detailBlock("核心体验", getCoreExperience(script, roles))}
        ${detailBlock("特殊角色 / 规则", getSpecialSummary(script, roles))}
        ${renderMaybeDetailBlock("适合玩家", script.detail?.bestFor)}
        ${renderMaybeDetailBlock("说书人提示", script.detail?.storytellerNotes)}
        ${renderMaybeDetailBlock("常见坑", script.detail?.commonPitfalls)}
      </aside>
    </section>
  `;
}

export function renderRoleDetail(id) {
  const role = getRoleById(id);

  if (!role) {
    renderNotFound("角色不存在。");
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
    renderNotFound("术语不存在。");
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

export function renderNotFound(message = "页面不存在。") {
  document.title = "未找到 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">404</p>
      <h1>${escapeHtml(message)}</h1>
      <p class="lead">请返回目录重新选择。</p>
      <a class="primary-link" href="/" data-link>回到百科首页</a>
    </section>
  `;
}

export function renderLoadError() {
  document.title = "资料加载失败 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">加载失败</p>
      <h1>加载失败。</h1>
      <p class="lead">刷新后再试。</p>
    </section>
  `;
}
