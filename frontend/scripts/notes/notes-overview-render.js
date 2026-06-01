import { getGameScript, isCustomRoleGame } from "../notes-claims.js";
import { cloneSuspectedRoles, getDraftOrPlayer } from "../notes-state.js";
import { state } from "../state.js";
import { escapeHtml } from "../utils.js";
import { getOverviewSecondaryText, isTravellerPlayer } from "./notes-core.js";
import { renderPlayerCycleField } from "./notes-player-render.js";
import { renderOverviewRoleInfoInputs } from "./notes-role-info-overview.js";
import { getRoleInfoSummary } from "./notes-role-info.js";
import { renderBeyondWorldlineAnalysis } from "./notes-worldline-analysis.js";

function renderOverviewActions() {
  return `
    <div class="notes-overview-actions">
      <button type="button" class="primary-link" data-notes-action="save-game">保存</button>
      <button type="button" class="secondary-link" data-notes-action="go-home">返回</button>
      <button type="button" class="secondary-link danger" data-notes-action="delete-game">删除</button>
    </div>
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
      <label class="note-field note-field--wide">
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
  `;
}

function renderOverviewSuspectedRoles(game) {
  const records = cloneSuspectedRoles(game.suspectedRoles);

  return `
    <section class="notes-roleinfo-section notes-suspected-roles">
      <div class="notes-roleinfo-section-header">
        <strong>疑似存在角色</strong>
        <small>${records.length ? `${records.length} 条` : "可添加"}</small>
      </div>
      ${
        records.length
          ? `
            <div class="notes-suspected-role-list">
              ${records
                .map(
                  (record, index) => `
                    <div class="notes-suspected-role-row">
                      <span class="notes-roleinfo-index">${index + 1}</span>
                      <div class="notes-roleinfo-fields notes-suspected-role-fields">
                        <label class="notes-roleinfo-field">
                          <span>角色</span>
                          <input
                            value="${escapeHtml(record.role)}"
                            placeholder="投毒者、洗脑师、鹰身女妖"
                            list="roleNameList"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            data-suspected-role-row="${index}"
                            data-suspected-role-field="role"
                          />
                        </label>
                        <label class="notes-roleinfo-field">
                          <span>线索</span>
                          <input
                            value="${escapeHtml(record.note)}"
                            placeholder="谁爆的，或为什么认为在场"
                            data-suspected-role-row="${index}"
                            data-suspected-role-field="note"
                          />
                        </label>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `
          : `<div class="notes-roleinfo-empty">暂无疑似角色。</div>`
      }
      <div class="notes-roleinfo-actions">
        <button
          type="button"
          class="note-icon-button"
          data-notes-action="add-suspected-role"
        >+ 一条</button>
        <button
          type="button"
          class="note-icon-button"
          data-notes-action="remove-suspected-role"
          ${records.length ? "" : "disabled"}
        >- 末条</button>
      </div>
    </section>
  `;
}

function renderOverviewClaimInput(player, game) {
  const script = getGameScript(game);
  const placeholder = script || isCustomRoleGame(game) ? "身份" : "先选剧本";

  return `
    <input
      class="notes-overview-claim-input"
      data-player-id="${escapeHtml(player.id)}"
      data-field="claim"
      list="roleNameList"
      value="${escapeHtml(player.claim)}"
      placeholder="${escapeHtml(placeholder)}"
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
      const isTraveller = isTravellerPlayer(player);
      const summaryText = getRoleInfoSummary(draft, game);
      const supplementText = getOverviewSecondaryText(draft);
      const isExpanded = expandedPlayerId === player.id;

      return `
        <article class="notes-overview-item${isExpanded ? " is-expanded" : ""}">
          <div
            class="notes-overview-row${isSelf ? " is-self" : ""}${isTraveller ? " is-traveller" : ""}${isExpanded ? " is-expanded" : ""}"
            aria-expanded="${isExpanded ? "true" : "false"}"
          >
            <button
              type="button"
              class="notes-overview-cell notes-overview-cell--seat notes-overview-toggle"
              data-notes-action="toggle-overview-player"
              data-player-id="${escapeHtml(player.id)}"
              aria-label="${escapeHtml(`${player.seat}号位${isExpanded ? "，收起" : "，展开"}`)}"
            >
              ${player.seat}${isSelf ? "*" : ""}${isTraveller ? "旅" : ""}
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

export function renderOverviewTab(game) {
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
      ${renderBeyondWorldlineAnalysis(game)}
      ${renderOverviewSuspectedRoles(game)}
      ${renderOverviewActions()}
    </section>
  `;
}
