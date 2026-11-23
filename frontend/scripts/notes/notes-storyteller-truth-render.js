import { escapeHtml } from "../utils.js";
import { computeRoleInfoTruth } from "./notes-storyteller-truth.js";

// Storyteller-only: "应给" strip under an ability record row. Suggestions are buttons that write the
// suggested values only when tapped; nothing is filled automatically, and a filled value that differs
// from the truth is only flagged (the storyteller may be giving false info on purpose).

export function encodeTruthFill(fill) {
  return new URLSearchParams(Object.entries(fill || {})).toString();
}

export function decodeTruthFill(value) {
  return Object.fromEntries(new URLSearchParams(String(value || "")).entries());
}

// Fingerprint of the target entry a suggestion was computed from. A tap whose basis no longer matches the
// stored target (e.g. the target was retyped without leaving the field) must not write a stale value.
export function encodeTruthBasis(target) {
  return new URLSearchParams(
    Object.entries(target || {})
      .filter(([, value]) => String(value ?? "").trim())
      .map(([key, value]) => [key, String(value).trim()])
      .sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
}

function phaseData(row) {
  return `data-roleinfo-row="${Number(row.entryIndex) || 0}" data-roleinfo-phase-type="${escapeHtml(row.phaseType || "")}" data-roleinfo-phase-number="${Number(row.phaseNumber) || 0}"`;
}

function isApplied(fill, result) {
  return Object.entries(fill).every(([key, value]) => String(result?.[key] ?? "") === String(value));
}

export function renderTruthSuggestion(truth, row, result = {}, target = {}) {
  if (!truth || truth.status === "unsupported") {
    return "";
  }

  if (truth.status !== "ok") {
    return `
      <div class="story-truth story-truth--unavailable" role="note">
        <span class="story-truth-label">应给</span>
        <small class="story-truth-hint">无法计算：${escapeHtml(truth.reason)}</small>
      </div>
    `;
  }

  const classes = ["story-truth"];
  if (truth.misinfo) classes.push("story-truth--misinfo");
  if (truth.mismatch) classes.push("story-truth--mismatch");
  const chips = truth.suggestions
    .map((suggestion) => {
      const applied = isApplied(suggestion.fill, result);
      return `
        <button
          type="button"
          class="story-truth-chip${applied ? " is-applied" : ""}"
          data-notes-action="apply-roleinfo-suggestion"
          data-truth-fill="${escapeHtml(encodeTruthFill(suggestion.fill))}"
          data-truth-basis="${escapeHtml(encodeTruthBasis(target))}"
          ${phaseData(row)}
          aria-pressed="${applied ? "true" : "false"}"
          title="填入：${escapeHtml(suggestion.label)}"
        >${escapeHtml(suggestion.label)}</button>
      `;
    })
    .join("");
  const notes = [
    truth.misinfo ? "行动者中毒/醉酒：可给假信息，以上为真实值" : "",
    truth.mismatch ? "已填结果与真实情况不同" : "",
    truth.hint,
    truth.detail,
    ...truth.notes,
  ].filter(Boolean);

  return `
    <div class="${classes.join(" ")}" role="group" aria-label="按真实身份应给的结果">
      <span class="story-truth-label">${truth.exact ? "应给" : "可给"}</span>
      ${chips ? `<span class="story-truth-chips">${chips}</span>` : ""}
      ${notes.map((note) => `<small class="story-truth-hint">${escapeHtml(note)}</small>`).join("")}
    </div>
  `;
}

/**
 * Builds the renderRowExtra callback for renderRoleInfoForm.
 * getEntries(row) -> { target, result } of that row; rows = every row of the ability (all-target templates).
 */
export function createTruthRowRenderer({ abilityData, sourceRole, source, game, resolveRole, getEntries, rows = null }) {
  if (game?.mode !== "storyteller" || !abilityData?.deduction || !source) {
    return null;
  }

  const resolved = new Map();
  const cachedResolve = (name) => {
    const key = String(name ?? "");
    if (!resolved.has(key)) resolved.set(key, resolveRole(name));
    return resolved.get(key);
  };

  return (row) => {
    // Only rows that show result inputs get a strip, and only with chips for the inputs shown there.
    const resultKeys = new Set((row.cells || []).filter((cell) => cell.section === "result").map((cell) => cell.field.key));
    if (!resultKeys.size) {
      return "";
    }

    const { target, result } = getEntries(row);
    const truth = computeRoleInfoTruth({
      abilityData,
      sourceRole,
      source,
      players: game.players,
      game,
      row: { phaseType: row.phaseType, phaseNumber: row.phaseNumber, target, result },
      rows,
      resolveRole: cachedResolve,
    });
    truth.suggestions = truth.suggestions.filter((suggestion) => Object.keys(suggestion.fill).every((key) => resultKeys.has(key)));
    return renderTruthSuggestion(truth, row, result, target);
  };
}
