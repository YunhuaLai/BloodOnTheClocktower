import { state } from "../state.js";
import { escapeHtml, renderSelectOptions } from "../utils.js";
import { getMaxSeatNumber } from "./notes-core.js";
import { renderRoleInfoFieldControl } from "./notes-role-info-fields.js";
import { formatRoleInfoEntrySummary, getRoleInfoNode, getRoleInfoSectionLabel } from "./notes-role-info.js";
import { acquiredCertaintyLabels, acquiredPhaseIndex, acquiredPhaseLabel, acquiredStatusLabels, findAcquiredRole, getAcquiredAbilities, getAcquiredMinimumRows, getAcquisitionKind, hasAcquiredRecords, isAcquiredAbilityActive } from "./notes-acquired-abilities.js";

function options(labels, selected) {
  return renderSelectOptions(Object.entries(labels).map(([value, label]) => ({ value, label })), selected);
}

function selectField(key, label, labels, value) {
  return `<label class="notes-roleinfo-field"><span>${label}</span><select data-acquired-field="${key}">${options(labels, value)}</select></label>`;
}

function phaseFields(prefix, label, ability) {
  return `<div class="notes-acquired-phase">
    <label class="notes-roleinfo-field"><span>${label}</span><input aria-label="${label}序号" type="number" min="1" max="99" data-acquired-field="${prefix}PhaseNumber" value="${escapeHtml(ability[`${prefix}PhaseNumber`] || "")}" /></label>
    <label class="notes-roleinfo-field"><span>阶段</span><select aria-label="${label}阶段" data-acquired-field="${prefix}PhaseType">${options({ night: "夜晚", day: "白天" }, ability[`${prefix}PhaseType`])}</select></label>
  </div>`;
}

function renderAcquiredRecord(ability, record, role, game) {
  const sections = ["target", "result"].map((section) => {
    const node = getRoleInfoNode(role.abilityData, section);
    if (node.repeatMode === "none" || !node.fields.length) return "";
    const entries = record.roleInfo?.[`${section}Entries`] || [];
    const minimum = getAcquiredMinimumRows(node);
    const rows = Array.from({ length: Math.max(entries.length, minimum) }, (_, index) => entries[index] || {});
    const repeatable = ["sequence", "variable"].includes(node.repeatMode);
    return `<section class="notes-roleinfo-section">
      <strong>${escapeHtml(getRoleInfoSectionLabel(section, role.abilityData))}</strong>
      ${rows.map((entry, index) => `<div class="notes-roleinfo-row">
        <span class="notes-roleinfo-index">${index + 1}</span>
        <div class="notes-roleinfo-fields notes-roleinfo-fields--${Math.min(node.fields.length, 3)}">
          ${node.fields.map((field) => renderRoleInfoFieldControl(section, index, field, entry[field.key], game, getMaxSeatNumber(game))).join("")}
        </div>
      </div>`).join("")}
      ${repeatable ? `<div class="notes-roleinfo-actions">
        <button type="button" class="note-icon-button" data-notes-action="add-roleinfo-row" data-section="${section}">+ 一条</button>
        <button type="button" class="note-icon-button" data-notes-action="remove-roleinfo-row" data-section="${section}" ${rows.length <= minimum ? "disabled" : ""}>- 末条</button>
      </div>` : ""}
    </section>`;
  }).join("");
  const summary = ["target", "result"].flatMap((section) => {
    const fields = getRoleInfoNode(role.abilityData, section).fields;
    return (record.roleInfo?.[`${section}Entries`] || []).map((entry) => formatRoleInfoEntrySummary(entry, fields)).filter(Boolean);
  }).join(" / ");
  const isCurrent = record.phaseType === game.phaseType && record.phaseNumber === Number(game.phaseNumber);
  return `<details class="notes-acquired-record" data-acquired-phase-type="${record.phaseType}" data-acquired-phase-number="${record.phaseNumber}" ${isCurrent ? "open" : ""}>
    <summary>${acquiredPhaseLabel(record.phaseType, record.phaseNumber)} · ${escapeHtml(summary || "行动记录")}</summary>
    ${sections || `<p class="notes-inline-hint">此能力无需结构化录入，可在能力备注中记录。</p>`}
  </details>`;
}

function renderAbility(ability, player, game, source, listId) {
  const role = findAcquiredRole(ability.role);
  const locked = hasAcquiredRecords(ability);
  const records = [...ability.records];
  const currentRecorded = records.some((record) => record.phaseType === game.phaseType && record.phaseNumber === Number(game.phaseNumber));
  if (isAcquiredAbilityActive(ability, game) && role && !currentRecorded) {
    records.push({ phaseType: game.phaseType, phaseNumber: Number(game.phaseNumber), roleInfo: {} });
  }
  records.sort((a, b) => acquiredPhaseIndex(a.phaseType, a.phaseNumber) - acquiredPhaseIndex(b.phaseType, b.phaseNumber));
  const phaseText = ability.status === "pending" ? "" : `${acquiredPhaseLabel(ability.startPhaseType, ability.startPhaseNumber)}起${ability.endPhaseNumber ? `，${acquiredPhaseLabel(ability.endPhaseType, ability.endPhaseNumber)}结束` : ""}`;
  return `<details class="notes-acquired-ability" data-acquired-id="${escapeHtml(ability.id)}" ${ability.status !== "ended" ? "open" : ""}>
    <summary><strong>${escapeHtml(role?.name || ability.role || "未知能力")}</strong>
      <span class="notes-roleinfo-tag">${acquiredStatusLabels[ability.status]}</span>
      <span>${escapeHtml(phaseText)}</span>
    </summary>
    <div class="notes-acquired-fields">
      <label class="notes-roleinfo-field"><span>获得的角色能力</span><input data-acquired-field="role" list="${listId}" value="${escapeHtml(ability.role)}" placeholder="搜索角色，可留空表示未知" autocomplete="off" ${locked ? "readonly" : ""} /></label>
      ${selectField("status", "状态", locked ? { active: "已获得", ended: "已结束" } : acquiredStatusLabels, ability.status)}
      ${selectField("kind", "持续方式", { continuous: "持续", replaceable: "可替换" }, ability.kind)}
      ${source === "player" ? selectField("certainty", "信息把握", acquiredCertaintyLabels, ability.certainty) : ""}
      ${ability.status !== "pending" ? phaseFields("start", "生效于", ability) : ""}
      ${ability.status === "ended" ? phaseFields("end", "结束于", ability) : ""}
      <label class="notes-roleinfo-field"><span>来源玩家（可选）</span><select data-acquired-field="sourceSeat"><option value="">未指定</option>${game.players.map((item) => `<option value="${item.seat}" ${String(item.seat) === ability.sourceSeat ? "selected" : ""}>${item.seat}号${item.name ? ` · ${escapeHtml(item.name)}` : ""}</option>`).join("")}</select></label>
      <label class="notes-roleinfo-field"><span>能力备注</span><input data-acquired-field="note" value="${escapeHtml(ability.note)}" placeholder="触发条件、判断依据等" /></label>
    </div>
    <p class="notes-inline-hint">${escapeHtml(ability.ownerRole ? `获得时身份：${ability.ownerRole}。` : "")}${locked ? "已有行动记录，换能力请新增一项。" : ""}${ability.status === "pending" ? "满足条件后将状态改为“已获得”，再录入行动。" : ""}</p>
    ${ability.role && !role ? `<p class="notes-inline-hint">未匹配到角色，请从搜索候选中选择。</p>` : ""}
    ${role ? `<p class="notes-inline-hint">${escapeHtml(role.ability || "")}</p>${records.map((record) => renderAcquiredRecord(ability, record, role, game)).join("")}` : `<p class="notes-inline-hint">能力未知时可先记来源和备注，确定角色后展开对应记录表。</p>`}
    ${!locked ? `<button type="button" class="note-icon-button" data-notes-action="remove-acquired-ability">删除此项</button>` : ""}
  </details>`;
}

export function renderAcquiredAbilities(player, game, source = "player") {
  const abilities = getAcquiredAbilities(player, source);
  const owner = source === "storyteller" ? player.trueRole : player.claim;
  if (!owner && !abilities.length) return "";
  const kind = getAcquisitionKind(owner);
  const listId = `acquired-roles-${source}-${player.id}`;
  const hints = {
    philosopher: "选择学到的角色，设为已获得后记录该能力的行动。",
    pixie: "先记得知的角色并保持待触发；满足条件、获得能力后再启用。",
    cannibal: "记录最近被处决且死亡的来源玩家；有新的来源时新增能力，启用后结束上一项可替换能力。",
    other: "记录额外获得的角色能力及生效阶段。",
  };
  const candidates = state.roles.filter((role) => !["fabled", "token"].includes(role.type));
  return `<section class="notes-acquired-panel" data-acquired-source="${source}" data-player-id="${escapeHtml(player.id)}">
    <div class="notes-roleinfo-section-header"><strong>获得的能力</strong><button type="button" class="note-icon-button" data-notes-action="add-acquired-ability">+ 新增能力</button></div>
    <p class="notes-inline-hint">${hints[kind]}${source === "player" && kind === "cannibal" ? " 不确定角色时可标为未知或推测。" : ""}</p>
    <datalist id="${listId}">${candidates.map((role) => `<option value="${escapeHtml(role.name)}"></option>`).join("")}</datalist>
    ${abilities.map((ability) => renderAbility(ability, player, game, source, listId)).join("")}
  </section>`;
}
