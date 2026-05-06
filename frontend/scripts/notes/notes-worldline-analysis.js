import { escapeHtml } from "../utils.js";
import { analyzeWorlds } from "./deduction/scorer.js";

function renderObservationList(items, emptyText, limit = 5) {
  if (!items.length) {
    return `<li>${escapeHtml(emptyText)}</li>`;
  }

  return items
    .slice(0, limit)
    .map((item) => `<li>${escapeHtml(item.label || item.observation?.label || "")}</li>`)
    .join("");
}

function renderFalseObservationList(items, limit = 5) {
  if (!items.length) {
    return "<li>无需要解释的错误信息</li>";
  }

  return items
    .slice(0, limit)
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item.observation.label)}</strong>
          <span>${escapeHtml(item.explanation.text)}（成本 ${item.explanation.cost}）</span>
        </li>
      `,
    )
    .join("");
}

function renderBaselineList(items) {
  if (!items.length) {
    return "";
  }

  return `
    <ul class="notes-world-baseline">
      ${[...items]
        .sort((left, right) => Math.abs(right.cost) - Math.abs(left.cost))
        .slice(0, 3)
        .map((item) => {
          const costText = item.cost < 0 ? `降成本 ${Math.abs(item.cost)}` : `成本 ${item.cost}`;
          return `<li>${escapeHtml(`${item.text}（${costText}）`)}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function renderWorldResult(result, index) {
  return `
    <article class="notes-world-card notes-world-card--${escapeHtml(result.classification)}">
      <div class="notes-world-card-head">
        <div>
          <strong>局势 ${index + 1}</strong>
          <span>${escapeHtml(result.classificationLabel)}</span>
        </div>
        <em>${result.likelihood}%</em>
      </div>
      <p class="notes-world-team">
        恶魔 ${result.world.demonSeat}号；爪牙 ${escapeHtml(result.minionText || "无")}；邪恶方 ${escapeHtml(result.evilText)}
      </p>
      <div class="notes-world-cost">
        <span>解释成本 ${result.cost}</span>
        <span>错误信息 ${result.falseObservations.length}</span>
        <span>未解释 ${result.unexplainedCount}</span>
      </div>
      ${renderBaselineList(result.baseline)}
      <div class="notes-world-card-grid">
        <section>
          <h5>自然成立</h5>
          <ul>${renderObservationList(result.trueObservations, "暂无自然成立的信息")}</ul>
        </section>
        <section>
          <h5>需要解释</h5>
          <ul>${renderFalseObservationList(result.falseObservations)}</ul>
        </section>
      </div>
    </article>
  `;
}

function renderSignals(signals) {
  if (!signals.length) {
    return "";
  }

  return `
    <section class="notes-world-signals">
      <h4>最值得验证的信息</h4>
      <div>
        ${signals
          .map(
            (signal) => `
              <span>
                ${escapeHtml(signal.observation.label)}
                <small>${signal.trueCount}真 / ${signal.falseCount}假</small>
              </span>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderUnsupported(unsupported) {
  if (!unsupported.length) {
    return "";
  }

  return `
    <section class="notes-analysis-signals notes-analysis-signals--muted">
      <h4>暂未接入自动推理</h4>
      <ul>
        ${unsupported
          .slice(0, 8)
          .map((item) => `<li>${escapeHtml(item.label)}</li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderEmpty(analysis) {
  if (analysis.unsupported.length) {
    return renderUnsupported(analysis.unsupported);
  }

  return `
    <section class="notes-analysis-signals">
      <h4>局势推理</h4>
      <p>还没有能自动计算的信息。先在玩家行里录入共情、女裁、占卜、祖母、贵族、筑梦等结构化结果。</p>
    </section>
  `;
}

export function renderBeyondWorldlineAnalysis(game) {
  const analysis = analyzeWorlds(game);
  const evilSlots = analysis.setup.minion + analysis.setup.demon;

  if (!analysis.observations.length && !analysis.unsupported.length) {
    return "";
  }

  return `
    <section class="notes-analysis-panel notes-world-panel">
      <div class="notes-analysis-header">
        <div>
          <p class="eyebrow">局势推理 MVP</p>
          <h3>枚举邪恶方位置，再计算解释成本</h3>
        </div>
        <span>${game.playerCount}人局：邪恶 ${evilSlots}（爪牙 ${analysis.setup.minion} / 恶魔 ${analysis.setup.demon}）</span>
      </div>

      <section class="notes-analysis-signals">
        <h4>已读取的信息</h4>
        <ul>
          <li>${escapeHtml(`自动计算 ${analysis.observations.length} 条；枚举 ${analysis.worldsChecked} 个局势；暂未接入 ${analysis.unsupported.length} 条`)}</li>
          ${renderObservationList(analysis.observations, "暂无自动计算信息", 6)}
        </ul>
      </section>

      ${
        analysis.observations.length
          ? `
            ${renderSignals(analysis.signals)}
            <div class="notes-world-list">
              ${
                analysis.results.length
                  ? analysis.results.slice(0, 10).map(renderWorldResult).join("")
                  : "<p class=\"notes-analysis-empty\">没有找到可展示的局势。</p>"
              }
            </div>
            ${renderUnsupported(analysis.unsupported)}
          `
          : renderEmpty(analysis)
      }
    </section>
  `;
}
