import { getClaimPickerHint, getGameScript, isCustomRoleGame, isFreeRoleGame } from "../notes-claims.js";
import { getDraftOrPlayer, getPlayerDraft } from "../notes-state.js";
import { noteAlignmentOptions, noteConditionOptions, noteStatusOptions, noteTagOptions, state, typeLabels } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel, getAliveCount, getSeatLabel, getTotalPlayerCount, isTravellerPlayer } from "./notes-core.js";
import { getClaimedRole } from "./notes-role-info.js";
import { renderRoleInfoInputs } from "./notes-role-info-panel.js";
import { renderAcquiredAbilities } from "./notes-acquired-render.js";
import { getDeathBadge, isGhostVoteUsed } from "./notes-death.js";
import { renderDeathEditor } from "./notes-death-render.js";

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

export function renderPlayersTab(game) {
  const selectedPlayer = getSelectedPlayer(game);
  const sheetOpen = Boolean(state.notes.ui.playerSheetOpen && selectedPlayer);

  return `
    <div class="player-page">
      ${renderPlayerRoundtable(game, sheetOpen ? selectedPlayer : null)}
      ${sheetOpen ? renderPlayerSheet(selectedPlayer, game) : ""}
    </div>
  `;
}

function renderSeatNameEditor(player) {
  const seatLabel = getSeatLabel(player);
  const hintText = player.name ? "点击号位可修改称呼" : "点击号位可填写称呼";

  return `
    <details class="notes-seat-editor" data-details-key="${escapeHtml(`seat-editor:${player.id}`)}">
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

export function renderPlayerCycleField(player, field, label) {
  const value =
    field === "condition" && player[field] === "drunk" ? "poisoned" : player[field];
  const valueText =
    (field === "status" && getDeathBadge(player)) || getPlayerCycleValueText(field, value);

  return `
    <button
      type="button"
      class="${getPlayerCycleFieldClass(field, value)}"
      data-notes-action="cycle-player-field"
      data-player-id="${escapeHtml(player.id)}"
      data-field="${escapeHtml(field)}"
      aria-label="${escapeHtml(`${label}：${valueText}`)}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(valueText)}</strong>
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

function getPlayerTableMarkerTokens(player, game) {
  const tokens = [];

  if (player.status !== "alive") {
    tokens.push(getDeathBadge(player) || getOptionLabel(noteStatusOptions, player.status));
    if (isGhostVoteUsed(game, player)) {
      tokens.push("无票");
    }
  }

  if (player.alignment !== "unknown") {
    tokens.push(getOptionLabel(noteAlignmentOptions, player.alignment));
  }

  const condition = player.condition === "drunk" ? "poisoned" : player.condition;
  if (condition !== "unknown") {
    tokens.push(getOptionLabel(noteConditionOptions, condition));
  }

  (player.tags || [])
    .map((tag) => getOptionLabel(noteTagOptions, tag))
    .filter(Boolean)
    .slice(0, 2)
    .forEach((tag) => tokens.push(tag));

  if (player.extraInfo) {
    tokens.push(String(player.extraInfo).trim().replace(/\s+/g, " "));
  }

  return tokens.slice(0, 5);
}

function renderPlayerRoundtableSeat(player, game, index, selectedPlayer) {
  const draft = getDraftOrPlayer(player);
  const role = getClaimedRole(draft, game);
  const angle = (360 / Math.max(game.players.length, 1)) * index - 90;
  const isSelected = player.id === selectedPlayer?.id;
  const isSelf = player.seat === game.selfSeat;
  const isTraveller = isTravellerPlayer(player);
  const markerTokens = getPlayerTableMarkerTokens(draft, game);
  const seatLabel = draft.name || (isTraveller ? "旅行者" : isSelf ? "自己" : "未命名");
  const claimLabel = draft.claim || "未声明";
  const roleType = role?.type || (isTraveller ? "traveller" : "unknown");

  return `
    <button
      type="button"
      class="story-grimoire-seat player-roundtable-seat story-grimoire-seat--${escapeHtml(roleType)} player-roundtable-seat--judgement-${escapeHtml(draft.alignment || "unknown")}${draft.status === "alive" ? "" : " is-dead"}${isSelected ? " is-selected" : ""}${isSelf ? " is-self" : ""}${isTraveller ? " is-traveller" : ""}"
      data-seat-angle="${angle}"
      data-notes-action="select-player"
      data-player-id="${escapeHtml(player.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="${escapeHtml(`${player.seat}号位 ${seatLabel}`)}"
    >
      <span class="story-seat-number">${player.seat}${isSelf ? "*" : ""}</span>
      <span class="story-seat-name">${escapeHtml(seatLabel)}</span>
      <strong>${escapeHtml(claimLabel)}</strong>
      <span class="story-seat-alignment">${escapeHtml(role ? typeLabels[role.type] : getJudgementSummary(draft))}</span>
      <span class="story-seat-markers">
        ${
          markerTokens.length
            ? markerTokens
                .map((token) => `<small>${escapeHtml(token)}</small>`)
                .join("")
            : `<small>暂无笔记</small>`
        }
      </span>
    </button>
  `;
}

function renderPlayerRoundtable(game, selectedPlayer) {
  return `
    <section class="story-grimoire-panel player-roundtable-panel">
      <div class="story-grimoire-header">
        <div>
          <p class="eyebrow">玩家圆桌</p>
          <p class="notes-inline-hint">点座位记录该玩家。</p>
        </div>
      </div>

      <div class="story-grimoire-layout player-roundtable-layout">
        <div class="story-grimoire-board player-roundtable-board" aria-label="玩家圆桌座位盘">
          <div class="story-grimoire-center player-roundtable-center">
            <span>${escapeHtml(formatPhaseLabel(game.phaseType, game.phaseNumber))}</span>
            <strong>${getAliveCount(game)} / ${getTotalPlayerCount(game)}</strong>
            <small>${escapeHtml(game.scriptName || "未选剧本")}</small>
          </div>
          ${game.players
            .map((player, index) =>
              renderPlayerRoundtableSeat(player, game, index, selectedPlayer),
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderClaimControl(player, game) {
  const script = getGameScript(game);
  const placeholder = script
    ? `输入或搜索《${script.name}》角色`
    : isFreeRoleGame(game)
      ? "输入或搜索全部基础角色"
      : isCustomRoleGame(game)
      ? "输入或搜索自定义角色"
      : "先选剧本";

  return `
    <label class="note-field note-field--wide">
      <span>自称身份</span>
      <input
        class="notes-player-field"
        data-player-id="${escapeHtml(player.id)}"
        data-field="claim"
        list="roleNameList"
        value="${escapeHtml(player.claim)}"
        placeholder="${escapeHtml(placeholder)}"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="输入自称身份并搜索当前剧本角色"
      />
    </label>
  `;
}

// The player editor opens over the roundtable as a bottom sheet. Tapping the backdrop or 完成 saves and closes,
// so a half-filled seat is never lost; 取消 is the only way to drop the edits.
function renderPlayerSheet(player, game) {
  return `
    <div class="notes-player-sheet">
      <button
        type="button"
        class="notes-player-sheet-backdrop"
        data-notes-action="close-player-sheet"
        data-player-id="${escapeHtml(player.id)}"
        aria-label="保存并关闭"
      ></button>
      <div
        class="notes-player-sheet-panel"
        role="dialog"
        aria-label="${escapeHtml(`${player.seat}号位`)}"
        data-scroll-key="player-sheet:${escapeHtml(player.id)}"
      >
        ${renderPlayerDetail(player, game)}
      </div>
    </div>
  `;
}

function renderPlayerDetail(player, game) {
  if (!player) {
    return `<div class="empty-state">暂无玩家。</div>`;
  }

  const draft = getDraftOrPlayer(player);
  const hasDraft = Boolean(getPlayerDraft(player.id));

  return `
    <article class="notes-player-detail" data-player-id="${escapeHtml(player.id)}">
      <header class="notes-player-detail-header">
        <div class="notes-player-title-block">
          ${renderSeatNameEditor(draft)}
        </div>
        <div class="notes-player-detail-side">
          ${player.seat === game.selfSeat ? `<span class="notes-self-badge">自己</span>` : ""}
          ${isTravellerPlayer(player) ? `<span class="notes-self-badge notes-traveller-badge">旅行者</span>` : ""}
          <button
            type="button"
            class="note-icon-button notes-player-sheet-close"
            data-notes-action="close-player-sheet"
            data-player-id="${escapeHtml(player.id)}"
          >完成</button>
        </div>
      </header>

      <div class="notes-form-grid">
        ${renderClaimControl(draft, game)}
      </div>

      <div class="notes-player-cycle-grid">
        ${renderPlayerCycleField(draft, "status", "状态")}
        ${renderPlayerCycleField(draft, "alignment", "判断")}
        ${renderPlayerCycleField(draft, "condition", "醉/毒")}
      </div>
      ${renderDeathEditor(draft, game)}

      ${renderRoleInfoInputs(draft, game)}
      ${renderAcquiredAbilities(draft, game)}

      <section class="notes-detail-section">
        <label class="note-field">
          <span>额外信息</span>
          <input
            class="notes-player-field"
            data-player-id="${escapeHtml(draft.id)}"
            data-field="extraInfo"
            value="${escapeHtml(draft.extraInfo)}"
            placeholder="首夜报 3/8，今天别先出票"
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
        <span class="notes-savehint">${hasDraft ? "未保存" : "已保存"}</span>
        <div class="notes-savebar-actions">
          <button type="button" class="secondary-link" data-notes-action="discard-player" data-player-id="${escapeHtml(player.id)}">取消</button>
          <button type="button" class="primary-link" data-notes-action="save-player" data-player-id="${escapeHtml(player.id)}">保存</button>
        </div>
      </div>

      ${renderStorytellerFields(draft, game)}
    </article>
  `;
}
