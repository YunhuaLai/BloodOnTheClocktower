// Split from notes-role-info.js. Keep script order in index.html.

function renderRoleInfoInputs(player, game) {
  if (!player.claim) {
    return `
      <section class="notes-detail-section notes-roleinfo-panel">
        <p class="eyebrow">技能记录</p>
        <p class="notes-inline-hint">先选择自称身份，这里再按角色类型展开录入项。</p>
      </section>
    `;
  }

  const role = getClaimedRole(player, game);
  if (!role) {
    return `
      <section class="notes-detail-section notes-roleinfo-panel">
        <p class="eyebrow">技能记录</p>
        <p class="notes-inline-hint">当前身份还没有匹配到角色数据，先用额外信息补充。</p>
      </section>
    `;
  }

  const abilityData = role.abilityData || null;
  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const maxSeat = clampNumber(Number(game?.playerCount) || 15, 1, 15);
  const renderSection = (sectionKey, node) => {
    if (node.repeatMode === "none" || !node.fields.length) {
      return "";
    }

    const rows = getDisplayedRoleInfoEntries(roleInfo, node, sectionKey);
    const minimumRows =
      node.repeatMode === "once"
        ? Math.max(node.defaultRows || 0, 1)
        : Math.max(node.defaultRows || 0, 1);

    return `
      <section class="notes-roleinfo-section">
        <div class="notes-roleinfo-section-header">
          <strong>${escapeHtml(getRoleInfoSectionLabel(sectionKey, abilityData))}</strong>
          <small>${escapeHtml(node.repeatMode === "once" ? "单条" : "多条")}</small>
        </div>
        <div class="notes-roleinfo-list">
          ${rows
            .map(
              (entry, index) => `
                <div class="notes-roleinfo-row">
                  <span class="notes-roleinfo-index">${index + 1}</span>
                  <div class="notes-roleinfo-fields notes-roleinfo-fields--${Math.min(
                    Math.max(node.fields.length, 1),
                    3,
                  )}">
                    ${node.fields
                      .map((field) =>
                        renderRoleInfoFieldControl(
                          sectionKey,
                          index,
                          field,
                          entry?.[field.key],
                          game,
                          maxSeat,
                        ),
                      )
                      .join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
        ${
          node.repeatMode === "sequence" || node.repeatMode === "variable"
            ? `
              <div class="notes-roleinfo-actions">
                <button
                  type="button"
                  class="note-icon-button"
                  data-notes-action="add-roleinfo-row"
                  data-player-id="${escapeHtml(player.id)}"
                  data-section="${escapeHtml(sectionKey)}"
                >+ 一条</button>
                <button
                  type="button"
                  class="note-icon-button"
                  data-notes-action="remove-roleinfo-row"
                  data-player-id="${escapeHtml(player.id)}"
                  data-section="${escapeHtml(sectionKey)}"
                  ${rows.length <= minimumRows ? "disabled" : ""}
                >- 末条</button>
              </div>
            `
            : ""
        }
      </section>
    `;
  };

  const targetSection = renderSection("target", targetNode);
  const resultSection = renderSection("result", resultNode);

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
        targetSection || resultSection
          ? `${targetSection}${resultSection}`
          : `
            <div class="notes-roleinfo-empty">
              这个身份目前更偏规则效果，先用“额外信息”补充关键点。
            </div>
          `
      }
    </section>
  `;
}
