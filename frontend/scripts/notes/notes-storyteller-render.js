import { getRoleById } from "../catalog-helpers.js";
import { getClaimRoleOptions, getGameScript } from "../notes-claims.js";
import { clampNumber, createDefaultStorytellerState, getDraftOrPlayer } from "../notes-state.js";
import { noteAlignmentOptions, noteConditionOptions, noteStatusOptions, state, typeLabels } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel, getAliveCount, getPlayerLabel, getStandardSetup } from "./notes-core.js";
import { renderPlayerCycleField } from "./notes-player-render.js";
import { renderRoleInfoFieldControl } from "./notes-role-info-fields.js";
import { ensureRoleInfoMatchesClaim, formatRoleInfoEntrySummary, getRoleInfoEntries, getRoleInfoNode, getRoleInfoSectionLabel, isRoleInfoEntryFilled } from "./notes-role-info.js";
import {
  getAssignedSetupAlertRoles,
  getRoleGlobalMarkers,
  getRoleSetupNotes,
  getScriptIdentityOverlayRoles,
  getRoleByLooseName,
} from "./notes-storyteller-actions.js";

// Split from notes-render.js. Keep script order in index.html.

const storytellerAlignmentOptions = [
  { value: "good", label: "好" },
  { value: "evil", label: "坏" },
];

const storytellerStatusOptions = [
  { value: "alive", label: "存活" },
  { value: "night-dead", label: "夜死" },
  { value: "executed", label: "处决" },
];

const storytellerConditionOptions = [
  { value: "sober", label: "清醒" },
  { value: "poisoned", label: "中毒" },
  { value: "drunk", label: "醉酒" },
];

export function getStorytellerState(game) {
  return {
    ...createDefaultStorytellerState(),
    ...(game?.storyteller || {}),
    bluffs: Array.isArray(game?.storyteller?.bluffs)
      ? game.storyteller.bluffs
      : [],
  };
}

export function getStorytellerRole(player, game) {
  return getRoleByLooseName(player?.trueRole, game);
}

export function getRoleBadgeClass(role) {
  return `story-role-badge story-role-badge--${escapeHtml(role?.type || "unknown")}`;
}

export function getStorytellerSetupSummary(game) {
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

function getStorytellerMarkerOptions(game) {
  const markers = getScriptIdentityOverlayRoles(game)
    .flatMap((role) => {
      const globalMarkers = getRoleGlobalMarkers(role);
      return globalMarkers.length ? globalMarkers : [`是${role.name}`];
    })
    .map((marker) => String(marker || "").trim())
    .filter(Boolean);

  return [...new Set(markers)];
}

function getStorytellerNoteTokens(value) {
  return String(value || "")
    .split(/[，,、；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderStorytellerMarkerButtons(player, game) {
  const markers = getStorytellerMarkerOptions(game);
  if (!markers.length) {
    return "";
  }

  const activeMarkers = new Set(getStorytellerNoteTokens(player.storytellerNotes));
  return `
    <div class="note-tags story-marker-options" aria-label="真实标记">
      ${markers
        .map(
          (marker) => `
            <button
              type="button"
              class="note-tag${activeMarkers.has(marker) ? " active" : ""}"
              data-notes-action="toggle-story-marker"
              data-player-id="${escapeHtml(player.id)}"
              data-marker="${escapeHtml(marker)}"
              aria-pressed="${activeMarkers.has(marker) ? "true" : "false"}"
            >${escapeHtml(marker)}</button>
          `,
        )
        .join("")}
    </div>
  `;
}

function getStorytellerRoleInfoSubject(player) {
  return {
    ...player,
    claim: player.trueRole,
  };
}

function getPlayerChoicePrompt(role, abilityData) {
  const targetNode = getRoleInfoNode(abilityData, "target");
  const meta = abilityData?.abilityMeta || {};
  if (!targetNode.fields.length) {
    return "无需玩家主动选择，按角色能力处理。";
  }

  const firstField = targetNode.fields[0];
  if (["seat", "player", "number"].includes(firstField.type)) {
    return meta.drivenBy === "player" || meta.activationMode === "active"
      ? "提示玩家：请给我一个号码。"
      : "记录目标号码。";
  }

  return meta.drivenBy === "player" || meta.activationMode === "active"
    ? `提示玩家：请选择${firstField.label || "目标"}。`
    : `记录${firstField.label || "目标"}。`;
}

function renderStorytellerRoleInfoSection(sectionKey, node, roleInfo, abilityData, game, playerId) {
  if (node.repeatMode === "none" || !node.fields.length) {
    return "";
  }

  const maxSeat = clampNumber(Number(game?.playerCount) || 15, 1, 15);
  const entries = getRoleInfoEntries(roleInfo, sectionKey);
  const minimumRows =
    node.repeatMode === "once"
      ? Math.max(node.defaultRows || 0, 1)
      : Math.max(node.defaultRows || 0, 1);
  const filledRows = entries.filter(isRoleInfoEntryFilled).length;
  const rowCount = Math.max(entries.length, filledRows + 1, minimumRows ? 1 : 0);
  const rows = Array.from({ length: rowCount }, (_, index) => entries[index] || {});

  return `
    <section class="story-night-record-section">
      <div class="notes-roleinfo-section-header">
        <strong>${escapeHtml(getRoleInfoSectionLabel(sectionKey, abilityData))}</strong>
        <small>${escapeHtml(sectionKey === "target" ? "玩家选择" : "给出的信息")}</small>
      </div>
      <div class="notes-roleinfo-list">
        ${rows
          .map(
            (entry, index) => `
              <div class="notes-roleinfo-row">
                <span class="notes-roleinfo-index">${index + 1}</span>
                <div class="notes-roleinfo-fields notes-roleinfo-fields--${Math.min(Math.max(node.fields.length, 1), 3)}">
                  ${node.fields
                    .map((field) =>
                      renderRoleInfoFieldControl(sectionKey, index, field, entry?.[field.key], game, maxSeat),
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
                data-player-id="${escapeHtml(playerId)}"
                data-section="${escapeHtml(sectionKey)}"
              >+ 一条</button>
              <button
                type="button"
                class="note-icon-button"
                data-notes-action="remove-roleinfo-row"
                data-player-id="${escapeHtml(playerId)}"
                data-section="${escapeHtml(sectionKey)}"
                ${rows.length <= 1 ? "disabled" : ""}
              >- 末条</button>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderStorytellerNightRecord(item, game, reminder) {
  if (!item.player) {
    return `<p class="story-night-detail-hint">${escapeHtml(reminder || item.role.ability || "按角色能力处理。")}</p>`;
  }

  const draft = getDraftOrPlayer(item.player);
  const subject = getStorytellerRoleInfoSubject(draft);
  const abilityData = item.role.abilityData || null;
  const roleInfo = ensureRoleInfoMatchesClaim(subject, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const hasRecordFields =
    targetNode.fields.length || resultNode.fields.length;

  return `
    <div class="story-night-detail" data-player-id="${escapeHtml(item.player.id)}">
      <p class="story-night-detail-hint">${escapeHtml(getPlayerChoicePrompt(item.role, abilityData))}</p>
      <p class="story-night-detail-reminder">${escapeHtml(reminder || item.role.ability || "按角色能力处理。")}</p>
      ${
        hasRecordFields
          ? `
            <div class="story-night-record-grid">
              ${renderStorytellerRoleInfoSection("target", targetNode, roleInfo, abilityData, game, item.player.id)}
              ${renderStorytellerRoleInfoSection("result", resultNode, roleInfo, abilityData, game, item.player.id)}
            </div>
            ${
              resultNode.fields.some((field) => field.type === "role")
                ? `
                  <button
                    type="button"
                    class="note-icon-button"
                    data-notes-action="autofill-story-result"
                    data-player-id="${escapeHtml(item.player.id)}"
                  >按真实身份预填</button>
                `
                : ""
            }
          `
          : ""
      }
    </div>
  `;
}

function getStorytellerInfoRecords(game) {
  return game.players.flatMap((player) => {
    const role = getStorytellerRole(player, game);
    if (!role?.abilityData?.abilityMeta?.recordable) {
      return [];
    }

    const subject = getStorytellerRoleInfoSubject(player);
    const roleInfo = ensureRoleInfoMatchesClaim(subject, game);
    const targetNode = getRoleInfoNode(role.abilityData, "target");
    const resultNode = getRoleInfoNode(role.abilityData, "result");
    const targetEntries = getRoleInfoEntries(roleInfo, "target");
    const resultEntries = getRoleInfoEntries(roleInfo, "result");
    const rowCount = Math.max(targetEntries.length, resultEntries.length);
    const records = [];

    for (let index = 0; index < rowCount; index += 1) {
      const targetText = formatRoleInfoEntrySummary(targetEntries[index], targetNode.fields);
      const resultText = formatRoleInfoEntrySummary(resultEntries[index], resultNode.fields);
      if (!targetText && !resultText) {
        continue;
      }

      records.push({
        id: `${player.id}-${index}`,
        player,
        role,
        text: [targetText ? `选择 ${targetText}` : "", resultText ? `告知 ${resultText}` : ""]
          .filter(Boolean)
          .join(" / "),
      });
    }

    return records;
  });
}

function renderStorytellerSetupAlerts(game) {
  const overlayRoles = getScriptIdentityOverlayRoles(game);
  const setupAlertRoles = getAssignedSetupAlertRoles(game);

  if (!overlayRoles.length && !setupAlertRoles.length) {
    return "";
  }

  return `
    <div class="story-setup-alerts">
      ${overlayRoles
        .map((role) => {
          const markers = getRoleGlobalMarkers(role);
          const notes = getRoleSetupNotes(role);
          return `
            <article class="story-setup-alert">
              <strong>${escapeHtml(role.name)} 标记需手动放置</strong>
              <p>${escapeHtml(
                markers.length
                  ? `可用标记：${markers.join("、")}。随机分配不会直接发放该身份。`
                  : "随机分配不会直接发放该身份，请说书人手动记录覆盖关系。",
              )}</p>
              ${notes.length ? `<small>${escapeHtml(notes.join("；"))}</small>` : ""}
            </article>
          `;
        })
        .join("")}
      ${setupAlertRoles
        .map((role) => {
          const notes = getRoleSetupNotes(role);
          return `
            <article class="story-setup-alert is-danger">
              <strong>${escapeHtml(role.name)} 会影响开局配置</strong>
              <p>${escapeHtml(
                notes.length
                  ? notes.join("；")
                  : "请说书人检查外来者、爪牙或其他配置人数是否需要调整。",
              )}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function getStorytellerSelectedPlayer(game) {
  return (
    game.players.find((player) => player.id === state.notes.ui.selectedPlayerId) ||
    game.players[0] ||
    null
  );
}

export function getStorytellerMarkerTokens(player) {
  const tokens = [];
  if (player.status !== "alive") {
    tokens.push(getOptionLabel(noteStatusOptions, player.status));
  }

  const condition = player.condition === "drunk" ? "drunk" : player.condition;
  if (["poisoned", "drunk"].includes(condition)) {
    tokens.push(getOptionLabel(noteConditionOptions, condition));
  }

  if (player.newRoleFirstNight) {
    tokens.push("新入场首夜");
  }

  String(player.storytellerNotes || "")
    .split(/[，,、；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
    .forEach((item) => tokens.push(item));

  return tokens.slice(0, 5);
}

export function renderStoryRoleToken(player, game) {
  const role = getStorytellerRole(player, game);
  return `
    <span class="${getRoleBadgeClass(role)}">
      ${escapeHtml(role ? typeLabels[role.type] : "未设")}
    </span>
  `;
}

export function renderGrimoireSeat(player, game, index, selectedPlayer) {
  const draft = getDraftOrPlayer(player);
  const role = getStorytellerRole(draft, game);
  const angle = (360 / Math.max(game.players.length, 1)) * index - 90;
  const isSelected = player.id === selectedPlayer?.id;
  const markerTokens = getStorytellerMarkerTokens(draft);

  return `
    <button
      type="button"
      class="story-grimoire-seat story-grimoire-seat--${escapeHtml(role?.type || "unknown")}${draft.status === "alive" ? "" : " is-dead"}${isSelected ? " is-selected" : ""}"
      style="--seat-angle: ${angle}deg;"
      data-notes-action="select-story-player"
      data-player-id="${escapeHtml(player.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span class="story-seat-number">${player.seat}</span>
      <span class="story-seat-name">${escapeHtml(player.name || "未命名")}</span>
      <strong>${escapeHtml(draft.trueRole || "未设置身份")}</strong>
      <span class="story-seat-alignment">${escapeHtml(getOptionLabel(noteAlignmentOptions, draft.trueAlignment))}</span>
      <span class="story-seat-markers">
        ${
          markerTokens.length
            ? markerTokens
                .map((token) => `<small>${escapeHtml(token)}</small>`)
                .join("")
            : `<small>无标记</small>`
        }
      </span>
    </button>
  `;
}

export function renderGrimoireInspector(player, game) {
  if (!player) {
    return "";
  }

  const draft = getDraftOrPlayer(player);
  const role = getStorytellerRole(draft, game);

  return `
    <aside class="story-grimoire-inspector" data-player-id="${escapeHtml(player.id)}">
      <div class="story-inspector-title">
        <div>
          <p class="eyebrow">座位 ${player.seat}</p>
          <h3>${escapeHtml(player.name || `${player.seat}号位`)}</h3>
        </div>
        ${renderStoryRoleToken(draft, game)}
      </div>
      <div class="story-inspector-grid">
        <label class="note-field">
          <span>真实身份</span>
          <input
            data-player-id="${escapeHtml(player.id)}"
            data-field="trueRole"
            list="roleNameList"
            value="${escapeHtml(draft.trueRole)}"
            placeholder="输入或搜索身份"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </label>
        <label class="note-field">
          <span>真实阵营</span>
          <select data-player-id="${escapeHtml(player.id)}" data-field="trueAlignment">
            ${renderSelectOptions(storytellerAlignmentOptions, ["good", "evil"].includes(draft.trueAlignment) ? draft.trueAlignment : "good")}
          </select>
        </label>
      </div>
      <div class="story-inspector-grid">
        <label class="note-field">
          <span>真实状态</span>
          <select data-player-id="${escapeHtml(player.id)}" data-field="status">
            ${renderSelectOptions(storytellerStatusOptions, ["alive", "night-dead", "executed"].includes(draft.status) ? draft.status : "alive")}
          </select>
        </label>
        <label class="note-field">
          <span>真实醉毒</span>
          <select data-player-id="${escapeHtml(player.id)}" data-field="condition">
            ${renderSelectOptions(storytellerConditionOptions, ["sober", "poisoned", "drunk"].includes(draft.condition) ? draft.condition : "sober")}
          </select>
        </label>
      </div>
      ${renderStorytellerMarkerButtons(draft, game)}
      <label class="note-checkbox">
        <input
          type="checkbox"
          data-player-id="${escapeHtml(player.id)}"
          data-field="newRoleFirstNight"
          ${draft.newRoleFirstNight ? "checked" : ""}
        />
        <span>新入场首夜</span>
      </label>
      <label class="note-field note-field--wide">
        <span>提醒标记</span>
        <input
          data-player-id="${escapeHtml(player.id)}"
          data-field="storytellerNotes"
          value="${escapeHtml(draft.storytellerNotes)}"
          placeholder="例如 中毒、保护、红鲱鱼、一次性能力已用"
        />
      </label>
      <div class="story-inspector-ability">
        <strong>${escapeHtml(draft.trueRole || "未设置身份")}</strong>
        <p>${escapeHtml(role?.ability || "选择真实身份后，这里会显示角色能力摘要。")}</p>
      </div>
    </aside>
  `;
}

export function renderStorytellerGrimoire(game) {
  const selectedPlayer = getStorytellerSelectedPlayer(game);
  const setup = getStorytellerSetupSummary(game);
  const storyteller = getStorytellerState(game);

  return `
    <section class="story-grimoire-panel">
      <div class="story-grimoire-header">
        <div>
          <p class="eyebrow">说书人魔典</p>
          <h2>桌面局势</h2>
        </div>
        <div class="story-toolbar-actions">
          <button type="button" class="primary-link" data-notes-action="random-assign-roles">随机分配</button>
          <button type="button" class="secondary-link" data-notes-action="clear-assignments">清空</button>
        </div>
      </div>

      <div class="story-grimoire-meta">
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
        ${renderStorytellerSetupAlerts(game)}
        <div class="story-grimoire-bluffs">
          <span>伪装</span>
          ${Array.from({ length: 3 }, (_, index) => `
            <input
              list="roleNameList"
              data-storyteller-bluff="${index}"
              value="${escapeHtml(storyteller.bluffs[index] || "")}"
              placeholder="伪装 ${index + 1}"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          `).join("")}
        </div>
      </div>

      <div class="story-grimoire-layout">
        <div class="story-grimoire-board" aria-label="说书人魔典座位盘">
          <div class="story-grimoire-center">
            <span>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))}</span>
            <strong>${getAliveCount(game)} / ${game.playerCount}</strong>
            <small>${escapeHtml(game.scriptName || "未选剧本")}</small>
          </div>
          ${game.players
            .map((player, index) =>
              renderGrimoireSeat(player, game, index, selectedPlayer),
            )
            .join("")}
        </div>
        ${renderGrimoireInspector(selectedPlayer, game)}
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

export function renderStorytellerSetupTools(game) {
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
      ${renderStorytellerSetupAlerts(game)}
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

export function renderStorytellerManualRows(game) {
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
          <label class="note-checkbox">
            <input
              type="checkbox"
              data-player-id="${escapeHtml(player.id)}"
              data-field="newRoleFirstNight"
              ${draft.newRoleFirstNight ? "checked" : ""}
            />
            <span>新入场首夜</span>
          </label>
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

export function renderStorytellerManualPanel(game) {
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

export function getScriptNightOrders(game) {
  const script = getGameScript(game);
  return {
    first: Array.isArray(script?.nightOrder?.first) ? script.nightOrder.first : [],
    other: Array.isArray(script?.nightOrder?.other) ? script.nightOrder.other : [],
  };
}

export function hasScriptNightOrder(game) {
  const orders = getScriptNightOrders(game);
  return Boolean(orders.first.length || orders.other.length);
}

export function getNightOrderForGame(game, assignedRoles) {
  const hasAssignments = assignedRoles.length > 0;
  const isFirstNight = game.phaseNumber <= 1;
  const orders = getScriptNightOrders(game);
  const previewOrder = isFirstNight ? orders.first : orders.other;

  if (!hasAssignments) {
    return previewOrder
      .map((roleId, index) => {
        const role = getRoleById(roleId);
        return role
          ? {
              player: null,
              role,
              order: index,
              fromNightOrder: true,
              useFirstNightAction: isFirstNight,
            }
          : null;
      })
      .filter(Boolean);
  }

  if (!orders.first.length && !orders.other.length) {
    return [];
  }

  return assignedRoles
    .map((item, fallbackIndex) => {
      if (!item.role?.id) {
        return null;
      }

      const useFirstNightAction = isFirstNight || Boolean(item.newRoleFirstNight);
      const nightOrder = useFirstNightAction ? orders.first : orders.other;
      const orderIndex = nightOrder.indexOf(item.role.id);
      if (orderIndex === -1) {
        return null;
      }

      return {
        ...item,
        order: orderIndex + (useFirstNightAction ? 0 : orders.first.length),
        fallbackOrder: fallbackIndex,
        fromNightOrder: true,
        useFirstNightAction,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.fallbackOrder - right.fallbackOrder);
}

export function getNightOrderRoles(game) {
  const assignedRoles = game.players
    .map((player) => ({
      player,
      role: getStorytellerRole(player, game),
      newRoleFirstNight: Boolean(player.newRoleFirstNight),
    }))
    .filter((item) => item.role);
  const hasAssignments = assignedRoles.length > 0;
  const orderedRoles = getNightOrderForGame(game, assignedRoles);
  const source = orderedRoles.length
    ? orderedRoles
    : hasAssignments
      ? hasScriptNightOrder(game)
        ? []
        : assignedRoles
      : getClaimRoleOptions(game)
          .filter((role) => role.type !== "fabled")
          .map((role) => ({ player: null, role }));

  return source
    .map((item, index) => {
      const timing = item.role.abilityData?.abilityMeta?.phaseTiming || "";
      const firstReminder = item.role.firstNightReminder || "";
      const otherReminder = item.role.otherNightReminder || "";
      const useFirstNightAction =
        item.useFirstNightAction ?? Boolean(game.phaseNumber <= 1 || item.newRoleFirstNight);
      const reminder = useFirstNightAction
        ? firstReminder || otherReminder
        : otherReminder;
      const hasNightAction =
        item.fromNightOrder ||
        Boolean(reminder) ||
        (useFirstNightAction
          ? ["setup", "first_night", "each_night", "each_night_star", "night"].includes(timing)
          : ["each_night", "each_night_star", "night"].includes(timing));

      return {
        ...item,
        order: item.order ?? index,
        timing,
        firstReminder,
        otherReminder,
        useFirstNightAction,
        hasNightAction,
      };
    })
    .filter((item) => item.hasNightAction);
}

export function renderNightOrderPanel(game) {
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
                  const reminder = item.useFirstNightAction
                    ? item.firstReminder || item.otherReminder
                    : item.otherReminder;
                  const playerLabel = item.player
                    ? getPlayerLabel(item.player, game)
                    : typeLabels[item.role.type];
                  const roleTitle = item.player
                    ? `${item.player.seat}号 ${item.role.name}`
                    : item.role.name;
                  return `
                    <details class="story-night-item">
                      <summary>
                        <div>
                          <strong>${escapeHtml(roleTitle)}</strong>
                          <span>${escapeHtml(playerLabel)}${item.newRoleFirstNight ? " · 新入场" : ""}</span>
                        </div>
                      </summary>
                      ${renderStorytellerNightRecord(item, game, reminder)}
                    </details>
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

export function renderPublicBoardPanel(game) {
  const storyteller = getStorytellerState(game);
  const infoRecords = getStorytellerInfoRecords(game);

  return `
    <section class="story-console-panel">
      <div class="story-panel-header">
        <div>
          <p class="eyebrow">玩家信息</p>
          <h2>已告知记录</h2>
        </div>
      </div>
      ${
        infoRecords.length
          ? `
            <div class="story-info-records">
              ${infoRecords
                .map(
                  (record) => `
                    <article class="story-info-record">
                      <strong>${record.player.seat}号 ${escapeHtml(record.role.name)}</strong>
                      <span>${escapeHtml(record.text)}</span>
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : `<div class="empty-state">还没有记录给玩家的信息。展开夜晚流程里的角色，录入目标和结果后会出现在这里。</div>`
      }
      <label class="note-field note-field--wide">
        <span>补充记录</span>
        <textarea
          data-storyteller-field="publicNotes"
          rows="3"
          placeholder="记录已经告知玩家的信息、提醒和需要回头核对的答案。"
        >${escapeHtml(storyteller.publicNotes)}</textarea>
      </label>
    </section>
  `;
}

export function renderStorytellerTab(game) {
  if (game.mode !== "storyteller") {
    return `
      <section class="notes-panel">
        <div class="empty-state">当前局是玩家模式。到时间线里把记录视角切成说书人后，这里会出现控制台。</div>
      </section>
    `;
  }

  return `
    <div class="story-console">
      ${renderStorytellerGrimoire(game)}
      ${renderNightOrderPanel(game)}
      ${renderPublicBoardPanel(game)}
    </div>
  `;
}
