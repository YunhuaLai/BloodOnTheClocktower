import { getClaimRoleOptions } from "../notes-claims.js";
import { roleTypeOrder, typeLabels } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getChoiceLabel } from "./notes-role-info.js";

function getRoleInfoFieldOptions(field, game) {
  if (field.type === "role") {
    return getClaimRoleOptions(game).map((role) => ({
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

// Above this many candidates a native <select> gets unwieldy (free mode lists the whole catalog),
// so role fields fall back to the searchable text input + datalist.
export const ROLE_SELECT_LIMIT = 80;
const deadStatuses = ["night-dead", "executed"];

function renderOption(value, label, currentValue) {
  return `<option value="${escapeHtml(value)}"${String(value) === currentValue ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderUnknownCurrentOption(currentValue, knownValues) {
  return currentValue && !knownValues.includes(currentValue)
    ? `<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(currentValue)}</option>`
    : "";
}

export function getSeatOptions(game, maxSeat) {
  const playersBySeat = new Map((game?.players || []).map((player) => [Number(player.seat), player]));
  const count = Math.max(Number(maxSeat) || 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const seat = index + 1;
    const player = playersBySeat.get(seat);
    const name = String(player?.name || "").trim();
    const dead = deadStatuses.includes(player?.status);
    return {
      value: String(seat),
      label: `${seat}号${dead ? "（死）" : ""}${name ? ` ${name}` : ""}`,
    };
  });
}

function renderSeatSelect(field, currentValue, game, maxSeat, sharedData) {
  const options = getSeatOptions(game, maxSeat);
  return `
    <select aria-label="${escapeHtml(field.label || "号码")}" ${sharedData}>
      <option value="">—</option>
      ${renderUnknownCurrentOption(currentValue, options.map((option) => option.value))}
      ${options.map((option) => renderOption(option.value, option.label, currentValue)).join("")}
    </select>
  `;
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

function renderPhaseData(prefix, phase) {
  if (!phase) {
    return "";
  }

  return `data-${prefix}phase-type="${escapeHtml(phase.phaseType || "")}" data-${prefix}phase-number="${Number(phase.phaseNumber) || 0}"`;
}

export function renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat, phase = null) {
  const currentValue = String(value ?? "");
  const sharedData = `
    data-roleinfo-section="${escapeHtml(sectionKey)}"
    data-roleinfo-row="${rowIndex}"
    data-roleinfo-field="${escapeHtml(field.key)}"
    ${renderPhaseData("roleinfo-", phase)}
  `;

  if (field.type === "seat" || field.type === "player") {
    return renderSeatSelect(field, currentValue, game, maxSeat, sharedData);
  }

  if (field.type === "role") {
    const roles = game ? getClaimRoleOptions(game) : [];
    if (roles.length && roles.length <= ROLE_SELECT_LIMIT) {
      return renderRoleSelect(field, currentValue, roles, sharedData);
    }

    return `
      <input
        type="text"
        list="roleNameList"
        value="${escapeHtml(currentValue)}"
        placeholder="${escapeHtml(field.placeholder || field.label)}"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        ${sharedData}
      />
    `;
  }

  if (field.type === "boolean") {
    const buttonText = getChoiceLabel(currentValue || "?");
    const buttonClass = currentValue ? ` notes-roleinfo-toggle--${escapeHtml(currentValue)}` : "";
    return `
      <button
        type="button"
        class="notes-roleinfo-toggle${buttonClass}"
        data-notes-action="cycle-roleinfo-field"
        data-section="${escapeHtml(sectionKey)}"
        data-row="${rowIndex}"
        data-field="${escapeHtml(field.key)}"
        ${renderPhaseData("", phase)}
      >${escapeHtml(buttonText)}</button>
    `;
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

  const isNumericField = field.type === "number";
  const inputType = isNumericField ? "number" : "text";
  const minValue = isNumericField ? field.min ?? "" : "";
  const maxValue = isNumericField ? field.max ?? "" : "";

  return `
    <input
      type="${inputType}"
        ${minValue !== "" ? `min="${minValue}"` : ""}
        ${maxValue !== "" ? `max="${maxValue}"` : ""}
        ${isNumericField ? 'step="1"' : ""}
        value="${escapeHtml(currentValue)}"
        placeholder="${escapeHtml(field.placeholder || field.label)}"
      ${sharedData}
    />
  `;
}

export function renderRoleInfoFieldControl(sectionKey, rowIndex, field, value, game, maxSeat, phase = null) {
  return `
    <label class="notes-roleinfo-field">
      <span>${escapeHtml(field.label)}</span>
      ${renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat, phase)}
    </label>
  `;
}

function isCompactField(field) {
  return ["number", "seat", "player", "boolean"].includes(field?.type);
}

function getFieldGridSize(fields) {
  if (!fields.length) {
    return 1;
  }

  if (fields.some((field) => field?.type === "role")) {
    return Math.min(fields.length, 3);
  }

  if (fields.every(isCompactField)) {
    return Math.min(fields.length, 5);
  }

  return Math.min(fields.length, 4);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function renderFormRow(row, game, maxSeat) {
  const phase = { phaseType: row.phaseType, phaseNumber: row.phaseNumber };
  return `
    <div class="notes-roleinfo-row${row.isCurrent ? " notes-roleinfo-row--current" : ""}">
      <span class="notes-roleinfo-index notes-roleinfo-index--phase">${escapeHtml(row.label)}</span>
      <div class="notes-roleinfo-fields notes-roleinfo-fields--${getFieldGridSize(row.cells.map((cell) => cell.field))}">
        ${row.cells
          .map((cell) => renderRoleInfoFieldControl(cell.section, row.entryIndex, cell.field, cell.value, game, maxSeat, phase))
          .join("")}
      </div>
    </div>
  `;
}

// Single-field rows (e.g. one number per night) are packed into a grid with the phase as the label.
function renderCompactRows(rows, game, maxSeat) {
  const field = rows[0].cells[0].field;
  const size = field?.type === "role" ? 3 : isCompactField(field) ? 5 : 4;
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
                  <label class="notes-roleinfo-field notes-roleinfo-field--stacked${row.isCurrent ? " notes-roleinfo-field--current" : ""}">
                    <span>${escapeHtml(row.label)}</span>
                    ${renderRoleInfoFieldElement(cell.section, row.entryIndex, cell.field, cell.value, game, maxSeat, phase)}
                  </label>
                `;
              })
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

/**
 * Render a form model from notes-role-info-form.js.
 * options: { game, maxSeat, density: "regular" | "compact", title, hint, playerId, className }
 */
export function renderRoleInfoForm(model, options = {}) {
  const { game, maxSeat = 15, density = "regular", title = "", hint = "", playerId = "", className = "" } = options;
  if (!model?.rows?.length) {
    return "";
  }

  const packed =
    density === "compact" && model.rows.length > 1 && model.rows.every((row) => row.cells.length === 1);
  const rowsHtml = packed
    ? renderCompactRows(model.rows, game, maxSeat)
    : model.rows.filter((row) => row.cells.length).map((row) => renderFormRow(row, game, maxSeat)).join("");
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
