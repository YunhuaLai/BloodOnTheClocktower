const JINX_TEAM_PATTERN = /jinx/i;

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
      .split(/\s*(?:&|\uFF06)\s*/)
      .flatMap((part) => stripRoleNameHint(part).split(/\s*(?:\/|\uFF0F)\s*/))
      .map((part) => stripRoleNameHint(part))
      .filter(Boolean),
  );
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

module.exports = {
  isJinxTeam,
  makeRoleLookup,
  resolveJinxRoleNames,
  splitJinxRoleNames,
};
