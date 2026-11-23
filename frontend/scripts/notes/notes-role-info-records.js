// Phase-tagged role ability records (roleInfo v3).
//
// v3 shape: { version: 3, roleId, records: [{ phaseType, phaseNumber, targetEntries, resultEntries }] }
// - Each record belongs to exactly one phase ("night" N / "day" N). Night N is followed by day N.
// - phaseType "" with phaseNumber 0 marks a record whose phase is unknown (migrated data whose old row
//   position did not encode a phase, e.g. event-triggered or once-per-game abilities).
// - Inside one record, targetEntries[j] and resultEntries[j] belong together (same as v2 rows).
//
// This module is pure (no DOM / global state) so it can be shared by renderers, actions and tests.

export const ROLE_INFO_VERSION = 3;
const MAX_PHASE_NUMBER = 99;

export function phaseOrderIndex(phaseType, phaseNumber) {
  if (!isPhased(phaseType)) {
    return -1;
  }

  return (Number(phaseNumber) || 1) * 2 + (phaseType === "day" ? 1 : 0);
}

export function isPhased(phaseType) {
  return phaseType === "night" || phaseType === "day";
}

export function formatRoleInfoPhaseLabel(phaseType, phaseNumber) {
  if (!isPhased(phaseType)) {
    return "";
  }

  return `第 ${phaseNumber} ${phaseType === "day" ? "天" : "夜"}`;
}

function clampPhaseNumber(value) {
  return Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), MAX_PHASE_NUMBER);
}

export function normalizeRecordPhase(phaseType, phaseNumber) {
  if (!isPhased(phaseType)) {
    return { phaseType: "", phaseNumber: 0 };
  }

  return { phaseType, phaseNumber: clampPhaseNumber(phaseNumber) };
}

export function getGamePhase(game) {
  return {
    phaseType: game?.phaseType === "day" ? "day" : "night",
    phaseNumber: clampPhaseNumber(game?.phaseNumber),
  };
}

export function isRoleInfoEntryFilled(entry) {
  return Object.values(entry || {}).some((value) => String(value ?? "").trim());
}

function cloneEntries(entries) {
  return Array.isArray(entries) ? entries.map((entry) => ({ ...(entry || {}) })) : [];
}

export function createEmptyPhasedRoleInfo(roleId = "") {
  return { version: ROLE_INFO_VERSION, roleId, records: [] };
}

export function sortRoleInfoRecords(records) {
  return [...records].sort(
    (left, right) =>
      phaseOrderIndex(left.phaseType, left.phaseNumber) -
      phaseOrderIndex(right.phaseType, right.phaseNumber),
  );
}

export function cloneRoleInfoRecords(records) {
  return sortRoleInfoRecords(
    (Array.isArray(records) ? records : [])
      .filter((record) => record && typeof record === "object")
      .map((record) => ({
        ...normalizeRecordPhase(record.phaseType, record.phaseNumber),
        targetEntries: cloneEntries(record.targetEntries),
        resultEntries: cloneEntries(record.resultEntries),
      })),
  );
}

export function isPhasedRoleInfo(roleInfo) {
  return Number(roleInfo?.version) === ROLE_INFO_VERSION && Array.isArray(roleInfo?.records);
}

export function findRoleInfoRecord(roleInfo, phaseType, phaseNumber) {
  const phase = normalizeRecordPhase(phaseType, phaseNumber);
  return (roleInfo?.records || []).find(
    (record) => record.phaseType === phase.phaseType && record.phaseNumber === phase.phaseNumber,
  ) || null;
}

export function ensureRoleInfoRecord(roleInfo, phaseType, phaseNumber) {
  const existing = findRoleInfoRecord(roleInfo, phaseType, phaseNumber);
  if (existing) {
    return existing;
  }

  const record = { ...normalizeRecordPhase(phaseType, phaseNumber), targetEntries: [], resultEntries: [] };
  roleInfo.records = sortRoleInfoRecords([...(roleInfo.records || []), record]);
  return record;
}

// ---------------------------------------------------------------------------
// Ability timing plan

function isOnceOnlyAbility(meta) {
  return ["once", "once_per_game", "passive"].includes(meta?.usagePattern);
}

export function isTimedRecurringAbility(meta) {
  return (
    ["once_per_night", "once_per_day", "repeatable"].includes(meta?.usagePattern) ||
    (["each_night", "each_night_star", "each_day"].includes(meta?.phaseTiming) && !isOnceOnlyAbility(meta))
  );
}

/**
 * Describe when an ability produces records.
 * kind:
 *  - "recurring": one record per phase of `phaseType`, starting at `firstNumber`.
 *  - "fixed": exactly one known phase (setup / first night).
 *  - "once": a single use on any phase of `phaseType` from `firstNumber` (phase unknown until used).
 *  - "death": recorded once the player is dead.
 *  - "untimed": event-triggered / passive / no timing; records go to the phase they were entered in.
 */
export function getAbilityPhasePlan(abilityMeta) {
  const meta = abilityMeta || {};
  const timing = meta.phaseTiming || "";

  if (meta.eventTiming === "on_death") {
    return { kind: "death", phaseType: "", firstNumber: 0 };
  }

  if (meta.eventTiming) {
    return { kind: "untimed", phaseType: "", firstNumber: 0 };
  }

  const recurring = isTimedRecurringAbility(meta);
  if (timing === "setup" || timing === "first_night") {
    return { kind: "fixed", phaseType: "night", firstNumber: 1 };
  }

  const timingPhases = {
    each_night: ["night", 1],
    each_night_star: ["night", 2],
    night: ["night", 2],
    each_day: ["day", 1],
    day: ["day", 1],
  };
  if (timingPhases[timing]) {
    const [phaseType, firstNumber] = timingPhases[timing];
    return { kind: recurring ? "recurring" : "once", phaseType, firstNumber };
  }

  if (meta.usagePattern === "once_per_night") {
    return { kind: "recurring", phaseType: "night", firstNumber: 1 };
  }

  if (meta.usagePattern === "once_per_day") {
    return { kind: "recurring", phaseType: "day", firstNumber: 1 };
  }

  return { kind: "untimed", phaseType: "", firstNumber: 0 };
}

/** Phases of the plan's phase type that have started by the current game phase, oldest first. */
export function listPlanPhases(plan, game) {
  if (!plan?.phaseType) {
    return [];
  }

  const current = getGamePhase(game);
  const currentIndex = phaseOrderIndex(current.phaseType, current.phaseNumber);
  const phases = [];
  for (let number = plan.firstNumber; number <= MAX_PHASE_NUMBER; number += 1) {
    if (phaseOrderIndex(plan.phaseType, number) > currentIndex) {
      break;
    }
    phases.push({ phaseType: plan.phaseType, phaseNumber: number });
    if (plan.kind === "fixed") {
      break;
    }
  }
  return phases;
}

// ---------------------------------------------------------------------------
// Migration v2 -> v3

/**
 * Convert v2 rows (targetEntries[i] / resultEntries[i]) into phase records.
 * Row i is mapped to the i-th phase of the ability's timing for recurring abilities
 * (each_night from night 1, each_night_star / night from night 2, each_day from day 1),
 * and to night 1 for setup / first-night abilities.
 * Rows whose phase cannot be derived from their position (once-per-game on a flexible phase,
 * on_death, event-triggered, passive, untimed) are kept together in one record with an unknown phase.
 * Completely empty rows are dropped but still consume their phase slot, so later rows keep their phase.
 */
export function migrateRoleInfoRowsToRecords(targetEntries, resultEntries, abilityMeta) {
  const targets = cloneEntries(targetEntries);
  const results = cloneEntries(resultEntries);
  const plan = getAbilityPhasePlan(abilityMeta);
  const rowCount = Math.max(targets.length, results.length);
  const records = [];
  const byKey = new Map();

  for (let index = 0; index < rowCount; index += 1) {
    const target = targets[index] || {};
    const result = results[index] || {};
    if (!isRoleInfoEntryFilled(target) && !isRoleInfoEntryFilled(result)) {
      continue;
    }

    let phase = { phaseType: "", phaseNumber: 0 };
    if (plan.kind === "recurring") {
      phase = normalizeRecordPhase(plan.phaseType, plan.firstNumber + index);
    } else if (plan.kind === "fixed") {
      phase = normalizeRecordPhase(plan.phaseType, plan.firstNumber);
    }

    const key = `${phase.phaseType}:${phase.phaseNumber}`;
    let record = byKey.get(key);
    if (!record) {
      record = { ...phase, targetEntries: [], resultEntries: [] };
      byKey.set(key, record);
      records.push(record);
    }
    record.targetEntries.push(target);
    record.resultEntries.push(result);
  }

  return sortRoleInfoRecords(records);
}

// ---------------------------------------------------------------------------
// Flattening (summaries, timeline, deduction)

/** Rows in phase order: { phaseType, phaseNumber, entryIndex, target, result }. Empty rows skipped. */
export function flattenRoleInfoRecords(records) {
  const rows = [];
  sortRoleInfoRecords(Array.isArray(records) ? records : []).forEach((record) => {
    const targets = record.targetEntries || [];
    const results = record.resultEntries || [];
    for (let index = 0; index < Math.max(targets.length, results.length); index += 1) {
      const target = targets[index] || {};
      const result = results[index] || {};
      if (!isRoleInfoEntryFilled(target) && !isRoleInfoEntryFilled(result)) {
        continue;
      }
      rows.push({ phaseType: record.phaseType, phaseNumber: record.phaseNumber, entryIndex: index, target, result });
    }
  });
  return rows;
}

function trimEntry(entry) {
  return Object.fromEntries(
    Object.entries(entry || {}).filter(([, value]) => typeof value === "number" || String(value ?? "").trim()),
  );
}

/** Drop empty rows and empty records (used when saving). */
export function trimRoleInfoRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((record) => {
      const targets = [];
      const results = [];
      const count = Math.max(record.targetEntries?.length || 0, record.resultEntries?.length || 0);
      for (let index = 0; index < count; index += 1) {
        const target = trimEntry(record.targetEntries?.[index]);
        const result = trimEntry(record.resultEntries?.[index]);
        if (!isRoleInfoEntryFilled(target) && !isRoleInfoEntryFilled(result)) {
          continue;
        }
        targets.push(target);
        results.push(result);
      }
      return { ...normalizeRecordPhase(record.phaseType, record.phaseNumber), targetEntries: targets, resultEntries: results };
    })
    .filter((record) => record.targetEntries.length || record.resultEntries.length);
}
