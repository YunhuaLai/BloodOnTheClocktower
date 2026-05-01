import { phaseTypeOptions, state, timelineTypeOptions } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel } from "./notes-core.js";

// Split from notes-render.js. Keep script order in index.html.

export function getTimelineTypeLabel(value) {
  return getOptionLabel(timelineTypeOptions, value);
}

export function formatTimelineTime(value) {
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

export function renderTimelineEntries(game) {
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

export function renderTimelineTab(game) {
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

export function renderInferenceTab(game) {
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
