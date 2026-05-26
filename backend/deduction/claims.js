function normalizeMatchText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesExact(item, query, fields) {
  return fields.some((field) => normalizeMatchText(item?.[field]) === query);
}

function matchesPartial(item, query, fields) {
  return fields.some((field) => normalizeMatchText(item?.[field]).includes(query));
}

function getGameScript(game, catalog) {
  if (game?.scriptMode === "custom") {
    return null;
  }

  const scripts = catalog?.scripts || [];

  if (game?.scriptId) {
    const exactById = scripts.find(
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

  return (
    scripts.find((script) => matchesExact(script, query, ["name", "en", "id", "englishName"])) ||
    scripts.find((script) => matchesPartial(script, query, ["name", "en", "id", "englishName"])) ||
    null
  );
}

function roleBelongsToScript(role, scriptId) {
  return (role?.scriptIds || [role?.scriptId]).filter(Boolean).includes(scriptId);
}

function isFabledRole(role) {
  return role?.type === "fabled";
}

function isTravellerRole(role) {
  return role?.type === "traveller" || role?.type === "traveler";
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

function getRolesFromIds(roles, roleIds, predicate = () => true) {
  const idSet = new Set(
    (Array.isArray(roleIds) ? roleIds : [])
      .map((roleId) => String(roleId || "").trim())
      .filter(Boolean),
  );
  return idSet.size ? roles.filter((role) => idSet.has(role.id) && predicate(role)) : [];
}

function getClaimRoleOptions(game, catalog) {
  const roles = catalog?.roles || [];
  if (game?.scriptMode === "custom") {
    return uniqueRoles([
      ...getRolesFromIds(
        roles,
        game?.customRoleIds,
        (role) => !isFabledRole(role) && !isTravellerRole(role),
      ),
      ...getRolesFromIds(roles, game?.travellerRoleIds, isTravellerRole),
    ]);
  }

  const script = getGameScript(game, catalog);
  if (!script) {
    return roles.filter((role) => !isFabledRole(role) && !isTravellerRole(role));
  }

  const scriptRoles = getRolesFromIds(
    script?.roleIds?.length ? roles : [],
    script?.roleIds,
    (role) => !isFabledRole(role) && !isTravellerRole(role),
  );
  return uniqueRoles([
    ...(scriptRoles.length
      ? scriptRoles
      : roles.filter(
          (role) =>
            roleBelongsToScript(role, script.id) &&
            !isFabledRole(role) &&
            !isTravellerRole(role),
        )),
    ...getRolesFromIds(roles, game?.travellerRoleIds, isTravellerRole),
  ]);
}

function getClaimedRole(playerOrClaim, game, catalog) {
  const roleOptions = getClaimRoleOptions(game, catalog);
  const explicitRoleId =
    typeof playerOrClaim === "string" ? "" : String(playerOrClaim?.roleInfo?.roleId || "").trim();
  if (explicitRoleId) {
    const exactById = roleOptions.find(
      (role) => role.id === explicitRoleId || role.englishName === explicitRoleId,
    );
    if (exactById) {
      return exactById;
    }

    if (game?.scriptMode !== "custom") {
      const fallbackById = (catalog?.roles || []).find(
        (role) =>
          !isFabledRole(role) &&
          !isTravellerRole(role) &&
          (role.id === explicitRoleId || role.englishName === explicitRoleId),
      );
      if (fallbackById) {
        return fallbackById;
      }
    }
  }

  const claim =
    typeof playerOrClaim === "string" ? playerOrClaim : playerOrClaim?.claim;
  const normalizedClaim = normalizeMatchText(claim);
  if (!normalizedClaim) {
    return null;
  }

  const matchRole = (role) =>
    matchesExact(role, normalizedClaim, ["name", "en", "id", "englishName"]);
  return (
    roleOptions.find(matchRole) ||
    (game?.scriptMode === "custom"
      ? null
      : (catalog?.roles || []).find(
          (role) => !isFabledRole(role) && !isTravellerRole(role) && matchRole(role),
        )) ||
    null
  );
}

module.exports = {
  getClaimedRole,
  getGameScript,
  normalizeMatchText,
};
