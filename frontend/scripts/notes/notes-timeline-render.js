import { getDayRecord, resolveAutomaticDayExecution, resolveDayExecution } from "./notes-day-records.js";
import { phaseTypeOptions, state, timelineTypeOptions } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel, getPlayerLabel } from "./notes-core.js";

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

function renderSeatOptions(game, selectedSeat, emptyLabel = "未选择") {
  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...game.players.map((player) => {
      const seat = String(player.seat);
      return `<option value="${seat}"${seat === String(selectedSeat || "") ? " selected" : ""}>${escapeHtml(getPlayerLabel(player, game))}</option>`;
    }),
  ].join("");
}

function renderVoterGrid(game, nomination, dayNumber) {
  const voterSeats = new Set((nomination.voterSeats || []).map(String));

  return `
    <div class="notes-voter-grid" role="group" aria-label="记录投票玩家">
      ${game.players
        .map((player) => {
          const seat = String(player.seat);
          return `
            <label class="notes-voter-chip${voterSeats.has(seat) ? " is-checked" : ""}">
              <input
                type="checkbox"
                data-day-number="${dayNumber}"
                data-nomination-id="${escapeHtml(nomination.id)}"
                data-voter-seat="${seat}"
                ${voterSeats.has(seat) ? "checked" : ""}
              />
              <span>${seat}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderNominationRow(game, record, nomination, index) {
  const voteCount = (nomination.voterSeats || []).length;

  return `
    <article class="notes-nomination-row">
      <div class="notes-nomination-row-head">
        <strong>提名 ${index + 1}</strong>
        <span>${voteCount} 票</span>
      </div>
      <div class="notes-nomination-fields">
        <label class="note-field">
          <span>发起提名</span>
          <select
            data-day-number="${record.dayNumber}"
            data-nomination-id="${escapeHtml(nomination.id)}"
            data-nomination-field="nominatorSeat"
          >
            ${renderSeatOptions(game, nomination.nominatorSeat, "谁提的")}
          </select>
        </label>
        <label class="note-field">
          <span>被提名</span>
          <select
            data-day-number="${record.dayNumber}"
            data-nomination-id="${escapeHtml(nomination.id)}"
            data-nomination-field="nomineeSeat"
          >
            ${renderSeatOptions(game, nomination.nomineeSeat, "提谁")}
          </select>
        </label>
      </div>
      <div class="notes-nomination-votes">
        <span>投票</span>
        ${renderVoterGrid(game, nomination, record.dayNumber)}
      </div>
      <button
        type="button"
        class="note-icon-button"
        data-notes-action="delete-nomination"
        data-day-number="${record.dayNumber}"
        data-nomination-id="${escapeHtml(nomination.id)}"
      >删除提名</button>
    </article>
  `;
}

function formatExecutionResult(result) {
  if (!result.seat) {
    return "无人处决";
  }

  const suffix = result.mode === "auto" ? `（${result.votes} 票）` : "（手动）";
  return `${result.seat}号${suffix}`;
}

function renderExecutionOverride(game, record) {
  const result = resolveDayExecution(game, record);
  const autoResult = resolveAutomaticDayExecution(game, record);

  return `
    <div class="notes-execution-control">
      <div>
        <span>处决结果</span>
        <strong>${escapeHtml(formatExecutionResult(result))}</strong>
        <small>票数门槛 ${result.threshold}；自动结算：${escapeHtml(formatExecutionResult(autoResult))}</small>
      </div>
      <label class="note-field">
        <span>手动更改</span>
        <select data-day-execution-override="${record.dayNumber}">
          <option value=""${record.executionOverride ? "" : " selected"}>使用自动结算</option>
          <option value="none"${record.executionOverride === "none" ? " selected" : ""}>无人处决</option>
          ${game.players
            .map((player) => {
              const seat = String(player.seat);
              return `<option value="${seat}"${record.executionOverride === seat ? " selected" : ""}>${escapeHtml(getPlayerLabel(player, game))}</option>`;
            })
            .join("")}
        </select>
      </label>
    </div>
  `;
}

function renderDayRecordPanel(game) {
  const dayNumber = game.phaseNumber || 1;
  const record = getDayRecord(game, dayNumber, true);
  const olderRecords = (game.dayRecords || [])
    .filter((item) => item.dayNumber !== dayNumber)
    .sort((left, right) => right.dayNumber - left.dayNumber);

  return `
    <section class="notes-detail-section notes-day-record-panel">
      <div class="notes-day-record-header">
        <div>
          <p class="eyebrow">第 ${dayNumber} 天公开行动</p>
          <h3>提名、投票与处决</h3>
        </div>
        <button
          type="button"
          class="primary-link"
          data-notes-action="add-nomination"
          data-day-number="${dayNumber}"
        >新增提名</button>
      </div>
      ${renderExecutionOverride(game, record)}
      <div class="notes-nomination-list">
        ${
          record.nominations.length
            ? record.nominations
                .map((nomination, index) => renderNominationRow(game, record, nomination, index))
                .join("")
            : `<div class="empty-state">还没有记录今天的提名。</div>`
        }
      </div>
      ${
        olderRecords.length
          ? `
            <div class="notes-day-history">
              <h4>已记录的其他白天</h4>
              ${olderRecords
                .map((item) => {
                  const result = resolveDayExecution(game, item);
                  return `<span>第 ${item.dayNumber} 天：${item.nominations.length} 次提名，${escapeHtml(formatExecutionResult(result))}</span>`;
                })
                .join("")}
            </div>
          `
          : ""
      }
    </section>
  `;
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

        ${renderDayRecordPanel(game)}

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
