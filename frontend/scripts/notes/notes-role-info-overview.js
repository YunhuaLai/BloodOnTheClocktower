import { clampNumber } from "../notes-state.js";
import { renderRoleInfoForm } from "./notes-role-info-fields.js";
import { buildRoleInfoForm } from "./notes-role-info-form.js";
import { getOncePhaseChoice } from "./notes-role-info-once-phase.js";
import { createExecutionHintRenderer } from "./notes-role-info-execution-hint.js";
import { findRoleInfoRecord } from "./notes-role-info-records.js";
import { getMaxSeatNumber } from "./notes-core.js";
import { ensureRoleInfoMatchesClaim, getClaimedRole, getRoleInfoSectionLabel } from "./notes-role-info.js";

export function renderOverviewRoleInfoInputs(player, game) {
  if (!player.claim) {
    return "";
  }

  const role = getClaimedRole(player, game);
  const abilityData = role?.abilityData || null;
  if (!role || !abilityData?.abilityMeta?.recordable) {
    return "";
  }

  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const oncePhase = getOncePhaseChoice(player.id, roleInfo.roleId);
  const form = buildRoleInfoForm({ abilityData, roleInfo, player, game, oncePhase });
  return renderRoleInfoForm(form, {
    game,
    maxSeat: clampNumber(getMaxSeatNumber(game) || 15, 1, 25),
    density: "compact",
    title: getRoleInfoSectionLabel("result", abilityData),
    hint: form.rows.length > 1 ? "按阶段" : form.rows.length ? "单条" : "",
    playerId: player.id,
    className: "notes-roleinfo-section--overview",
    renderRowExtra: getPlayerRowExtra(abilityData, roleInfo, game),
  });
}

/** Player-mode row hints (the storyteller tab has its own "应给" suggestions). */
export function getPlayerRowExtra(abilityData, roleInfo, game) {
  if (game?.mode === "storyteller") {
    return null;
  }
  return createExecutionHintRenderer(
    abilityData,
    game,
    (row) => findRoleInfoRecord(roleInfo, row.phaseType, row.phaseNumber)?.resultEntries?.[row.entryIndex] || {},
  );
}
