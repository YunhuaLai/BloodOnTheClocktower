function normalizeMatchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getGameScript(game) {
  if (game?.scriptId) {
    const exactById = state.scripts.find((script) => script.id === game.scriptId);
    if (exactById) {
      return exactById;
    }
  }

  const query = normalizeMatchText(game?.scriptName);
  if (!query) {
    return null;
  }

  const exactMatch = state.scripts.find((script) =>
    [script.name, script.en, script.id].some(
      (value) => normalizeMatchText(value) === query,
    ),
  );
  if (exactMatch) {
    return exactMatch;
  }

  return (
    state.scripts.find((script) =>
      [script.name, script.en, script.id].some((value) =>
        normalizeMatchText(value).includes(query),
      ),
    ) || null
  );
}

function roleBelongsToScript(role, scriptId) {
  return (role.scriptIds || [role.scriptId]).filter(Boolean).includes(scriptId);
}

function getClaimRoleOptions(game) {
  const script = getGameScript(game);
  if (!script) {
    return sortCatalogRoles(state.roles);
  }

  return sortScriptRoles(
    script,
    state.roles.filter((role) => roleBelongsToScript(role, script.id)),
  );
}

function getClaimPickerHint(game) {
  const script = getGameScript(game);
  if (!script) {
    return "先选具体剧本，自称身份才会收窄到该剧本角色；输入框仍然可以手动填写。";
  }

  return `当前只提示《${script.name}》角色，也可以直接输入其他跳身份。`;
}

function renderRoleNameDatalist(game) {
  const roles = getClaimRoleOptions(game);

  return `
    <datalist id="roleNameList">
      ${roles
        .map(
          (role) =>
            `<option value="${escapeHtml(role.name)}" label="${escapeHtml(typeLabels[role.type] || role.type)}"></option>`,
        )
        .join("")}
    </datalist>
  `;
}

function renderScriptSelectOptions(selectedScriptId) {
  return state.scripts
    .map(
      (script) =>
        `<option value="${escapeHtml(script.id)}"${script.id === selectedScriptId ? " selected" : ""}>${escapeHtml(script.name)}</option>`,
    )
    .join("");
}
