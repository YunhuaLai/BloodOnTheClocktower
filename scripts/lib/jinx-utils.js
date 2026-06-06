const JINX_TEAM_PATTERN = /jinx/i;
const SCRIPT_RULE_TAGS = new Set(["能力修改"]);

function isJinxTeam(team) {
  return JINX_TEAM_PATTERN.test(String(team || ""));
}

function normalizeLookupText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stripRoleNameHint(value) {
  return String(value || "")
    .trim()
    .replace(/^[^:：]+[:：]\s*/, "")
    .replace(/[（(][^）)]*[）)]\s*$/, "")
    .trim();
}

function splitJinxRoleNames(name) {
  return uniqueValues(
    String(name || "")
      .split(/\s*(?:&|\uFF06|与)\s*/)
      .flatMap((part) => stripRoleNameHint(part).split(/\s*(?:\/|\uFF0F)\s*/))
      .map((part) => stripRoleNameHint(part))
      .filter(Boolean),
  );
}

function isScriptRuleTag(name) {
  return SCRIPT_RULE_TAGS.has(stripRoleNameHint(name));
}

function makeRoleLookup(roles) {
  const lookup = new Map();

  roles.forEach((entry) => {
    const role = entry?.data || entry;
    if (!role?.id) {
      return;
    }

    [role.name, role.en, role.englishName, role.id].forEach((value) => {
      const key = normalizeLookupText(value);
      if (key && !lookup.has(key)) {
        lookup.set(key, role);
      }
    });
  });

  return lookup;
}

function resolveJinxRoleNames(names, roleLookup) {
  const resolvedRoles = [];
  const unresolvedRoleNames = [];

  names.forEach((name) => {
    const candidates = uniqueValues([
      name,
      stripRoleNameHint(name),
      stripRoleNameHint(name).replace(/^红唇$/, "红唇女郎"),
    ]);
    const role = candidates
      .map((candidate) => roleLookup.get(normalizeLookupText(candidate)))
      .find(Boolean);

    if (role) {
      resolvedRoles.push(role);
      return;
    }

    unresolvedRoleNames.push(name);
  });

  return {
    roleIds: uniqueValues(resolvedRoles.map((role) => role.id)),
    roleNames: uniqueValues(resolvedRoles.map((role) => role.name)),
    unresolvedRoleNames: uniqueValues(unresolvedRoleNames),
  };
}

function normalizeJinxResolution(resolved, existingJinx = {}) {
  const unresolvedRoleNames = Array.isArray(resolved?.unresolvedRoleNames)
    ? resolved.unresolvedRoleNames
    : [];
  const ruleTags = uniqueValues([
    ...(Array.isArray(existingJinx.ruleTags) ? existingJinx.ruleTags : []),
    ...unresolvedRoleNames.filter(isScriptRuleTag),
  ]);
  const appliesWhen =
    existingJinx.appliesWhen ||
    (ruleTags.length && (resolved?.roleIds || []).length ? "script" : "");

  return {
    roleIds: resolved?.roleIds || [],
    roleNames: resolved?.roleNames || [],
    unresolvedRoleNames: unresolvedRoleNames.filter((name) => !isScriptRuleTag(name)),
    ruleTags,
    appliesWhen,
  };
}

function isScriptScopedJinx(jinx) {
  return String(jinx?.appliesWhen || jinx?.scope || "").toLowerCase() === "script";
}

function jinxAppliesToRoleSet(jinx, roleIdSet, { sourceScriptId = "" } = {}) {
  const jinxRoleIds = (jinx?.roleIds || []).filter(Boolean);
  const scriptId = String(sourceScriptId || "").trim();
  const hasResolvedMatch =
    jinxRoleIds.length >= 2 && jinxRoleIds.every((roleId) => roleIdSet.has(roleId));
  const hasScriptScopeMatch =
    isScriptScopedJinx(jinx) &&
    jinxRoleIds.length >= 1 &&
    jinxRoleIds.every((roleId) => roleIdSet.has(roleId));
  const hasSourceMatch =
    scriptId && (jinx?.sourceScriptIds || []).includes(scriptId);

  return hasResolvedMatch || hasScriptScopeMatch || hasSourceMatch;
}

module.exports = {
  isJinxTeam,
  isScriptScopedJinx,
  jinxAppliesToRoleSet,
  makeRoleLookup,
  normalizeJinxResolution,
  resolveJinxRoleNames,
  splitJinxRoleNames,
};
