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
  const index = oneInOneOutRoleOrder.indexOf(role.id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortScriptRoles(script, roles) {
  if (script.id !== "one-in-one-out") {
    return roles;
  }

  return [...roles].sort((left, right) => {
    return getOneInOneOutSortValue(left) - getOneInOneOutSortValue(right);
  });
}

function renderScriptRoleList(script, roles) {
  return compactListLinks(sortScriptRoles(script, roles), "roles");
}

function sortCatalogRoles(roles) {
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
