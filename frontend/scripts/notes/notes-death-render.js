import { escapeHtml, renderSelectOptions } from "../utils.js";
import {
  deathCauseOptions,
  formatDeathPhaseValue,
  getDeathPhaseChoices,
  getGhostVoteDays,
  isDeadStatus,
  normalizeDeath,
} from "./notes-death.js";

// Death time / cause / dead vote controls, shown under the status control of a dead player.
export function renderDeathEditor(player, game) {
  if (!isDeadStatus(player?.status)) {
    return "";
  }

  const death = normalizeDeath(player.death, player.status);
  const playerId = escapeHtml(player.id);
  const phaseOptions = [
    { value: "", label: "不确定" },
    ...getDeathPhaseChoices(game, death),
  ];
  const ghostVoteDays = getGhostVoteDays(game, player);
  const ghostVoteUsed = Boolean(player.ghostVoteUsed) || ghostVoteDays.length > 0;
  const ghostVoteHint = ghostVoteDays.length
    ? `第 ${ghostVoteDays.join("、")} 天投过`
    : "";

  return `
    <div class="notes-death-editor">
      <label class="note-field">
        <span>死亡时间</span>
        <select data-player-id="${playerId}" data-field="deathPhase">
          ${renderSelectOptions(phaseOptions, formatDeathPhaseValue(death))}
        </select>
      </label>
      <label class="note-field">
        <span>死因</span>
        <select data-player-id="${playerId}" data-field="deathCause">
          ${renderSelectOptions(deathCauseOptions, death.cause)}
        </select>
      </label>
      <label class="notes-ghost-vote${ghostVoteUsed ? " is-used" : ""}">
        <input
          type="checkbox"
          data-player-id="${playerId}"
          data-field="ghostVoteUsed"
          ${ghostVoteUsed ? "checked" : ""}
          ${ghostVoteDays.length ? "disabled" : ""}
        />
        <span>死人票已用${ghostVoteHint ? `<small>${escapeHtml(ghostVoteHint)}</small>` : ""}</span>
      </label>
    </div>
  `;
}
