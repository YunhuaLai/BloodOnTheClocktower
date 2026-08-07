import { escapeHtml } from "../utils.js";
import { getDraftOrPlayer } from "../notes-state.js";
import { getCachedWorldlineAnalysis, loadWorldlineAnalysis } from "./notes-analysis-client.js";

let analysisRenderId = 0;

const deductionStatusLabels = {
  missing: "尚未建模",
  candidate: "候选规则待接入",
  manual: "需要人工判断",
  world_effect: "涉及全局效果",
};

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
    return "<li>无冲突信息</li>";
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
  const matchScore = result.matchScore ?? result.likelihood ?? 0;
  return `
    <article class="notes-world-card notes-world-card--${escapeHtml(result.classification)}">
      <div class="notes-world-card-head">
        <div>
          <strong>局势 ${index + 1}</strong>
          <span>${escapeHtml(result.classificationLabel)}</span>
        </div>
        <em>匹配 ${matchScore}/100</em>
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
          <ul>${renderObservationList(result.trueObservations, "暂无成立信息")}</ul>
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
      <h4>未参与本次排序</h4>
      <p>这些记录会保留，但不会影响下方相对匹配分。</p>
      <details class="notes-analysis-details">
        <summary>查看全部 ${unsupported.length} 条</summary>
        <ul>
          ${unsupported
            .map(
              (item) => `
                <li>
                  <span>${escapeHtml(item.label)}</span>
                  <small>${escapeHtml(deductionStatusLabels[item.status] || item.status || "未支持")}</small>
                </li>
              `,
            )
            .join("")}
        </ul>
      </details>
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
      <p>暂无可计算信息。</p>
    </section>
  `;
}

function renderAnalysisPanel(game, analysis) {
  const evilSlots = analysis.setup.minion + analysis.setup.demon;
  const totalEvidence = analysis.observations.length + analysis.unsupported.length;
  const coverage = totalEvidence
    ? Math.round((analysis.observations.length / totalEvidence) * 100)
    : 0;

  if (!analysis.observations.length && !analysis.unsupported.length) {
    return "";
  }

  return `
    <section class="notes-analysis-panel notes-world-panel">
      <div class="notes-analysis-header">
        <div>
          <p class="eyebrow">局势推理</p>
          <h3>枚举邪恶方位置，再计算解释成本 <small>实验功能</small></h3>
        </div>
        <span>${game.playerCount}人局：邪恶 ${evilSlots}（爪牙 ${analysis.setup.minion} / 恶魔 ${analysis.setup.demon}）</span>
      </div>

      <section class="notes-analysis-signals">
        <h4>证据覆盖 ${coverage}%</h4>
        <p>匹配分只用于比较本次候选局势，不代表真实概率。</p>
        <ul>
          <li>${escapeHtml(`参与排序 ${analysis.observations.length} 条；未参与 ${analysis.unsupported.length} 条；枚举 ${analysis.worldsChecked} 个局势`)}</li>
          ${renderObservationList(analysis.observations, "暂无计算信息", 6)}
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
                  : "<p class=\"notes-analysis-empty\">暂无局势。</p>"
              }
            </div>
            ${renderUnsupported(analysis.unsupported)}
          `
          : renderEmpty(analysis)
      }
    </section>
  `;
}

function buildAnalysisGame(game) {
  return {
    ...game,
    players: game.players.map((player) => getDraftOrPlayer(player)),
  };
}

function renderAnalysisLoading(panelId) {
  return `
    <section class="notes-analysis-panel notes-world-panel" id="${escapeHtml(panelId)}">
      <div class="notes-analysis-header">
        <div>
          <p class="eyebrow">局势推理</p>
          <h3>正在计算局势</h3>
        </div>
      </div>
    </section>
  `;
}

function renderAnalysisError() {
  return `
    <section class="notes-analysis-signals notes-analysis-signals--muted">
      <h4>局势推理</h4>
      <p>暂无推理结果。</p>
    </section>
  `;
}

async function hydrateAnalysis(panelId, game) {
  const panel = document.getElementById(panelId);
  if (!panel) {
    return;
  }

  try {
    const analysis = await loadWorldlineAnalysis(game);
    const currentPanel = document.getElementById(panelId);
    if (!currentPanel) {
      return;
    }

    const html = renderAnalysisPanel(game, analysis);
    if (html) {
      currentPanel.outerHTML = html;
    } else {
      currentPanel.remove();
    }
  } catch (error) {
    console.error(error);
    const currentPanel = document.getElementById(panelId);
    if (currentPanel) {
      currentPanel.outerHTML = renderAnalysisError();
    }
  }
}

export function renderBeyondWorldlineAnalysis(game) {
  const analysisGame = buildAnalysisGame(game);
  const cachedAnalysis = getCachedWorldlineAnalysis(analysisGame);

  if (cachedAnalysis) {
    return renderAnalysisPanel(analysisGame, cachedAnalysis);
  }

  const panelId = `notesWorldAnalysis-${(analysisRenderId += 1)}`;
  queueMicrotask(() => hydrateAnalysis(panelId, analysisGame));
  return renderAnalysisLoading(panelId);
}
