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

function getClaimRoleOptions(game, catalog) {
  const roles = catalog?.roles || [];
  if (game?.scriptMode === "custom") {
    const customRoleIds = new Set(
      (Array.isArray(game?.customRoleIds) ? game.customRoleIds : [])
        .map((roleId) => String(roleId || "").trim())
        .filter(Boolean),
    );
    return customRoleIds.size
      ? roles.filter((role) => customRoleIds.has(role.id))
      : [];
  }

  const script = getGameScript(game, catalog);
  if (!script) {
    return roles;
  }

  return roles.filter((role) => roleBelongsToScript(role, script.id));
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
        (role) => role.id === explicitRoleId || role.englishName === explicitRoleId,
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
    (game?.scriptMode === "custom" ? null : (catalog?.roles || []).find(matchRole)) ||
    null
  );
}

module.exports = {
  getClaimedRole,
  getGameScript,
  normalizeMatchText,
};
