import { sortCatalogRoles, sortScriptRoles } from "./catalog-helpers.js";
import { state, typeLabels } from "./state.js";
import { escapeHtml } from "./utils.js";

const baseRoleTypes = new Set(["townsfolk", "outsider", "minion", "demon"]);
const travellerRoleTypes = new Set(["traveller", "traveler"]);

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

export function isBaseRole(role) {
  return baseRoleTypes.has(role?.type);
}

export function isFabledRole(role) {
  return role?.type === "fabled";
}

export function isTravellerRole(role) {
  return travellerRoleTypes.has(role?.type);
}

export function isTokenRole(role) {
  return role?.type === "token";
}

function uniqueRoles(roles) {
  const seen = new Set();
  return roles.filter((role) => {
    if (!role?.id || seen.has(role.id)) {
      return false;
    }

    seen.add(role.id);
    return true;
  });
}

function roleIdsFromValues(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((roleId) => String(roleId || "").trim())
        .filter(Boolean),
    ),
  ];
}

function getRolesFromIds(roleIds, predicate = () => true) {
  const idSet = new Set(roleIdsFromValues(roleIds));
  if (!idSet.size) {
    return [];
  }

  return state.roles.filter((role) => idSet.has(role.id) && predicate(role));
}

function isTravellerPlayer(player) {
  return Boolean(player?.isTraveller || player?.seatType === "traveller");
}

export function isCustomRoleGame(game) {
  return game?.scriptMode === "custom";
}

export function getAllRoleOptions() {
  return sortCatalogRoles(state.roles);
}

export function getBaseRoleOptions() {
  return sortCatalogRoles(state.roles.filter(isBaseRole));
}

export function getFabledRoleOptions() {
  return sortCatalogRoles(state.roles.filter(isFabledRole));
}

export function filterRoleOptions(roles, query, type = "all") {
  const normalizedQuery = normalizeMatchText(query);
  return (Array.isArray(roles) ? roles : []).filter((role) => {
    if (type !== "all" && role.type !== type) {
      return false;
    }

    return (
      !normalizedQuery ||
      roleSearchFields.some((field) =>
        normalizeMatchText(role?.[field]).includes(normalizedQuery),
      )
    );
  });
}

export function getTravellerRoleOptions() {
  return sortCatalogRoles(state.roles.filter(isTravellerRole));
}

export function getCustomRoleOptionsFromIds(roleIds, predicate = () => true) {
  return sortCatalogRoles(getRolesFromIds(roleIds, predicate));
}

export function findCatalogRole(value, candidates = state.roles) {
  const query = normalizeMatchText(value);
  if (!query) {
    return null;
  }

  const roles = Array.isArray(candidates) && candidates.length ? candidates : state.roles;
  return (
    roles.find((role) => matchesRoleValue(role, query)) ||
    roles.find((role) => includesRoleValue(role, query)) ||
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

function getScriptRolesFromField(script, field, predicate = () => true) {
  const roleIds = roleIdsFromValues(script?.[field]);
  return state.roles.filter((role) => roleIds.includes(role.id) && predicate(role));
}

function getScriptBaseRoles(game) {
  const script = getGameScript(game);
  if (!script) {
    return getAllRoleOptions().filter((role) => !isFabledRole(role) && !isTravellerRole(role));
  }

  const explicitRoles = getScriptRolesFromField(
    script,
    "roleIds",
    (role) => !isFabledRole(role) && !isTravellerRole(role),
  );
  if (explicitRoles.length) {
    return sortScriptRoles(script, explicitRoles);
  }

  return sortScriptRoles(
    script,
    state.roles.filter(
      (role) =>
        roleBelongsToScript(role, script.id) &&
        !isFabledRole(role) &&
        !isTravellerRole(role),
    ),
  );
}

export function getSetupFabledRoleOptions(setup) {
  if (isCustomRoleGame(setup)) {
    return getFabledRoleOptions();
  }

  const script = getGameScript(setup);
  if (!script?.fabledIds?.length) {
    return [];
  }

  return sortScriptRoles(
    script,
    getScriptRolesFromField(script, "fabledIds", isFabledRole),
  );
}

export function getRoomFabledRoleOptions(game) {
  if (isCustomRoleGame(game)) {
    return getCustomRoleOptionsFromIds(game?.fabledRoleIds, isFabledRole);
  }

  const script = getGameScript(game);
  if (!script?.fabledIds?.length) {
    return [];
  }

  return sortScriptRoles(
    script,
    getScriptRolesFromField(script, "fabledIds", isFabledRole),
  );
}

export function getRoomTokenRoleOptions(game) {
  if (isCustomRoleGame(game)) {
    return [];
  }

  const script = getGameScript(game);
  if (!script?.tokenIds?.length) {
    return [];
  }

  return sortScriptRoles(
    script,
    getScriptRolesFromField(script, "tokenIds", isTokenRole),
  );
}

export function getActiveTravellerRoleOptions(game) {
  const configuredRoles = getCustomRoleOptionsFromIds(game?.travellerRoleIds, isTravellerRole);
  const claimedTravellerRoles = (game?.players || [])
    .filter(isTravellerPlayer)
    .map((player) => findCatalogRole(player.trueRole || player.claim))
    .filter(isTravellerRole);

  return sortCatalogRoles(uniqueRoles([...configuredRoles, ...claimedTravellerRoles]));
}

export function getAvailableTravellerOptions(game) {
  const script = getGameScript(game);
  if (script?.travellerIds?.length) {
    return sortScriptRoles(
      script,
      getScriptRolesFromField(script, "travellerIds", isTravellerRole),
    );
  }

  return getTravellerRoleOptions();
}

export function getClaimRoleOptions(game) {
  if (isCustomRoleGame(game)) {
    return sortCatalogRoles(
      uniqueRoles([
        ...getCustomRoleOptionsFromIds(
          game.customRoleIds,
          (role) => !isFabledRole(role) && !isTravellerRole(role),
        ),
        ...getActiveTravellerRoleOptions(game),
      ]),
    );
  }

  const script = getGameScript(game);
  const roles = uniqueRoles([
    ...getScriptBaseRoles(game),
    ...getActiveTravellerRoleOptions(game),
  ]);

  return script ? sortScriptRoles(script, roles) : sortCatalogRoles(roles);
}

export function getRoomRoleOptions(game) {
  return sortCatalogRoles(
    uniqueRoles([
      ...getClaimRoleOptions(game),
      ...getRoomFabledRoleOptions(game),
      ...getRoomTokenRoleOptions(game),
    ]),
  );
}

export function getClaimPickerHint(game) {
  if (isCustomRoleGame(game)) {
    const count = getClaimRoleOptions(game).length;
    return count ? `自定义池：${count} 个角色。` : "自定义池为空。";
  }

  const script = getGameScript(game);
  if (!script) {
    return "先选剧本。";
  }

  return `《${script.name}》角色。`;
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
      ${getBaseRoleOptions()
        .map(
          (role) =>
            `<option value="${escapeHtml(role.name)}" label="${escapeHtml(typeLabels[role.type] || role.type)}"></option>`,
        )
        .join("")}
    </datalist>
  `;
}

export function renderFabledRoleNameDatalist(roles = getFabledRoleOptions()) {
  return `
    <datalist id="fabledRoleNameList">
      ${roles
        .map(
          (role) =>
            `<option value="${escapeHtml(role.name)}" label="${escapeHtml(typeLabels[role.type] || role.type)}"></option>`,
        )
        .join("")}
    </datalist>
  `;
}

export function renderTravellerRoleNameDatalist(game) {
  return `
    <datalist id="travellerRoleNameList">
      ${getAvailableTravellerOptions(game)
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
