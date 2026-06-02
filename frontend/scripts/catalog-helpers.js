import { importantAbilityPhrases, oneInOneOutRoleOrder, roleTypeOrder, state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function getScriptById(id) {
  return state.scripts.find((script) => script.id === id);
}

export function getRoleById(id) {
  return state.roles.find((role) => role.id === id);
}

export function getTermById(id) {
  return state.terms.find((term) => term.id === id);
}

export function getScriptsForRole(role) {
  const scriptIds = role.scriptIds || [role.scriptId];
  return scriptIds.map(getScriptById).filter(Boolean);
}

export function getRoleScriptLabel(role) {
  return (role.scriptNames || []).join(" / ") || role.script || "未归属";
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

function isBlankDetailValue(value) {
  if (value === undefined || value === null) {
    return true;
  }

  const text = String(value).trim();
  return !text || text === "undefined" || text === "null" || text.startsWith("这里填写");
}

function cleanDetailItems(items) {
  return items.map((item) => String(item ?? "").trim()).filter((item) => !isBlankDetailValue(item));
}

function listItems(items) {
  const cleanItems = cleanDetailItems(items);
  return `<ul class="detail-list">${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function detailBlock(title, content) {
  const cleanItems = Array.isArray(content) ? cleanDetailItems(content) : [];
  const text = Array.isArray(content) ? "" : String(content ?? "").trim();
  const body = Array.isArray(content)
    ? cleanItems.length
      ? listItems(cleanItems)
      : `<p class="muted">暂无资料。</p>`
    : isBlankDetailValue(text)
      ? `<p class="muted">暂无资料。</p>`
      : `<p>${escapeHtml(text)}</p>`;

  return `
    <section class="detail-block">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

export function compactListLinks(items, type) {
  if (!items.length) {
    return `<p class="muted">无关联条目。</p>`;
  }

  return `
    <div class="compact-list">
      ${items
        .map(
          (item) => `
            <a href="/${type}/${escapeHtml(item.id)}" data-link${type === "roles" ? ` data-type="${escapeHtml(item.type)}"` : ""}>
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

function getRoleTypeSortValue(role) {
  const index = roleTypeOrder.indexOf(role.type);
  return index === -1 ? roleTypeOrder.length : index;
}

function getOneInOneOutSortValue(role) {
  const index = oneInOneOutRoleOrder.indexOf(role.englishName || role.id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getScriptRoleIds(script) {
  return [
    ...(script?.roleIds || []),
    ...(script?.travellerIds || script?.travelerIds || []),
    ...(script?.fabledIds || []),
  ].filter(Boolean);
}

function getScriptRoleOrder(script) {
  return new Map(getScriptRoleIds(script).map((roleId, index) => [roleId, index]));
}

function getScriptRoleSortValue(role, scriptRoleOrder) {
  const ids = [role.id, role.englishName].filter(Boolean);
  const orderedId = ids.find((id) => scriptRoleOrder.has(id));
  return orderedId ? scriptRoleOrder.get(orderedId) : Number.MAX_SAFE_INTEGER;
}

export function sortScriptRoles(script, roles) {
  const scriptRoleOrder = getScriptRoleOrder(script);
  const hasScriptOrder = scriptRoleOrder.size > 0;
  const isOneInOneOut = (script.englishName || script.id) === "one-in-one-out";

  return roles
    .map((role, index) => ({ role, index }))
    .sort((left, right) => {
      if (hasScriptOrder) {
        const scriptOrderDelta =
          getScriptRoleSortValue(left.role, scriptRoleOrder) -
          getScriptRoleSortValue(right.role, scriptRoleOrder);
        if (scriptOrderDelta) {
          return scriptOrderDelta;
        }
      }

      if (isOneInOneOut) {
        const oneInOneOutDelta =
          getOneInOneOutSortValue(left.role) -
          getOneInOneOutSortValue(right.role);
        if (oneInOneOutDelta) {
          return oneInOneOutDelta;
        }
      }

      const typeDelta =
        getRoleTypeSortValue(left.role) - getRoleTypeSortValue(right.role);
      if (typeDelta) {
        return typeDelta;
      }

      return left.index - right.index;
    })
    .map(({ role }) => role);
}

export function renderScriptRoleList(script, roles) {
  return compactListLinks(sortScriptRoles(script, roles), "roles");
}

export function sortCatalogRoles(roles) {
  return roles
    .map((role, index) => ({ role, index }))
    .sort((left, right) => {
      const typeDelta =
        getRoleTypeSortValue(left.role) - getRoleTypeSortValue(right.role);
      if (typeDelta) {
        return typeDelta;
      }

      const oneInOneOutDelta =
        getOneInOneOutSortValue(left.role) -
        getOneInOneOutSortValue(right.role);
      if (oneInOneOutDelta) {
        return oneInOneOutDelta;
      }

      return left.index - right.index;
    })
    .map(({ role }) => role);
}

export function renderKeywordLinks(keywords) {
  const tokens = splitKeywords(keywords);
  if (!tokens.length) {
    return `<p class="muted">无关键词。</p>`;
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

export function abilityBlock(role) {
  return `
    <section class="ability-block">
      <p class="eyebrow">角色能力</p>
      <p>${renderRichText(role.ability || role.detail.abilitySummary)}</p>
    </section>
  `;
}
