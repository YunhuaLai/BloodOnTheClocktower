import {
  findRoleInfoRecord,
  formatRoleInfoPhaseLabel,
  getAbilityPhasePlan,
  getGamePhase,
  isPhased,
  isRoleInfoEntryFilled,
  listPlanPhases,
  phaseOrderIndex,
  sortRoleInfoRecords,
} from "./notes-role-info-records.js";
import { getAbilityTimingText, getRoleInfoNode, getRoleInfoSectionLabel } from "./notes-role-info.js";

// Shared form model for role ability records. Pure: takes ability data + records + context and returns
// rows grouped by phase with cell descriptors. The detail panel, overview editor, storyteller night
// record and acquired-ability records all render from this model and differ only in density/styling.

const deadStatuses = ["night-dead", "executed"];
const repeatableModes = ["sequence", "variable"];

function getVisibleSections(abilityData) {
  return ["target", "result"]
    .map((key) => ({ key, ...getRoleInfoNode(abilityData, key), label: getRoleInfoSectionLabel(key, abilityData) }))
    .filter((section) => section.repeatMode !== "none" && section.fields.length);
}

function phaseKey(phase) {
  return `${phase.phaseType}:${phase.phaseNumber}`;
}

function recordHasData(record) {
  return [...(record?.targetEntries || []), ...(record?.resultEntries || [])].some(isRoleInfoEntryFilled);
}

function getUnphasedLabel(abilityData) {
  return (abilityData?.abilityMeta?.eventTiming && getAbilityTimingText(abilityData.abilityMeta)) || "阶段未知";
}

export function getRoleInfoPhaseRowLabel(phaseType, phaseNumber, entryIndex = 0, abilityData = null) {
  const base = isPhased(phaseType) ? formatRoleInfoPhaseLabel(phaseType, phaseNumber) : getUnphasedLabel(abilityData);
  return entryIndex > 0 ? `${base} · ${entryIndex + 1}` : base;
}

function getDeathPhase(player, game) {
  const current = getGamePhase(game);
  if (player?.status === "night-dead" && current.phaseType === "day") {
    return { phaseType: "night", phaseNumber: current.phaseNumber };
  }
  return current;
}

/**
 * Build rows from a list of phases and their records.
 * options.minEntries(phase) -> minimum entries rendered for that phase.
 */
function buildRows({ abilityData, sections, phases, records, game, minEntries }) {
  const current = getGamePhase(game);
  const hasRepeatable = sections.some((section) => repeatableModes.includes(section.repeatMode));
  // A single-row ("once") section next to a repeatable one is shown on one row only (shared result).
  const onceSectionRow = {};
  sections.forEach((section) => {
    if (section.repeatMode !== "once" || !hasRepeatable) return;
    const holder = sortRoleInfoRecords(records).find((record) =>
      (record[`${section.key}Entries`] || []).some(isRoleInfoEntryFilled),
    );
    onceSectionRow[section.key] = holder ? `${phaseKey(holder)}#0` : null;
  });

  const rows = [];
  phases.forEach((phase) => {
    const record = findRoleInfoRecord({ records }, phase.phaseType, phase.phaseNumber);
    const entryCount = Math.max(
      record?.targetEntries?.length || 0,
      record?.resultEntries?.length || 0,
      minEntries(phase),
    );
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      const rowKey = `${phaseKey(phase)}#${entryIndex}`;
      const cells = [];
      sections.forEach((section) => {
        if (section.key in onceSectionRow) {
          if (onceSectionRow[section.key] === null) onceSectionRow[section.key] = rowKey;
          if (onceSectionRow[section.key] !== rowKey) return;
        }
        const entry = record?.[`${section.key}Entries`]?.[entryIndex] || {};
        section.fields.forEach((field) => {
          cells.push({ section: section.key, field, value: entry[field.key] ?? "" });
        });
      });
      rows.push({
        key: rowKey,
        phaseType: phase.phaseType,
        phaseNumber: phase.phaseNumber,
        entryIndex,
        label: getRoleInfoPhaseRowLabel(phase.phaseType, phase.phaseNumber, entryIndex, abilityData),
        isCurrent: phase.phaseType === current.phaseType && phase.phaseNumber === current.phaseNumber,
        cells,
      });
    }
  });
  return rows;
}

/**
 * Greyed placeholder shown instead of input rows before the ability can be recorded.
 * { phaseType, phaseNumber, label, text }; phaseType is "" when the next chance is not a known phase.
 * It never carries inputs, so nothing can be entered for a future phase.
 */
function getPendingRow(plan, alive, game) {
  if (plan.kind === "death") {
    return { phaseType: "", phaseNumber: 0, label: "死亡后", text: "死亡后可录入" };
  }

  if (plan.kind === "recurring" && !alive) {
    return { phaseType: "", phaseNumber: 0, label: "已死亡", text: "已死亡，不再自动新增" };
  }

  if ((plan.kind === "recurring" || plan.kind === "once") && plan.phaseType && !listPlanPhases(plan, game).length) {
    const label = formatRoleInfoPhaseLabel(plan.phaseType, plan.firstNumber);
    return { phaseType: plan.phaseType, phaseNumber: plan.firstNumber, label, text: `${label}起可录入` };
  }

  return { phaseType: "", phaseNumber: 0, label: "未到", text: "未到记录时机" };
}

function sortPhases(phases) {
  const unique = new Map();
  phases.forEach((phase) => unique.set(phaseKey(phase), phase));
  return [...unique.values()].sort(
    (left, right) => phaseOrderIndex(left.phaseType, left.phaseNumber) - phaseOrderIndex(right.phaseType, right.phaseNumber),
  );
}

function buildActions(sections, rows, target, perPhaseMax, minimum) {
  const repeatable = sections.filter((section) => repeatableModes.includes(section.repeatMode));
  if (!repeatable.length || perPhaseMax <= 1 || !target) {
    return null;
  }
  const count = rows.filter((row) => row.phaseType === target.phaseType && row.phaseNumber === target.phaseNumber).length;
  return {
    phaseType: target.phaseType,
    phaseNumber: target.phaseNumber,
    section: repeatable[0].key,
    canAdd: count < perPhaseMax,
    canRemove: count > minimum,
  };
}

/**
 * Main role ability form.
 * @param {object} params
 * @param {object} params.abilityData role abilityData
 * @param {object} params.roleInfo v3 roleInfo ({ records })
 * @param {object} params.player player (status is used for death-dependent rows)
 * @param {object} params.game { phaseType, phaseNumber }
 * @param {"all"|"current"} [params.scope] "current" only shows the current phase (storyteller night)
 */
export function buildRoleInfoForm({ abilityData, roleInfo, player, game, scope = "all" }) {
  const sections = getVisibleSections(abilityData);
  const plan = getAbilityPhasePlan(abilityData?.abilityMeta);
  const current = getGamePhase(game);
  const records = sortRoleInfoRecords(Array.isArray(roleInfo?.records) ? roleInfo.records : []);
  const alive = !deadStatuses.includes(player?.status);
  const anyFilled = records.some(recordHasData);
  const perPhaseMax = plan.kind === "untimed" || sections.some((section) => section.repeatMode === "variable") ? 99 : 1;
  const model = { plan, sections, rows: [], actions: null, emptyReason: "", pending: null };

  if (!sections.length) {
    return model;
  }

  let phases = [];
  if (scope === "current") {
    phases = [current];
  } else {
    phases = records.map((record) => ({ phaseType: record.phaseType, phaseNumber: record.phaseNumber }));
    if (plan.kind === "recurring" && alive) {
      phases.push(...listPlanPhases(plan, game));
    } else if (plan.kind === "fixed") {
      phases.push(...listPlanPhases(plan, game));
    } else if (plan.kind === "once" && !anyFilled) {
      phases.push(...listPlanPhases(plan, game));
    } else if (plan.kind === "death" && !alive && !anyFilled) {
      phases.push(getDeathPhase(player, game));
    } else if (plan.kind === "untimed") {
      phases.push(current);
    }
  }
  phases = sortPhases(phases);

  model.rows = buildRows({
    abilityData,
    sections,
    phases,
    records,
    game,
    minEntries: () => 1,
  });

  if (!model.rows.length) {
    if (plan.kind === "death") {
      model.emptyReason = "死亡后可录入。";
    } else if (plan.kind === "recurring" && !alive) {
      model.emptyReason = "已死亡，不再自动新增。";
    } else {
      model.emptyReason = "未到记录时机。";
    }
    model.pending = getPendingRow(plan, alive, game);
  }

  const lastPhased = [...model.rows].reverse().find((row) => isPhased(row.phaseType));
  const actionPhase = scope === "current" || plan.kind === "untimed" ? current : lastPhased;
  model.actions = buildActions(sections, model.rows, actionPhase, perPhaseMax, 1);
  return model;
}

/**
 * One acquired-ability record (a single phase). record = { phaseType, phaseNumber, roleInfo: { targetEntries, resultEntries } }.
 */
export function buildAcquiredRecordForm({ abilityData, record, game }) {
  const sections = getVisibleSections(abilityData);
  const phase = { phaseType: record.phaseType, phaseNumber: Number(record.phaseNumber) };
  const phaseRecord = {
    ...phase,
    targetEntries: record.roleInfo?.targetEntries || [],
    resultEntries: record.roleInfo?.resultEntries || [],
  };
  const minimum = Math.max(
    1,
    ...sections.map((section) =>
      repeatableModes.includes(section.repeatMode) ? 1 : Math.max(section.defaultRows || 0, 1),
    ),
  );
  const rows = sections.length
    ? buildRows({ abilityData, sections, phases: [phase], records: [phaseRecord], game, minEntries: () => minimum })
    : [];
  return {
    plan: getAbilityPhasePlan(abilityData?.abilityMeta),
    sections,
    rows,
    actions: buildActions(sections, rows, phase, 99, minimum),
    emptyReason: "",
    pending: null,
  };
}

export { recordHasData };
