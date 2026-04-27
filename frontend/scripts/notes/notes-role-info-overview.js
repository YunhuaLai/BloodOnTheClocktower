// Split from notes-role-info.js. Keep script order in index.html.

function isCompactRoleInfoField(field) {
  return ["number", "seat", "player", "boolean"].includes(field?.type);
}

function getRoleInfoFieldGridSize(fields) {
  const safeFields = Array.isArray(fields) ? fields : [];
  if (!safeFields.length) {
    return 1;
  }

  if (safeFields.some((field) => field?.type === "role")) {
    return Math.min(safeFields.length, 3);
  }

  if (safeFields.every((field) => isCompactRoleInfoField(field))) {
    return Math.min(safeFields.length, 5);
  }

  return Math.min(safeFields.length, 4);
}

function getRoleInfoEntryGridSize(field) {
  if (field?.type === "role") {
    return 3;
  }

  if (isCompactRoleInfoField(field)) {
    return 5;
  }

  return 4;
}

function chunkItems(items, size) {
  const safeItems = Array.isArray(items) ? items : [];
  const chunkSize = Math.max(Number(size) || 1, 1);
  const chunks = [];

  for (let index = 0; index < safeItems.length; index += chunkSize) {
    chunks.push(safeItems.slice(index, index + chunkSize));
  }

  return chunks;
}

function renderRoleInfoFieldGroup(sectionKey, rowIndex, fields, entry, game, maxSeat) {
  const safeFields = Array.isArray(fields) ? fields : [];
  if (!safeFields.length) {
    return "";
  }

  return `
    <div class="notes-roleinfo-fields notes-roleinfo-fields--${getRoleInfoFieldGridSize(safeFields)}">
      ${safeFields
        .map((field) =>
          renderRoleInfoFieldControl(
            sectionKey,
            rowIndex,
            field,
            entry?.[field.key],
            game,
            maxSeat,
          ),
        )
        .join("")}
    </div>
  `;
}

function renderRoleInfoEntrySequence(sectionKey, field, entries, game, maxSeat) {
  const gridSize = getRoleInfoEntryGridSize(field);
  return chunkItems(entries, gridSize)
    .map(
      (chunk) => `
        <div class="notes-roleinfo-row notes-roleinfo-row--compact">
          <span class="notes-roleinfo-index">${
            sectionKey === "target" ? "目" : "记"
          }</span>
          <div class="notes-roleinfo-fields notes-roleinfo-fields--${Math.max(chunk.length, 1)}">
            ${chunk
              .map(
                (entry) => `
                  <label class="notes-roleinfo-field notes-roleinfo-field--stacked">
                    <span>${entry.index + 1}</span>
                    ${renderRoleInfoFieldElement(
                      sectionKey,
                      entry.index,
                      field,
                      entry.value,
                      game,
                      maxSeat,
                    )}
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderOverviewRoleInfoInputs(player, game) {
  if (!player.claim) {
    return "";
  }

  const role = getClaimedRole(player, game);
  const abilityData = role?.abilityData || null;
  if (!role || !abilityData?.abilityMeta?.recordable) {
    return "";
  }

  const roleInfo = ensureRoleInfoMatchesClaim(player, game);
  const targetNode = getRoleInfoNode(abilityData, "target");
  const resultNode = getRoleInfoNode(abilityData, "result");
  const maxSeat = clampNumber(Number(game?.playerCount) || 15, 1, 15);
  const targetRows =
    targetNode.repeatMode === "none" || !targetNode.fields.length
      ? []
      : getDisplayedRoleInfoEntries(roleInfo, targetNode, "target");
  const resultRows =
    resultNode.repeatMode === "none" || !resultNode.fields.length
      ? []
      : getDisplayedRoleInfoEntries(roleInfo, resultNode, "result");
  const rowCount = Math.max(targetRows.length, resultRows.length);

  if (!rowCount) {
    return "";
  }

  const minimumRows = Math.max(
    targetNode.fields.length ? Math.max(targetNode.defaultRows || 0, 1) : 0,
    resultNode.fields.length ? Math.max(resultNode.defaultRows || 0, 1) : 0,
  );
  const allowRowAdjust =
    ["sequence", "variable"].includes(targetNode.repeatMode) ||
    ["sequence", "variable"].includes(resultNode.repeatMode);
  const rowAdjustSection =
    ["sequence", "variable"].includes(targetNode.repeatMode)
      ? "target"
      : ["sequence", "variable"].includes(resultNode.repeatMode)
        ? "result"
        : "target";
  const hasTargetFields = Boolean(targetNode.fields.length);
  const hasResultFields = Boolean(resultNode.fields.length);
  const targetSingleField = targetNode.fields.length === 1 ? targetNode.fields[0] : null;
  const resultSingleField = resultNode.fields.length === 1 ? resultNode.fields[0] : null;
  const usesSharedResultLayout =
    hasTargetFields &&
    hasResultFields &&
    targetRows.length > 1 &&
    resultRows.length <= 1 &&
    resultNode.repeatMode === "once";
  const usesTargetSequenceLayout =
    hasTargetFields &&
    !hasResultFields &&
    targetRows.length > 1 &&
    targetNode.fields.length === 1;
  const usesResultSequenceLayout =
    !hasTargetFields &&
    hasResultFields &&
    resultRows.length > 1 &&
    resultNode.fields.length === 1;

  return `
    <section class="notes-roleinfo-section notes-roleinfo-section--overview">
      <div class="notes-roleinfo-section-header">
        <strong>${escapeHtml(getRoleInfoSectionLabel("result", abilityData))}</strong>
        <small>${escapeHtml(
          allowRowAdjust || rowCount > 1 ? "多条" : "单条",
        )}</small>
      </div>
      <div class="notes-roleinfo-list">
        ${
          usesSharedResultLayout
            ? `
              ${targetRows
                .map(
                  (targetEntry, index) => `
                    <div class="notes-roleinfo-row">
                      <span class="notes-roleinfo-index">${index + 1}</span>
                      ${renderRoleInfoFieldGroup(
                        "target",
                        index,
                        targetNode.fields,
                        targetEntry,
                        game,
                        maxSeat,
                      )}
                    </div>
                  `,
                )
                .join("")}
              <div class="notes-roleinfo-row notes-roleinfo-row--result">
                <span class="notes-roleinfo-index">记</span>
                ${renderRoleInfoFieldGroup(
                  "result",
                  0,
                  resultNode.fields,
                  resultRows[0] || {},
                  game,
                  maxSeat,
                )}
              </div>
            `
            : usesTargetSequenceLayout
              ? renderRoleInfoEntrySequence(
                  "target",
                  targetSingleField,
                  targetRows.map((entry, index) => ({
                    index,
                    value: entry?.[targetSingleField.key],
                  })),
                  game,
                  maxSeat,
                )
            : usesResultSequenceLayout
              ? renderRoleInfoEntrySequence(
                  "result",
                  resultSingleField,
                  resultRows.map((entry, index) => ({
                    index,
                    value: entry?.[resultSingleField.key],
                  })),
                  game,
                  maxSeat,
                )
              : hasTargetFields && hasResultFields
              ? Array.from({ length: rowCount }, (_, index) => {
                  const targetEntry = targetRows[index] || {};
                  const resultEntry = resultRows[index] || {};
                  const combinedFields = [...targetNode.fields, ...resultNode.fields];
                  return `
                    <div class="notes-roleinfo-row">
                      <span class="notes-roleinfo-index">${index + 1}</span>
                      <div class="notes-roleinfo-fields notes-roleinfo-fields--${getRoleInfoFieldGridSize(
                        combinedFields,
                      )}">
                        ${targetNode.fields
                          .map((field) =>
                            renderRoleInfoFieldControl(
                              "target",
                              index,
                              field,
                              targetEntry?.[field.key],
                              game,
                              maxSeat,
                            ),
                          )
                          .join("")}
                        ${resultNode.fields
                          .map((field) =>
                            renderRoleInfoFieldControl(
                              "result",
                              index,
                              field,
                              resultEntry?.[field.key],
                              game,
                              maxSeat,
                            ),
                          )
                          .join("")}
                      </div>
                    </div>
                  `;
                }).join("")
              : hasTargetFields
                ? targetRows
                    .map(
                      (targetEntry, index) => `
                        <div class="notes-roleinfo-row">
                          <span class="notes-roleinfo-index">${index + 1}</span>
                          ${renderRoleInfoFieldGroup(
                            "target",
                            index,
                            targetNode.fields,
                            targetEntry,
                            game,
                            maxSeat,
                          )}
                        </div>
                      `,
                    )
                    .join("")
                : resultRows
                    .map(
                      (resultEntry, index) => `
                        <div class="notes-roleinfo-row">
                          <span class="notes-roleinfo-index">${index + 1}</span>
                          ${renderRoleInfoFieldGroup(
                            "result",
                            index,
                            resultNode.fields,
                            resultEntry,
                            game,
                            maxSeat,
                          )}
                        </div>
                      `,
                    )
                    .join("")
        }
      </div>
      ${
        allowRowAdjust
          ? `
            <div class="notes-roleinfo-actions">
              <button
                type="button"
                class="note-icon-button"
                data-notes-action="add-roleinfo-row"
                data-player-id="${escapeHtml(player.id)}"
                data-section="${rowAdjustSection}"
              >+ 一条</button>
              <button
                type="button"
                class="note-icon-button"
                data-notes-action="remove-roleinfo-row"
                data-player-id="${escapeHtml(player.id)}"
                data-section="${rowAdjustSection}"
                ${rowCount <= minimumRows ? "disabled" : ""}
              >- 末条</button>
            </div>
          `
          : ""
      }
    </section>
  `;
}
