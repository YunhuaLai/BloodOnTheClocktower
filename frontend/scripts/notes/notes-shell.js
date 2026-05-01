import { getClaimRoleOptions, getGameScript, renderRoleNameDatalist, renderScriptNameDatalist } from "../notes-claims.js";
import { createDefaultSetupDraft, ensureNotesState, getActiveGame, getDraftOrPlayer } from "../notes-state.js";
import { app, noteModeOptions, noteTabOptions, state, typeLabels } from "../state.js";
import { escapeHtml, getOptionLabel, renderSelectOptions } from "../utils.js";
import { formatPhaseLabel, getAliveCount, getStandardSetup } from "./notes-core.js";
import { renderOverviewTab } from "./notes-overview-render.js";
import { renderPlayersTab } from "./notes-player-render.js";
import { getClaimedRole } from "./notes-role-info.js";
import { renderStorytellerTab } from "./notes-storyteller-render.js";
import { renderInferenceTab, renderTimelineTab } from "./notes-timeline-render.js";

// Split from notes-render.js. Keep script order in index.html.

export function renderNotesStageBar(game) {
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

export function getOverviewClaimedRoleIds(game) {
  return new Set(
    game.players
      .map((player) => getClaimedRole(getDraftOrPlayer(player), game)?.id || "")
      .filter(Boolean),
  );
}

export function renderScriptSheetRole(role, selectedRoleIds) {
  const isSelected = selectedRoleIds.has(role.id);
  return `
    <article class="notes-script-sheet-role${isSelected ? " is-selected" : ""}">
      <div class="notes-script-sheet-role-title">
        <strong>${escapeHtml(role.name)}</strong>
        <span>${escapeHtml(typeLabels[role.type] || role.type || "角色")}</span>
      </div>
      <p>${escapeHtml(role.ability || role.detail?.abilitySummary || "暂无能力文本")}</p>
    </article>
  `;
}

export function renderScriptSheetOverlay(game) {
  if (!state.notes.ui.scriptSheetOpen) {
    return "";
  }

  const script = getGameScript(game);
  const roles = getClaimRoleOptions(game).filter((role) => role.type !== "fabled");
  const selectedRoleIds = getOverviewClaimedRoleIds(game);
  const groupedRoles = ["townsfolk", "outsider", "minion", "demon"]
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
            <p class="eyebrow">当前剧本</p>
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
      </section>
    </div>
  `;
}

export function renderGameMeta(game) {
  const config = getStandardSetup(game.playerCount);
  const script = getGameScript(game);
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
                ${script ? "" : "disabled"}
              >剧本</button>
            `
            : ""
        }
      </div>
      <p class="notes-game-meta-line">
        ${game.playerCount} 人 / 镇民 ${config.townsfolk} / 外来者 ${config.outsider} / 爪牙 ${config.minion} / 恶魔 ${config.demon}
      </p>
      <p class="notes-game-meta-line">
        ${escapeHtml(game.scriptName || "未选剧本")} / ${escapeHtml(getOptionLabel(noteModeOptions, game.mode))}
      </p>
    </section>
    ${showScriptButton ? renderScriptSheetOverlay(game) : ""}
  `;
}

export function renderSetupSeatOptions(playerCount, selectedSeat) {
  return Array.from({ length: playerCount }, (_, index) => {
    const seat = index + 1;
    return `<option value="${seat}"${seat === selectedSeat ? " selected" : ""}>${seat}号位</option>`;
  }).join("");
}

export function renderSetupPage(notes) {
  const draft = state.notes.ui.setupDraft || createDefaultSetupDraft();
  const config = getStandardSetup(draft.playerCount);

  document.title = "创建对局房间";
  app.innerHTML = `
    <section class="notes-setup">
      <div class="notes-setup-panel">
        <p class="eyebrow">对局房间</p>
        <h1>先把这一局定下来</h1>
        <p class="lead">先选剧本、人数和自己的位置，创建后就直接进入对局总览；之后这里可以接入房间码和多人加入。</p>

        <form id="notesSetupForm" class="notes-setup-form">
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
            <button type="button" class="secondary-link" data-notes-action="cancel-create">返回对局房间</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

export function renderNotesHome(notes) {
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
              <p>还没有已保存的对局，先创建一局。</p>
            </section>
          `
      }
    </section>
  `;
}

export function renderTabContent(game) {
  const tab = state.notes.ui.activeTab;

  if (tab === "storyteller") {
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

export function renderTabBar() {
  const game = getActiveGame();
  const tabs =
    game?.mode === "storyteller"
      ? [
          ...noteTabOptions.slice(0, 1),
          { value: "storyteller", label: "说书人" },
          ...noteTabOptions.slice(1),
        ]
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

export function renderGamePage(notes, game) {
  document.title = `${game.title} · 对局房间`;
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
