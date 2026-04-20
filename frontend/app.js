const app = document.querySelector("#app");

const typeLabels = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
  fabled: "传奇角色",
};

const typeDescriptions = {
  townsfolk: "善良阵营的主要信息与功能角色",
  outsider: "善良阵营，但能力常带来负担或干扰",
  minion: "邪恶阵营，负责保护恶魔并制造混乱",
  demon: "邪恶阵营核心，通常决定夜晚死亡",
  fabled: "由说书人使用的特殊规则或配置工具",
};

const notesStorageKey = "botc-game-notes-v1";

const noteAlignmentOptions = [
  { value: "unknown", label: "未知" },
  { value: "good", label: "偏好" },
  { value: "evil", label: "偏邪" },
  { value: "suspect", label: "存疑" },
];

const noteStatusOptions = [
  { value: "alive", label: "存活" },
  { value: "dead", label: "死亡" },
  { value: "executed", label: "已处决" },
  { value: "unclear", label: "待确认" },
];

const noteModeOptions = [
  { value: "player", label: "玩家模式" },
  { value: "storyteller", label: "说书人模式" },
];

const noteTagOptions = [
  { value: "trusted", label: "可信" },
  { value: "suspicious", label: "可疑" },
  { value: "info", label: "信息位" },
  { value: "outsider", label: "外来者候选" },
  { value: "demon", label: "恶魔候选" },
  { value: "minion", label: "爪牙候选" },
  { value: "conflict", label: "说法冲突" },
  { value: "confirmed-dead", label: "已确认死亡" },
];

const oneInOneOutRoleOrder = [
  "steward",
  "knight",
  "high-priestess",
  "village-idiot",
  "snake-charmer",
  "fortune-teller",
  "oracle",
  "fisherman",
  "seamstress",
  "monk",
  "amnesiac",
  "farmer",
  "cannibal",
  "ogre",
  "goon",
  "recluse",
  "drunk",
  "poisoner",
  "harpy",
  "spy",
  "mezepheles",
  "kazali",
  "imp",
  "ojo",
  "fang-gu",
  "spirit-of-ivory",
];

const roleTypeOrder = ["townsfolk", "outsider", "minion", "demon", "fabled"];

const state = {
  activeFilter: "all",
  notes: {
    activeGameId: "",
    games: [],
    loaded: false,
  },
  rules: [],
  scripts: [],
  roles: [],
  terms: [],
};

const importantAbilityPhrases = [
  "善良方失败",
  "善良方获胜",
  "邪恶方失败",
  "邪恶方获胜",
  "不会死亡",
  "不能死亡",
  "立刻被处决",
  "立即被处决",
  "失去能力",
  "必定为假",
  "不生效",
  "交换角色与阵营",
  "变成恶魔",
  "变成邪恶",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || "未知";
}

function renderSelectOptions(options, selectedValue) {
  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
    )
    .join("");
}

function createDefaultPlayer(number) {
  return {
    id: createId("player"),
    name: `玩家 ${number}`,
    claim: "",
    alignment: "unknown",
    status: "alive",
    tags: [],
    notes: "",
    votes: "",
    trueRole: "",
    trueAlignment: "unknown",
    storytellerNotes: "",
  };
}

function createDefaultGame() {
  return {
    id: createId("game"),
    title: "新的一局",
    scriptName: "",
    phase: "第 1 天",
    mode: "player",
    createdAt: new Date().toISOString(),
    players: Array.from({ length: 7 }, (_, index) => createDefaultPlayer(index + 1)),
    timeline: [],
  };
}

function normalizePlayer(player, index) {
  const validTags = new Set(noteTagOptions.map((tag) => tag.value));
  const tags = Array.isArray(player?.tags)
    ? player.tags.filter((tag) => validTags.has(tag))
    : [];

  return {
    id: player?.id || createId("player"),
    name: player?.name || `玩家 ${index + 1}`,
    claim: player?.claim || "",
    alignment: noteAlignmentOptions.some((option) => option.value === player?.alignment)
      ? player.alignment
      : "unknown",
    status: noteStatusOptions.some((option) => option.value === player?.status)
      ? player.status
      : "alive",
    tags,
    notes: player?.notes || "",
    votes: player?.votes || "",
    trueRole: player?.trueRole || "",
    trueAlignment: noteAlignmentOptions.some((option) => option.value === player?.trueAlignment)
      ? player.trueAlignment
      : "unknown",
    storytellerNotes: player?.storytellerNotes || "",
  };
}

function normalizeTimelineEntry(entry) {
  return {
    id: entry?.id || createId("note"),
    phase: entry?.phase || "未标记阶段",
    text: entry?.text || "",
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function normalizeGame(game, index) {
  const fallback = createDefaultGame();
  const mode = noteModeOptions.some((option) => option.value === game?.mode)
    ? game.mode
    : "player";

  return {
    id: game?.id || fallback.id,
    title: game?.title || `第 ${index + 1} 局`,
    scriptName: game?.scriptName || "",
    phase: game?.phase || "第 1 天",
    mode,
    createdAt: game?.createdAt || fallback.createdAt,
    players: Array.isArray(game?.players)
      ? game.players.map(normalizePlayer)
      : fallback.players,
    timeline: Array.isArray(game?.timeline)
      ? game.timeline.map(normalizeTimelineEntry).filter((entry) => entry.text)
      : [],
  };
}

function loadNotesState() {
  const fallback = {
    activeGameId: "",
    games: [],
    loaded: true,
  };

  try {
    const raw = window.localStorage.getItem(notesStorageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      activeGameId: parsed.activeGameId || "",
      games: Array.isArray(parsed.games) ? parsed.games.map(normalizeGame) : [],
      loaded: true,
    };
  } catch (error) {
    console.warn("Failed to load game notes", error);
    return fallback;
  }
}

function getNotesGameCount() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  return state.notes.games.length;
}

function saveNotesState() {
  try {
    window.localStorage.setItem(
      notesStorageKey,
      JSON.stringify({
        activeGameId: state.notes.activeGameId,
        games: state.notes.games,
      }),
    );
  } catch (error) {
    console.warn("Failed to save game notes", error);
  }
}

function ensureNotesState() {
  if (!state.notes.loaded) {
    state.notes = loadNotesState();
  }

  if (!state.notes.games.length) {
    const game = createDefaultGame();
    state.notes.games = [game];
    state.notes.activeGameId = game.id;
    saveNotesState();
    return state.notes;
  }

  const activeGame = state.notes.games.find(
    (game) => game.id === state.notes.activeGameId,
  );
  if (!activeGame) {
    state.notes.activeGameId = state.notes.games[0].id;
    saveNotesState();
  }

  return state.notes;
}

function getActiveGame() {
  const notes = ensureNotesState();
  return notes.games.find((game) => game.id === notes.activeGameId) || notes.games[0];
}

function getNoteTagLabel(value) {
  return getOptionLabel(noteTagOptions, value);
}

function renderGameSelectOptions(notes) {
  return notes.games
    .map(
      (game, index) =>
        `<option value="${escapeHtml(game.id)}"${game.id === notes.activeGameId ? " selected" : ""}>${escapeHtml(game.title || `第 ${index + 1} 局`)}</option>`,
    )
    .join("");
}

function renderRoleNameDatalist() {
  return `
    <datalist id="roleNameList">
      ${state.roles.map((role) => `<option value="${escapeHtml(role.name)}"></option>`).join("")}
    </datalist>
  `;
}

function renderScriptNameDatalist() {
  return `
    <datalist id="scriptNameList">
      ${state.scripts.map((script) => `<option value="${escapeHtml(script.name)}"></option>`).join("")}
    </datalist>
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
            <label class="note-field">
              <span>自称身份</span>
              <input
                class="notes-player-field"
                data-player-id="${escapeHtml(player.id)}"
                data-field="claim"
                list="roleNameList"
                value="${escapeHtml(player.claim)}"
                placeholder="例如 洗衣妇"
              />
            </label>
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

          <label class="note-field wide">
            <span>投票 / 提名</span>
            <textarea
              class="notes-player-field"
              data-player-id="${escapeHtml(player.id)}"
              data-field="votes"
              rows="2"
              placeholder="第几天投了谁，被谁提名"
            >${escapeHtml(player.votes)}</textarea>
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

function renderTimelineEntries(game) {
  if (!game.timeline.length) {
    return `<div class="empty-state timeline-empty">还没有时间线。先记第一条信息。</div>`;
  }

  return game.timeline
    .map(
      (entry) => `
        <article class="timeline-entry">
          <div>
            <strong>${escapeHtml(entry.phase)}</strong>
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
            <label class="note-field">
              <span>阶段</span>
              <input id="timelinePhase" value="${escapeHtml(game.phase)}" />
            </label>
            <label class="note-field wide">
              <span>信息</span>
              <textarea id="timelineText" rows="4" placeholder="例如 今晚死了 A；B 说 C 是爪牙候选"></textarea>
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

      ${renderRoleNameDatalist()}
      ${renderScriptNameDatalist()}
    </section>
  `;
}

function updateGameField(field, value) {
  const game = getActiveGame();
  if (!game || !(field in game)) {
    return false;
  }

  game[field] = value;
  saveNotesState();
  return field === "mode";
}

function updatePlayerField(playerId, field, value) {
  const game = getActiveGame();
  const player = game?.players.find((item) => item.id === playerId);
  if (!player || !(field in player)) {
    return false;
  }

  player[field] = value;
  saveNotesState();
  return field === "status" || field === "alignment" || field === "trueAlignment";
}

function handleNotesFieldChange(target, refreshSummaries = false) {
  if (target.id === "gameSelect") {
    const notes = ensureNotesState();
    notes.activeGameId = target.value;
    saveNotesState();
    renderNotesPage();
    return;
  }

  const gameField = target.closest("[data-game-field]");
  if (gameField) {
    const field = gameField.dataset.gameField;
    const shouldRerender = updateGameField(field, gameField.value);
    if (shouldRerender || (refreshSummaries && field === "title")) {
      renderNotesPage();
    }
    return;
  }

  const playerField = target.closest("[data-player-id][data-field]");
  if (playerField) {
    const field = playerField.dataset.field;
    const shouldRerender = updatePlayerField(
      playerField.dataset.playerId,
      field,
      playerField.value,
    );
    if (shouldRerender || (refreshSummaries && ["name", "claim"].includes(field))) {
      renderNotesPage();
    }
  }
}

function addTimelineEntry() {
  const game = getActiveGame();
  const phaseInput = document.querySelector("#timelinePhase");
  const textInput = document.querySelector("#timelineText");
  const text = textInput?.value.trim() || "";

  if (!game || !text) {
    textInput?.focus();
    return;
  }

  game.timeline.unshift({
    id: createId("note"),
    phase: phaseInput?.value.trim() || game.phase || "未标记阶段",
    text,
    createdAt: new Date().toISOString(),
  });
  saveNotesState();
  renderNotesPage();
}

function exportActiveGame() {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  const safeTitle = (game.title || "botc-notes")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const blob = new Blob([JSON.stringify(game, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle || "botc-notes"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleNotesAction(button) {
  const action = button.dataset.notesAction;
  const notes = ensureNotesState();
  const game = getActiveGame();

  if (action === "new-game") {
    const newGame = createDefaultGame();
    notes.games.unshift(newGame);
    notes.activeGameId = newGame.id;
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (!game) {
    return;
  }

  if (action === "delete-game") {
    if (!window.confirm("删除当前局次记录？这只会清除本机保存。")) {
      return;
    }

    notes.games = notes.games.filter((item) => item.id !== game.id);
    if (!notes.games.length) {
      const newGame = createDefaultGame();
      notes.games = [newGame];
      notes.activeGameId = newGame.id;
    } else {
      notes.activeGameId = notes.games[0].id;
    }
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "export-game") {
    exportActiveGame();
    return;
  }

  if (action === "add-player") {
    game.players.push(createDefaultPlayer(game.players.length + 1));
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "delete-player") {
    game.players = game.players.filter(
      (player) => player.id !== button.dataset.playerId,
    );
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "toggle-tag") {
    const player = game.players.find((item) => item.id === button.dataset.playerId);
    if (!player) {
      return;
    }

    const tag = button.dataset.tag;
    player.tags = player.tags.includes(tag)
      ? player.tags.filter((item) => item !== tag)
      : [...player.tags, tag];
    saveNotesState();
    renderNotesPage();
    return;
  }

  if (action === "add-timeline") {
    addTimelineEntry();
    return;
  }

  if (action === "delete-timeline") {
    game.timeline = game.timeline.filter(
      (entry) => entry.id !== button.dataset.entryId,
    );
    saveNotesState();
    renderNotesPage();
  }
}

function getScriptById(id) {
  return state.scripts.find((script) => script.id === id);
}

function getRoleById(id) {
  return state.roles.find((role) => role.id === id);
}

function getTermById(id) {
  return state.terms.find((term) => term.id === id);
}

function getScriptsForRole(role) {
  const scriptIds = role.scriptIds || [role.scriptId];
  return scriptIds.map(getScriptById).filter(Boolean);
}

function getRoleScriptLabel(role) {
  return (role.scriptNames || []).join(" / ") || role.script || "未归属剧本";
}

function getTermForKeyword(keyword) {
  return state.terms.find((term) => {
    const names = [term.name, ...(term.aliases || [])];
    return names.some((name) => name === keyword);
  });
}

function splitKeywords(keywords) {
  return String(keywords || "")
    .split(/\s+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function listItems(items) {
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function detailBlock(title, content) {
  const body = Array.isArray(content)
    ? listItems(content)
    : `<p>${escapeHtml(content)}</p>`;

  return `
    <section class="detail-block">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

function compactListLinks(items, type) {
  if (!items.length) {
    return `<p class="muted">当前还没有录入关联条目。</p>`;
  }

  return `
    <div class="compact-list">
      ${items
        .map(
          (item) => `
            <a href="/${type}/${escapeHtml(item.id)}" data-link${type === "roles" ? ` data-type="${escapeHtml(item.type)}"` : ""}>
              <span>${escapeHtml(item.name)}</span>
              <small>${getCompactLabel(item, type)}</small>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function getCompactLabel(item, type) {
  if (type === "roles") {
    return escapeHtml(typeLabels[item.type] || item.type);
  }

  if (type === "terms") {
    return escapeHtml(item.category);
  }

  return escapeHtml(item.level);
}

function getRoleTypeSortValue(role) {
  const index = roleTypeOrder.indexOf(role.type);
  return index === -1 ? roleTypeOrder.length : index;
}

function getOneInOneOutSortValue(role) {
  const index = oneInOneOutRoleOrder.indexOf(role.id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortScriptRoles(script, roles) {
  if (script.id !== "one-in-one-out") {
    return roles;
  }

  return [...roles].sort((left, right) => {
    return getOneInOneOutSortValue(left) - getOneInOneOutSortValue(right);
  });
}

function renderScriptRoleList(script, roles) {
  return compactListLinks(sortScriptRoles(script, roles), "roles");
}

function sortCatalogRoles(roles) {
  return roles
    .map((role, index) => ({ role, index }))
    .sort((left, right) => {
      const typeDelta =
        getRoleTypeSortValue(left.role) - getRoleTypeSortValue(right.role);
      if (typeDelta) {
        return typeDelta;
      }

      const oneInOneOutDelta =
        getOneInOneOutSortValue(left.role) -
        getOneInOneOutSortValue(right.role);
      if (oneInOneOutDelta) {
        return oneInOneOutDelta;
      }

      return left.index - right.index;
    })
    .map(({ role }) => role);
}

function renderKeywordLinks(keywords) {
  const tokens = splitKeywords(keywords);
  if (!tokens.length) {
    return `<p class="muted">当前没有关键词。</p>`;
  }

  return `
    <div class="keyword-list">
      ${tokens
        .map((keyword) => {
          const term = getTermForKeyword(keyword);
          if (!term) {
            return `<span class="keyword-chip">${escapeHtml(keyword)}</span>`;
          }

          return `<a class="keyword-chip" href="/terms/${escapeHtml(term.id)}" data-link>${escapeHtml(keyword)}</a>`;
        })
        .join("")}
    </div>
  `;
}

function getInlineTermMatches() {
  return state.terms.flatMap((term) => {
    const names = [term.name, ...(term.aliases || [])];
    return names.map((name) => ({
      text: name,
      type: "term",
      id: term.id,
    }));
  });
}

function renderRichText(value) {
  const source = String(value || "");
  const candidates = [
    ...getInlineTermMatches(),
    ...importantAbilityPhrases.map((text) => ({ text, type: "strong" })),
  ]
    .filter((item) => item.text)
    .sort((a, b) => b.text.length - a.text.length);
  const matches = [];

  candidates.forEach((candidate) => {
    let start = source.indexOf(candidate.text);
    while (start !== -1) {
      const end = start + candidate.text.length;
      const overlaps = matches.some(
        (match) => start < match.end && end > match.start,
      );

      if (!overlaps) {
        matches.push({ ...candidate, start, end });
      }

      start = source.indexOf(candidate.text, end);
    }
  });

  matches.sort((a, b) => a.start - b.start);

  let html = "";
  let cursor = 0;
  matches.forEach((match) => {
    html += escapeHtml(source.slice(cursor, match.start));
    const text = escapeHtml(source.slice(match.start, match.end));

    if (match.type === "term") {
      html += `<a class="inline-term" href="/terms/${escapeHtml(match.id)}" data-link>${text}</a>`;
    } else {
      html += `<strong>${text}</strong>`;
    }

    cursor = match.end;
  });

  html += escapeHtml(source.slice(cursor));
  return html;
}

function abilityBlock(role) {
  return `
    <section class="ability-block">
      <p class="eyebrow">角色能力</p>
      <p>${renderRichText(role.ability || role.detail.abilitySummary)}</p>
    </section>
  `;
}

function getRoleTypeSummary() {
  return Object.entries(typeLabels)
    .map(([type, label]) => {
      const count = state.roles.filter((role) => role.type === type).length;
      return count ? `${label} ${count}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function renderHomeDirectory() {
  const cards = [
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: state.roles.length,
      countLabel: "个角色",
      text: "按身份筛选，或直接搜索能力、板子和关键词。",
      action: "查角色",
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: state.scripts.length,
      countLabel: "个板子",
      text: "先看每个板子的节奏、适合人群和常见坑。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: state.terms.length,
      countLabel: "个术语",
      text: "把中毒、醉酒、疯狂等容易混淆的词先对齐。",
      action: "查术语",
    },
    {
      eyebrow: "局内记录",
      title: "记录局",
      href: "/notes",
      count: getNotesGameCount(),
      countLabel: "个本地记录",
      text: "把座位、声明、标签和每天得到的信息按局保存下来。",
      action: "开始记录",
    },
  ];

  return cards
    .map(
      (card) => `
        <a class="directory-card" href="${card.href}" data-link>
          <p class="eyebrow">${escapeHtml(card.eyebrow)}</p>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.text)}</p>
          <div class="directory-meta">
            <strong>${card.count}</strong>
            <span>${escapeHtml(card.countLabel)}</span>
          </div>
          <span class="card-action">${escapeHtml(card.action)}</span>
        </a>
      `,
    )
    .join("");
}

function renderHome() {
  document.title = "血染钟楼百科";
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">社交推理 · 说书人 · 阵营博弈</p>
        <h1>查规则、看板子、找角色，一局开始前够用了。</h1>
        <p class="lead">
          开局前先定位问题：查角色能力、挑今晚的板子，或把容易混淆的术语对齐。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link" href="/roles" data-link>直接查角色</a>
          <a class="secondary-link" href="/scripts" data-link>看板子目录</a>
          <a class="secondary-link" href="/notes" data-link>记录这一局</a>
        </div>
        <div class="quick-stats" aria-label="资料概览">
          <div>
            <strong>${state.scripts.length}</strong>
            <span>个板子</span>
          </div>
          <div>
            <strong>${state.roles.length}</strong>
            <span>个角色</span>
          </div>
          <div>
            <strong>${state.terms.length}</strong>
            <span>个术语</span>
          </div>
          <div>
            <strong>${Object.keys(typeLabels).length}</strong>
            <span>类阵营/身份</span>
          </div>
        </div>
      </div>

      <div class="image-strip" aria-label="氛围图">
        <img
          src="/assets/clock-tower-night.jpg"
          alt="夜色中的钟楼"
          width="1200"
          height="1600"
          decoding="async"
          fetchpriority="high"
        />
        <img
          src="/assets/medieval-town-night.jpg"
          alt="夜晚的中世纪街巷"
          width="1280"
          height="887"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/assets/candle-book.jpg"
          alt="烛光下的旧书"
          width="1280"
          height="853"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">从哪开始</p>
          <h2 id="directoryTitle">先选一个方向</h2>
        </div>
        <p class="section-note">遇到角色、板子、术语，直接进对应目录。</p>
      </div>
      <div class="directory-grid">
        ${renderHomeDirectory()}
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">先懂这几个词</p>
          <h2 id="rulesTitle">游戏速览</h2>
        </div>
        <p class="section-note">点开当下需要的规则点，先把开局会用到的概念看明白。</p>
      </div>
      <div class="rule-grid" id="ruleGrid"></div>
    </section>
  `;

  renderRules();
  scrollToHash();
}

function renderTermIndex() {
  document.title = "术语目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero terms-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">关键词 / 术语</p>
          <h1>先把黑话对齐。</h1>
          <p class="lead">
            中毒、醉酒、疯狂、处决这些词会影响整局判断。这里先按概念查，再去角色详情看它们怎么落到实战里。
          </p>
        </div>
        <div class="collection-stats" aria-label="术语目录概览">
          <strong>${state.terms.length}</strong>
          <span>个术语</span>
        </div>
      </div>
    </section>

    <section class="section terms-section catalog-section" id="terms" aria-labelledby="termsTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">术语目录</p>
          <h2 id="termsTitle">按概念查</h2>
        </div>
      </div>
      <div class="term-grid" id="termGrid"></div>
    </section>
  `;

  renderTerms();
}

function renderScriptIndex() {
  document.title = "板子目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero scripts-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">剧本 / 板子</p>
          <h1>从入门到混乱。</h1>
          <p class="lead">
            先看板子的节奏、适合玩家和说书人提醒，再决定这一局要开哪一张。
          </p>
        </div>
        <div class="collection-stats" aria-label="板子目录概览">
          <strong>${state.scripts.length}</strong>
          <span>个板子</span>
        </div>
      </div>
    </section>

    <section class="section catalog-section" id="scripts" aria-labelledby="scriptsTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">板子目录</p>
          <h2 id="scriptsTitle">选择今晚的局</h2>
        </div>
      </div>
      <div class="script-grid" id="scriptGrid"></div>
    </section>
  `;

  renderScripts();
}

function renderRoleIndex() {
  document.title = "角色目录 · 血染钟楼百科";
  app.innerHTML = `
    <section class="collection-hero roles-hero">
      <a class="back-link" href="/" data-link>返回首页</a>
      <div class="collection-hero-grid">
        <div>
          <p class="eyebrow">角色百科</p>
          <h1>按身份、板子和关键词查。</h1>
          <p class="lead">
            ${escapeHtml(getRoleTypeSummary())}。输入角色名、能力关键词或所属板子，快速缩小范围。
          </p>
        </div>
        <div class="collection-stats" aria-label="角色目录概览">
          <strong>${state.roles.length}</strong>
          <span>个角色</span>
        </div>
      </div>
    </section>

    <section class="section role-browser catalog-section" id="roles" aria-labelledby="rolesTitle">
      <div class="section-heading role-heading">
        <div>
          <p class="eyebrow">角色目录</p>
          <h2 id="rolesTitle">筛一下再看</h2>
        </div>
        <label class="search-box">
          <span>搜索</span>
          <input id="searchInput" type="search" placeholder="输入角色、能力关键词或板子" />
        </label>
      </div>

      <div class="filters" aria-label="角色筛选">
        <button class="filter active" data-filter="all">全部</button>
        <button class="filter" data-filter="townsfolk">镇民</button>
        <button class="filter" data-filter="outsider">外来者</button>
        <button class="filter" data-filter="minion">爪牙</button>
        <button class="filter" data-filter="demon">恶魔</button>
        <button class="filter" data-filter="fabled">传奇</button>
      </div>

      <div class="role-grid" id="roleGrid"></div>
    </section>
  `;

  renderRoles();
  syncFilterButtons();
}

function renderTerms() {
  const termGrid = document.querySelector("#termGrid");
  if (!termGrid) {
    return;
  }

  termGrid.innerHTML = state.terms
    .map(
      (term) => `
        <a class="term-card" href="/terms/${escapeHtml(term.id)}" data-link>
          <small>${escapeHtml(term.category)}</small>
          <h3>${escapeHtml(term.name)}</h3>
          <p>${escapeHtml(term.summary)}</p>
          ${(term.aliases || []).length ? `<div class="term-aliases">${term.aliases.map((alias) => `<span>${escapeHtml(alias)}</span>`).join("")}</div>` : ""}
        </a>
      `,
    )
    .join("");
}

function renderRules() {
  const ruleGrid = document.querySelector("#ruleGrid");
  if (!ruleGrid) {
    return;
  }

  ruleGrid.innerHTML = state.rules
    .map(
      (rule, index) => `
        <details class="rule-card" ${index === 0 ? "open" : ""}>
          <summary>${escapeHtml(rule.title)}</summary>
          <p>${escapeHtml(rule.text)}</p>
        </details>
      `,
    )
    .join("");
}

function renderScripts() {
  const scriptGrid = document.querySelector("#scriptGrid");
  if (!scriptGrid) {
    return;
  }

  scriptGrid.innerHTML = state.scripts
    .map(
      (script) => `
        <a class="script-card" href="/scripts/${escapeHtml(script.id)}" data-link>
          <img src="${escapeHtml(script.image)}" alt="${escapeHtml(script.name)}氛围图" />
          <div class="script-body">
            <p class="eyebrow">${escapeHtml(script.en)} · ${escapeHtml(script.level)}</p>
            <h3>${escapeHtml(script.name)}</h3>
            <p>${escapeHtml(script.text)}</p>
            <div class="script-meta">
              <span class="tag">${escapeHtml(script.mood)}</span>
              ${script.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </a>
      `,
    )
    .join("");
}

function roleMatchesSearch(role, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    role.name,
    getRoleScriptLabel(role),
    typeLabels[role.type],
    role.summary,
    role.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function renderRoles() {
  const roleGrid = document.querySelector("#roleGrid");
  if (!roleGrid) {
    return;
  }

  const searchInput = document.querySelector("#searchInput");
  const query = searchInput?.value.trim() || "";
  const visibleRoles = sortCatalogRoles(
    state.roles.filter((role) => {
      const matchesFilter =
        state.activeFilter === "all" || role.type === state.activeFilter;
      return matchesFilter && roleMatchesSearch(role, query);
    }),
  );

  if (!visibleRoles.length) {
    roleGrid.innerHTML = `<div class="empty-state">没有找到匹配角色。换个关键词试试，比如“保护”“恶魔”“开局”。</div>`;
    return;
  }

  roleGrid.innerHTML = visibleRoles
    .map(
      (role) => `
        <a class="role-card" href="/roles/${escapeHtml(role.id)}" data-link data-type="${escapeHtml(role.type)}">
          <header>
            <h3>${escapeHtml(role.name)}</h3>
            <small>${escapeHtml(typeLabels[role.type] || role.type)}</small>
          </header>
          <p>${escapeHtml(role.summary)}</p>
          <div class="script-name">${escapeHtml(getRoleScriptLabel(role))}</div>
        </a>
      `,
    )
    .join("");
}

function syncFilterButtons() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}

function renderScriptDetail(id) {
  const script = getScriptById(id);

  if (!script) {
    renderNotFound("没有找到这个剧本。");
    return;
  }

  const roles = state.roles.filter((role) =>
    (role.scriptIds || [role.scriptId]).includes(script.id),
  );
  document.title = `${script.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero">
      <a class="back-link" href="/scripts" data-link>返回板子目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(script.en)} · ${escapeHtml(script.level)}</p>
          <h1>${escapeHtml(script.name)}</h1>
          <p class="lead">${escapeHtml(script.detail.overview)}</p>
          <div class="script-meta detail-tags">
            <span class="tag">${escapeHtml(script.mood)}</span>
            ${script.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <img class="detail-image" src="${escapeHtml(script.image)}" alt="${escapeHtml(script.name)}氛围图" />
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${detailBlock("适合玩家", script.detail.bestFor)}
        ${detailBlock("核心体验", script.detail.playStyle)}
        ${detailBlock("说书人提示", script.detail.storytellerNotes)}
        ${detailBlock("常见坑", script.detail.commonPitfalls)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">当前资料</p>
          <h2>${roles.length} 个已录入角色</h2>
          ${renderScriptRoleList(script, roles)}
        </section>
      </aside>
    </section>
  `;
}

function renderRoleDetail(id) {
  const role = getRoleById(id);

  if (!role) {
    renderNotFound("没有找到这个角色。");
    return;
  }

  const scripts = getScriptsForRole(role);
  const relatedRoles = (role.detail.relatedRoleIds || [])
    .map(getRoleById)
    .filter(Boolean);

  document.title = `${role.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero role-detail-hero" data-type="${escapeHtml(role.type)}">
      <a class="back-link" href="/roles" data-link>返回角色目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(getRoleScriptLabel(role))} · ${escapeHtml(typeLabels[role.type] || role.type)}</p>
          <h1>${escapeHtml(role.name)}</h1>
          <p class="lead">${escapeHtml(role.detail.overview)}</p>
          <div class="script-meta detail-tags">
            <span class="tag">${escapeHtml(typeLabels[role.type] || role.type)}</span>
            <span class="tag">${escapeHtml(typeDescriptions[role.type] || "角色资料")}</span>
          </div>
        </div>
        <div class="role-token">
          <span>${escapeHtml(role.name.slice(0, 1))}</span>
          <strong>${escapeHtml(typeLabels[role.type] || role.type)}</strong>
        </div>
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${abilityBlock(role)}
        ${detailBlock("玩家玩法提示", role.detail.playTips)}
        ${detailBlock("说书人注意", role.detail.storytellerTips)}
        ${detailBlock("常见误区", role.detail.commonMistakes)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">所属剧本</p>
          ${
            scripts.length
              ? compactListLinks(scripts, "scripts")
              : `<h2>${escapeHtml(getRoleScriptLabel(role))}</h2>`
          }
        </section>
        <section class="side-panel">
          <p class="eyebrow">关键词</p>
          ${renderKeywordLinks(role.keywords)}
        </section>
        <section class="side-panel">
          <p class="eyebrow">关联角色</p>
          ${compactListLinks(relatedRoles, "roles")}
        </section>
      </aside>
    </section>
  `;
}

function renderTermDetail(id) {
  const term = getTermById(id);

  if (!term) {
    renderNotFound("没有找到这个术语。");
    return;
  }

  const relatedTerms = (term.relatedTermIds || []).map(getTermById).filter(Boolean);
  const relatedRoles = (term.relatedRoleIds || []).map(getRoleById).filter(Boolean);

  document.title = `${term.name} · 血染钟楼百科`;
  app.innerHTML = `
    <section class="detail-hero term-detail-hero">
      <a class="back-link" href="/terms" data-link>返回术语目录</a>
      <div class="detail-hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(term.category)}</p>
          <h1>${escapeHtml(term.name)}</h1>
          <p class="lead">${escapeHtml(term.detail.overview)}</p>
          ${
            (term.aliases || []).length
              ? `<div class="script-meta detail-tags">${term.aliases.map((alias) => `<span class="tag">${escapeHtml(alias)}</span>`).join("")}</div>`
              : ""
          }
        </div>
        <div class="term-token">
          <span>${escapeHtml(term.name.slice(0, 1))}</span>
          <strong>${escapeHtml(term.category)}</strong>
        </div>
      </div>
    </section>

    <section class="detail-layout">
      <article class="detail-main">
        ${detailBlock("怎么理解", term.detail.howItWorks)}
        ${detailBlock("常见误区", term.detail.commonMistakes)}
        ${detailBlock("实战提示", term.detail.examples)}
      </article>

      <aside class="detail-side">
        <section class="side-panel">
          <p class="eyebrow">关联术语</p>
          ${compactListLinks(relatedTerms, "terms")}
        </section>
        <section class="side-panel">
          <p class="eyebrow">关联角色</p>
          ${compactListLinks(relatedRoles, "roles")}
        </section>
      </aside>
    </section>
  `;
}

function renderNotFound(message = "这个页面不存在。") {
  document.title = "未找到 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">404</p>
      <h1>${escapeHtml(message)}</h1>
      <p class="lead">可能是链接写错了，也可能是这条资料还没录入。</p>
      <a class="primary-link" href="/" data-link>回到百科首页</a>
    </section>
  `;
}

function renderLoadError() {
  document.title = "资料加载失败 · 血染钟楼百科";
  app.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">加载失败</p>
      <h1>资料加载失败。</h1>
      <p class="lead">请确认后端服务正在运行，然后刷新页面。</p>
    </section>
  `;
}

function scrollToHash() {
  if (!window.location.hash) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  requestAnimationFrame(() => {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView();
    }
  });
}

function renderRoute() {
  const segments = window.location.pathname.split("/").filter(Boolean);

  if (!segments.length) {
    renderHome();
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (segments.length === 1 && segments[0] === "scripts") {
    renderScriptIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "roles") {
    renderRoleIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "terms") {
    renderTermIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "notes") {
    renderNotesPage();
    return;
  }

  if (segments.length === 2 && segments[0] === "scripts") {
    renderScriptDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "roles") {
    renderRoleDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "terms") {
    renderTermDetail(segments[1]);
    return;
  }

  renderNotFound();
}

function navigateTo(url) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (url !== current) {
    window.history.pushState({}, "", url);
  }
  renderRoute();
}

async function loadEncyclopedia() {
  try {
    const response = await fetch("/api/encyclopedia");
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    state.rules = data.rules || [];
    state.scripts = data.scripts || [];
    state.roles = data.roles || [];
    state.terms = data.terms || [];
    renderRoute();
  } catch (error) {
    console.error(error);
    renderLoadError();
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) {
    return;
  }

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  navigateTo(`${url.pathname}${url.search}${url.hash}`);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) {
    return;
  }

  state.activeFilter = button.dataset.filter;
  syncFilterButtons();
  renderRoles();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notes-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  handleNotesAction(button);
});

document.addEventListener("input", (event) => {
  if (event.target.id === "searchInput") {
    renderRoles();
    return;
  }

  if (event.target.closest(".notes-workspace")) {
    handleNotesFieldChange(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.closest(".notes-workspace")) {
    handleNotesFieldChange(event.target, true);
  }
});

window.addEventListener("popstate", renderRoute);

loadEncyclopedia();
