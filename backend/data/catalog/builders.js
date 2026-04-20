const { SCRIPT_NAMES } = require("./constants");

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getScriptNames(scriptIds) {
  return scriptIds.map((scriptId) => SCRIPT_NAMES[scriptId] || scriptId);
}

function withScript(roleData, scriptId) {
  const scriptIds = uniqueValues([...(roleData.scriptIds || [roleData.scriptId]), scriptId]);
  const scriptNames = getScriptNames(scriptIds);

  return {
    ...roleData,
    scriptIds,
    scriptNames,
    script: scriptNames.join(" / "),
  };
}

function role(id, name, type, scriptId, summary, keywords) {
  const scriptIds = [scriptId];
  const scriptNames = getScriptNames(scriptIds);

  return {
    id,
    name,
    type,
    script: scriptNames.join(" / "),
    scriptId,
    scriptIds,
    scriptNames,
    summary,
    keywords,
  };
}

function term(
  id,
  name,
  aliases,
  category,
  summary,
  howItWorks,
  commonMistakes,
  relatedTermIds,
  relatedRoleIds,
) {
  return {
    id,
    name,
    aliases,
    category,
    summary,
    detail: {
      overview: summary,
      howItWorks,
      commonMistakes,
      examples: relatedRoleIds.length
        ? ["可以在关联角色的详情页里看到这个关键词如何影响实际局面。"]
        : ["这是通用规则词，适合先理解概念，再结合具体角色查看。"],
    },
    relatedTermIds,
    relatedRoleIds,
  };
}

module.exports = {
  getScriptNames,
  role,
  term,
  uniqueValues,
  withScript,
};
