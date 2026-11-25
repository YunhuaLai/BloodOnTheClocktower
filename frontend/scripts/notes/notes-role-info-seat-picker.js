import { escapeHtml } from "../utils.js";
import { getClaimAbbreviation, isTravellerPlayer } from "./notes-core.js";

// Seat fields render as a button; tapping it opens a grid of seats under the row. Picking a seat writes the
// value through the usual set-roleinfo-field path and moves straight on to the next seat field of the row
// (占卜师: 查验1 -> 查验2 -> closed), so two seats cost three taps instead of two dropdowns.
//
// Only one picker is open at a time. The open field is kept in memory (not in saved notes) by a key built
// from the form scope (player id, or player + acquired ability), section, row, field and phase.

const deadStatuses = ["night-dead", "executed"];
const seatFilterValues = ["alive", "dead", "notSelf"];
let openKey = "";

export function getOpenSeatPickerKey() {
  return openKey;
}

export function setOpenSeatPickerKey(key) {
  openKey = String(key || "");
}

export function getSeatPickerKey(scope, section, rowIndex, fieldKey, phase) {
  return [scope || "", section, Number(rowIndex) || 0, fieldKey, phase?.phaseType || "", Number(phase?.phaseNumber) || 0].join("|");
}

/** Seat filters of a field: any of alive / dead / notSelf (see seatFilter in role-ability-schema.yaml). */
export function getSeatFilters(field) {
  const values = Array.isArray(field?.seatFilter) ? field.seatFilter : field?.seatFilter ? [field.seatFilter] : [];
  return values.filter((value) => seatFilterValues.includes(value));
}

const seatFilterHints = { alive: "存活玩家", dead: "死亡玩家", notSelf: "不含自己" };

export function getSeatFilterHint(field) {
  return getSeatFilters(field).map((value) => seatFilterHints[value]).join(" · ");
}

/**
 * Seat cells for the grid. A seat outside the field's filter is dimmed, never disabled: the status shown now
 * may differ from the status at the recorded phase (alive on night 2, dead today), and claims can be wrong.
 */
export function getSeatPickerOptions(game, maxSeat, field, ownerSeat = 0) {
  const filters = getSeatFilters(field);
  const playersBySeat = new Map((game?.players || []).map((player) => [Number(player.seat), player]));
  const count = Math.max(Number(maxSeat) || 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const seat = index + 1;
    const player = playersBySeat.get(seat);
    const dead = deadStatuses.includes(player?.status);
    const self = Boolean(ownerSeat) && seat === Number(ownerSeat);
    const dim =
      (filters.includes("alive") && dead) ||
      (filters.includes("dead") && player && !dead) ||
      (filters.includes("notSelf") && self);
    const name = String(player?.name || "").trim();
    const claim = player?.claim ? getClaimAbbreviation(player.claim) : "";
    return {
      value: String(seat),
      seat,
      dead,
      self,
      dim: Boolean(dim),
      traveller: isTravellerPlayer(player),
      caption: self ? "自己" : name || (claim && claim !== "--" ? claim : ""),
    };
  });
}

export function renderSeatFieldButton(field, currentValue, key, disabled, accessibleLabel) {
  const isOpen = key === openKey;
  const text = currentValue ? `${currentValue}号` : "—";
  return `
    <button
      type="button"
      class="notes-seat-field${currentValue ? " has-value" : ""}${isOpen ? " is-open" : ""}"
      data-notes-action="toggle-seat-picker"
      data-seat-picker-key="${escapeHtml(isOpen ? "" : key)}"
      aria-expanded="${isOpen ? "true" : "false"}"
      aria-label="${escapeHtml(`${accessibleLabel || field.label}：${currentValue ? text : "未选"}`)}"
      ${disabled ? "disabled" : ""}
    >${escapeHtml(text)}</button>
  `;
}

/**
 * The grid under a row. sharedData addresses the field (same attributes as the other controls);
 * nextKey is the picker to open after a pick ("" closes it).
 */
export function renderSeatPicker({ field, currentValue, sharedData, key, nextKey, game, maxSeat, ownerSeat, accessibleLabel }) {
  const options = getSeatPickerOptions(game, maxSeat, field, ownerSeat);
  const hint = getSeatFilterHint(field);
  return `
    <div class="notes-seat-picker" role="group" aria-label="${escapeHtml(`选择${accessibleLabel || field.label}`)}">
      <div class="notes-seat-picker-head">
        <strong>${escapeHtml(field.label)}</strong>
        ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
        <button type="button" class="notes-seat-picker-action" data-notes-action="pick-seat" value="" data-next-picker-key="${escapeHtml(key)}" ${sharedData} ${currentValue ? "" : "disabled"}>清除</button>
        <button type="button" class="notes-seat-picker-action" data-notes-action="toggle-seat-picker" data-seat-picker-key="">完成</button>
      </div>
      <div class="notes-seat-picker-grid">
        ${options
          .map((option) => {
            const selected = option.value === currentValue;
            const classes = [
              "notes-seat-option",
              selected ? "is-selected" : "",
              option.dim ? "is-dim" : "",
              option.dead ? "is-dead" : "",
              option.self ? "is-self" : "",
            ].filter(Boolean).join(" ");
            const caption = option.dead ? `${option.caption ? `${option.caption} ` : ""}死` : option.caption;
            return `<button
              type="button"
              class="${classes}"
              data-notes-action="pick-seat"
              value="${selected ? "" : escapeHtml(option.value)}"
              data-next-picker-key="${escapeHtml(selected ? key : nextKey)}"
              aria-pressed="${selected ? "true" : "false"}"
              aria-label="${escapeHtml(`${option.seat}号${option.dead ? "（死亡）" : ""}${option.caption ? ` ${option.caption}` : ""}`)}"
              ${sharedData}
            ><b>${option.seat}</b><small>${escapeHtml(caption || "")}</small></button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}
