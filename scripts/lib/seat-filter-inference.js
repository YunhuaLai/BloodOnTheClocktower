// Infer seatFilter (alive / dead / notSelf) for the target seat fields of a role from its ability text.
// Only abilities with exactly one "选择…玩家" clause are inferred: with several clauses (首夜选一名存活玩家，
// 每夜选一名玩家) it is unclear which seat field each clause belongs to, so those are reported instead.

const CHOOSE_PLAYER_CLAUSE = /选择[^。；;：:，,]*?玩家/g;

function getChoosePlayerClauses(abilityText) {
  return String(abilityText || "").match(CHOOSE_PLAYER_CLAUSE) || [];
}

/** Filters a single choose-player clause asks for, in schema order. */
function inferFiltersFromClause(clause) {
  const filters = [];
  if (/存活/.test(clause)) filters.push("alive");
  else if (/死亡的?(?:玩家|旅行者)/.test(clause)) filters.push("dead");
  if (/除(?:你|自己)(?:以外|之外|外|及)/.test(clause)) filters.push("notSelf");
  return filters;
}

function getTargetSeatFields(abilityData) {
  const fields = abilityData?.interactionSchema?.target?.fields;
  return (Array.isArray(fields) ? fields : []).filter((field) => field?.type === "seat" || field?.type === "player");
}

/**
 * { status, filters, fieldKeys }:
 *  - "infer": add `filters` to `fieldKeys` (target seat fields without a seatFilter yet)
 *  - "ambiguous": several clauses and at least one asks for a filter
 *  - "none": nothing to add
 */
function inferSeatFilters(role) {
  const seatFields = getTargetSeatFields(role?.abilityData);
  if (!seatFields.length) {
    return { status: "none", filters: [], fieldKeys: [] };
  }

  const clauses = getChoosePlayerClauses(role.ability);
  const perClause = clauses.map(inferFiltersFromClause);
  if (clauses.length !== 1) {
    return {
      status: perClause.some((filters) => filters.length) ? "ambiguous" : "none",
      filters: [],
      fieldKeys: [],
    };
  }

  const filters = perClause[0];
  const fieldKeys = seatFields
    .filter((field) => field.seatFilter === undefined || field.seatFilter === null)
    .map((field) => field.key);
  return filters.length && fieldKeys.length ? { status: "infer", filters, fieldKeys } : { status: "none", filters: [], fieldKeys: [] };
}

/** Write the inferred filters into role.abilityData (mutates). Returns true when something changed. */
function applySeatFilters(role, inference) {
  if (inference.status !== "infer") {
    return false;
  }
  let changed = false;
  getTargetSeatFields(role.abilityData).forEach((field) => {
    if (inference.fieldKeys.includes(field.key)) {
      field.seatFilter = [...inference.filters];
      changed = true;
    }
  });
  return changed;
}

module.exports = {
  applySeatFilters,
  getChoosePlayerClauses,
  inferFiltersFromClause,
  inferSeatFilters,
};
