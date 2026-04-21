function formatPhaseLabel(phaseType, phaseNumber) {
  return `${getOptionLabel(phaseTypeOptions, phaseType)} ${phaseNumber}`;
}

const roleInfoProfiles = [
  {
    key: "yes-no-seq",
    names: ["城镇公告员", "town crier"],
    label: "是否信息",
  },
  {
    key: "seat-seq",
    names: ["僧侣", "投毒者", "舞蛇人", "monk", "poisoner", "snake charmer"],
    label: "号码序列",
  },
  {
    key: "digit-seq",
    names: ["共情者", "empath"],
    label: "数字序列",
  },
  {
    key: "seat-pair-alignment",
    names: ["筑梦师", "dreamer"],
    label: "号码 + 好坏",
  },
];

function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

function getRoleInfoProfile(claim) {
  const normalizedClaim = normalizeRoleName(claim);
  if (!normalizedClaim) {
    return null;
  }

  return (
    roleInfoProfiles.find((profile) =>
      profile.names.some((name) => normalizeRoleName(name) === normalizedClaim),
    ) || null
  );
}

function ensureRoleInfoMatchesClaim(player) {
  const profile = getRoleInfoProfile(player.claim);
  if (!profile) {
    return createEmptyRoleInfo();
  }

  const current = cloneRoleInfo(player.roleInfo);
  if (current.profile !== profile.key) {
    return {
      profile: profile.key,
      entries: [],
    };
  }

  return current;
}

function getRoleInfoSummary(player) {
  const roleInfo = ensureRoleInfoMatchesClaim(player);
  if (!roleInfo.profile || !roleInfo.entries.length) {
    return "--";
  }

  const items = roleInfo.entries
    .map((entry) => {
      if (roleInfo.profile === "yes-no-seq") {
        return entry.value || "_";
      }

      if (roleInfo.profile === "seat-seq") {
        return entry.seat || "_";
      }

      if (roleInfo.profile === "digit-seq") {
        return entry.value ?? "_";
      }

      if (roleInfo.profile === "seat-pair-alignment") {
        return `${entry.seat || "_"} ${entry.first || "_"}${entry.second || "_"}`;
      }

      return "";
    })
    .filter(Boolean);

  return items.length ? items.join(" / ") : "--";
}

function renderRoleInfoInputs(player, game) {
  const roleInfo = ensureRoleInfoMatchesClaim(player);
  const profile = roleInfoProfiles.find((item) => item.key === roleInfo.profile);
  if (!profile) {
    return "";
  }

  const rows =
    roleInfo.entries.length > 0
      ? roleInfo.entries
      : Array.from({ length: 3 }, () => ({}));
  const maxSeat = clampNumber(Number(game?.playerCount) || 15, 1, 15);

  if (profile.key === "yes-no-seq") {
    return `
      <section class="notes-detail-section">
        <p class="eyebrow">${escapeHtml(profile.label)}</p>
        <div class="notes-roleinfo-list">
          ${rows
            .map(
              (entry, index) => `
                <div class="notes-roleinfo-row">
                  <span>第 ${index + 1} 次</span>
                  <select data-roleinfo-index="${index}" data-roleinfo-field="value">
                    <option value="">空</option>
                    <option value="是"${entry.value === "是" ? " selected" : ""}>是</option>
                    <option value="否"${entry.value === "否" ? " selected" : ""}>否</option>
                  </select>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  if (profile.key === "seat-seq") {
    return `
      <section class="notes-detail-section">
        <p class="eyebrow">${escapeHtml(profile.label)}</p>
        <div class="notes-roleinfo-list">
          ${rows
            .map(
              (entry, index) => `
                <div class="notes-roleinfo-row">
                  <span>第 ${index + 1} 夜</span>
                  <input
                    type="number"
                    min="1"
                    max="${maxSeat}"
                    step="1"
                    value="${escapeHtml(entry.seat || "")}"
                    placeholder="空或号码"
                    data-roleinfo-index="${index}"
                    data-roleinfo-field="seat"
                  />
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  if (profile.key === "digit-seq") {
    return `
      <section class="notes-detail-section">
        <p class="eyebrow">${escapeHtml(profile.label)}</p>
        <div class="notes-roleinfo-list">
          ${rows
            .map(
              (entry, index) => `
                <div class="notes-roleinfo-row">
                  <span>第 ${index + 1} 夜</span>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    step="1"
                    value="${escapeHtml(entry.value ?? "")}"
                    placeholder="空或数字"
                    data-roleinfo-index="${index}"
                    data-roleinfo-field="value"
                  />
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  if (profile.key === "seat-pair-alignment") {
    return `
      <section class="notes-detail-section">
        <p class="eyebrow">${escapeHtml(profile.label)}</p>
        <div class="notes-roleinfo-list">
          ${rows
            .map(
              (entry, index) => `
                <div class="notes-roleinfo-row notes-roleinfo-row--dreamer">
                  <span>第 ${index + 1} 夜</span>
                  <input
                    type="number"
                    min="1"
                    max="${maxSeat}"
                    step="1"
                    value="${escapeHtml(entry.seat || "")}"
                    placeholder="号码"
                    data-roleinfo-index="${index}"
                    data-roleinfo-field="seat"
                  />
                  <select data-roleinfo-index="${index}" data-roleinfo-field="first">
                    <option value="">空</option>
                    <option value="好"${entry.first === "好" ? " selected" : ""}>好</option>
                    <option value="坏"${entry.first === "坏" ? " selected" : ""}>坏</option>
                  </select>
                  <select data-roleinfo-index="${index}" data-roleinfo-field="second">
                    <option value="">空</option>
                    <option value="好"${entry.second === "好" ? " selected" : ""}>好</option>
                    <option value="坏"${entry.second === "坏" ? " selected" : ""}>坏</option>
                  </select>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  return "";
}

function getStandardSetup(playerCount) {
  const setups = {
    5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
    6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
    7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
    8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
    9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
    10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
    11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
    12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
    13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
    14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
    15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
  };

  return setups[playerCount] || setups[10];
}

function getAliveCount(game) {
  return game.players.filter((player) => player.status === "alive").length;
}

function getPlayerLabel(player, game) {
  const name = String(player.name || "").trim();
  const seatLabel = `${player.seat}号位`;
  if (name) {
    return `${seatLabel} ${name}`;
  }

  if (player.seat === game.selfSeat) {
    return `${seatLabel} 我`;
  }

  return seatLabel;
}

function getCompactClass(prefix, value) {
  return `${prefix} ${prefix}--${escapeHtml(value)}`;
}

function renderCompactBadge(prefix, value, text) {
  return `<span class="${getCompactClass(prefix, value)}">${escapeHtml(text)}</span>`;
}

function getOverviewSecondaryText(player) {
  if (player.extraInfo) {
    return player.extraInfo;
  }

  if (player.notes) {
    return player.notes.split(/\r?\n/)[0];
  }

  return "--";
}

function getShortStatusLabel(status) {
  const shortLabels = {
    alive: "存",
    "night-dead": "夜死",
    executed: "处决",
    unclear: "待定",
  };

  return shortLabels[status] || "待定";
}

function getJudgementSummary(player) {
  const alignmentShort = {
    good: "好",
    evil: "坏",
    suspect: "疑",
    unknown: "--",
  };
  const conditionShort = {
    sober: "清",
    poisoned: "毒",
    drunk: "醉",
    unknown: "--",
  };

  return `${alignmentShort[player.alignment] || "--"}/${conditionShort[player.condition] || "--"}`;
}

function renderNotesStageBar(game) {
  const aliveCount = getAliveCount(game);

  return `
    <header class="notes-stagebar">
      <div class="notes-stagebar-item">
        <span>当前阶段</span>
        <strong>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))}</strong>
      </div>
      <div class="notes-stagebar-item">
        <span>存活</span>
        <strong>${aliveCount} / ${game.playerCount}</strong>
      </div>
    </header>
  `;
}

function renderGameMeta(game) {
  const config = getStandardSetup(game.playerCount);

  return `
    <section class="notes-game-meta">
      <div class="notes-game-meta-title">
        <p class="eyebrow">当前局</p>
        <h1>${escapeHtml(game.title)}</h1>
      </div>
      <p class="notes-game-meta-line">
        ${game.playerCount} 人 / 镇民 ${config.townsfolk} / 外来者 ${config.outsider} / 爪牙 ${config.minion} / 恶魔 ${config.demon}
      </p>
      <p class="notes-game-meta-line">
        ${escapeHtml(game.scriptName || "未选剧本")} / ${escapeHtml(getOptionLabel(noteModeOptions, game.mode))}
      </p>
    </section>
  `;
}

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

function renderClaimControl(player, game) {
  const script = getGameScript(game);
  const roleOptions = getClaimRoleOptions(game);

  return `
    <label class="note-field note-field--wide">
      <span>自称身份</span>
      <div class="notes-claim-control">
        <input
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="claim"
          list="roleNameList"
          value="${escapeHtml(player.claim)}"
          placeholder="可直接输入，也可从右侧快选"
        />
        <select
          class="notes-player-field"
          data-player-id="${escapeHtml(player.id)}"
          data-field="claim"
          aria-label="按剧本快速选择身份"
        >
          <option value="">${script ? `《${script.name}》快选` : "先选剧本"}</option>
          ${roleOptions
            .map(
              (role) =>
                `<option value="${escapeHtml(role.name)}"${role.name === player.claim ? " selected" : ""}>${escapeHtml(role.name)}</option>`,
            )
            .join("")}
        </select>
      </div>
    </label>
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

function renderSetupSeatOptions(playerCount, selectedSeat) {
  return Array.from({ length: playerCount }, (_, index) => {
    const seat = index + 1;
    return `<option value="${seat}"${seat === selectedSeat ? " selected" : ""}>${seat}号位</option>`;
  }).join("");
}

function renderSetupPage(notes) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const currentGame = notes.games.find((game) => game.id === notes.activeGameId) || null;
  const config = getStandardSetup(draft.playerCount);

  document.title = "记录局创建";
  app.innerHTML = `
    <section class="notes-setup">
      <div class="notes-setup-panel">
        <p class="eyebrow">记录局</p>
        <h1>先把这一局定下来</h1>
        <p class="lead">先选剧本、人数和自己的位置，创建后就直接进入手机端总览。</p>

        <form id="notesSetupForm" class="notes-setup-form">
          <label class="note-field note-field--wide">
            <span>剧本</span>
            <select name="scriptId" data-setup-field="scriptId" required>
              <option value="">请选择剧本</option>
              ${renderScriptSelectOptions(draft.scriptId)}
            </select>
          </label>

          <div class="notes-setup-grid">
            <label class="note-field">
              <span>人数</span>
              <select name="playerCount" data-setup-field="playerCount" required>
                ${Array.from({ length: 11 }, (_, index) => {
                  const count = index + 5;
                  return `<option value="${count}"${count === draft.playerCount ? " selected" : ""}>${count} 人</option>`;
                }).join("")}
              </select>
            </label>

            <label class="note-field">
              <span>自己所在位置</span>
              <select name="selfSeat" data-setup-field="selfSeat" required>
                ${renderSetupSeatOptions(draft.playerCount, draft.selfSeat)}
              </select>
            </label>
          </div>

          <label class="note-field note-field--wide">
            <span>局名</span>
            <input
              name="title"
              data-setup-field="title"
              value="${escapeHtml(draft.title)}"
              placeholder="例如 周二 15 人局"
              required
            />
          </label>

          <label class="note-field note-field--wide">
            <span>记录视角</span>
            <select name="mode" data-setup-field="mode">
              ${renderSelectOptions(noteModeOptions, draft.mode)}
            </select>
          </label>

          <div class="notes-setup-preview">
            <strong>${draft.playerCount} 人配置</strong>
            <span>镇民 ${config.townsfolk} / 外来者 ${config.outsider} / 爪牙 ${config.minion} / 恶魔 ${config.demon}</span>
          </div>

          <div class="notes-setup-actions">
            <button type="button" class="primary-link" data-notes-action="create-game">创建并进入总览</button>
            ${
              currentGame
                ? `<button type="button" class="secondary-link" data-notes-action="cancel-create">返回当前局</button>`
                : ""
            }
          </div>
        </form>

        ${
          notes.games.length
            ? `
              <section class="notes-existing">
                <p class="eyebrow">已有记录</p>
                <label class="note-field note-field--wide">
                  <span>快速切换</span>
                  <select id="gameSelect">
                    ${renderGameSelectOptions(notes)}
                  </select>
                </label>
                <button type="button" class="secondary-link notes-existing-open" data-notes-action="open-current-game">打开当前局</button>
              </section>
            `
            : ""
        }
      </div>
    </section>
  `;
}

function renderGameToolbar(notes) {
  return `
    <div class="notes-toolbar">
      <label class="note-field notes-toolbar-field">
        <span>当前局</span>
        <select id="gameSelect">
          ${renderGameSelectOptions(notes)}
        </select>
      </label>
      <button type="button" class="secondary-link" data-notes-action="new-game">新建</button>
      <button type="button" class="secondary-link" data-notes-action="export-game">导出</button>
      <button type="button" class="secondary-link danger" data-notes-action="delete-game">删除</button>
    </div>
  `;
}

function renderOverviewRows(game) {
  return game.players
    .map((player) => {
      const isSelf = player.seat === game.selfSeat;
      const claimText = player.claim || "--";
      const summaryText = getRoleInfoSummary(player);
      const judgementText = getJudgementSummary(player);
      const supplementText = getOverviewSecondaryText(player);

      return `
        <button
          type="button"
          class="notes-overview-row${isSelf ? " is-self" : ""}"
          data-notes-action="open-player"
          data-player-id="${escapeHtml(player.id)}"
        >
          <span class="notes-overview-cell notes-overview-cell--seat">
            ${player.seat}${isSelf ? "*" : ""}
          </span>
          <span class="notes-overview-cell notes-overview-cell--status">
            <span class="notes-overview-token notes-overview-token--status notes-overview-token--status-${escapeHtml(player.status)}">
              ${escapeHtml(getShortStatusLabel(player.status))}
            </span>
          </span>
          <span class="notes-overview-cell notes-overview-cell--claim">${escapeHtml(claimText)}</span>
          <span class="notes-overview-cell notes-overview-cell--summary">${escapeHtml(summaryText)}</span>
          <span class="notes-overview-cell notes-overview-cell--judgement">${escapeHtml(judgementText)}</span>
          <span class="notes-overview-cell notes-overview-cell--extra">${escapeHtml(supplementText)}</span>
        </button>
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
          <h2>一页扫全桌</h2>
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
    </section>
  `;
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
            >
              <span>${player.seat}</span>
              <small>${isSelf ? "我" : player.name || "玩家"}</small>
            </button>
          `;
        })
        .join("")}
    </div>
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
        <div>
          <p class="eyebrow">玩家页</p>
          <h2>${escapeHtml(getPlayerLabel(draft, game))}</h2>
        </div>
        ${player.seat === game.selfSeat ? `<span class="notes-self-badge">自己</span>` : ""}
      </header>

      <div class="notes-form-grid">
        <label class="note-field">
          <span>玩家名</span>
          <input
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="name"
            value="${escapeHtml(draft.name)}"
            placeholder="${escapeHtml(`${player.seat}号位`)}"
          />
        </label>
        <label class="note-field">
          <span>状态</span>
          <select
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="status"
          >
            ${renderSelectOptions(noteStatusOptions, draft.status)}
          </select>
        </label>
        <label class="note-field">
          <span>判断</span>
          <select
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="alignment"
          >
            ${renderSelectOptions(noteAlignmentOptions, draft.alignment)}
          </select>
        </label>
        <label class="note-field">
          <span>中毒 / 醉酒</span>
          <select
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="condition"
          >
            ${renderSelectOptions(noteConditionOptions, draft.condition)}
          </select>
        </label>
        ${renderClaimControl(draft, game)}
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
        <label class="note-field note-field--wide">
          <span>详细记录</span>
          <textarea
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="notes"
            rows="6"
            placeholder="补充发言、对跳、可验证点"
          >${escapeHtml(draft.notes)}</textarea>
        </label>
      </div>

      ${renderRoleInfoInputs(draft, game)}

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

function getTimelineTypeLabel(value) {
  return getOptionLabel(timelineTypeOptions, value);
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

function renderTimelineEntries(game) {
  if (!game.timeline.length) {
    return `<div class="empty-state">还没有时间线，先记一条今天最重要的信息。</div>`;
  }

  return game.timeline
    .map(
      (entry) => `
        <article class="timeline-entry">
          <div class="timeline-entry-head">
            <strong>
              <span class="timeline-type timeline-type--${escapeHtml(entry.type)}">${escapeHtml(getTimelineTypeLabel(entry.type))}</span>
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

function renderTimelineTab(game) {
  return `
    <section class="notes-panel">
      <div class="notes-panel-header">
        <div>
          <p class="eyebrow">时间线</p>
          <h2>按时间顺着记</h2>
        </div>
      </div>

      <div class="notes-detail-section">
        <div class="notes-phase-row">
          <label class="note-field">
            <span>当前阶段</span>
            <select data-game-field="phaseType">
              ${renderSelectOptions(phaseTypeOptions, game.phaseType)}
            </select>
          </label>
          <label class="note-field">
            <span>轮次</span>
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              data-game-field="phaseNumber"
              value="${game.phaseNumber}"
            />
          </label>
        </div>

        <div class="notes-timeline-compose">
          <label class="note-field">
            <span>记录类型</span>
            <select id="timelineType">
              ${renderSelectOptions(timelineTypeOptions, "info")}
            </select>
          </label>
          <label class="note-field note-field--wide">
            <span>内容</span>
            <textarea
              id="timelineText"
              rows="4"
              placeholder="例如 2号提名 7号；3、4、8 对 7 号投票；今晚死了 11 号"
            ></textarea>
          </label>
          <button type="button" class="primary-link notes-timeline-submit" data-notes-action="add-timeline">
            记入 ${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))}
          </button>
        </div>
      </div>

      <div class="timeline-list">
        ${renderTimelineEntries(game)}
      </div>
    </section>
  `;
}

function renderInferenceTab(game) {
  return `
    <section class="notes-panel">
      <div class="notes-panel-header">
        <div>
          <p class="eyebrow">推理</p>
          <h2>把桌面判断先收拢</h2>
        </div>
      </div>

      <div class="notes-form-grid">
        <label class="note-field note-field--wide">
          <span>当前局面</span>
          <textarea
            data-inference-field="summary"
            rows="4"
            placeholder="现在最像什么局，哪些信息链已经站稳"
          >${escapeHtml(game.inference.summary)}</textarea>
        </label>
        <label class="note-field note-field--wide">
          <span>好人候选</span>
          <textarea
            data-inference-field="goodTeam"
            rows="4"
            placeholder="谁更像好，为什么"
          >${escapeHtml(game.inference.goodTeam)}</textarea>
        </label>
        <label class="note-field note-field--wide">
          <span>坏人候选</span>
          <textarea
            data-inference-field="evilTeam"
            rows="4"
            placeholder="恶魔/爪牙候选，当前最关键的矛盾"
          >${escapeHtml(game.inference.evilTeam)}</textarea>
        </label>
        <label class="note-field note-field--wide">
          <span>下一步</span>
          <textarea
            data-inference-field="plan"
            rows="4"
            placeholder="今天想问谁、想提谁、想验证什么"
          >${escapeHtml(game.inference.plan)}</textarea>
        </label>
      </div>
    </section>
  `;
}

function renderTabContent(game) {
  const tab = state.notes.ui.activeTab;

  if (tab === "players") {
    return renderPlayersTab(game);
  }

  if (tab === "timeline") {
    return renderTimelineTab(game);
  }

  if (tab === "deduction") {
    return renderInferenceTab(game);
  }

  return renderOverviewTab(game);
}

function renderTabBar() {
  return `
    <nav class="notes-tabbar" aria-label="记录页面">
      ${noteTabOptions
        .map(
          (tab) => `
            <button
              type="button"
              class="notes-tab${state.notes.ui.activeTab === tab.value ? " active" : ""}"
              data-notes-action="switch-tab"
              data-tab="${escapeHtml(tab.value)}"
              aria-pressed="${state.notes.ui.activeTab === tab.value ? "true" : "false"}"
            >${escapeHtml(tab.label)}</button>
          `,
        )
        .join("")}
    </nav>
  `;
}

function renderGamePage(notes, game) {
  document.title = `${game.title} · 记录局`;
  app.innerHTML = `
    <section class="notes-shell">
      ${renderNotesStageBar(game)}
      ${renderGameMeta(game)}
      ${renderGameToolbar(notes)}

      <main class="notes-tab-content">
        ${renderTabContent(game)}
      </main>

      ${renderRoleNameDatalist(game)}
      ${renderTabBar()}
    </section>
  `;
}

function renderNotesPage() {
  const notes = ensureNotesState();
  const game = getActiveGame();

  if (!game || notes.ui.creatingGame) {
    renderSetupPage(notes);
    return;
  }

  renderGamePage(notes, game);
}
