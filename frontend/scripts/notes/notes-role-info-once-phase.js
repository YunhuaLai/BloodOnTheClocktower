// Phase picked in the phase picker of an unused once-per-game ability row (see buildRoleInfoForm).
// Nothing is recorded until a field is filled, so the choice lives only in memory: after a reload the row
// falls back to the latest phase the ability could have been used in.

const choices = new Map();

function getKey(playerId, roleId) {
  return `${playerId || ""}:${roleId || ""}`;
}

export function getOncePhaseChoice(playerId, roleId) {
  return choices.get(getKey(playerId, roleId)) || null;
}

export function setOncePhaseChoice(playerId, roleId, phase) {
  const key = getKey(playerId, roleId);
  if (phase?.phaseType) {
    choices.set(key, { phaseType: phase.phaseType, phaseNumber: Number(phase.phaseNumber) || 0 });
  } else {
    choices.delete(key);
  }
}
