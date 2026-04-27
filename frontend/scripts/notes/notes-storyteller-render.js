// Split from notes-render.js. Keep script order in index.html.

function getStorytellerState(game) {
  return {
    ...createDefaultStorytellerState(),
    ...(game?.storyteller || {}),
    bluffs: Array.isArray(game?.storyteller?.bluffs)
      ? game.storyteller.bluffs
      : [],
  };
}

function getStorytellerRole(player, game) {
  return getRoleByLooseName(player?.trueRole, game);
}

function getRoleBadgeClass(role) {
  return `story-role-badge story-role-badge--${escapeHtml(role?.type || "unknown")}`;
}

function getStorytellerSetupSummary(game) {
  const config = getStandardSetup(game.playerCount);
  const counts = game.players.reduce(
    (result, player) => {
      const role = getStorytellerRole(player, game);
      if (role?.type && result[role.type] !== undefined) {
        result[role.type] += 1;
      }
      return result;
    },
    { townsfolk: 0, outsider: 0, minion: 0, demon: 0 },
  );

  return ["townsfolk", "outsider", "minion", "demon"].map((type) => ({
    type,
    label: typeLabels[type],
    expected: config[type],
    actual: counts[type],
  }));
}

function renderStorytellerSetupTools(game) {
  const setup = getStorytellerSetupSummary(game);
  const storyteller = getStorytellerState(game);

  return `
    <section class="story-console-panel">
      <div class="story-panel-header">
        <div>
          <p class="eyebrow">身份分配</p>
          <h2>开局控制</h2>
        </div>
        <div class="story-toolbar-actions">
          <button type="button" class="primary-link" data-notes-action="random-assign-roles">随机分配</button>
          <button type="button" class="secondary-link" data-notes-action="clear-assignments">清空</button>
        </div>
      </div>
      <div class="story-setup-counts">
        ${setup
          .map(
            (item) => `
              <span class="story-count${item.actual === item.expected ? " is-ok" : " is-warn"}">
                ${escapeHtml(item.label)} ${item.actual}/${item.expected}
              </span>
            `,
          )
          .join("")}
      </div>
      <div class="story-bluffs-grid">
        ${Array.from({ length: 3 }, (_, index) => `
          <label class="note-field">
            <span>恶魔伪装 ${index + 1}</span>
            <input
              list="roleNameList"
              data-storyteller-bluff="${index}"
              value="${escapeHtml(storyteller.bluffs[index] || "")}"
              placeholder="留空或手动指定"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </label>
        `).join("")}
      </div>
      <label class="note-field note-field--wide">
        <span>开局备注</span>
        <textarea
          data-storyteller-field="setupNotes"
          rows="3"
          placeholder="酒鬼以为什么身份、红鲱鱼、特殊配置、第一天要记的裁量"
        >${escapeHtml(storyteller.setupNotes)}</textarea>
      </label>
    </section>
  `;
}

function renderStorytellerManualRows(game) {
  return game.players
    .map((player) => {
      const draft = getDraftOrPlayer(player);
      const role = getStorytellerRole(draft, game);
      return `
        <article class="story-player-row">
          <div class="story-player-seat">
            <strong>${player.seat}</strong>
            <span>${escapeHtml(player.name || "未命名")}</span>
          </div>
          <label class="note-field">
            <span>真实身份</span>
            <input
              data-player-id="${escapeHtml(player.id)}"
              data-field="trueRole"
              list="roleNameList"
              value="${escapeHtml(draft.trueRole)}"
              placeholder="手动设置"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </label>
          <label class="note-field">
            <span>真实阵营</span>
            <select data-player-id="${escapeHtml(player.id)}" data-field="trueAlignment">
              ${renderSelectOptions(noteAlignmentOptions, draft.trueAlignment)}
            </select>
          </label>
          <div class="story-row-cycles">
            ${renderPlayerCycleField(draft, "status", "状态")}
            ${renderPlayerCycleField(draft, "condition", "醉/毒")}
          </div>
          <label class="note-field note-field--wide">
            <span>标记与备注</span>
            <input
              data-player-id="${escapeHtml(player.id)}"
              data-field="storytellerNotes"
              value="${escapeHtml(draft.storytellerNotes)}"
              placeholder="中毒、保护、被选中、一次性能力已用"
            />
          </label>
          <span class="${getRoleBadgeClass(role)}">${escapeHtml(role ? typeLabels[role.type] : "未设")}</span>
        </article>
      `;
    })
    .join("");
}

function renderStorytellerManualPanel(game) {
  return `
    <section class="story-console-panel">
      <div class="story-panel-header">
        <div>
          <p class="eyebrow">手动设置</p>
          <h2>座位与状态</h2>
        </div>
      </div>
      <div class="story-player-list">
        ${renderStorytellerManualRows(game)}
      </div>
    </section>
  `;
}

function getNightOrderRoles(game) {
  const assignedRoles = game.players
    .map((player) => ({
      player,
      role: getStorytellerRole(player, game),
    }))
    .filter((item) => item.role);
  const hasAssignments = assignedRoles.length > 0;
  const source = hasAssignments
    ? assignedRoles
    : getClaimRoleOptions(game)
        .filter((role) => role.type !== "fabled")
        .map((role) => ({ player: null, role }));

  return source
    .map((item, index) => {
      const timing = item.role.abilityData?.abilityMeta?.phaseTiming || "";
      const firstReminder = item.role.firstNightReminder || "";
      const otherReminder = item.role.otherNightReminder || "";
      const hasNightAction =
        firstReminder ||
        otherReminder ||
        ["setup", "first_night", "each_night", "each_night_star", "night"].includes(timing);

      return {
        ...item,
        order: index,
        timing,
        firstReminder,
        otherReminder,
        hasNightAction,
      };
    })
    .filter((item) => item.hasNightAction);
}

function renderNightOrderPanel(game) {
  const nightRoles = getNightOrderRoles(game);

  return `
    <section class="story-console-panel">
      <div class="story-panel-header">
        <div>
          <p class="eyebrow">夜晚流程</p>
          <h2>${game.phaseNumber <= 1 ? "首夜" : "每晚"}助手</h2>
        </div>
      </div>
      ${
        nightRoles.length
          ? `
            <div class="story-night-list">
              ${nightRoles
                .map((item) => {
                  const reminder =
                    game.phaseNumber <= 1
                      ? item.firstReminder || item.otherReminder
                      : item.otherReminder || item.firstReminder;
                  return `
                    <article class="story-night-item">
                      <div>
                        <strong>${escapeHtml(item.role.name)}</strong>
                        <span>${escapeHtml(item.player ? getPlayerLabel(item.player, game) : typeLabels[item.role.type])}</span>
                      </div>
                      <p>${escapeHtml(reminder || item.role.ability || "按角色能力处理。")}</p>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
          : `<div class="empty-state">当前剧本或分配里还没有可显示的夜晚提醒。</div>`
      }
    </section>
  `;
}

function renderPublicBoardPanel(game) {
  const storyteller = getStorytellerState(game);

  return `
    <section class="story-console-panel">
      <div class="story-panel-header">
        <div>
          <p class="eyebrow">公开视图</p>
          <h2>可给玩家看的信息</h2>
        </div>
      </div>
      <div class="story-public-board">
        ${game.players
          .map(
            (player) => `
              <div class="story-public-player">
                <strong>${player.seat}</strong>
                <span>${escapeHtml(player.name || "未命名")}</span>
                <small>${escapeHtml(getOptionLabel(noteStatusOptions, player.status))}</small>
              </div>
            `,
          )
          .join("")}
      </div>
      <label class="note-field note-field--wide">
        <span>公开备注</span>
        <textarea
          data-storyteller-field="publicNotes"
          rows="3"
          placeholder="例如 今日处决、公开死亡、旅行者流放、全桌可见提醒"
        >${escapeHtml(storyteller.publicNotes)}</textarea>
      </label>
    </section>
  `;
}

function renderStorytellerTab(game) {
  if (game.mode !== "storyteller") {
    return `
      <section class="notes-panel">
        <div class="empty-state">当前局是玩家模式。到时间线里把记录视角切成说书人后，这里会出现控制台。</div>
      </section>
    `;
  }

  return `
    <div class="story-console">
      ${renderStorytellerSetupTools(game)}
      ${renderStorytellerManualPanel(game)}
      ${renderNightOrderPanel(game)}
      ${renderPublicBoardPanel(game)}
    </div>
  `;
}
