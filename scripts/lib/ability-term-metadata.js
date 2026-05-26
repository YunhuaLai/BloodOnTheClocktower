const { TERMS_FILE, readYamlFile } = require("./library-io");

const WEAK_TEXT_TERM_IDS = new Set(["ability"]);
const IGNORED_UNMATCHED_KEYWORDS = new Set(["a"]);

const ROLE_ABILITY_FIELD_ORDER = [
  "id",
  "englishName",
  "name",
  "schemaVersion",
  "generatedFromOfficial",
  "sourceAbility",
  "needsReview",
  "reviewReason",
  "tags",
  "termIds",
  "abilityPattern",
  "abilitySemantics",
  "abilityMeta",
  "interactionSchema",
  "deduction",
];

function readTermsConfig(filePath = TERMS_FILE) {
  const parsed = readYamlFile(filePath, {});
  return normalizeTermsConfig(parsed);
}

function normalizeTermsConfig(data) {
  const terms = Array.isArray(data) ? data : Array.isArray(data?.terms) ? data.terms : [];
  const replacements = (Array.isArray(data?.replacements) ? data.replacements : [])
    .map((replacement) => {
      if (Array.isArray(replacement)) {
        return { from: replacement[0], to: replacement[1] };
      }

      return replacement;
    })
    .filter((replacement) => replacement?.from && replacement?.to);

  return { terms, replacements };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase();
}

function applyReplacements(value, replacements) {
  return replacements.reduce(
    (result, { from, to }) => result.replaceAll(normalizeText(from), normalizeText(to)),
    normalizeText(value),
  );
}

function splitKeywords(value) {
  const rawValues = Array.isArray(value) ? value : String(value || "").split(/[\s,，、/|]+/);

  return rawValues
    .map((item) => normalizeText(item).trim())
    .filter(Boolean);
}

function getRoleText(roleData = {}) {
  return [
    roleData.ability,
    roleData.summary,
    roleData.detail?.abilitySummary,
    roleData.detail?.overview,
  ]
    .filter(Boolean)
    .join(" ");
}

function makeTermAliasRecords(terms) {
  return terms
    .flatMap((term) =>
      [term.id, term.name, ...(Array.isArray(term.aliases) ? term.aliases : [])]
        .filter(Boolean)
        .map((alias) => ({
          termId: term.id,
          alias,
          normalizedAlias: normalizeText(alias),
        })),
    )
    .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length);
}

function inferTermIds(roleData = {}, abilityData = {}, termsConfig = readTermsConfig()) {
  const { terms, replacements } = termsConfig;
  const aliases = makeTermAliasRecords(terms);
  const explicitTokens = new Set([
    ...splitKeywords(roleData.keywords),
    ...splitKeywords(roleData.type),
    ...splitKeywords(abilityData.tags),
  ]);
  const matchedTermIds = new Set();

  aliases.forEach(({ termId, normalizedAlias }) => {
    if (explicitTokens.has(normalizedAlias)) {
      matchedTermIds.add(termId);
    }
  });

  const searchableText = applyReplacements(
    [
      getRoleText(roleData),
      Array.isArray(abilityData.tags) ? abilityData.tags.join(" ") : "",
    ].join(" "),
    replacements,
  );

  aliases.forEach(({ termId, normalizedAlias }) => {
    if (
      normalizedAlias.length > 1 &&
      !WEAK_TEXT_TERM_IDS.has(termId) &&
      searchableText.includes(normalizedAlias)
    ) {
      matchedTermIds.add(termId);
    }
  });

  return terms.map((term) => term.id).filter((termId) => matchedTermIds.has(termId));
}

function getFields(abilityData = {}, sectionKey) {
  return abilityData?.interactionSchema?.[sectionKey]?.fields || [];
}

function hasFieldType(abilityData, sectionKey, type) {
  return getFields(abilityData, sectionKey).some((field) => field?.type === type);
}

function hasFieldKey(abilityData, sectionKey, key) {
  return getFields(abilityData, sectionKey).some((field) => field?.key === key);
}

function hasAnyTerm(termIds, ids) {
  return ids.some((id) => termIds.includes(id));
}

function inferAbilityPattern(roleData = {}, abilityData = {}, termIds = []) {
  const meta = abilityData?.abilityMeta || {};
  const targetFields = getFields(abilityData, "target");
  const resultFields = getFields(abilityData, "result");

  if (!meta.recordable) {
    return meta.pageType === "rule_modifier" ? "rule_modifier" : "no_input";
  }

  if (meta.eventTiming === "on_nomination") return "nomination_trigger";
  if (meta.eventTiming === "on_execution") return "execution_trigger";
  if (meta.eventTiming === "on_death") return "death_trigger";
  if (meta.eventTiming === "on_vote") return "vote_trigger";

  if (
    !targetFields.length &&
    hasFieldKey(abilityData, "result", "seat1") &&
    hasFieldKey(abilityData, "result", "seat2") &&
    hasFieldType(abilityData, "result", "role")
  ) {
    return "role_in_group_hint";
  }

  if (hasFieldType(abilityData, "target", "seat") && hasFieldType(abilityData, "result", "role")) {
    return "target_role_info";
  }

  if (hasFieldType(abilityData, "target", "seat") && hasFieldType(abilityData, "result", "boolean")) {
    return hasAnyTerm(termIds, ["demon"]) ? "target_demon_check" : "target_boolean_check";
  }

  if (hasFieldType(abilityData, "target", "seat") && hasFieldType(abilityData, "result", "number")) {
    return "target_number_info";
  }

  if (hasFieldType(abilityData, "target", "role") && hasAnyTerm(termIds, ["drunk", "poisoned"])) {
    return "choose_role_status_effect";
  }

  if (hasFieldType(abilityData, "target", "seat") && !resultFields.length) {
    if (hasAnyTerm(termIds, ["protected"])) return "choose_player_protection";
    if (hasAnyTerm(termIds, ["death"])) return "choose_player_death";
    if (hasAnyTerm(termIds, ["drunk", "poisoned"])) return "choose_player_status_effect";
    return "choose_player_effect";
  }

  if (hasFieldType(abilityData, "result", "number")) return "number_info";
  if (hasFieldType(abilityData, "result", "boolean")) return "boolean_info";
  if (hasFieldType(abilityData, "result", "team")) return "team_info";
  if (hasFieldType(abilityData, "result", "role")) return "role_info";
  if (hasFieldType(abilityData, "result", "seat")) return "player_info";
  if (hasAnyTerm(termIds, ["drunk", "poisoned"])) return "status_effect";

  return meta.pageType === "record_result_only" ? "record_result_only" : "manual_record";
}

function orderRoleAbilityFields(abilityData) {
  const ordered = {};

  ROLE_ABILITY_FIELD_ORDER.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(abilityData, key)) {
      ordered[key] = abilityData[key];
    }
  });

  Object.keys(abilityData).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = abilityData[key];
    }
  });

  return ordered;
}

function applyAbilityTermMetadata(abilityData = {}, roleData = {}, termsConfig = readTermsConfig()) {
  const termIds = inferTermIds(roleData, abilityData, termsConfig);
  const abilityPattern = inferAbilityPattern(roleData, abilityData, termIds);

  return orderRoleAbilityFields({
    ...abilityData,
    termIds,
    abilityPattern,
  });
}

function getUnmatchedKeywordTokens(roleData = {}, abilityData = {}, termsConfig = readTermsConfig()) {
  const aliases = new Set(
    makeTermAliasRecords(termsConfig.terms).flatMap((record) => [
      record.normalizedAlias,
      record.termId,
    ]),
  );

  return Array.from(new Set(splitKeywords(roleData.keywords))).filter(
    (keyword) => !aliases.has(keyword) && !IGNORED_UNMATCHED_KEYWORDS.has(keyword),
  );
}

module.exports = {
  applyAbilityTermMetadata,
  getUnmatchedKeywordTokens,
  readTermsConfig,
};
