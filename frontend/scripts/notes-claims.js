function normalizeMatchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getGameScript(game) {
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
  if (!game?.scriptName) {
    return "先选具体剧本后，自称身份会优先从该剧本角色中提示；仍然可以手动输入。";
  }

  if (!script) {
    return "还没匹配到已录入剧本，自称身份暂时显示全部角色候选。";
  }

  return `自称身份候选已按《${script.name}》筛选，也可以直接输入其他说法。`;
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

function renderScriptNameDatalist() {
  return `
    <datalist id="scriptNameList">
      ${state.scripts.map((script) => `<option value="${escapeHtml(script.name)}"></option>`).join("")}
    </datalist>
  `;
}
