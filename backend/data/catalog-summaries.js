function summarizeScript(script) {
  return {
    id: script.id,
    englishName: script.englishName,
    name: script.name,
    en: script.en,
    status: script.status,
    author: script.author,
    level: script.level,
    mood: script.mood,
    text: script.text,
    description: script.description,
    image: script.image,
    tags: script.tags,
    roleIds: script.roleIds,
    travellerIds: script.travellerIds,
    fabledIds: script.fabledIds,
    tokenIds: script.tokenIds,
    nightOrder: script.nightOrder,
  };
}

function summarizeRole(role) {
  return {
    id: role.id,
    englishName: role.englishName,
    name: role.name,
    en: role.en,
    type: role.type,
    summary: role.summary,
    keywords: role.keywords,
    ability: role.ability,
    image: role.image,
    scriptId: role.scriptId,
    scriptIds: role.scriptIds,
    scriptNames: role.scriptNames,
    script: role.script,
  };
}

function summarizeJinx(jinx) {
  return {
    id: jinx.id,
    kind: jinx.kind,
    name: jinx.name,
    roleIds: jinx.roleIds,
    roleNames: jinx.roleNames,
    unresolvedRoleNames: jinx.unresolvedRoleNames,
    ruleTags: jinx.ruleTags,
    appliesWhen: jinx.appliesWhen,
    rule: jinx.rule,
    audience: jinx.audience,
    sourceScriptIds: jinx.sourceScriptIds,
    source: jinx.source,
  };
}

function summarizeTerm(term) {
  return {
    id: term.id,
    name: term.name,
    category: term.category,
    summary: term.summary,
    aliases: term.aliases,
    relatedRoleIds: term.relatedRoleIds,
    relatedTermIds: term.relatedTermIds,
  };
}

function buildBootstrapData(data) {
  return {
    rules: data.rules || [],
    scripts: (data.scripts || []).map(summarizeScript),
    roles: (data.roles || []).map(summarizeRole),
    jinxes: (data.jinxes || []).map(summarizeJinx),
    terms: (data.terms || []).map(summarizeTerm),
  };
}

function buildHomeData(data) {
  return {
    rules: data.rules || [],
    counts: {
      scripts: (data.scripts || []).length,
      roles: (data.roles || []).length,
      jinxes: (data.jinxes || []).length,
      terms: (data.terms || []).length,
    },
  };
}

module.exports = {
  buildBootstrapData,
  buildHomeData,
};
