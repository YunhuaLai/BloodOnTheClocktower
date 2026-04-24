function formatPhaseLabel(phaseType, phaseNumber) {
  return `${getOptionLabel(phaseTypeOptions, phaseType)} ${phaseNumber}`;
}

const abilityPageTypeLabels = {
  no_input: "无录入",
  record_result_only: "只记结果",
  pick_and_record: "选择并记录",
  event_triggered: "事件触发",
  rule_modifier: "规则型",
};

const abilityPhaseTimingLabels = {
  setup: "开局",
  first_night: "首夜",
  each_night: "每晚",
  each_night_star: "每晚*",
  night: "夜间",
  day: "白天",
  each_day: "每天",
  passive: "被动",
  special: "特殊",
};

const abilityEventTimingLabels = {
  on_nomination: "提名时",
  on_execution: "处决时",
  on_death: "死亡时",
  on_attack: "受袭时",
  on_vote: "投票时",
  endgame: "残局",
};

const abilityUsagePatternLabels = {
  once: "一次",
  once_per_game: "本局一次",
  once_per_day: "每天一次",
  once_per_night: "每晚一次",
  repeatable: "可重复",
  passive: "被动",
  variable: "不固定",
};

const abilityActivationModeLabels = {
  active: "主动",
  passive: "被动",
  conditional: "条件触发",
  reactive: "响应触发",
};

const abilityValueLabels = {
  yes: "是",
  no: "否",
  good: "好",
  evil: "坏",
  sober: "清",
  poisoned: "毒",
  drunk: "醉",
  self: "自己",
  target: "目标",
  unknown: "?",
};

function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

function getClaimedRole(playerOrClaim, game = getActiveGame()) {
  const claim =
    typeof playerOrClaim === "string"
      ? playerOrClaim
      : playerOrClaim?.claim;
  const normalizedClaim = normalizeRoleName(claim);
  if (!normalizedClaim) {
    return null;
  }

  const roleOptions = game ? getClaimRoleOptions(game) : state.roles;
  const matchRole = (role) =>
    [role.name, role.en, role.id].some(
      (name) => normalizeRoleName(name) === normalizedClaim,
    );

  return roleOptions.find(matchRole) || state.roles.find(matchRole) || null;
}

function getRoleAbilityData(playerOrClaim, game = getActiveGame()) {
  return getClaimedRole(playerOrClaim, game)?.abilityData || null;
}

function getRoleInfoNode(abilityData, sectionKey) {
  const node = abilityData?.interactionSchema?.[sectionKey];
  return {
    repeatMode: node?.repeatMode || "none",
    defaultRows: clampNumber(Number(node?.defaultRows) || 0, 0, 99),
    fields: Array.isArray(node?.fields) ? node.fields : [],
  };
}

function isRoleInfoEntryFilled(entry) {
  return Object.values(entry || {}).some((value) => String(value ?? "").trim());
}

function normalizeLegacyBooleanValue(value) {
  const normalized = normalizeRoleName(value);
  if (["yes", "true", "1", "是"].includes(normalized)) {
    return "yes";
  }

  if (["no", "false", "0", "否"].includes(normalized)) {
    return "no";
  }

  return String(value || "").trim();
}

function migrateLegacyRoleInfo(roleInfo, role, abilityData) {
  const legacyEntries = Array.isArray(roleInfo?.entries) ? roleInfo.entries : [];
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const nextRoleInfo = createEmptyRoleInfo(role?.id || "");

  if (roleInfo?.profile === "yes-no-seq") {
    const resultKey = resultNode.fields[0]?.key || "answer";
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultKey]: normalizeLegacyBooleanValue(entry?.value),
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "seat-seq") {
    const targetKey = targetNode.fields[0]?.key || "seat";
    nextRoleInfo.targetEntries = legacyEntries.map((entry) => ({
      [targetKey]: String(entry?.seat || "").trim(),
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "digit-seq") {
    const resultKey = resultNode.fields[0]?.key || "count";
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultKey]: entry?.value ?? "",
    }));
    return nextRoleInfo;
  }

  if (roleInfo?.profile === "seat-pair-alignment") {
    const targetKey = targetNode.fields[0]?.key || "seat";
    nextRoleInfo.targetEntries = legacyEntries.map((entry) => ({
      [targetKey]: String(entry?.seat || "").trim(),
    }));
    nextRoleInfo.resultEntries = legacyEntries.map((entry) => ({
      [resultNode.fields[0]?.key || "first"]: entry?.first || "",
      [resultNode.fields[1]?.key || "second"]: entry?.second || "",
    }));
    return nextRoleInfo;
  }

  return nextRoleInfo;
}

function ensureRoleInfoMatchesClaim(player, game = getActiveGame()) {
  const role = getClaimedRole(player, game);
  const abilityData = role?.abilityData || null;
  const current = cloneRoleInfo(player?.roleInfo);

  if (!role || !abilityData?.abilityMeta?.recordable) {
    return createEmptyRoleInfo(role?.id || "");
  }

  if (current.version === 2) {
    if (current.roleId && current.roleId !== role.id) {
      return createEmptyRoleInfo(role.id);
    }

    if (!current.profile && !current.entries.length) {
      return {
        version: 2,
        roleId: role.id,
        targetEntries: cloneRoleInfoEntries(current.targetEntries),
        resultEntries: cloneRoleInfoEntries(current.resultEntries),
      };
    }
  }

  return migrateLegacyRoleInfo(current, role, abilityData);
}

function getRoleInfoEntries(roleInfo, sectionKey) {
  if (sectionKey === "target") {
    return cloneRoleInfoEntries(roleInfo?.targetEntries);
  }

  return cloneRoleInfoEntries(roleInfo?.resultEntries);
}

function getDisplayedRoleInfoEntries(roleInfo, node, sectionKey) {
  const entries = getRoleInfoEntries(roleInfo, sectionKey);
  if (node.repeatMode === "none" || !node.fields.length) {
    return [];
  }

  const minimumRows =
    node.repeatMode === "once"
      ? Math.max(node.defaultRows || 0, 1)
      : Math.max(node.defaultRows || 0, 1);
  const totalRows = Math.max(entries.length, minimumRows);

  return Array.from({ length: totalRows }, (_, index) => entries[index] || {});
}

function getAbilityTimingText(abilityMeta) {
  if (abilityMeta?.eventTiming) {
    return abilityEventTimingLabels[abilityMeta.eventTiming] || "";
  }

  if (abilityMeta?.phaseTiming) {
    return abilityPhaseTimingLabels[abilityMeta.phaseTiming] || "";
  }

  return "";
}

function getAbilityMetaSummary(abilityData) {
  const meta = abilityData?.abilityMeta || {};
  return [
    abilityPageTypeLabels[meta.pageType] || "",
    getAbilityTimingText(meta),
    abilityUsagePatternLabels[meta.usagePattern] || "",
    abilityActivationModeLabels[meta.activationMode] || "",
  ]
    .filter(Boolean)
    .join(" / ");
}

function getChoiceLabel(value) {
  const normalized = normalizeRoleName(value);
  if (abilityValueLabels[normalized]) {
    return abilityValueLabels[normalized];
  }

  if (typeLabels[normalized]) {
    return typeLabels[normalized];
  }

  return String(value || "");
}

function getCompactFieldValue(field, value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const normalized = normalizeRoleName(text);

  if (field.type === "role") {
    return getClaimAbbreviation(text);
  }

  if (field.type === "seat" || field.type === "player" || field.type === "number") {
    return text;
  }

  if (field.type === "team" || field.type === "boolean" || field.type === "status") {
    return getChoiceLabel(normalized);
  }

  if (field.type === "character_type") {
    return typeLabels[normalized] || text;
  }

  if (field.type === "choice") {
    return getChoiceLabel(normalized);
  }

  return text.replace(/\s+/g, "").slice(0, 8);
}

function formatRoleInfoEntrySummary(entry, fields) {
  if (!fields.length || !isRoleInfoEntryFilled(entry)) {
    return "";
  }

  return fields
    .map((field) => getCompactFieldValue(field, entry?.[field.key]))
    .filter(Boolean)
    .join(",");
}

function getRoleInfoSummary(player, game = getActiveGame()) {
  const abilityData = getRoleAbilityData(player, game);
  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const targetEntries = getRoleInfoEntries(roleInfo, "target");
  const resultEntries = getRoleInfoEntries(roleInfo, "result");
  const rowCount = Math.max(targetEntries.length, resultEntries.length);

  if (!abilityData?.abilityMeta?.recordable || !rowCount) {
    return "--";
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const targetText = formatRoleInfoEntrySummary(targetEntries[index], targetNode.fields);
    const resultText = formatRoleInfoEntrySummary(resultEntries[index], resultNode.fields);
    if (!targetText && !resultText) {
      continue;
    }

    rows.push([targetText, resultText].filter(Boolean).join(">"));
  }

  return rows.length ? rows.join("/") : "--";
}

function getRoleInfoSectionLabel(sectionKey, abilityData) {
  const pageType = abilityData?.abilityMeta?.pageType;
  if (sectionKey === "target") {
    if (pageType === "event_triggered") {
      return "触发对象";
    }

    return "目标";
  }

  if (pageType === "record_result_only") {
    return "结果";
  }

  if (pageType === "event_triggered") {
    return "触发结果";
  }

  return "记录";
}

function getRoleInfoFieldOptions(field, game) {
  if (field.type === "role") {
    return getClaimRoleOptions(game).map((role) => ({
      value: role.name,
      label: role.name,
    }));
  }

  if (field.type === "team") {
    return [
      { value: "good", label: "好" },
      { value: "evil", label: "坏" },
    ];
  }

  if (field.type === "character_type") {
    return roleTypeOrder
      .filter((type) => type !== "fabled")
      .map((type) => ({
        value: type,
        label: typeLabels[type] || type,
      }));
  }

  if (field.type === "status") {
    return [
      { value: "sober", label: "清" },
      { value: "poisoned", label: "毒" },
      { value: "drunk", label: "醉" },
    ];
  }

  if (field.type === "boolean" || field.type === "choice") {
    const optionValues =
      Array.isArray(field.options) && field.options.length
        ? field.options
        : field.type === "boolean"
          ? ["yes", "no"]
          : [];

    return optionValues.map((value) => ({
      value: String(value),
      label: getChoiceLabel(value),
    }));
  }

  return [];
}

function renderRoleInfoFieldControl(sectionKey, rowIndex, field, value, game, maxSeat) {
  const currentValue = String(value ?? "");
  const sharedData = `
    data-roleinfo-section="${escapeHtml(sectionKey)}"
    data-roleinfo-row="${rowIndex}"
    data-roleinfo-field="${escapeHtml(field.key)}"
  `;

  if (["role", "team", "character_type", "status", "boolean", "choice"].includes(field.type)) {
    const options = getRoleInfoFieldOptions(field, game);
    const hasCurrentValue =
      currentValue &&
      options.some((option) => String(option.value) === currentValue);
    const extraCurrentOption =
      currentValue && !hasCurrentValue
        ? `<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(currentValue)}</option>`
        : "";

    return `
      <label class="notes-roleinfo-field">
        <span>${escapeHtml(field.label)}</span>
        <select ${sharedData}>
          <option value="">空</option>
          ${extraCurrentOption}
          ${options
            .map(
              (option) =>
                `<option value="${escapeHtml(option.value)}"${String(option.value) === currentValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  const isNumericField = ["seat", "player", "number"].includes(field.type);
  const inputType = isNumericField ? "number" : "text";
  const minValue =
    field.type === "seat" || field.type === "player"
      ? 1
      : field.min ?? "";
  const maxValue =
    field.type === "seat" || field.type === "player"
      ? maxSeat
      : field.max ?? "";

  return `
    <label class="notes-roleinfo-field">
      <span>${escapeHtml(field.label)}</span>
      <input
        type="${inputType}"
        ${minValue !== "" ? `min="${minValue}"` : ""}
        ${maxValue !== "" ? `max="${maxValue}"` : ""}
        ${isNumericField ? 'step="1"' : ""}
        value="${escapeHtml(currentValue)}"
        placeholder="${escapeHtml(field.placeholder || field.label)}"
        ${sharedData}
      />
    </label>
  `;
}

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
        <p class="notes-inline-hint">当前身份还没有匹配到角色数据，先用额外信息或详细记录补充。</p>
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
              这个身份目前更偏规则效果，先用“额外信息”或“详细记录”补充关键点。
            </div>
          `
      }
    </section>
  `;
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

function getOverviewSecondaryTextLegacy(player) {
  if (player.extraInfo) {
    return String(player.extraInfo).trim().replace(/\s+/g, " ");
  }

  if (player.notes) {
    return player.notes.split(/\r?\n/)[0].trim().replace(/\s+/g, " ");
  }

  return "--";
}

function getClaimAbbreviation(claim) {
  const text = String(claim || "").trim();
  if (!text) {
    return "--";
  }

  const compact = text.replace(/\s+/g, "");
  const chineseMatches = compact.match(/[\u4e00-\u9fff]/g);
  if (chineseMatches?.length) {
    return chineseMatches.slice(0, 2).join("");
  }

  if (compact.includes("-")) {
    return compact
      .split("-")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  return compact.slice(0, 2).toUpperCase();
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
        <div class="notes-stagebar-phase">
          <button
            type="button"
            class="notes-stagebar-button"
            data-notes-action="advance-phase"
            data-step="-1"
            aria-label="上一阶段"
          >-</button>
          <strong>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))}</strong>
          <button
            type="button"
            class="notes-stagebar-button"
            data-notes-action="advance-phase"
            data-step="1"
            aria-label="下一阶段"
          >+</button>
        </div>
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
      <select
        class="notes-player-field"
        data-player-id="${escapeHtml(player.id)}"
        data-field="claim"
        aria-label="按剧本选择自称身份"
      >
        <option value="">${script ? `《${script.name}》角色` : "先选剧本"}</option>
        ${roleOptions
          .map(
            (role) =>
              `<option value="${escapeHtml(role.name)}"${role.name === player.claim ? " selected" : ""}>${escapeHtml(role.name)}</option>`,
          )
          .join("")}
      </select>
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
              placeholder="可不填，默认用编号"
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
            <button type="button" class="secondary-link" data-notes-action="cancel-create">返回记录局</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderNotesHome(notes) {
  document.title = "记录局";
  app.innerHTML = `
    <section class="notes-home">
      <div class="notes-home-panel">
        <p class="eyebrow">记录局</p>
        <h1>先选你要做什么</h1>
        <div class="notes-home-actions">
          <button type="button" class="primary-link" data-notes-action="new-game">新建记录</button>
          ${
            notes.games.length
              ? `<button type="button" class="secondary-link" data-notes-action="view-saved">查看已保存</button>`
              : ""
          }
        </div>
      </div>

      ${
        notes.games.length
          ? `
            <section class="notes-home-saved" id="notesSavedSection">
              <div class="notes-panel-header">
                <div>
                  <p class="eyebrow">已保存</p>
                  <h2>继续上次的对局</h2>
                </div>
              </div>
              <div class="notes-saved-list">
                ${notes.games
                  .map((game) => {
                    const aliveCount = getAliveCount(game);
                    return `
                      <button
                        type="button"
                        class="notes-saved-card"
                        data-notes-action="open-game"
                        data-game-id="${escapeHtml(game.id)}"
                      >
                        <strong>${escapeHtml(game.title)}</strong>
                        <span>${escapeHtml(game.scriptName || "未选剧本")}</span>
                        <small>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))} / 存活 ${aliveCount} / ${game.playerCount}</small>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `
          : `
            <section class="notes-home-empty">
              <p>还没有已保存的记录，先新建一局。</p>
            </section>
          `
      }
    </section>
  `;
}

function renderOverviewActions() {
  return `
    <div class="notes-overview-actions">
      <button type="button" class="primary-link" data-notes-action="save-game">保存</button>
      <button type="button" class="secondary-link" data-notes-action="go-home">返回</button>
      <button type="button" class="secondary-link danger" data-notes-action="delete-game">删除</button>
    </div>
  `;
}

function renderOverviewRows(game) {
  return game.players
    .map((player) => {
      const isSelf = player.seat === game.selfSeat;
      const claimText = getClaimAbbreviation(player.claim);
      const summaryText = getRoleInfoSummary(player, game);
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

function getSeatLabel(player) {
  return `${player.seat}号位`;
}

function getOverviewSecondaryText(player) {
  if (player.extraInfo) {
    return String(player.extraInfo).trim().replace(/\s+/g, " ");
  }

  return "--";
}

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

  if (notes.ui.screen === "setup") {
    renderSetupPage(notes);
    return;
  }

  if (notes.ui.screen !== "game" || !game) {
    renderNotesHome(notes);
    return;
  }

  renderGamePage(notes, game);
}
