// Reads a player's main ability record in either format:
// - v3: { version: 3, records: [{ phaseType, phaseNumber, targetEntries, resultEntries }] }
// - v2 (older clients): { targetEntries, resultEntries } where row i is implied by position.
// Rows come back in phase order as { target, result, index, phaseType, phaseNumber, entryIndex }.

function isPhasedRoleInfo(roleInfo) {
  return Number(roleInfo?.version) === 3 && Array.isArray(roleInfo?.records);
}

function phaseOrderIndex(phaseType, phaseNumber) {
  if (phaseType !== "night" && phaseType !== "day") {
    return -1;
  }
  return (Number(phaseNumber) || 1) * 2 + (phaseType === "day" ? 1 : 0);
}

function normalizePhase(record) {
  if (record?.phaseType !== "night" && record?.phaseType !== "day") {
    return { phaseType: "", phaseNumber: 0 };
  }
  const phaseNumber = Math.min(Math.max(Math.trunc(Number(record.phaseNumber)) || 1, 1), 99);
  return { phaseType: record.phaseType, phaseNumber };
}

function asEntries(value) {
  return Array.isArray(value) ? value : [];
}

function getRoleInfoRows(roleInfo) {
  if (isPhasedRoleInfo(roleInfo)) {
    const records = roleInfo.records
      .filter((record) => record && typeof record === "object")
      .map((record) => ({ ...normalizePhase(record), record }))
      .sort((left, right) => phaseOrderIndex(left.phaseType, left.phaseNumber) - phaseOrderIndex(right.phaseType, right.phaseNumber));
    const rows = [];
    records.forEach(({ phaseType, phaseNumber, record }) => {
      const targets = asEntries(record.targetEntries);
      const results = asEntries(record.resultEntries);
      for (let entryIndex = 0; entryIndex < Math.max(targets.length, results.length); entryIndex += 1) {
        rows.push({
          target: targets[entryIndex] || {},
          result: results[entryIndex] || {},
          index: rows.length,
          phaseType,
          phaseNumber,
          entryIndex,
        });
      }
    });
    return rows;
  }

  const targetEntries = asEntries(roleInfo?.targetEntries);
  const resultEntries = asEntries(roleInfo?.resultEntries);
  const rowCount = Math.max(targetEntries.length, resultEntries.length);
  return Array.from({ length: rowCount }, (_, index) => ({
    target: targetEntries[index] || {},
    result: resultEntries[index] || {},
    index,
    phaseType: "",
    phaseNumber: 0,
    entryIndex: index,
  }));
}

function countRoleInfoRows(roleInfo) {
  if (isPhasedRoleInfo(roleInfo)) {
    return roleInfo.records.reduce(
      (total, record) =>
        total + Math.max(asEntries(record?.targetEntries).length, asEntries(record?.resultEntries).length),
      0,
    );
  }
  return Math.max(asEntries(roleInfo?.targetEntries).length, asEntries(roleInfo?.resultEntries).length);
}

function describeRowPhase(row) {
  if (row.phaseType === "night" || row.phaseType === "day") {
    const base = `第${row.phaseNumber}${row.phaseType === "day" ? "天" : "夜"}`;
    return row.entryIndex > 0 ? `${base}第${row.entryIndex + 1}条` : base;
  }
  return `第${row.index + 1}条`;
}

module.exports = {
  countRoleInfoRows,
  describeRowPhase,
  getRoleInfoRows,
};
