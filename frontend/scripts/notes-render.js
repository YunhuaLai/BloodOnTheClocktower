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
    <div class="storyteller-fields">
      <label class="note-field">
        <span>真实身份</span>
        <input
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="trueRole"
          list="roleNameList"
          value="${escapeHtml(player.trueRole)}"
          placeholder="只给说书人看"
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
      <label class="note-field wide">
        <span>说书人备注</span>
        <textarea
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="storytellerNotes"
          rows="3"
          placeholder="中毒、醉酒、保护、夜晚操作等"
        >${escapeHtml(player.storytellerNotes)}</textarea>
      </label>
    </div>
  `;
}

function renderClaimControl(player, game) {
  const script = getGameScript(game);
  const roleOptions = getClaimRoleOptions(game);
  const picker = script
    ? `
      <select
        class="notes-player-field claim-picker"
        data-player-id="${escapeHtml(player.id)}"
        data-field="claim"
        aria-label="从${escapeHtml(script.name)}选择自称身份"
      >
        <option value="">从剧本选</option>
        ${roleOptions
          .map(
            (role) =>
              `<option value="${escapeHtml(role.name)}"${role.name === player.claim ? " selected" : ""}>${escapeHtml(role.name)}</option>`,
          )
          .join("")}
      </select>
    `
    : "";

  return `
    <label class="note-field claim-field">
      <span>自称身份</span>
      <div class="claim-control">
        <input
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="claim"
          list="roleNameList"
          value="${escapeHtml(player.claim)}"
          placeholder="${script ? "选择或输入身份" : "例如 洗衣妇"}"
        />
        ${picker}
      </div>
    </label>
  `;
}

function renderNotePlayerCards(game) {
  if (!game.players.length) {
    return `<div class="empty-state">还没有玩家。先补一个座位，再开始记录。</div>`;
  }

  return game.players
    .map(
      (player, index) => `
        <article class="note-player-card" data-status="${escapeHtml(player.status)}">
          <header class="note-player-head">
            <label class="note-field player-name-field">
              <span>座位 ${index + 1}</span>
              <input
                class="notes-player-field"
                data-player-id="${escapeHtml(player.id)}"
                data-field="name"
                value="${escapeHtml(player.name)}"
              />
            </label>
            <button
              class="note-icon-button"
              type="button"
              data-notes-action="delete-player"
              data-player-id="${escapeHtml(player.id)}"
              aria-label="删除 ${escapeHtml(player.name)}"
            >删除</button>
          </header>

          <div class="note-player-fields">
            ${renderClaimControl(player, game)}
            <label class="note-field">
              <span>判断</span>
              <select
                class="notes-player-field"
                data-player-id="${escapeHtml(player.id)}"
                data-field="alignment"
              >
                ${renderSelectOptions(noteAlignmentOptions, player.alignment)}
              </select>
            </label>
            <label class="note-field">
              <span>状态</span>
              <select
                class="notes-player-field"
                data-player-id="${escapeHtml(player.id)}"
                data-field="status"
              >
                ${renderSelectOptions(noteStatusOptions, player.status)}
              </select>
            </label>
          </div>

          <div class="note-tags" aria-label="${escapeHtml(player.name)} 的标签">
            ${renderNoteTagButtons(player)}
          </div>

          <label class="note-field wide">
            <span>公开备注</span>
            <textarea
              class="notes-player-field"
              data-player-id="${escapeHtml(player.id)}"
              data-field="notes"
              rows="3"
              placeholder="谁给了他信息、他说法哪里对不上、今天想问什么"
            >${escapeHtml(player.notes)}</textarea>
          </label>

          ${renderStorytellerFields(player, game)}
        </article>
      `,
    )
    .join("");
}

function renderClaimSummary(game) {
  const rows = game.players.filter(
    (player) =>
      player.claim ||
      player.alignment !== "unknown" ||
      player.tags.includes("conflict") ||
      player.tags.includes("demon") ||
      player.tags.includes("minion"),
  );

  if (!rows.length) {
    return `<p class="muted">还没有身份声明。先在玩家卡片里填自称身份或标签。</p>`;
  }

  return `
    <div class="claim-list">
      ${rows
        .map(
          (player) => `
            <div class="claim-row">
              <strong>${escapeHtml(player.name)}</strong>
              <span>${escapeHtml(player.claim || "未声明")}</span>
              <small>${escapeHtml(getOptionLabel(noteAlignmentOptions, player.alignment))}</small>
              ${
                player.tags.length
                  ? `<em>${player.tags.map(getNoteTagLabel).map(escapeHtml).join(" / ")}</em>`
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function formatTimelineTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTimelineTypeLabel(value) {
  return getOptionLabel(timelineTypeOptions, value);
}

function renderTimelineEntries(game) {
  if (!game.timeline.length) {
    return `<div class="empty-state timeline-empty">还没有时间线。先记第一条信息。</div>`;
  }

  return game.timeline
    .map(
      (entry) => `
        <article class="timeline-entry">
          <div>
            <strong>
              <span class="timeline-type" data-type="${escapeHtml(entry.type)}">${escapeHtml(getTimelineTypeLabel(entry.type))}</span>
              ${escapeHtml(entry.phase)}
            </strong>
            <small>${escapeHtml(formatTimelineTime(entry.createdAt))}</small>
          </div>
          <p>${escapeHtml(entry.text)}</p>
          <button
            type="button"
            class="note-icon-button"
            data-notes-action="delete-timeline"
            data-entry-id="${escapeHtml(entry.id)}"
          >删除</button>
        </article>
      `,
    )
    .join("");
}

function renderNotesPage() {
  const notes = ensureNotesState();
  const game = getActiveGame();

  document.title = "记录局 · 血染钟楼百科";
  app.innerHTML = `
    <section class="notes-workspace">
      <div class="notes-hero">
        <div class="notes-hero-copy">
          <p class="eyebrow">记录局</p>
          <h1>把这一局的信息先落下来。</h1>
          <p class="lead">座位、身份声明、标签和每天的信息会自动保存在本机浏览器。</p>
          <div class="notes-toolbar" aria-label="局次操作">
            <label class="note-field game-switcher">
              <span>当前局</span>
              <select id="gameSelect">
                ${renderGameSelectOptions(notes)}
              </select>
            </label>
            <button type="button" class="primary-link" data-notes-action="new-game">新建局</button>
            <button type="button" class="secondary-link" data-notes-action="export-game">导出 JSON</button>
            <button type="button" class="secondary-link danger" data-notes-action="delete-game">删除当前局</button>
          </div>
        </div>
        <img
          class="notes-hero-image"
          src="/assets/candle-book.jpg"
          alt="烛光下的旧书"
          width="1280"
          height="853"
          loading="lazy"
          decoding="async"
        />
      </div>

      <section class="notes-meta" aria-labelledby="notesMetaTitle">
        <div class="section-heading">
          <div>
            <p class="eyebrow">局次信息</p>
            <h2 id="notesMetaTitle">先定这几个点</h2>
          </div>
          <p class="section-note">当前 ${game.players.length} 个座位，${escapeHtml(getOptionLabel(noteModeOptions, game.mode))}。</p>
        </div>
        <div class="notes-meta-grid">
          <label class="note-field">
            <span>局名</span>
            <input
              class="notes-field"
              data-game-field="title"
              value="${escapeHtml(game.title)}"
              placeholder="例如 周五 9 人局"
            />
          </label>
          <label class="note-field">
            <span>剧本</span>
            <input
              class="notes-field"
              data-game-field="scriptName"
              list="scriptNameList"
              value="${escapeHtml(game.scriptName)}"
              placeholder="例如 暗流涌动"
            />
          </label>
          <label class="note-field">
            <span>当前阶段</span>
            <input
              class="notes-field"
              data-game-field="phase"
              value="${escapeHtml(game.phase)}"
              placeholder="例如 第 2 夜"
            />
          </label>
          <label class="note-field">
            <span>记录模式</span>
            <select class="notes-field" data-game-field="mode">
              ${renderSelectOptions(noteModeOptions, game.mode)}
            </select>
          </label>
        </div>
      </section>

      <section class="notes-layout">
        <div class="notes-main">
          <div class="notes-panel-heading">
            <div>
              <p class="eyebrow">玩家记录表</p>
              <h2>座位、声明和判断</h2>
              <p class="note-claim-hint">${escapeHtml(getClaimPickerHint(game))}</p>
            </div>
            <button type="button" class="primary-link" data-notes-action="add-player">补一个座位</button>
          </div>
          <div class="note-player-grid">
            ${renderNotePlayerCards(game)}
          </div>
        </div>

        <aside class="notes-side">
          <section class="notes-side-section">
            <p class="eyebrow">时间线</p>
            <h2>按阶段记信息</h2>
            <div class="timeline-form-row">
              <label class="note-field">
                <span>阶段</span>
                <input id="timelinePhase" value="${escapeHtml(game.phase)}" />
              </label>
              <label class="note-field">
                <span>类型</span>
                <select id="timelineType">
                  ${renderSelectOptions(timelineTypeOptions, "info")}
                </select>
              </label>
            </div>
            <label class="note-field wide">
              <span>信息</span>
              <textarea id="timelineText" rows="4" placeholder="例如 B 提名 C；A 对 C 投票；今晚死了 D"></textarea>
            </label>
            <button type="button" class="primary-link full-width" data-notes-action="add-timeline">加入时间线</button>
            <div class="timeline-list">
              ${renderTimelineEntries(game)}
            </div>
          </section>

          <section class="notes-side-section">
            <p class="eyebrow">身份声明</p>
            <h2>谁说了什么</h2>
            ${renderClaimSummary(game)}
          </section>
        </aside>
      </section>

      ${renderRoleNameDatalist(game)}
      ${renderScriptNameDatalist()}
    </section>
  `;
}
