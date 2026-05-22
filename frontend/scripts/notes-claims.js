import { sortCatalogRoles, sortScriptRoles } from "./catalog-helpers.js";
import { state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

export function normalizeMatchText(value) {
  return String(value || "").trim().toLowerCase();
}

const roleSearchFields = ["name", "en", "id", "englishName"];

function matchesRoleValue(role, query) {
  return roleSearchFields.some(
    (field) => normalizeMatchText(role?.[field]) === query,
  );
}

function includesRoleValue(role, query) {
  return roleSearchFields.some((field) =>
    normalizeMatchText(role?.[field]).includes(query),
  );
}

export function isCustomRoleGame(game) {
  return game?.scriptMode === "custom";
}

export function getAllRoleOptions() {
  return sortCatalogRoles(state.roles);
}

export function getCustomRoleOptionsFromIds(roleIds) {
  const idSet = new Set(
    (Array.isArray(roleIds) ? roleIds : [])
      .map((roleId) => String(roleId || "").trim())
      .filter(Boolean),
  );

  if (!idSet.size) {
    return [];
  }

  return sortCatalogRoles(state.roles.filter((role) => idSet.has(role.id)));
}

export function findCatalogRole(value) {
  const query = normalizeMatchText(value);
  if (!query) {
    return null;
  }

  return (
    state.roles.find((role) => matchesRoleValue(role, query)) ||
    state.roles.find((role) => includesRoleValue(role, query)) ||
    null
  );
}

export function getGameScript(game) {
  if (isCustomRoleGame(game)) {
    return null;
  }

  if (game?.scriptId) {
    const exactById = state.scripts.find(
      (script) => script.id === game.scriptId || script.englishName === game.scriptId,
    );
    if (exactById) {
      return exactById;
    }
  }

  const query = normalizeMatchText(game?.scriptName);
  if (!query) {
    return null;
  }

  const exactMatch = state.scripts.find((script) =>
    [script.name, script.en, script.id, script.englishName].some(
      (value) => normalizeMatchText(value) === query,
    ),
  );
  if (exactMatch) {
    return exactMatch;
  }

  return (
    state.scripts.find((script) =>
      [script.name, script.en, script.id, script.englishName].some((value) =>
        normalizeMatchText(value).includes(query),
      ),
    ) || null
  );
}

function roleBelongsToScript(role, scriptId) {
  return (role.scriptIds || [role.scriptId]).filter(Boolean).includes(scriptId);
}

export function getClaimRoleOptions(game) {
  if (isCustomRoleGame(game)) {
    return getCustomRoleOptionsFromIds(game.customRoleIds);
  }

  const script = getGameScript(game);
  if (!script) {
    return getAllRoleOptions();
  }

  return sortScriptRoles(
    script,
    state.roles.filter((role) => roleBelongsToScript(role, script.id)),
  );
}

export function getClaimPickerHint(game) {
  if (isCustomRoleGame(game)) {
    const count = getClaimRoleOptions(game).length;
    return count
      ? `当前只显示自定义角色池里的 ${count} 个角色。`
      : "自定义角色池还是空的。";
  }

  const script = getGameScript(game);
  if (!script) {
    return "先选具体剧本，自称身份才会收窄到该剧本角色。";
  }

  return `当前只显示《${script.name}》角色。`;
}

export function renderRoleNameDatalist(game) {
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

export function renderAllRoleNameDatalist() {
  return `
    <datalist id="allRoleNameList">
      ${getAllRoleOptions()
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

export function renderScriptNameDatalist() {
  return `
    <datalist id="scriptNameList">
      ${state.scripts
        .map((script) => {
          const label = [script.en, script.englishName]
            .filter(Boolean)
            .join(" / ");
          return `<option value="${escapeHtml(script.name)}"${label ? ` label="${escapeHtml(label)}"` : ""}></option>`;
        })
        .join("")}
    </datalist>
  `;
}
