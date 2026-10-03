import { createEmptyRoleInfo, getActiveGame } from "../notes-state.js";
import { state } from "../state.js";
import { createId } from "../utils.js";
import { ensurePlayerDraftForId, persistPlayerDraft } from "./notes-player-actions.js";
import { getRoleInfoNode } from "./notes-role-info.js";
import { acquiredPhaseIndex, findAcquiredRole, getAcquiredMinimumRows, getAcquisitionKind, hasAcquiredRecords, isAcquiredAbilityActive } from "./notes-acquired-abilities.js";
import { renderNotesPage } from "./notes-shell.js";

function getContext(playerId, source, abilityId) {
  const game = getActiveGame();
  if (!game || !["player", "storyteller"].includes(source) || (source === "storyteller" && (game.mode !== "storyteller" || state.notes.ui.activeTab !== "storyteller"))) return null;
  const draft = ensurePlayerDraftForId(playerId);
  if (!draft) return null;
  const ability = draft.acquiredAbilities.find((item) => item.id === abilityId && item.source === source);
  return { game, draft, ability };
}

export function addAcquiredAbility(playerId, source = "player") {
  const context = getContext(playerId, source);
  if (!context) return null;
  const { game, draft } = context;
  const ownerRole = source === "storyteller" ? draft.trueRole : draft.claim;
  const kind = getAcquisitionKind(ownerRole);
  const ability = {
    id: createId("acquired"), source, ownerRole, role: "",
    kind: kind === "cannibal" ? "replaceable" : "continuous",
    status: "pending", certainty: kind === "cannibal" ? "unknown" : "known",
    startPhaseType: game.phaseType, startPhaseNumber: game.phaseNumber,
    endPhaseType: game.phaseType, endPhaseNumber: null,
    sourceSeat: "", note: "", records: [],
  };
  draft.acquiredAbilities.push(ability);
  return ability;
}

export function updateAcquiredAbility(playerId, source, abilityId, field, value) {
  const context = getContext(playerId, source, abilityId);
  if (!context?.ability) return false;
  const { ability, game, draft } = context;
  if (field === "role") {
    if (hasAcquiredRecords(ability)) return false;
    if (ability.role !== String(value || "")) ability.records = [];
    ability.role = String(value || "");
    if (ability.role.trim() && ability.certainty === "unknown") ability.certainty = "suspected";
  } else if (field === "status" && ["pending", "active", "ended"].includes(value)) {
    if (ability.status === value) return false;
    if (value === "pending" && hasAcquiredRecords(ability)) return false;
    if (value === "active") {
      if (ability.status === "pending") {
        ability.startPhaseType = game.phaseType;
        ability.startPhaseNumber = game.phaseNumber;
      }
      ability.endPhaseNumber = null;
      if (ability.kind === "replaceable") {
        draft.acquiredAbilities.filter((item) => item.id !== ability.id && item.source === source && item.ownerRole === ability.ownerRole && item.kind === "replaceable" && item.status === "active").forEach((item) => {
          item.status = "ended";
          item.endPhaseType = ability.startPhaseType;
          item.endPhaseNumber = ability.startPhaseNumber;
        });
      }
    } else if (value === "ended") {
      const afterStart = acquiredPhaseIndex(game.phaseType, game.phaseNumber) >= acquiredPhaseIndex(ability.startPhaseType, ability.startPhaseNumber);
      ability.endPhaseType = afterStart ? game.phaseType : ability.startPhaseType;
      ability.endPhaseNumber = afterStart ? game.phaseNumber : ability.startPhaseNumber;
    } else {
      ability.endPhaseNumber = null;
    }
    ability.status = value;
  } else if (field === "kind" && ["continuous", "replaceable"].includes(value)) {
    ability.kind = value;
  } else if (field === "certainty" && source === "player" && ["known", "suspected", "unknown"].includes(value)) {
    ability.certainty = value;
  } else if (["startPhaseType", "endPhaseType"].includes(field) && ["day", "night"].includes(value)) {
    ability[field] = value;
  } else if (["startPhaseNumber", "endPhaseNumber"].includes(field)) {
    ability[field] = Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), 99);
  } else if (field === "sourceSeat") {
    ability.sourceSeat = game.players.some((player) => String(player.seat) === String(value)) ? String(value) : "";
  } else if (field === "note") {
    ability.note = String(value || "");
  } else {
    return false;
  }
  if (ability.endPhaseNumber && acquiredPhaseIndex(ability.endPhaseType, ability.endPhaseNumber) < acquiredPhaseIndex(ability.startPhaseType, ability.startPhaseNumber)) {
    ability.endPhaseType = ability.startPhaseType;
    ability.endPhaseNumber = ability.startPhaseNumber;
  }
  return true;
}

function getRecordContext(playerId, source, abilityId, phaseType, phaseNumber) {
  const context = getContext(playerId, source, abilityId);
  if (!context?.ability) return null;
  const { ability, game } = context;
  const role = findAcquiredRole(ability.role);
  if (!role || !["day", "night"].includes(phaseType) || !Number.isInteger(phaseNumber) || phaseNumber < 1 || phaseNumber > 99) return null;
  let record = ability.records.find((item) => item.phaseType === phaseType && item.phaseNumber === phaseNumber);
  if (!record) {
    if (phaseType !== game.phaseType || phaseNumber !== Number(game.phaseNumber) || !isAcquiredAbilityActive(ability, game)) return null;
    record = { phaseType, phaseNumber, roleInfo: createEmptyRoleInfo(role.id) };
    ability.records.push(record);
  }
  return { ...context, role, record };
}

export function updateAcquiredRecord(playerId, source, abilityId, phaseType, phaseNumber, section, index, fieldKey, value, cycle = false) {
  if (!["target", "result"].includes(section) || !Number.isInteger(index) || index < 0 || index >= 99) return false;
  const context = getRecordContext(playerId, source, abilityId, phaseType, phaseNumber);
  if (!context) return false;
  const { record, role } = context;
  const node = getRoleInfoNode(role.abilityData, section);
  const field = node.fields.find((item) => item.key === fieldKey);
  if (!field || node.repeatMode === "none" || (node.repeatMode === "once" && index >= Math.max(node.defaultRows, 1))) return false;
  const entries = record.roleInfo[`${section}Entries`];
  while (entries.length <= index) entries.push({});
  if (cycle) {
    if (field.type !== "boolean") return false;
    const values = ["", "yes", "no"];
    value = values[(values.indexOf(String(entries[index][fieldKey] || "")) + 1) % values.length];
  }
  entries[index][fieldKey] = String(value ?? "");
  return true;
}

export function adjustAcquiredRecordRows(playerId, source, abilityId, phaseType, phaseNumber, section, step) {
  const context = getRecordContext(playerId, source, abilityId, phaseType, phaseNumber);
  if (!context || !["target", "result"].includes(section)) return false;
  const { record, role } = context;
  const nodes = ["target", "result"].map((key) => ({ key, node: getRoleInfoNode(role.abilityData, key) }));
  const repeatable = nodes.filter(({ node }) => ["sequence", "variable"].includes(node.repeatMode) && node.fields.length);
  if (!repeatable.some(({ key }) => key === section)) return false;
  repeatable.forEach(({ key, node }) => {
    const entries = record.roleInfo[`${key}Entries`];
    const minimum = getAcquiredMinimumRows(node);
    while (entries.length < minimum) entries.push({});
    if (step > 0 && entries.length < 99) entries.push({});
    if (step < 0 && entries.length > minimum) entries.pop();
  });
  return true;
}

function persistInline(playerId) {
  if (["overview", "storyteller"].includes(state.notes.ui.activeTab)) persistPlayerDraft(playerId);
}

function getElementContext(element) {
  const panel = element.closest(".notes-acquired-panel");
  if (!panel) return null;
  const card = element.closest("[data-acquired-id]");
  const record = element.closest("[data-acquired-phase-type]");
  return {
    playerId: panel.dataset.playerId, source: panel.dataset.acquiredSource,
    abilityId: card?.dataset.acquiredId,
    phaseType: record?.dataset.acquiredPhaseType,
    phaseNumber: Number(record?.dataset.acquiredPhaseNumber),
  };
}

export function handleAcquiredFieldChange(target, refreshInterface) {
  const context = getElementContext(target);
  if (!context) return false;
  const { playerId, source, abilityId, phaseType, phaseNumber } = context;
  if (target.dataset.acquiredField) {
    updateAcquiredAbility(playerId, source, abilityId, target.dataset.acquiredField, target.value);
  } else if (target.dataset.roleinfoField) {
    updateAcquiredRecord(playerId, source, abilityId, phaseType, phaseNumber, target.dataset.roleinfoSection, Number(target.dataset.roleinfoRow), target.dataset.roleinfoField, target.value);
  }
  persistInline(playerId);
  if (refreshInterface) renderNotesPage();
  return true;
}

export function handleAcquiredAction(action, button) {
  const context = getElementContext(button);
  if (!context) return false;
  const { playerId, source, abilityId, phaseType, phaseNumber } = context;
  if (action === "add-acquired-ability") {
    addAcquiredAbility(playerId, source);
  } else if (action === "remove-acquired-ability") {
    const editable = getContext(playerId, source, abilityId);
    if (editable?.ability && !hasAcquiredRecords(editable.ability)) editable.draft.acquiredAbilities = editable.draft.acquiredAbilities.filter((item) => item.id !== abilityId);
  } else if (action === "cycle-roleinfo-field") {
    updateAcquiredRecord(playerId, source, abilityId, phaseType, phaseNumber, button.dataset.section, Number(button.dataset.row), button.dataset.field, "", true);
  } else if (["add-roleinfo-row", "remove-roleinfo-row"].includes(action)) {
    adjustAcquiredRecordRows(playerId, source, abilityId, phaseType, phaseNumber, button.dataset.section, action === "add-roleinfo-row" ? 1 : -1);
  } else {
    return false;
  }
  persistInline(playerId);
  renderNotesPage();
  return true;
}
