// Split from notes-render.js. Keep script order in index.html.

function renderOverviewActions() {
  return `
    <div class="notes-overview-actions">
      <button type="button" class="primary-link" data-notes-action="save-game">保存</button>
      <button type="button" class="secondary-link" data-notes-action="go-home">返回</button>
      <button type="button" class="secondary-link danger" data-notes-action="delete-game">删除</button>
    </div>
  `;
}

function renderOverviewExternalReports(player, game) {
  const reports = cloneExternalReports(player.externalReports);
  const maxSeat = clampNumber(Number(game?.playerCount) || 15, 1, 15);

  return `
    <section class="notes-roleinfo-section notes-roleinfo-section--overview notes-external-reports">
      <div class="notes-roleinfo-section-header">
        <strong>外部能力记录</strong>
        <small>${reports.length ? `${reports.length} 条` : "可添加"}</small>
      </div>
      ${
        reports.length
          ? `
            <div class="notes-roleinfo-list">
              ${reports
                .map(
                  (report, index) => `
                    <div class="notes-roleinfo-row notes-external-report-row">
                      <input
                        class="notes-roleinfo-index notes-external-report-seat"
                        type="number"
                        min="1"
                        max="${maxSeat}"
                        step="1"
                        value="${escapeHtml(report.seat)}"
                        placeholder="号"
                        data-external-report-row="${index}"
                        data-external-report-field="seat"
                        aria-label="能力来源号码"
                      />
                      <div class="notes-roleinfo-fields notes-roleinfo-fields--1">
                        <label class="notes-roleinfo-field">
                          <span>记录</span>
                          <input
                            value="${escapeHtml(report.note)}"
                            placeholder="例如 中毒、被脑移、被美女表示等"
                            data-external-report-row="${index}"
                            data-external-report-field="note"
                          />
                        </label>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      <div class="notes-roleinfo-actions">
        <button
          type="button"
          class="note-icon-button"
          data-notes-action="add-external-report"
          data-player-id="${escapeHtml(player.id)}"
        >+ 一条</button>
        <button
          type="button"
          class="note-icon-button"
          data-notes-action="remove-external-report"
          data-player-id="${escapeHtml(player.id)}"
          ${reports.length ? "" : "disabled"}
        >- 末条</button>
      </div>
    </section>
  `;
}

function renderOverviewInlineEditor(player, game) {
  const draft = getDraftOrPlayer(player);
  const extraExpanded = state.notes.ui.overviewExpandedExtraPlayerId === player.id;

  return `
    <section class="notes-overview-editor" data-player-id="${escapeHtml(player.id)}">
      <div class="notes-overview-editor-main">
        <div class="notes-player-cycle-grid">
          ${renderPlayerCycleField(draft, "condition", "醉/毒")}
        </div>
        <label class="note-field note-field--wide">
          <span>额外信息</span>
          <input
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="extraInfo"
            value="${escapeHtml(draft.extraInfo)}"
            placeholder="例如 首夜报 3/8，或今天不该先出票"
          />
        </label>
      </div>
      <div class="notes-overview-editor-footer">
        <span class="notes-inline-hint">自动保存中</span>
        <button
          type="button"
          class="note-icon-button notes-overview-expand-button${extraExpanded ? " active" : ""}"
          data-notes-action="toggle-overview-extra"
          data-player-id="${escapeHtml(player.id)}"
        >${extraExpanded ? "− 收起扩展" : "+ 展开扩展"}</button>
      </div>
      ${
        extraExpanded
          ? `
            <div class="notes-overview-editor-extra">
              ${renderRoleInfoInputs(draft, game)}
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderOverviewClaimInput(player, game) {
  const script = getGameScript(game);

  return `
    <input
      class="notes-overview-claim-input"
      data-player-id="${escapeHtml(player.id)}"
      data-field="claim"
      list="roleNameList"
      value="${escapeHtml(player.claim)}"
      placeholder="${escapeHtml(script ? "身份" : "先选剧本")}"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label="输入自称身份"
    />
  `;
}

function renderOverviewRows(game) {
  const expandedPlayerId = state.notes.ui.overviewExpandedPlayerId;

  return game.players
    .map((player) => {
      const isSelf = player.seat === game.selfSeat;
      const claimText = getClaimAbbreviation(player.claim);
      const summaryText = getRoleInfoSummary(player, game);
      const judgementText = getJudgementSummary(player);
      const supplementText = getOverviewSecondaryText(player);
      const isExpanded = expandedPlayerId === player.id;

      return `
        <article class="notes-overview-item${isExpanded ? " is-expanded" : ""}">
          <div
            class="notes-overview-row${isSelf ? " is-self" : ""}${isExpanded ? " is-expanded" : ""}"
            aria-expanded="${isExpanded ? "true" : "false"}"
          >
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--seat notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
              aria-label="${escapeHtml(`${player.seat}号位${isExpanded ? "，收起" : "，展开"}`)}"
            >
              ${player.seat}${isSelf ? "*" : ""}
            </button>
            <div class="notes-overview-cell notes-overview-cell--status">
              ${renderPlayerCycleField(player, "status", "状态")}
            </div>
            <label class="notes-overview-cell notes-overview-cell--claim notes-overview-claim-cell">
              ${renderOverviewClaimInput(player, game)}
            </label>
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--summary notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
            >${escapeHtml(summaryText)}</button>
            <div class="notes-overview-cell notes-overview-cell--judgement">
              ${renderPlayerCycleField(player, "alignment", "判断")}
            </div>
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--extra notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
            >${escapeHtml(supplementText)}</button>
          </div>
          ${isExpanded ? renderOverviewInlineEditor(player, game) : ""}
        </article>
      `;
    })
    .join("");
}

function renderOverviewTab(game) {
  return `
    <section class="notes-panel">
      <div class="notes-panel-header">
        <div>
          <p class="eyebrow">总览页</p>
          <p class="notes-inline-hint">点任意玩家行直接展开编辑，复杂角色再用 + 展开扩展录入。</p>
        </div>
      </div>
      <div class="notes-overview-head">
        <span>编号</span>
        <span>状态</span>
        <span>身份</span>
        <span>摘要</span>
        <span>判断</span>
        <span>补充</span>
      </div>
      <div class="notes-overview-list">
        ${renderOverviewRows(game)}
      </div>
      ${renderOverviewActions()}
    </section>
  `;
}

function renderOverviewJudgementControls(player) {
  return `
    <div class="notes-overview-judgement-controls">
      ${renderPlayerCycleField(player, "alignment", "判断")}
      ${renderPlayerCycleField(player, "condition", "醉/毒")}
    </div>
  `;
}

function renderOverviewInlineEditor(player, game) {
  const draft = getDraftOrPlayer(player);
  const roleInfoInputs = renderOverviewRoleInfoInputs(draft, game);

  return `
    <section class="notes-overview-editor" data-player-id="${escapeHtml(player.id)}">
      ${roleInfoInputs}
      ${renderOverviewExternalReports(draft, game)}
      <label class="note-field note-field--wide">
        <span>额外信息</span>
        <input
          class="notes-player-field"
          data-player-id="${escapeHtml(draft.id)}"
          data-field="extraInfo"
          value="${escapeHtml(draft.extraInfo)}"
          placeholder="例如 首夜报 3/8，或今天不该先出票"
        />
      </label>
    </section>
  `;
}

function renderOverviewClaimInput(player, game) {
  const script = getGameScript(game);

  return `
    <input
      class="notes-overview-claim-input"
      data-player-id="${escapeHtml(player.id)}"
      data-field="claim"
      list="roleNameList"
      value="${escapeHtml(player.claim)}"
      placeholder="${escapeHtml(script ? "身份" : "先选剧本")}"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label="输入自称身份"
    />
  `;
}

function renderOverviewRows(game) {
  const expandedPlayerId = state.notes.ui.overviewExpandedPlayerId;

  return game.players
    .map((player) => {
      const draft = getDraftOrPlayer(player);
      const isSelf = player.seat === game.selfSeat;
      const summaryText = getRoleInfoSummary(draft, game);
      const supplementText = getOverviewSecondaryText(draft);
      const isExpanded = expandedPlayerId === player.id;

      return `
        <article class="notes-overview-item${isExpanded ? " is-expanded" : ""}">
          <div
            class="notes-overview-row${isSelf ? " is-self" : ""}${isExpanded ? " is-expanded" : ""}"
            aria-expanded="${isExpanded ? "true" : "false"}"
          >
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--seat notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
              aria-label="${escapeHtml(`${player.seat}号位${isExpanded ? "，收起" : "，展开"}`)}"
            >
              ${player.seat}${isSelf ? "*" : ""}
            </button>
            <div class="notes-overview-cell notes-overview-cell--status">
              ${renderPlayerCycleField(draft, "status", "状态")}
            </div>
            <label class="notes-overview-cell notes-overview-cell--claim notes-overview-claim-cell">
              ${renderOverviewClaimInput(draft, game)}
            </label>
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--summary notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
            >${escapeHtml(summaryText)}</button>
            <div class="notes-overview-cell notes-overview-cell--judgement">
              ${renderOverviewJudgementControls(draft)}
            </div>
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--extra notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
            >${escapeHtml(supplementText)}</button>
          </div>
          ${isExpanded ? renderOverviewInlineEditor(player, game) : ""}
        </article>
      `;
    })
    .join("");
}

function renderOverviewTab(game) {
  return `
    <section class="notes-panel">
      <div class="notes-panel-header">
        <div>
          <p class="eyebrow">总览页</p>
        </div>
      </div>
      <div class="notes-overview-head">
        <span>编号</span>
        <span>状态</span>
        <span>身份</span>
        <span>摘要</span>
        <span>判断</span>
        <span>补充</span>
      </div>
      <div class="notes-overview-list">
        ${renderOverviewRows(game)}
      </div>
      ${renderOverviewActions()}
    </section>
  `;
}
