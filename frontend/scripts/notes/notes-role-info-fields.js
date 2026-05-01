import { getClaimRoleOptions } from "../notes-claims.js";
import { roleTypeOrder, typeLabels } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getChoiceLabel } from "./notes-role-info.js";

// Split from notes-role-info.js. Keep script order in index.html.

export function getRoleInfoFieldOptions(field, game) {
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
      .filter((type) => type !== "fabled")
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

export function renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat) {
  const currentValue = String(value ?? "");
  const sharedData = `
    data-roleinfo-section="${escapeHtml(sectionKey)}"
    data-roleinfo-row="${rowIndex}"
    data-roleinfo-field="${escapeHtml(field.key)}"
  `;

  if (field.type === "role") {
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

  const isNumericField = ["seat", "player", "number"].includes(field.type);
  const inputType = isNumericField ? "number" : "text";
  const minValue =
    field.type === "seat" || field.type === "player"
      ? 1
      : field.min ?? "";
  const maxValue =
    field.type === "seat" || field.type === "player"
      ? maxSeat
      : field.max ?? "";

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

export function renderRoleInfoFieldControl(sectionKey, rowIndex, field, value, game, maxSeat) {
  return `
    <label class="notes-roleinfo-field">
      <span>${escapeHtml(field.label)}</span>
      ${renderRoleInfoFieldElement(sectionKey, rowIndex, field, value, game, maxSeat)}
    </label>
  `;
}
