import { escapeHtml } from "../utils.js";
import { getDayExecutionDeathSeat, getDayExecutionSeat } from "./notes-day-records.js";

// Player mode: abilities that learn the role of the player executed today (送葬者, deduction template
// role_at_day_execution) get a chip under each night row: "第2天处决 5号 · 自称 共情者". Tapping it writes the
// claim into the role field through set-roleinfo-field; nothing is filled automatically.

function getExecutionRoleKeys(abilityData) {
  const templates = Array.isArray(abilityData?.deduction?.templates) ? abilityData.deduction.templates : [];
  const template = templates.find((item) => item?.type === "role_at_day_execution" && item.role?.source === "result");
  if (!template) {
    return null;
  }
  const fields = abilityData?.interactionSchema?.result?.fields || [];
  const field = fields.find((item) => item.type === "role" && template.role.keys.includes(item.key));
  return field || null;
}

/** renderRowExtra for buildRoleInfoForm rows, or null when the ability does not learn the executed role. */
export function createExecutionHintRenderer(abilityData, game, getResult) {
  const field = getExecutionRoleKeys(abilityData);
  if (!field || !game) {
    return null;
  }

  return (row) => {
    if (row.phaseType !== "night" || Number(row.phaseNumber) < 2) {
      return "";
    }
    const dayNumber = Number(row.phaseNumber) - 1;
    const seat = getDayExecutionDeathSeat(game, dayNumber);
    if (!seat) {
      // Only nudge on the current night; older nights without a recorded execution stay quiet.
      if (!row.isCurrent) {
        return "";
      }
      const executedSeat = getDayExecutionSeat(game, dayNumber);
      const hint = executedSeat
        ? `第${dayNumber}天处决的 ${executedSeat}号没有因处决死亡`
        : `第${dayNumber}天未记录处决`;
      return `
        <div class="story-truth story-truth--unavailable notes-execution-hint" role="note">
          <span class="story-truth-label">处决</span>
          <small class="story-truth-hint">${hint}</small>
        </div>
      `;
    }
    const player = (game.players || []).find((item) => Number(item.seat) === seat);
    const claim = String(player?.claim || "").trim();
    const current = String(getResult(row)?.[field.key] ?? "");
    if (!claim) {
      return `
        <div class="story-truth notes-execution-hint" role="note">
          <span class="story-truth-label">处决</span>
          <small class="story-truth-hint">第${dayNumber}天 ${seat}号（未声明身份）</small>
        </div>
      `;
    }
    const applied = current === claim;
    return `
      <div class="story-truth notes-execution-hint">
        <span class="story-truth-label">处决</span>
        <div class="story-truth-chips">
          <button
            type="button"
            class="story-truth-chip${applied ? " is-applied" : ""}"
            data-notes-action="set-roleinfo-field"
            data-roleinfo-section="result"
            data-roleinfo-row="${Number(row.entryIndex) || 0}"
            data-roleinfo-field="${escapeHtml(field.key)}"
            data-roleinfo-phase-type="night"
            data-roleinfo-phase-number="${Number(row.phaseNumber) || 0}"
            value="${escapeHtml(applied ? "" : claim)}"
            aria-pressed="${applied ? "true" : "false"}"
          >第${dayNumber}天 ${seat}号 · 自称${escapeHtml(claim)}</button>
        </div>
      </div>
    `;
  };
}
