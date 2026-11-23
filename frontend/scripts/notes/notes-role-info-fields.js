import { getClaimRoleOptions } from "../notes-claims.js";
import { roleTypeOrder, typeLabels } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getChoiceLabel, isExclusiveField, isExclusiveValueOn } from "./notes-role-info.js";
import { formatRoleInfoPhaseLabel } from "./notes-role-info-records.js";
import { getResidentPlayers, getStandardSetup } from "./notes-core.js";
import { getOpenSeatPickerKey, getSeatPickerKey, renderSeatFieldButton, renderSeatPicker } from "./notes-role-info-seat-picker.js";

// Role field filters. `roleTypes` is an optional explicit attribute on the field (see
// role-ability-schema.yaml); without it the filter is inferred from the field key, then the label.
const teamRoleTypes = {
  good: ["townsfolk", "outsider"],
  evil: ["minion", "demon"],
};
const characterRoleTypes = ["townsfolk", "outsider", "minion", "demon", "traveller"];
const keyTypeTokens = {
  townsfolk: ["townsfolk"],
  outsider: ["outsider"],
  minion: ["minion"],
  demon: ["demon"],
  good: teamRoleTypes.good,
  evil: teamRoleTypes.evil,
};
// Checked in order: specific character types before the broad good/evil wording.
const labelTypeRules = [
  [/镇民/, ["townsfolk"]],
  [/外来者/, ["outsider"]],
  [/爪牙/, ["minion"]],
  [/恶魔/, ["demon"]],
  [/好身份|好角色|好人|善良/, teamRoleTypes.good],
  [/坏身份|坏角色|坏人|邪恶/, teamRoleTypes.evil],
];

function expandRoleTypes(values) {
  const list = (Array.isArray(values) ? values : [values])
    .map((value) => String(value || "").trim().toLowerCase())
    .flatMap((value) => teamRoleTypes[value] || (value === "traveler" ? ["traveller"] : [value]))
    .filter((value) => characterRoleTypes.includes(value));
  return list.length ? [...new Set(list)] : null;
}

/** Character types a role field should list, or null for no filter. */
export function getRoleFieldTypeFilter(field) {
  if (!field || field.type !== "role") {
    return null;
  }

  if (field.roleTypes !== undefined && field.roleTypes !== null) {
    return expandRoleTypes(field.roleTypes);
  }

  const tokens = String(field.key || "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const token of ["townsfolk", "outsider", "minion", "demon", "good", "evil"]) {
    if (tokens.includes(token)) {
      return [...keyTypeTokens[token]];
    }
  }

  const label = String(field.label || "");
  const rule = labelTypeRules.find(([pattern]) => pattern.test(label));
  return rule ? [...rule[1]] : null;
}

/** Filter role options for a field; falls back to every role when the filter would leave none. */
export function getRoleFieldCandidates(field, roles) {
  const types = getRoleFieldTypeFilter(field);
  if (!types) {
    return roles;
  }

  const filtered = roles.filter((role) => types.includes(role.type === "traveler" ? "traveller" : role.type));
  return filtered.length ? filtered : roles;
}

// Number fields render as a row of buttons only when the declared range is small. Most role YAML
// number fields carry an auto-generated 0..15 range, so a small span is a sign it was set by hand.
export const NUMBER_BUTTON_LIMIT = 6;

const deadStatusList = ["night-dead", "executed"];

/**
 * Game-dependent number bounds: min / max may be "$players" (non-traveller players), "$alive", "$dead" or
 * "$evil" (minions + demon of the standard setup for the player count). Without a game they stay unset.
 */
export function resolveNumberBound(value, game) {
  if (typeof value !== "string" || !value.startsWith("$")) {
    return value;
  }
  if (!game) {
    return null;
  }
  const residents = getResidentPlayers(game);
  const players = residents.length || Number(game.playerCount) || 0;
  const dead = residents.filter((player) => deadStatusList.includes(player.status)).length;
  const setup = getStandardSetup(players);
  const tokens = {
    $players: players,
    $alive: players - dead,
    $dead: dead,
    $evil: (setup.minion || 0) + (setup.demon || 0),
  };
  return value in tokens ? tokens[value] : null;
}

export function isDynamicNumberBound(value) {
  return typeof value === "string" && value.startsWith("$");
}

/** The field with its min / max resolved against the game; `dynamicMax` marks a game-dependent upper bound. */
export function resolveNumberField(field, game) {
  if (field?.type !== "number") {
    return field;
  }
  return {
    ...field,
    min: resolveNumberBound(field.min, game),
    max: resolveNumberBound(field.max, game),
    dynamicMax: isDynamicNumberBound(field.max),
  };
}

/** Values for the number button row, or null when the field should use the stepper input. */
export function getNumberButtonValues(field) {
  if (field?.type !== "number" || field.min === null || field.max === null || field.min === undefined || field.max === undefined || field.min === "" || field.max === "") {
    return null;
  }

  const min = Number(field.min);
  const max = Number(field.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min || max - min + 1 > NUMBER_BUTTON_LIMIT) {
    return null;
  }

  return Array.from({ length: max - min + 1 }, (_, index) => String(min + index));
}

/** Options for a segmented boolean control: custom `options` when present, otherwise yes/no. */
export function getBooleanFieldOptions(field) {
  const values = Array.isArray(field?.options) && field.options.length ? field.options : ["yes", "no"];
  return values.map((value) => ({ value: String(value), label: getChoiceLabel(value) }));
}

const booleanTones = ["evil", "good", "neutral"];

/**
 * Colour meaning of a yes/no field. "evil": yes is bad news for good (占卜师 有恶魔) and shows red, no shows
 * teal; "good" is the reverse; "neutral" (default) shows both in ink. Set by `tone`, otherwise inferred:
 * a label about finding a demon / minion / evil player is "evil".
 */
export function getBooleanFieldTone(field) {
  if (booleanTones.includes(field?.tone)) {
    return field.tone;
  }
  const label = String(field?.label || "");
  return /恶魔|爪牙|邪恶/.test(label) && !/阻止|提示|告知/.test(label) ? "evil" : "neutral";
}

/** Value to store when a segment is tapped: tapping the selected segment clears the field. */
export function getSegmentNextValue(currentValue, optionValue) {
  return String(currentValue ?? "") === String(optionValue) ? "" : String(optionValue);
}

function readBound(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Next stepper value: blank steps to the lower bound; never below min (or 0 without min) and
 * + never goes past max. A value already above max (typed, or old data) is not pulled down.
 */
export function getSteppedNumberValue(currentValue, step, field = {}) {
  const lower = readBound(field.min) ?? 0;
  const upper = readBound(field.max);
  const text = String(currentValue ?? "").trim();
  const current = Number(text);
  if (!text || !Number.isFinite(current)) {
    return String(lower);
  }

  const rounded = Math.round(current);
  let next = Math.max(rounded + Number(step || 0), lower);
  if (upper !== null && step > 0 && next > upper) {
    next = Math.max(rounded, upper);
  }
  return String(next);
}

/** Accessible name for a control: the phase (when known) plus the field label, e.g. "第2夜 邻座邪恶数". */
export function getFieldAccessibleLabel(field, phase) {
  const number = Number(phase?.phaseNumber) || 0;
  const phaseText =
    number > 0 && phase?.phaseType === "night" ? `第${number}夜` : number > 0 && phase?.phaseType === "day" ? `第${number}天` : "";
  return [phaseText, String(field?.label || "").trim()].filter(Boolean).join(" ");
}

function getRoleInfoFieldOptions(field, game) {
  if (field.type === "role") {
    return getRoleFieldCandidates(field, getClaimRoleOptions(game)).map((role) => ({
      value: role.name,
      label: role.name,
    }));
  }

  if (field.type === "team") {
    return [
      { value: "good", label: "好" },
      { value: "evil", label: "坏" },
    ];
  }

  if (field.type === "character_type") {
    return roleTypeOrder
      .filter((type) => type !== "fabled" && type !== "traveller" && type !== "traveler")
      .map((type) => ({
        value: type,
        label: typeLabels[type] || type,
      }));
  }

  if (field.type === "status") {
    return [
      { value: "sober", label: "清" },
      { value: "poisoned", label: "毒" },
      { value: "drunk", label: "醉" },
    ];
  }

  if (field.type === "boolean" || field.type === "choice") {
    const optionValues =
      Array.isArray(field.options) && field.options.length
        ? field.options
        : field.type === "boolean"
          ? ["yes", "no"]
          : [];

    return optionValues.map((value) => ({
      value: String(value),
      label: getChoiceLabel(value),
    }));
  }

  return [];
}

// Context of the form being rendered (set by renderRoleInfoForm, which renders synchronously):
// pickerScope keys the seat picker to one form, ownerSeat is the seat of the ability's owner (seatFilter notSelf).
let formUi = { pickerScope: "", ownerSeat: 0 };

function getFieldSharedData(sectionKey, rowIndex, field, phase, disabled) {
  return `
    data-roleinfo-section="${escapeHtml(sectionKey)}"
    data-roleinfo-row="${rowIndex}"
    data-roleinfo-field="${escapeHtml(field.key)}"
    ${renderPhaseData("roleinfo-", phase)}
    ${disabled ? "disabled" : ""}
  `;
}

// Above this many candidates a native <select> gets unwieldy (free mode lists the whole catalog),
// so role fields fall back to the searchable text input + datalist.
export const ROLE_SELECT_LIMIT = 80;

function renderOption(value, label, currentValue) {
  return `<option value="${escapeHtml(value)}"${String(value) === currentValue ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderUnknownCurrentOption(currentValue, knownValues) {
  return currentValue && !knownValues.includes(currentValue)
    ? `<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(currentValue)}</option>`
    : "";
}

function renderRoleSelect(field, currentValue, roles, sharedData) {
  const groups = roleTypeOrder
    .map((type) => ({ type, roles: roles.filter((role) => role.type === type) }))
    .filter((group) => group.roles.length);
  const ungrouped = roles.filter((role) => !roleTypeOrder.includes(role.type));
  const names = roles.map((role) => role.name);
  return `
    <select aria-label="${escapeHtml(field.label || "角色")}" ${sharedData}>
      <option value="">—</option>
      ${renderUnknownCurrentOption(currentValue, names)}
      ${groups
        .map(
          (group) => `<optgroup label="${escapeHtml(typeLabels[group.type] || group.type)}">
            ${group.roles.map((role) => renderOption(role.name, role.name, currentValue)).join("")}
          </optgroup>`,
        )
        .join("")}
      ${ungrouped.map((role) => renderOption(role.name, role.name, currentValue)).join("")}
    </select>
  `;
}

// Filtered role inputs over ROLE_SELECT_LIMIT share one datalist per type set. Fields register the
// set while the tab content renders; the shell then emits the lists next to #roleNameList.
const pendingRoleLists = new Map();

export function getRoleListId(types) {
  return `roleNameList-${types.join("-")}`;
}

export function renderRoleInfoRoleDatalists(game) {
  const lists = [...pendingRoleLists.values()];
  pendingRoleLists.clear();
  if (!lists.length || !game) {
    return "";
  }

  const roles = getClaimRoleOptions(game);
  return lists
    .map((types) => {
      const candidates = getRoleFieldCandidates({ type: "role", roleTypes: types }, roles);
      return `<datalist id="${escapeHtml(getRoleListId(types))}">${candidates
        .map((role) => `<option value="${escapeHtml(role.name)}" label="${escapeHtml(typeLabels[role.type] || role.type)}"></option>`)
        .join("")}</datalist>`;
    })
    .join("");
}

function renderRoleTextInput(field, currentValue, filterTypes, sharedData) {
  let listId = "roleNameList";
  if (filterTypes) {
    listId = getRoleListId(filterTypes);
    pendingRoleLists.set(listId, filterTypes);
  }

  return `
    <input
      type="text"
      list="${listId}"
      value="${escapeHtml(currentValue)}"
      placeholder="${escapeHtml(field.placeholder || field.label)}"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      ${sharedData}
    />
  `;
}

function renderSegmentButtons(field, currentValue, options, sharedData, accessibleLabel, extraClass = "", toneClass = "") {
  const knownValues = options.map((option) => option.value);
  // A stored value outside the options (old data, out-of-range number) stays visible and clearable.
  const allOptions =
    currentValue && !knownValues.includes(currentValue)
      ? [...options, { value: currentValue, label: getChoiceLabel(currentValue) }]
      : options;
  const countClass = extraClass ? ` notes-roleinfo-segments--n${Math.min(allOptions.length, NUMBER_BUTTON_LIMIT)}` : "";
  return `
    <div class="notes-roleinfo-segments${extraClass}${countClass}${toneClass}" role="group" aria-label="${escapeHtml(accessibleLabel)}">
      ${extraClass ? `<div class="notes-roleinfo-segment-grid">` : ""}
      ${allOptions
        .map((option) => {
          const selected = !option.extra && option.value === currentValue;
          return `<button
            type="button"
            class="notes-roleinfo-segment${selected ? ` is-selected notes-roleinfo-segment--${escapeHtml(option.value)}` : ""}"
            data-notes-action="set-roleinfo-field"
            value="${escapeHtml(option.extra ? option.value : getSegmentNextValue(currentValue, option.value))}"
            aria-pressed="${selected ? "true" : "false"}"
            ${sharedData}
          >${escapeHtml(option.label)}</button>`;
        })
        .join("")}
      ${extraClass ? "</div>" : ""}
    </div>
  `;
}

function renderNumberStepper(field, currentValue, sharedData, accessibleLabel) {
  const minValue = field.min ?? "";
  const maxValue = field.max ?? "";
  const name = escapeHtml(accessibleLabel || "数字");
  return `
    <div class="notes-roleinfo-stepper" role="group" aria-label="${name}">
      <button type="button" class="notes-roleinfo-step" data-notes-action="step-roleinfo-field" data-step="-1" aria-label="${name} 减一">−</button>
      <input
        type="number"
        inputmode="numeric"
        step="1"
        ${minValue !== "" ? `min="${escapeHtml(minValue)}"` : ""}
        ${maxValue !== "" ? `max="${escapeHtml(maxValue)}"` : ""}
        value="${escapeHtml(currentValue)}"
        placeholder="${escapeHtml(field.placeholder || "—")}"
        aria-label="${name}"
        autocomplete="off"
        ${sharedData}
      />
      <button type="button" class="notes-roleinfo-step" data-notes-action="step-roleinfo-field" data-step="1" aria-label="${name} 加一">+</button>
    </div>
  `;
}

function renderPhaseData(prefix, phase) {
  if (!phase) {
    return "";
  }

  return `data-${prefix}phase-type="${escapeHtml(phase.phaseType || "")}" data-${prefix}phase-number="${Number(phase.phaseNumber) || 0}"`;
}

// One toggle button for an exclusive switch: tap to turn on ("yes"), tap again to clear.
function renderExclusiveToggle(field, currentValue, sharedData, accessibleLabel) {
  const on = isExclusiveValueOn(currentValue);
  return `
    <button
      type="button"
      class="notes-roleinfo-segment notes-roleinfo-exclusive${on ? " is-selected" : ""}"
      data-notes-action="set-roleinfo-field"
      value="${on ? "" : "yes"}"
      aria-pressed="${on ? "true" : "false"}"
      aria-label="${escapeHtml(accessibleLabel)}"
      ${sharedData}
    >${escapeHtml(field.label)}</button>
  `;
}

/** disabled: the row's exclusive switch is on, so this field does not apply. */
export function renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat, phase = null, disabled = false) {
  const currentValue = String(value ?? "");
  const sharedData = getFieldSharedData(sectionKey, rowIndex, field, phase, disabled);

  if (field.type === "seat" || field.type === "player") {
    const key = getSeatPickerKey(formUi.pickerScope, sectionKey, rowIndex, field.key, phase);
    return renderSeatFieldButton(field, currentValue, key, disabled, getFieldAccessibleLabel(field, phase));
  }

  if (field.type === "role") {
    const allRoles = game ? getClaimRoleOptions(game) : [];
    const roles = getRoleFieldCandidates(field, allRoles);
    if (roles.length && roles.length <= ROLE_SELECT_LIMIT) {
      return renderRoleSelect(field, currentValue, roles, sharedData);
    }

    return renderRoleTextInput(field, currentValue, roles !== allRoles ? getRoleFieldTypeFilter(field) : null, sharedData);
  }

  const accessibleLabel = getFieldAccessibleLabel(field, phase);

  if (isExclusiveField(field)) {
    return renderExclusiveToggle(field, currentValue, sharedData, accessibleLabel);
  }

  if (field.type === "boolean") {
    const toneClass = ` notes-roleinfo-segments--bool notes-roleinfo-segments--tone-${getBooleanFieldTone(field)}`;
    return renderSegmentButtons(field, currentValue, getBooleanFieldOptions(field), sharedData, accessibleLabel, "", toneClass);
  }

  if (field.type === "number") {
    const resolved = resolveNumberField(field, game);
    const values = getNumberButtonValues(resolved);
    if (values) {
      const options = values.map((value) => ({ value, label: value }));
      // A game-dependent maximum can be too low (a death not marked yet, a converted player): "+1" goes past it.
      if (resolved.dynamicMax) {
        const top = Math.max(Number(resolved.max), Number(currentValue) || 0);
        options.push({ value: String(top + 1), label: "+1", extra: true });
      }
      return renderSegmentButtons(resolved, currentValue, options, sharedData, accessibleLabel, " notes-roleinfo-segments--numbers");
    }

    // A dynamic maximum only shapes the buttons; the stepper stays open-ended so it never blocks a value.
    return renderNumberStepper(resolved.dynamicMax ? { ...resolved, max: null } : resolved, currentValue, sharedData, accessibleLabel);
  }

  if (["team", "character_type", "status", "choice"].includes(field.type)) {
    const options = getRoleInfoFieldOptions(field, game);
    const hasCurrentValue =
      currentValue &&
      options.some((option) => String(option.value) === currentValue);
    const extraCurrentOption =
      currentValue && !hasCurrentValue
        ? `<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(currentValue)}</option>`
        : "";

    return `
        <select ${sharedData}>
          <option value="">空</option>
          ${extraCurrentOption}
          ${options
            .map(
              (option) =>
                `<option value="${escapeHtml(option.value)}"${String(option.value) === currentValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
            )
            .join("")}
        </select>
    `;
  }

  return `
    <input
      type="text"
      value="${escapeHtml(currentValue)}"
      placeholder="${escapeHtml(field.placeholder || field.label)}"
      ${sharedData}
    />
  `;
}

// Button-based controls must not sit inside a <label>: tapping the caption would click the first button.
function usesButtonControl(field) {
  return ["boolean", "number", "seat", "player"].includes(field?.type);
}

function getFieldWrapperTag(field) {
  return usesButtonControl(field) ? "div" : "label";
}

export function renderRoleInfoFieldControl(sectionKey, rowIndex, field, value, game, maxSeat, phase = null, disabled = false) {
  const tag = getFieldWrapperTag(field);
  // An exclusive switch carries its own label on the button; the caption reads "或" (… or there is none).
  const caption = isExclusiveField(field) ? "或" : field.label;
  return `
    <${tag} class="notes-roleinfo-field${disabled ? " is-disabled" : ""}">
      <span>${escapeHtml(caption)}</span>
      ${renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat, phase, disabled)}
    </${tag}>
  `;
}

/** Field keys of a row that an exclusive switch turned on replaces (the switch itself stays enabled). */
export function getExclusiveDisabledKeys(cells) {
  const on = cells.find((cell) => isExclusiveField(cell.field) && isExclusiveValueOn(cell.value));
  if (!on) {
    return new Set();
  }
  return new Set(cells.filter((cell) => cell !== on && cell.section === on.section).map((cell) => `${cell.section}:${cell.field.key}`));
}

// Most columns a field fits in on a phone-width row.
function getFieldMaxColumns(field) {
  if (field?.type === "seat" || field?.type === "player") {
    return 5;
  }

  if (field?.type === "role" || field?.type === "boolean") {
    return 3;
  }

  if (field?.type === "number") {
    return 2;
  }

  return 4;
}

export function getFieldGridSize(fields) {
  if (!fields.length) {
    return 1;
  }

  return Math.min(fields.length, ...fields.map(getFieldMaxColumns));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function formatPhaseChoiceValue(phase) {
  return `${phase.phaseType}:${Number(phase.phaseNumber) || 0}`;
}

export function parsePhaseChoiceValue(value) {
  const [phaseType, phaseNumber] = String(value || "").split(":");
  return { phaseType: phaseType || "", phaseNumber: Number(phaseNumber) || 0 };
}

// Once-per-game rows label themselves with a phase picker: "this was used on night 3".
function renderPhasePicker(row) {
  const currentValue = formatPhaseChoiceValue(row);
  const known = row.phaseChoices.some((phase) => formatPhaseChoiceValue(phase) === currentValue);
  return `
    <select
      class="notes-roleinfo-index notes-roleinfo-index--phase notes-roleinfo-phase-picker"
      aria-label="使用阶段"
      data-roleinfo-phase-picker="true"
      ${renderPhaseData("roleinfo-", row)}
    >
      ${known ? "" : `<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(row.label)}</option>`}
      ${row.phaseChoices
        // No spaces ("第2夜"): the picker sits in the narrow phase column next to its arrow.
        .map((phase) => renderOption(formatPhaseChoiceValue(phase), formatRoleInfoPhaseLabel(phase.phaseType, phase.phaseNumber).replace(/\s+/g, ""), currentValue))
        .join("")}
    </select>
  `;
}

function renderRowLabel(row) {
  return row.phaseChoices?.length
    ? renderPhasePicker(row)
    : `<span class="notes-roleinfo-index notes-roleinfo-index--phase">${escapeHtml(row.label)}</span>`;
}

function isSeatField(field) {
  return field?.type === "seat" || field?.type === "player";
}

/**
 * Seat picker for the open seat cell among `cells`, or "". With `advance`, a pick moves on to the next enabled
 * seat cell of the list; otherwise (packed rows, where the next cell is another phase) it closes.
 */
function renderOpenSeatPicker(cells, game, maxSeat, disabledKeys = new Set(), advance = true) {
  const openKey = getOpenSeatPickerKey();
  if (!openKey) {
    return "";
  }
  const seatCells = cells
    .filter((cell) => isSeatField(cell.field) && !disabledKeys.has(`${cell.section}:${cell.field.key}`))
    .map((cell) => ({ ...cell, key: getSeatPickerKey(formUi.pickerScope, cell.section, cell.rowIndex, cell.field.key, cell.phase) }));
  const index = seatCells.findIndex((cell) => cell.key === openKey);
  if (index < 0) {
    return "";
  }
  const cell = seatCells[index];
  return renderSeatPicker({
    field: cell.field,
    currentValue: String(cell.value ?? ""),
    sharedData: getFieldSharedData(cell.section, cell.rowIndex, cell.field, cell.phase, false),
    key: cell.key,
    nextKey: advance ? seatCells[index + 1]?.key || "" : "",
    game,
    maxSeat,
    ownerSeat: formUi.ownerSeat,
    accessibleLabel: getFieldAccessibleLabel(cell.field, cell.phase),
  });
}

function renderFormRow(row, game, maxSeat, renderRowExtra = null) {
  const phase = { phaseType: row.phaseType, phaseNumber: row.phaseNumber };
  const extra = renderRowExtra ? renderRowExtra(row) : "";
  const disabledKeys = getExclusiveDisabledKeys(row.cells);
  const picker = renderOpenSeatPicker(
    row.cells.map((cell) => ({ ...cell, rowIndex: row.entryIndex, phase })),
    game,
    maxSeat,
    disabledKeys,
  );
  return `
    <div class="notes-roleinfo-row${row.isCurrent ? " notes-roleinfo-row--current" : ""}">
      ${renderRowLabel(row)}
      <div class="notes-roleinfo-fields notes-roleinfo-fields--${getFieldGridSize(row.cells.map((cell) => cell.field))}">
        ${row.cells
          .map((cell) =>
            renderRoleInfoFieldControl(cell.section, row.entryIndex, cell.field, cell.value, game, maxSeat, phase, disabledKeys.has(`${cell.section}:${cell.field.key}`)),
          )
          .join("")}
      </div>
      ${picker}
      ${extra}
    </div>
  `;
}

// Placeholder for a phase that has not started yet (see getPendingRow in notes-role-info-form.js). No inputs.
function renderPendingRow(pending) {
  return `
    <div class="notes-roleinfo-row notes-roleinfo-row--pending" aria-disabled="true">
      <span class="notes-roleinfo-index notes-roleinfo-index--phase">${escapeHtml(pending.label)}</span>
      <span class="notes-roleinfo-pending-text">${escapeHtml(pending.text)}</span>
    </div>
  `;
}

// Single-field rows (e.g. one number per night) are packed into a grid with the phase as the label.
function renderCompactRows(rows, game, maxSeat) {
  const field = rows[0].cells[0].field;
  const size = getFieldMaxColumns(field);
  const tag = getFieldWrapperTag(field);
  return chunk(rows, size)
    .map(
      (group) => `
        <div class="notes-roleinfo-row notes-roleinfo-row--packed">
          <div class="notes-roleinfo-fields notes-roleinfo-fields--${size}">
            ${group
              .map((row) => {
                const cell = row.cells[0];
                const phase = { phaseType: row.phaseType, phaseNumber: row.phaseNumber };
                return `
                  <${tag} class="notes-roleinfo-field notes-roleinfo-field--stacked${row.isCurrent ? " notes-roleinfo-field--current" : ""}">
                    <span>${escapeHtml(row.label)}</span>
                    ${renderRoleInfoFieldElement(cell.section, row.entryIndex, cell.field, cell.value, game, maxSeat, phase)}
                  </${tag}>
                `;
              })
              .join("")}
          </div>
          ${renderOpenSeatPicker(
            group.map((row) => ({ ...row.cells[0], rowIndex: row.entryIndex, phase: { phaseType: row.phaseType, phaseNumber: row.phaseNumber } })),
            game,
            maxSeat,
            new Set(),
            false,
          )}
        </div>
      `,
    )
    .join("");
}

/**
 * Render a form model from notes-role-info-form.js.
 * options: { game, maxSeat, density: "regular" | "compact", title, hint, playerId, className, renderRowExtra }
 * renderRowExtra(row) -> html appended inside each row (storyteller truth suggestions); disables packing.
 */
export function renderRoleInfoForm(model, options = {}) {
  const { game, maxSeat = 15, density = "regular", title = "", hint = "", playerId = "", className = "", renderRowExtra = null } = options;
  if (!model?.rows?.length && !model?.pending) {
    return "";
  }

  const owner = (game?.players || []).find((player) => player.id === playerId);
  formUi = {
    pickerScope: options.pickerScope ?? playerId,
    ownerSeat: Number(options.ownerSeat ?? owner?.seat) || 0,
  };

  const packed =
    !renderRowExtra && density === "compact" && model.rows.length > 1 && model.rows.every((row) => row.cells.length === 1);
  const rowsHtml = !model.rows.length
    ? renderPendingRow(model.pending)
    : packed
      ? renderCompactRows(model.rows, game, maxSeat)
      : model.rows.filter((row) => row.cells.length).map((row) => renderFormRow(row, game, maxSeat, renderRowExtra)).join("");
  const actions = model.actions;
  const actionData = actions
    ? `${playerId ? `data-player-id="${escapeHtml(playerId)}"` : ""} data-section="${escapeHtml(actions.section)}" ${renderPhaseData("", actions)}`
    : "";
  const heading = title || model.sections.map((section) => section.label).join(" → ");

  return `
    <section class="notes-roleinfo-section notes-roleinfo-form notes-roleinfo-form--${density}${className ? ` ${className}` : ""}">
      ${
        heading || hint
          ? `<div class="notes-roleinfo-section-header">
              <strong>${escapeHtml(heading)}</strong>
              ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
            </div>`
          : ""
      }
      <div class="notes-roleinfo-list">${rowsHtml}</div>
      ${
        actions
          ? `<div class="notes-roleinfo-actions">
              <button type="button" class="note-icon-button" data-notes-action="add-roleinfo-row" ${actionData} ${actions.canAdd ? "" : "disabled"}>+ 一条</button>
              <button type="button" class="note-icon-button" data-notes-action="remove-roleinfo-row" ${actionData} ${actions.canRemove ? "" : "disabled"}>- 末条</button>
            </div>`
          : ""
      }
    </section>
  `;
}
