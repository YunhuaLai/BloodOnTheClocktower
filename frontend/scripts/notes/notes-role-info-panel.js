import { clampNumber } from "../notes-state.js";
import { escapeHtml } from "../utils.js";
import { renderRoleInfoForm } from "./notes-role-info-fields.js";
import { buildRoleInfoForm } from "./notes-role-info-form.js";
import { getMaxSeatNumber } from "./notes-core.js";
import { abilityPageTypeLabels, abilityUsagePatternLabels, ensureRoleInfoMatchesClaim, getAbilityMetaSummary, getAbilityTimingText, getClaimedRole } from "./notes-role-info.js";

export function renderRoleInfoInputs(player, game) {
  if (!player.claim) {
    return `
      <section class="notes-detail-section notes-roleinfo-panel">
        <p class="eyebrow">技能记录</p>
        <p class="notes-inline-hint">先选身份。</p>
      </section>
    `;
  }

  const role = getClaimedRole(player, game);
  if (!role) {
    return `
      <section class="notes-detail-section notes-roleinfo-panel">
        <p class="eyebrow">技能记录</p>
        <p class="notes-inline-hint">未匹配角色数据。</p>
      </section>
    `;
  }

  const abilityData = role.abilityData || null;
  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const maxSeat = clampNumber(getMaxSeatNumber(game) || 15, 1, 25);
  const form = buildRoleInfoForm({ abilityData, roleInfo, player, game });
  const formHtml = abilityData?.abilityMeta?.recordable
    ? renderRoleInfoForm(form, { game, maxSeat, playerId: player.id, hint: form.rows.length > 1 ? "按阶段" : "单条" })
    : "";
  const emptyMessage =
    form.sections.length && form.emptyReason
      ? form.emptyReason
      : "规则效果，写在额外信息里。";

  return `
    <section class="notes-detail-section notes-roleinfo-panel">
      <div class="notes-roleinfo-header">
        <div>
          <p class="eyebrow">技能记录</p>
          <h3>${escapeHtml(role.name)}</h3>
        </div>
        <div class="notes-roleinfo-meta">
          <span class="notes-roleinfo-tag">${escapeHtml(
            abilityPageTypeLabels[abilityData?.abilityMeta?.pageType] || "技能",
          )}</span>
          ${
            getAbilityTimingText(abilityData?.abilityMeta)
              ? `<span class="notes-roleinfo-tag">${escapeHtml(
                  getAbilityTimingText(abilityData?.abilityMeta),
                )}</span>`
              : ""
          }
          ${
            abilityUsagePatternLabels[abilityData?.abilityMeta?.usagePattern]
              ? `<span class="notes-roleinfo-tag">${escapeHtml(
                  abilityUsagePatternLabels[abilityData?.abilityMeta?.usagePattern],
                )}</span>`
              : ""
          }
        </div>
      </div>
      <p class="notes-inline-hint">${escapeHtml(getAbilityMetaSummary(abilityData))}</p>
      ${
        formHtml
          ? formHtml
          : `
            <div class="notes-roleinfo-empty">
              ${escapeHtml(emptyMessage)}
            </div>
          `
      }
    </section>
  `;
}
