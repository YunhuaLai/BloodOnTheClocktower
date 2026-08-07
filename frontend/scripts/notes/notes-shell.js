import { filterRoleOptions, findCatalogRole, getAvailableTravellerOptions, getBaseRoleOptions, getClaimRoleOptions, getCustomRoleOptionsFromIds, getFabledRoleOptions, getRoomFabledRoleOptions, getRoomRoleOptions, getRoomTokenRoleOptions, getGameScript, getSetupFabledRoleOptions, isBaseRole, isCustomRoleGame, isFabledRole, renderAllRoleNameDatalist, renderFabledRoleNameDatalist, renderRoleNameDatalist, renderScriptNameDatalist, renderTravellerRoleNameDatalist } from "../notes-claims.js";
import { createDefaultSetupDraft, ensureNotesState, getActiveGame, getDraftOrPlayer } from "../notes-state.js";
import { getJinxesForRoleIds, getJinxRoleLabel, isJinxObservedForRoleIds } from "../catalog-helpers.js";
import { app, noteModeOptions, noteTabOptions, roleTypeOrder, scriptModeOptions, state, typeLabels } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel, getAliveCount, getStandardSetup, getTotalPlayerCount, getTravellerPlayers } from "./notes-core.js";
import { renderOverviewTab } from "./notes-overview-render.js";
import { renderPlayersTab } from "./notes-player-render.js";
import { getClaimedRole } from "./notes-role-info.js";
import { renderStorytellerTab } from "./notes-storyteller-render.js";
import { renderInferenceTab, renderTimelineTab } from "./notes-timeline-render.js";

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
            ${game.phaseType === "night" && Number(game.phaseNumber) <= 1 ? "disabled" : ""}
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
        <strong>${aliveCount} / ${getTotalPlayerCount(game)}</strong>
      </div>
    </header>
  `;
}

function getOverviewClaimedRoleIds(game) {
  return new Set(
    game.players
      .map((player) => getClaimedRole(getDraftOrPlayer(player), game)?.id || "")
      .filter(Boolean),
  );
}

function renderScriptSheetRole(role, selectedRoleIds) {
  const isSelected = selectedRoleIds.has(role.id);
  return `
    <article class="notes-script-sheet-role${isSelected ? " is-selected" : ""}">
      <div class="notes-script-sheet-role-title">
        <strong>${escapeHtml(role.name)}</strong>
        <span>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</span>
      </div>
      <p>${escapeHtml(role.ability || role.detail?.abilitySummary || "无能力文本")}</p>
    </article>
  `;
}

function getObservedRoomRoleIds(game) {
  const roleOptions = getClaimRoleOptions(game);
  const roleIds = getOverviewClaimedRoleIds(game);

  game.players.forEach((player) => {
    const draft = getDraftOrPlayer(player);
    const trueRole = findCatalogRole(draft.trueRole, roleOptions);
    if (trueRole?.id) {
      roleIds.add(trueRole.id);
    }
  });

  return roleIds;
}

function renderScriptSheetJinxRules(jinxes, observedRoleIds) {
  if (!jinxes.length) {
    return "";
  }

  return `
    <section class="notes-script-sheet-jinxes">
      <h4>相克规则</h4>
      <div class="notes-script-sheet-jinx-list">
        ${jinxes
          .map((jinx) => {
            const isObserved = isJinxObservedForRoleIds(jinx, observedRoleIds);
            const roleLabel = getJinxRoleLabel(jinx) || jinx.name;
            return `
              <article class="notes-script-sheet-jinx${isObserved ? " is-observed" : ""}">
                <div>
                  <strong>${escapeHtml(jinx.name || roleLabel)}</strong>
                  <small>${escapeHtml(roleLabel || "相克规则")}</small>
                </div>
                ${isObserved ? `<span>已出现</span>` : ""}
                <p>${escapeHtml(jinx.rule || "暂无规则文本。")}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderScriptSheetOverlay(game) {
  if (!state.notes.ui.scriptSheetOpen) {
    return "";
  }

  const script = getGameScript(game);
  const isCustom = isCustomRoleGame(game);
  const roles = getRoomRoleOptions(game);
  const selectedRoleIds = getOverviewClaimedRoleIds(game);
  const observedRoleIds = getObservedRoomRoleIds(game);
  const jinxes = getJinxesForRoleIds(roles.map((role) => role.id), {
    sourceScriptId: script?.id || "",
  });
  const groupedRoles = roleTypeOrder
    .map((type) => ({
      type,
      roles: roles.filter((role) => role.type === type),
    }))
    .filter((group) => group.roles.length);

  return `
    <div
      class="notes-script-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="查看当前剧本角色"
    >
      <button
        type="button"
        class="notes-script-sheet-backdrop"
        data-notes-action="close-script-sheet"
        aria-label="关闭剧本角色"
      ></button>
      <section class="notes-script-sheet-panel">
        <header class="notes-script-sheet-header">
          <div>
            <p class="eyebrow">${isCustom ? "自定义角色池" : "当前剧本"}</p>
            <h3>${escapeHtml(script?.name || game.scriptName || "可选角色")}</h3>
          </div>
          <button
            type="button"
            class="note-icon-button"
            data-notes-action="close-script-sheet"
          >关闭</button>
        </header>
        <div class="notes-script-sheet-grid">
          ${groupedRoles
            .map(
              (group) => `
                <section class="notes-script-sheet-group notes-script-sheet-group--${escapeHtml(group.type)}">
                  <h4>${escapeHtml(typeLabels[group.type] || group.type)}</h4>
                  <div class="notes-script-sheet-roles">
                    ${group.roles
                      .map((role) => renderScriptSheetRole(role, selectedRoleIds))
                      .join("")}
                  </div>
                </section>
              `,
            )
            .join("")}
        </div>
        ${renderScriptSheetJinxRules(jinxes, observedRoleIds)}
      </section>
    </div>
  `;
}

function renderRoomRoleChip(role, extra = "") {
  return `
    <span class="notes-room-role-chip notes-room-role-chip--${escapeHtml(role.type || "unknown")}">
      <strong>${escapeHtml(role.name)}</strong>
      <small>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</small>
      ${extra}
    </span>
  `;
}

function renderRoomRoleTools(game) {
  const fabledRoles = getRoomFabledRoleOptions(game);
  const tokenRoles = getRoomTokenRoleOptions(game);
  const travellerPlayers = getTravellerPlayers(game);
  const travellerOptions = getAvailableTravellerOptions(game);
  const emptyFabledText = isCustomRoleGame(game) ? "可在创建时添加。" : "当前剧本无传奇。";

  return `
    <section class="notes-room-role-tools">
      <div class="notes-room-role-section">
        <div class="notes-room-role-header">
          <strong>传奇角色</strong>
          <span>${fabledRoles.length ? `${fabledRoles.length} 个已启用` : "未启用"}</span>
        </div>
        ${
          fabledRoles.length
            ? `<div class="notes-room-role-list">${fabledRoles.map((role) => renderRoomRoleChip(role)).join("")}</div>`
            : `<p class="notes-room-role-empty">${emptyFabledText}</p>`
        }
      </div>
      ${
        tokenRoles.length
          ? `
            <div class="notes-room-role-section">
              <div class="notes-room-role-header">
                <strong>\u6807\u8bb0</strong>
                <span>${tokenRoles.length} \u4e2a\u5267\u672c\u6807\u8bb0</span>
              </div>
              <div class="notes-room-role-list">${tokenRoles.map((role) => renderRoomRoleChip(role)).join("")}</div>
            </div>
          `
          : ""
      }
      <div class="notes-room-role-section">
        <div class="notes-room-role-header">
          <strong>旅行者</strong>
          <span>${travellerPlayers.length ? `${travellerPlayers.length} 位在场` : "可在开局后加入"}</span>
        </div>
        ${
          travellerPlayers.length
            ? `
              <div class="notes-room-role-list">
                ${travellerPlayers
                  .map((player) =>
                    renderRoomRoleChip(
                      { name: `${player.seat}号 ${player.claim || player.trueRole || "旅行者"}`, type: "traveller" },
                      `<button type="button" data-notes-action="remove-traveller" data-player-id="${escapeHtml(player.id)}" aria-label="${escapeHtml(`移除${player.seat}号旅行者`)}">×</button>`,
                    ),
                  )
                  .join("")}
              </div>
            `
            : ""
        }
        <div class="notes-room-role-control">
          <label class="note-field">
            <span>添加旅行者</span>
            <input
              id="travellerRoleInput"
              list="travellerRoleNameList"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="${travellerOptions.length ? "输入旅行者角色" : "无旅行者"}"
              ${travellerOptions.length ? "" : "disabled"}
            />
          </label>
          <button type="button" class="note-icon-button" data-notes-action="add-traveller" ${travellerOptions.length ? "" : "disabled"}>添加</button>
        </div>
      </div>
    </section>
  `;
}

function renderGameMeta(game) {
  const config = getStandardSetup(game.playerCount);
  const script = getGameScript(game);
  const isCustom = isCustomRoleGame(game);
  const roleCount = getRoomRoleOptions(game).length;
  const travellerCount = getTravellerPlayers(game).length;
  const showScriptButton = state.notes.ui.activeTab === "overview";

  return `
    <section class="notes-game-meta">
      <div class="notes-game-meta-top">
        <div class="notes-game-meta-title">
          <p class="eyebrow">当前局</p>
          <h1>${escapeHtml(game.title)}</h1>
        </div>
        ${
          showScriptButton
            ? `
              <button
                type="button"
                class="note-icon-button notes-script-sheet-button"
                data-notes-action="toggle-script-sheet"
                ${script || roleCount ? "" : "disabled"}
              >${isCustom ? "角色池" : "剧本"}</button>
            `
            : ""
        }
      </div>
      <p class="notes-game-meta-line">
        ${game.playerCount} 人 / 镇民 ${config.townsfolk} / 外来者 ${config.outsider} / 爪牙 ${config.minion} / 恶魔 ${config.demon}
      </p>
      <p class="notes-game-meta-line">
        ${escapeHtml(game.scriptName || (isCustom ? "自定义角色池" : "未选剧本"))} / ${escapeHtml(getOptionLabel(noteModeOptions, game.mode))}${isCustom ? ` / ${roleCount} 个角色` : ""}${travellerCount ? ` / 旅行者 ${travellerCount}` : ""}
      </p>
      ${renderRoomRoleTools(game)}
    </section>
    ${showScriptButton ? renderScriptSheetOverlay(game) : ""}
  `;
}

function renderSetupSeatOptions(playerCount, selectedSeat) {
  return Array.from({ length: playerCount }, (_, index) => {
    const seat = index + 1;
    return `<option value="${seat}"${seat === selectedSeat ? " selected" : ""}>${seat}号位</option>`;
  }).join("");
}

function renderCustomRoleChip(role) {
  return `
    <button
      type="button"
      class="notes-custom-role-chip notes-custom-role-chip--${escapeHtml(role.type || "unknown")}"
      data-notes-action="remove-custom-role"
      data-role-id="${escapeHtml(role.id)}"
      aria-label="${escapeHtml(`移除${role.name}`)}"
    >
      <span>${escapeHtml(role.name)}</span>
      <small>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</small>
      <strong aria-hidden="true">×</strong>
    </button>
  `;
}

function renderCustomRoleGroups(draft) {
  const selectedRoles = getCustomRoleOptionsFromIds(draft.customRoleIds, isBaseRole);
  if (!selectedRoles.length) {
    return `<div class="notes-custom-role-empty">未添加角色。</div>`;
  }

  return `
    <div class="notes-custom-role-groups">
      ${roleTypeOrder
        .map((type) => {
          const roles = selectedRoles.filter((role) => role.type === type);
          if (!roles.length) {
            return "";
          }

          return `
            <section class="notes-custom-role-group notes-custom-role-group--${escapeHtml(type)}">
              <h3>${escapeHtml(typeLabels[type] || type)} <span>${roles.length}</span></h3>
              <div class="notes-custom-role-chips">
                ${roles.map(renderCustomRoleChip).join("")}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderSetupRolePickerResults(
  roles,
  selectedRoleIds,
  action,
  emptyText,
  limit,
) {
  const visibleRoles = roles.slice(0, limit);
  const selected = new Set(selectedRoleIds || []);
  return `
    <div class="notes-role-picker-summary">
      <span>匹配 ${roles.length} 个，显示 ${visibleRoles.length} 个</span>
      ${roles.length > limit ? `<small>请继续输入关键词缩小范围</small>` : ""}
    </div>
    <div class="notes-role-picker-results">
      ${
        visibleRoles.length
          ? visibleRoles
              .map(
                (role) => `
                  <button
                    type="button"
                    class="notes-role-picker-item notes-role-picker-item--${escapeHtml(role.type || "unknown")}${selected.has(role.id) ? " is-selected" : ""}"
                    data-notes-action="${escapeHtml(action)}"
                    data-role-id="${escapeHtml(role.id)}"
                    aria-pressed="${selected.has(role.id) ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(role.name)}</strong>
                    <small>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</small>
                  </button>
                `,
              )
              .join("")
          : `<p class="notes-custom-role-empty">${escapeHtml(emptyText)}</p>`
      }
    </div>
  `;
}

function renderCustomRoleBuilder(draft) {
  const allRoles = getBaseRoleOptions();
  const selectedCount = getCustomRoleOptionsFromIds(draft.customRoleIds, isBaseRole).length;
  const matches = filterRoleOptions(
    allRoles,
    draft.customRoleQuery,
    draft.customRoleType,
  );

  return `
    <section class="notes-custom-roles">
      <div class="notes-custom-role-header">
        <div>
          <strong>自定义角色池</strong>
          <span>${selectedCount} / ${allRoles.length}</span>
        </div>
      </div>
      <div class="notes-custom-role-copy">
        <label class="note-field">
          <span>从已有剧本复制</span>
          <input
            data-setup-field="sourceScriptName"
            value="${escapeHtml(draft.sourceScriptName || "")}"
            list="scriptNameList"
            autocomplete="off"
            placeholder="输入剧本名"
          />
        </label>
        <button type="button" class="note-icon-button" data-notes-action="copy-script-roles">复制角色</button>
      </div>
      ${renderScriptNameDatalist()}
      <div class="notes-role-picker-filters">
        <label class="note-field">
          <span>搜索角色</span>
          <input
            id="customRoleInput"
            name="customRoleQuery"
            data-setup-field="customRoleQuery"
            value="${escapeHtml(draft.customRoleQuery || "")}"
            list="allRoleNameList"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="输入角色名"
          />
        </label>
        <label class="note-field">
          <span>角色类型</span>
          <select data-setup-field="customRoleType">
            <option value="all"${draft.customRoleType === "all" ? " selected" : ""}>全部类型</option>
            ${roleTypeOrder
              .filter((type) => ["townsfolk", "outsider", "minion", "demon"].includes(type))
              .map(
                (type) =>
                  `<option value="${type}"${draft.customRoleType === type ? " selected" : ""}>${escapeHtml(typeLabels[type])}</option>`,
              )
              .join("")}
          </select>
        </label>
        <button type="button" class="note-icon-button" data-notes-action="refresh-custom-role-results">筛选</button>
      </div>
      <div class="notes-role-picker-actions">
        <button type="button" class="note-icon-button" data-notes-action="add-custom-role">添加精确匹配</button>
        <button type="button" class="note-icon-button" data-notes-action="add-filtered-custom-roles" ${matches.length ? "" : "disabled"}>批量添加当前显示</button>
        <button type="button" class="note-icon-button danger" data-notes-action="clear-custom-roles" ${selectedCount ? "" : "disabled"}>清空已选</button>
      </div>
      ${renderSetupRolePickerResults(matches, draft.customRoleIds, "toggle-setup-custom-role", "没有匹配角色。", 60)}
      ${renderAllRoleNameDatalist()}
      ${renderCustomRoleGroups(draft)}
    </section>
  `;
}

function renderFabledRoleGroups(draft) {
  const canEditFabled = isCustomRoleGame(draft);
  const selectedRoles = canEditFabled
    ? getCustomRoleOptionsFromIds(draft.fabledRoleIds, isFabledRole)
    : getSetupFabledRoleOptions(draft);
  if (!selectedRoles.length) {
    return `<div class="notes-custom-role-empty">未启用传奇。</div>`;
  }

  return `
    <div class="notes-custom-role-groups">
      <section class="notes-custom-role-group notes-custom-role-group--fabled">
        <h3>传奇角色 <span>${selectedRoles.length}</span></h3>
        <div class="notes-custom-role-chips">
          ${selectedRoles
            .map(
              (role) =>
                canEditFabled
                  ? `
                    <button
                      type="button"
                      class="notes-custom-role-chip notes-custom-role-chip--${escapeHtml(role.type || "unknown")}"
                      data-notes-action="remove-fabled-role"
                      data-role-id="${escapeHtml(role.id)}"
                      aria-label="${escapeHtml(`移除${role.name}`)}"
                    >
                      <span>${escapeHtml(role.name)}</span>
                      <small>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</small>
                      <strong aria-hidden="true">×</strong>
                    </button>
                  `
                  : `
                    <span class="notes-custom-role-chip notes-custom-role-chip--${escapeHtml(role.type || "unknown")}">
                      <span>${escapeHtml(role.name)}</span>
                      <small>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</small>
                    </span>
                  `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderFabledRoleBuilder(draft) {
  const canEditFabled = isCustomRoleGame(draft);
  const availableRoles = getSetupFabledRoleOptions(draft);
  const selectedCount = canEditFabled
    ? getCustomRoleOptionsFromIds(draft.fabledRoleIds, isFabledRole).length
    : availableRoles.length;
  const totalCount = canEditFabled ? getFabledRoleOptions().length : availableRoles.length;
  const matches = canEditFabled
    ? filterRoleOptions(availableRoles, draft.fabledRoleQuery)
    : [];

  return `
    <section class="notes-custom-roles notes-fabled-roles">
      <div class="notes-custom-role-header">
        <div>
          <strong>传奇角色</strong>
          <span>${selectedCount} / ${totalCount}</span>
        </div>
      </div>
      ${
        canEditFabled
          ? `
            <div class="notes-custom-role-control">
              <label class="note-field">
                <span>添加传奇角色</span>
                <input
                  id="fabledRoleInput"
                  name="fabledRoleQuery"
                  data-setup-field="fabledRoleQuery"
                  value="${escapeHtml(draft.fabledRoleQuery || "")}"
                  list="fabledRoleNameList"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  placeholder="输入传奇角色名"
                />
              </label>
              <button type="button" class="note-icon-button" data-notes-action="refresh-fabled-role-results">筛选</button>
            </div>
            <div class="notes-role-picker-actions">
              <button type="button" class="note-icon-button" data-notes-action="add-fabled-role">添加精确匹配</button>
              <button type="button" class="note-icon-button" data-notes-action="add-filtered-fabled-roles" ${matches.length ? "" : "disabled"}>批量添加当前显示</button>
            </div>
            ${renderSetupRolePickerResults(matches, draft.fabledRoleIds, "toggle-setup-fabled-role", "没有匹配传奇角色。", 40)}
            ${renderFabledRoleNameDatalist(availableRoles)}
          `
          : ""
      }
      ${renderFabledRoleGroups(draft)}
    </section>
  `;
}

function renderSetupPage(notes) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const config = getStandardSetup(draft.playerCount);
  const isStorytellerMode = draft.mode === "storyteller";
  const isCustomScriptMode = draft.scriptMode === "custom";
  const defaultTitle = `第 ${notes.games.length + 1} 局`;
  const displayTitle = String(draft.title || "").trim() || defaultTitle;

  document.title = "创建对局房间";
  app.innerHTML = `
    <section class="notes-setup">
      <div class="notes-setup-panel">
        <p class="eyebrow">对局房间</p>
        <h1>创建对局</h1>
        <p class="lead">选剧本、人数和视角。</p>

        <form id="notesSetupForm" class="notes-setup-form">
          <label class="note-field note-field--wide notes-setup-title-field">
            <span>局名</span>
            <input
              class="notes-setup-title-input"
              name="title"
              data-setup-field="title"
              value="${escapeHtml(displayTitle)}"
              aria-label="局名"
            />
          </label>

          <label class="note-field note-field--wide">
            <span>角色来源</span>
            <select name="scriptMode" data-setup-field="scriptMode">
              ${renderSelectOptions(scriptModeOptions, draft.scriptMode)}
            </select>
          </label>

          ${
            isCustomScriptMode
              ? `
                <label class="note-field note-field--wide">
                  <span>角色池名称</span>
                  <input
                    name="scriptName"
                    data-setup-field="scriptName"
                    value="${escapeHtml(draft.scriptName)}"
                    autocomplete="off"
                    placeholder="自定义角色池"
                  />
                </label>
                ${renderCustomRoleBuilder(draft)}
              `
              : `
                <label class="note-field note-field--wide">
                  <span>剧本</span>
                  <input
                    name="scriptName"
                    data-setup-field="scriptName"
                    value="${escapeHtml(draft.scriptName)}"
                    list="scriptNameList"
                    autocomplete="off"
                    placeholder="输入剧本名自动搜索"
                    required
                  />
                  ${renderScriptNameDatalist()}
                </label>
              `
          }

          ${renderFabledRoleBuilder(draft)}

          <label class="note-field note-field--wide">
            <span>记录视角</span>
            <select name="mode" data-setup-field="mode">
              ${renderSelectOptions(noteModeOptions, draft.mode)}
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

            ${
              isStorytellerMode
                ? `
                  <div class="notes-setup-static-field">
                    <span>自己所在位置</span>
                    <strong>说书人</strong>
                    <input type="hidden" name="selfSeat" value="1" />
                  </div>
                `
                : `
                  <label class="note-field">
                    <span>自己所在位置</span>
                    <select name="selfSeat" data-setup-field="selfSeat" required>
                      ${renderSetupSeatOptions(draft.playerCount, draft.selfSeat)}
                    </select>
                  </label>
                `
            }
          </div>

          <div class="notes-setup-preview">
            <span>镇民 ${config.townsfolk} / 外来者 ${config.outsider} / 爪牙 ${config.minion} / 恶魔 ${config.demon}</span>
          </div>

          <div class="notes-setup-actions">
            <button type="button" class="primary-link" data-notes-action="create-game">创建并进入对局</button>
            <button type="button" class="secondary-link" data-notes-action="cancel-create">返回对局房间</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderSavedGameCard(game, selectedGameIds) {
  const aliveCount = getAliveCount(game);
  const isSelected = selectedGameIds.includes(game.id);
  const isFavorite = Boolean(game.favorite);

  return `
    <article
      class="notes-saved-item${isSelected ? " is-selected" : ""}${isFavorite ? " is-favorite" : ""}"
      data-game-id="${escapeHtml(game.id)}"
    >
      <div class="notes-saved-swipe-actions notes-saved-swipe-actions--star" aria-hidden="true">
        <span>${isFavorite ? "取消星标" : "加星"}</span>
      </div>
      <div class="notes-saved-swipe-actions notes-saved-swipe-actions--delete" aria-hidden="true">
        <span>删除</span>
      </div>
      <div class="notes-saved-swipe" data-swipe-game-id="${escapeHtml(game.id)}">
        <label class="notes-saved-check" aria-label="选择对局">
          <input
            type="checkbox"
            data-notes-action="toggle-saved-selection"
            data-game-id="${escapeHtml(game.id)}"
            ${isSelected ? "checked" : ""}
          />
          <span></span>
        </label>
        <button
          type="button"
          class="notes-saved-star${isFavorite ? " is-active" : ""}"
          data-notes-action="toggle-game-favorite"
          data-game-id="${escapeHtml(game.id)}"
          aria-pressed="${isFavorite ? "true" : "false"}"
          aria-label="${isFavorite ? "取消星标" : "加星"}"
        >★</button>
        <button
          type="button"
          class="notes-saved-card"
          data-notes-action="open-game"
          data-game-id="${escapeHtml(game.id)}"
        >
          <strong>${escapeHtml(game.title)}</strong>
          <span>${escapeHtml(game.scriptName || "未选剧本")}</span>
          <small>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))} / 存活 ${aliveCount} / ${getTotalPlayerCount(game)}</small>
        </button>
        <button
          type="button"
          class="notes-saved-delete"
          data-notes-action="delete-saved-game"
          data-game-id="${escapeHtml(game.id)}"
          aria-label="删除对局"
        >删除</button>
      </div>
    </article>
  `;
}

function renderNotesHome(notes) {
  const selectedGameIds = state.notes.ui.selectedSavedGameIds || [];
  const savedGames = [...notes.games].sort((a, b) => {
    if (Boolean(a.favorite) !== Boolean(b.favorite)) {
      return a.favorite ? -1 : 1;
    }

    return (
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
    );
  });
  const selectedCount = selectedGameIds.length;

  document.title = "对局房间";
  app.innerHTML = `
    <section class="notes-home">
      <div class="notes-home-panel">
        <p class="eyebrow">对局房间</p>
        <h1>新建一局，或继续之前的对局</h1>
        <div class="notes-home-actions">
          <button type="button" class="primary-link" data-notes-action="new-game">创建对局</button>
          ${
            notes.games.length
              ? `<button type="button" class="secondary-link" data-notes-action="view-saved">查看已保存</button>`
              : ""
          }
          ${
            notes.games.length
              ? `<button type="button" class="secondary-link" data-notes-action="export-all-games">备份全部</button>`
              : ""
          }
          <button type="button" class="secondary-link" data-notes-action="import-games">导入备份</button>
          <input type="file" accept=".json,application/json" data-notes-import hidden />
        </div>
      </div>

      ${
        notes.games.length
          ? `
            <section class="notes-home-saved" id="notesSavedSection">
              <div class="notes-panel-header">
                <div>
                  <p class="eyebrow">已保存对局</p>
                  <h2>继续上次的对局</h2>
                </div>
                <div class="notes-saved-bulk-actions">
                  <button type="button" class="secondary-link" data-notes-action="select-all-saved-games">全选</button>
                  <button type="button" class="secondary-link" data-notes-action="clear-saved-selection" ${selectedCount ? "" : "disabled"}>清空</button>
                  <button type="button" class="secondary-link danger" data-notes-action="delete-selected-games" ${selectedCount ? `aria-label="删除已选择的 ${selectedCount} 个对局"` : "disabled"}>删除${selectedCount ? ` ${selectedCount}` : ""}</button>
                </div>
              </div>
              <div class="notes-saved-list">
                ${savedGames.map((game) => renderSavedGameCard(game, selectedGameIds)).join("")}
              </div>
            </section>
          `
          : `
            <section class="notes-home-empty">
              <p>暂无保存对局。</p>
            </section>
          `
      }
    </section>
  `;
}

function renderTabContent(game) {
  const tab = state.notes.ui.activeTab;

  if (tab === "storyteller") {
    return renderStorytellerTab(game);
  }

  if (game.mode === "storyteller" && tab !== "timeline") {
    state.notes.ui.activeTab = "storyteller";
    return renderStorytellerTab(game);
  }

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
  const game = getActiveGame();
  const tabs =
    game?.mode === "storyteller"
      ? [
          { value: "storyteller", label: "说书人" },
          noteTabOptions.find((tab) => tab.value === "timeline"),
        ]
          .filter(Boolean)
      : noteTabOptions;

  return `
    <nav class="notes-tabbar${game?.mode === "storyteller" ? " notes-tabbar--storyteller" : ""}" aria-label="记录页面">
      ${tabs
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
  document.title = `${game.title} · 对局房间`;
  app.innerHTML = `
    <section class="notes-shell">
      ${renderNotesStageBar(game)}
      ${renderGameMeta(game)}

      <main class="notes-tab-content">
        ${renderTabContent(game)}
      </main>

      ${renderRoleNameDatalist(game)}
      ${renderTravellerRoleNameDatalist(game)}
      ${renderTabBar()}
    </section>
  `;
}

export function renderNotesPage() {
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
