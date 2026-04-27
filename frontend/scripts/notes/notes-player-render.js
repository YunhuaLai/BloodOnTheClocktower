// Split from notes-render.js. Keep script order in index.html.

function renderNoteTagButtons(player) {
  return noteTagOptions
    .map((tag) => {
      const active = player.tags.includes(tag.value);
      return `
        <button
          class="note-tag${active ? " active" : ""}"
          type="button"
          data-notes-action="toggle-tag"
          data-player-id="${escapeHtml(player.id)}"
          data-tag="${escapeHtml(tag.value)}"
          aria-pressed="${active ? "true" : "false"}"
        >${escapeHtml(tag.label)}</button>
      `;
    })
    .join("");
}

function renderStorytellerFields(player, game) {
  if (game.mode !== "storyteller") {
    return "";
  }

  return `
    <section class="notes-detail-section">
      <p class="eyebrow">说书人视角</p>
      <div class="notes-form-grid">
        <label class="note-field">
          <span>真实身份</span>
          <input
            class="notes-player-field"
            data-player-id="${escapeHtml(player.id)}"
            data-field="trueRole"
            list="roleNameList"
            value="${escapeHtml(player.trueRole)}"
            placeholder="仅说书人可见"
          />
        </label>
        <label class="note-field">
          <span>真实阵营</span>
          <select
            class="notes-player-field"
            data-player-id="${escapeHtml(player.id)}"
            data-field="trueAlignment"
          >
            ${renderSelectOptions(noteAlignmentOptions, player.trueAlignment)}
          </select>
        </label>
        <label class="note-field note-field--wide">
          <span>说书人备注</span>
          <textarea
            class="notes-player-field"
            data-player-id="${escapeHtml(player.id)}"
            data-field="storytellerNotes"
            rows="4"
            placeholder="中毒、醉酒、保护、夜晚操作"
          >${escapeHtml(player.storytellerNotes)}</textarea>
        </label>
      </div>
    </section>
  `;
}

function getSelectedPlayer(game) {
  const selectedId = state.notes.ui.selectedPlayerId;
  return (
    game.players.find((player) => player.id === selectedId) ||
    game.players.find((player) => player.seat === game.selfSeat) ||
    game.players[0] ||
    null
  );
}

function renderPlayersTab(game) {
  const selectedPlayer = getSelectedPlayer(game);

  return `
    <section class="notes-panel">
      <div class="notes-panel-header">
        <div>
          <p class="eyebrow">玩家页</p>
          <h2>点座位，改信息</h2>
        </div>
      </div>
      ${renderSeatTabs(game, selectedPlayer)}
      ${renderPlayerDetail(selectedPlayer, game)}
    </section>
  `;
}

function renderSeatNameEditor(player) {
  const seatLabel = getSeatLabel(player);
  const hintText = player.name ? "点击号位可修改称呼" : "点击号位可填写称呼";

  return `
    <details class="notes-seat-editor">
      <summary class="notes-seat-editor-summary" aria-label="编辑玩家称呼">
        <span class="notes-seat-editor-title">${escapeHtml(seatLabel)}</span>
        <small>${escapeHtml(hintText)}</small>
      </summary>
      <label class="note-field notes-seat-editor-field">
        <span>玩家称呼</span>
        <input
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="name"
          value="${escapeHtml(player.name)}"
          placeholder="可留空，默认按号位显示"
        />
      </label>
    </details>
  `;
}

function getPlayerCycleValueText(field, value) {
  if (field === "status") {
    return {
      alive: "存",
      "night-dead": "夜",
      executed: "处",
      unclear: "?",
    }[value] || "?";
  }

  if (field === "alignment") {
    return {
      unknown: "?",
      good: "好",
      evil: "坏",
      suspect: "疑",
    }[value] || "?";
  }

  if (field === "condition") {
    const normalizedValue = value === "drunk" ? "poisoned" : value;
    return {
      unknown: "?",
      sober: "清",
      poisoned: "醉/毒",
    }[normalizedValue] || "?";
  }

  return String(value || "?");
}

function getPlayerCycleFieldClass(field, value) {
  const normalizedValue =
    field === "condition" && value === "drunk" ? "poisoned" : value;
  return `notes-cycle-button notes-cycle-button--${field} notes-cycle-button--${field}-${escapeHtml(
    normalizedValue || "unknown",
  )}`;
}

function renderPlayerCycleField(player, field, label) {
  const value =
    field === "condition" && player[field] === "drunk" ? "poisoned" : player[field];

  return `
    <button
      type="button"
      class="${getPlayerCycleFieldClass(field, value)}"
      data-notes-action="cycle-player-field"
      data-player-id="${escapeHtml(player.id)}"
      data-field="${escapeHtml(field)}"
      aria-label="${escapeHtml(`${label}：${getPlayerCycleValueText(field, value)}`)}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(getPlayerCycleValueText(field, value))}</strong>
    </button>
  `;
}

function getJudgementSummary(player) {
  const alignmentShort = {
    good: "好",
    evil: "坏",
    suspect: "疑",
    unknown: "?",
  };
  const conditionValue = player.condition === "drunk" ? "poisoned" : player.condition;
  const conditionShort = {
    sober: "清",
    poisoned: "醉/毒",
    unknown: "?",
  };

  return `${alignmentShort[player.alignment] || "?"}/${conditionShort[conditionValue] || "?"}`;
}

function renderSeatTabs(game, selectedPlayer) {
  return `
    <div class="notes-seat-tabs" role="tablist" aria-label="选择玩家">
      ${game.players
        .map((player) => {
          const active = player.id === selectedPlayer?.id;
          const isSelf = player.seat === game.selfSeat;
          return `
            <button
              type="button"
              class="notes-seat-tab${active ? " active" : ""}${isSelf ? " is-self" : ""}"
              data-notes-action="select-player"
              data-player-id="${escapeHtml(player.id)}"
              aria-pressed="${active ? "true" : "false"}"
              aria-label="${escapeHtml(`${player.seat}号位${isSelf ? "（自己）" : ""}`)}"
            >
              <span>${player.seat}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderClaimControl(player, game) {
  const script = getGameScript(game);

  return `
    <label class="note-field note-field--wide">
      <span>自称身份</span>
      <input
        class="notes-player-field"
        data-player-id="${escapeHtml(player.id)}"
        data-field="claim"
        list="roleNameList"
        value="${escapeHtml(player.claim)}"
        placeholder="${escapeHtml(script ? `输入或搜索《${script.name}》角色` : "先选剧本")}"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="输入自称身份并搜索当前剧本角色"
      />
    </label>
  `;
}

function renderPlayerDetail(player, game) {
  if (!player) {
    return `<div class="empty-state">还没有玩家信息。</div>`;
  }

  const draft = getDraftOrPlayer(player);
  const hasDraft = Boolean(getPlayerDraft(player.id));

  return `
    <article class="notes-player-detail" data-player-id="${escapeHtml(player.id)}">
      <header class="notes-player-detail-header">
        <div class="notes-player-title-block">
          <p class="eyebrow">玩家页</p>
          ${renderSeatNameEditor(draft)}
        </div>
        ${player.seat === game.selfSeat ? `<span class="notes-self-badge">自己</span>` : ""}
      </header>

      <div class="notes-form-grid">
        ${renderClaimControl(draft, game)}
      </div>

      <div class="notes-player-cycle-grid">
        ${renderPlayerCycleField(draft, "status", "状态")}
        ${renderPlayerCycleField(draft, "alignment", "判断")}
        ${renderPlayerCycleField(draft, "condition", "醉/毒")}
      </div>

      ${renderRoleInfoInputs(draft, game)}

      <section class="notes-detail-section">
        <label class="note-field">
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

      <section class="notes-detail-section">
        <p class="eyebrow">快速标签</p>
        <div class="note-tags">
          ${renderNoteTagButtons(draft)}
        </div>
      </section>

      <section class="notes-detail-section">
        <p class="eyebrow">身份候选</p>
        <p class="notes-inline-hint">${escapeHtml(getClaimPickerHint(game))}</p>
      </section>

      <div class="notes-savebar">
        <span class="notes-savehint">${hasDraft ? "有未保存修改" : "当前已保存"}</span>
        <div class="notes-savebar-actions">
          <button type="button" class="secondary-link" data-notes-action="discard-player" data-player-id="${escapeHtml(player.id)}">取消</button>
          <button type="button" class="primary-link" data-notes-action="save-player" data-player-id="${escapeHtml(player.id)}">保存</button>
        </div>
      </div>

      ${renderStorytellerFields(draft, game)}
    </article>
  `;
}
