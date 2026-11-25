import { getDayExecutionDeathSeat, getDayNominatorSeats, getDayVotingSeats, hasDayActionHistory } from "./notes-day-records.js";

// Storyteller-only "what should this ability tell" calculator.
//
// Pure: takes the role's abilityData (deduction.templates), the row being recorded and the true grimoire
// (trueRole / trueAlignment / status / markers) and returns what the result fields are in truth. It mirrors
// the meaning of the backend checkers (backend/deduction/checkers.js + observations.js): the backend asks
// "is this recorded info consistent with a world", this asks "what does the real world say". The two must
// agree; tests/notes-storyteller-truth.test.js feeds each suggestion back through the backend checker.
// Intended differences (the backend's abstract worlds cannot express them): the Fortune Teller's red
// herring counts as the demon here, and travellers sit in the seat circle here (the backend drops them).
//
// Result:
// {
//   status: "ok" | "unavailable" | "unsupported",
//   reason,                     // why nothing can be computed (status !== "ok")
//   exact,                      // true: the suggestion is the single true answer; false: legal options only
//   suggestions: [{ label, fill: { fieldKey: value } }],
//   hint,                       // short text shown with option-style suggestions
//   mismatch,                   // true when filled result values contradict the truth (never an error)
//   misinfo,                    // the acting player is poisoned / drunk: false info is allowed
//   notes: [string],            // misregistration reminders (red herring, recluse, spy, ...)
// }

const POISONED_CONDITIONS = new Set(["poisoned", "drunk"]);
const POISON_MARKERS = new Set(["中毒", "醉酒"]);
const MISREGISTER_ROLES = {
  recluse: "可被当作邪恶/爪牙/恶魔",
  spy: "可被当作善良/镇民/外来者",
};
const RED_HERRING_PATTERN = /干扰/;
const MAX_SUGGESTIONS = 8;

const choiceLabels = {
  yes: "是",
  no: "否",
  clockwise: "左",
  counterclockwise: "右",
  storyteller_choice: "说书人选择",
};

function unavailable(reason) {
  return { status: "unavailable", reason, exact: false, suggestions: [], hint: "", mismatch: false, misinfo: false, notes: [] };
}

function unsupported(reason) {
  return { ...unavailable(reason), status: "unsupported" };
}

function text(value) {
  return String(value ?? "").trim();
}

function splitMarkers(value) {
  return text(value)
    .split(/[，,、；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function roleKey(role) {
  return text(role?.englishName || role?.en).toLowerCase().replace(/[\s_-]/g, "");
}

function roleAlignment(role) {
  if (["townsfolk", "outsider"].includes(role?.type)) return "good";
  if (["minion", "demon"].includes(role?.type)) return "evil";
  return "";
}

function isTraveller(player) {
  return Boolean(player?.isTraveller || player?.seatType === "traveller");
}

/**
 * True grimoire seen by the calculator. A "是X" marker of an identity-overlay role (酒鬼 / 疯子 / 提线木偶)
 * means the player's real character is X even though trueRole holds the role they believe they are.
 */
export function buildTruthPlayers(players, resolveRole) {
  return (Array.isArray(players) ? players : [])
    .map((player) => {
      const markers = splitMarkers(player?.storytellerNotes);
      const shownRole = resolveRole(player?.trueRole) || null;
      const overlayRole =
        markers
          .filter((marker) => marker.startsWith("是") && marker.length > 1)
          .map((marker) => resolveRole(marker.slice(1)))
          .find((role) => role?.setupMeta?.identityOverlay?.enabled || ["drunk", "lunatic", "marionette"].includes(roleKey(role))) ||
        null;
      const role = overlayRole || shownRole;
      const explicitAlignment = ["good", "evil"].includes(player?.trueAlignment) ? player.trueAlignment : "";
      // An unset traveller alignment is shown (and treated) as 好 by the storyteller inspector.
      const fallbackAlignment = roleAlignment(role) || (isTraveller(player) && player?.trueRole ? "good" : "");
      const alignment = overlayRole ? roleAlignment(overlayRole) || explicitAlignment : explicitAlignment || fallbackAlignment;
      return {
        seat: Number(player?.seat) || 0,
        role,
        shownRole,
        overlayRole,
        alignment,
        alive: (player?.status || "alive") === "alive",
        traveller: isTraveller(player),
        markers,
        condition: player?.condition || "",
      };
    })
    .filter((player) => player.seat > 0)
    .sort((left, right) => left.seat - right.seat);
}

function seatLabel(seat) {
  return `${seat}号`;
}

function valueLabel(value) {
  return choiceLabels[value] || String(value);
}

function normalizeSeat(value, truth) {
  const seat = Number.parseInt(value, 10);
  return truth.bySeat.has(seat) ? seat : 0;
}

function fieldsOf(abilityData, section) {
  return abilityData?.interactionSchema?.[section]?.fields || [];
}

// The first key of a template spec that the role's form really has (the spec lists aliases).
function specField(spec, abilityData, fallbackSource = "result") {
  if (!spec?.keys) return null;
  const source = spec.source || fallbackSource;
  const fields = fieldsOf(abilityData, source);
  const key = spec.keys.find((item) => fields.some((field) => field.key === item));
  return key ? { source, key, field: fields.find((field) => field.key === key) } : null;
}

function specFields(spec, abilityData) {
  if (!spec?.keys) return [];
  const source = spec.source || "result";
  const fields = fieldsOf(abilityData, source);
  return spec.keys.filter((key) => fields.some((field) => field.key === key)).map((key) => ({ source, key }));
}

function entryValue(row, ref) {
  return ref ? text((ref.source === "target" ? row.target : row.result)?.[ref.key]) : "";
}

function requireAlignment(players) {
  const missing = players.filter((player) => !player.alignment);
  return missing.length ? `${missing.map((player) => seatLabel(player.seat)).join("、")}未设置真实身份或阵营` : "";
}

function requireRole(players) {
  const missing = players.filter((player) => !player.role);
  return missing.length ? `${missing.map((player) => seatLabel(player.seat)).join("、")}未设置真实身份` : "";
}

const isEvil = (player) => player.alignment === "evil";
const isDemon = (player) => player.role?.type === "demon";
const isMinion = (player) => player.role?.type === "minion";

function circleIndex(truth, seat) {
  return truth.circle.findIndex((player) => player.seat === seat);
}

function aliveNeighbors(truth, seat) {
  const index = circleIndex(truth, seat);
  const count = truth.circle.length;
  if (index < 0 || count < 2) return [];
  const result = [];
  for (const direction of [-1, 1]) {
    for (let step = 1; step < count; step += 1) {
      const player = truth.circle[(index + direction * step + count * step) % count];
      if (player.seat !== seat && player.alive) {
        result.push(player);
        break;
      }
    }
  }
  return [...new Map(result.map((player) => [player.seat, player])).values()];
}

function circularSteps(truth, seatA, seatB) {
  const a = circleIndex(truth, seatA);
  const b = circleIndex(truth, seatB);
  const distance = Math.abs(a - b);
  return Math.min(distance, truth.circle.length - distance);
}

function clockwiseSteps(truth, fromSeat, toSeat) {
  const count = truth.circle.length;
  return ((circleIndex(truth, toSeat) - circleIndex(truth, fromSeat) + count) % count) || count;
}

function clockwiseBetween(truth, fromSeat, toSeat) {
  const count = truth.circle.length;
  const start = circleIndex(truth, fromSeat);
  const steps = clockwiseSteps(truth, fromSeat, toSeat);
  return Array.from({ length: Math.max(steps - 1, 0) }, (_, offset) => truth.circle[(start + offset + 1) % count]);
}

// The day an ability row refers to (same rule as the backend's dayNumberFromRow).
function dayNumberOf(row) {
  const explicit = ["day", "dayNumber", "phase"]
    .flatMap((key) => [row.target?.[key], row.result?.[key]])
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0);
  if (explicit) return explicit;
  if (row.phaseType === "night" && Number(row.phaseNumber) > 1) return Number(row.phaseNumber) - 1;
  if (row.phaseType === "day") return Number(row.phaseNumber);
  return 0;
}

function exactResult(fill, labels, involved, extra = {}) {
  const label = Object.keys(fill)
    .map((key) => labels[key] ?? valueLabel(fill[key]))
    .join(" · ");
  return {
    exact: true,
    suggestions: [{ label, fill }],
    involved,
    validate: (row) => Object.entries(fill).every(([key, value]) => {
      const current = text(row.result?.[key]);
      return !current || !String(value) || current === String(value);
    }),
    ...extra,
  };
}

function optionResult(suggestions, hint, involved, validate) {
  return { exact: false, suggestions: suggestions.slice(0, MAX_SUGGESTIONS), hint, involved, validate };
}

function booleanValue(value) {
  return value ? "yes" : "no";
}

function readBoolean(value) {
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "1", "是", "有"].includes(normalized)) return true;
  if (["no", "false", "0", "否", "无", "没有"].includes(normalized)) return false;
  return null;
}

function sameRole(role, value, resolveRole) {
  const other = resolveRole(value);
  return Boolean(role && other && (other.id === role.id || other.name === role.name));
}

function targetSeatsOf(spec, row, truth, abilityData) {
  const refs = specFields(spec, abilityData);
  const values = refs.map((ref) => entryValue(row, ref));
  return { refs, seats: [...new Set(values.map((value) => normalizeSeat(value, truth)).filter(Boolean))], filled: values.every(Boolean) };
}

const handlers = {
  adjacent_evil_pair_count(template, ctx) {
    const ref = specField(template.value, ctx.abilityData);
    if (!ref) return null;
    const missing = requireAlignment(ctx.truth.circle);
    if (missing) return missing;
    const count = ctx.truth.circle.filter((player, index) => {
      const next = ctx.truth.circle[(index + 1) % ctx.truth.circle.length];
      return ctx.truth.circle.length > 1 && isEvil(player) && isEvil(next);
    }).length;
    return exactResult({ [ref.key]: String(count) }, {}, ctx.truth.circle);
  },

  evil_count_group(template, ctx) {
    const { truth, row, abilityData, source } = ctx;
    if (template.fixedValue !== undefined && template.seats?.source !== "target") {
      // Noble-like: the storyteller picks the seats; only a constraint can be shown.
      const refs = specFields(template.seats, abilityData);
      const evil = truth.circle.filter(isEvil);
      return optionResult([], `所选${refs.length}人中须恰好${template.fixedValue}名邪恶（邪恶：${evil.map((player) => seatLabel(player.seat)).join("、") || "无"}）`, truth.circle, (current) => {
        const seats = refs.map((ref) => normalizeSeat(entryValue(current, ref), truth));
        if (seats.some((seat) => !seat)) return true;
        return seats.filter((seat) => isEvil(truth.bySeat.get(seat))).length === Number(template.fixedValue);
      });
    }

    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    let group;
    if (template.group === "source_alive_neighbors") {
      group = aliveNeighbors(truth, source.seat);
    } else if (template.group === "target_alive_neighbors") {
      const seat = normalizeSeat(entryValue(row, specField(template.seat, abilityData, "target")), truth);
      if (!seat) return "目标未填完";
      group = aliveNeighbors(truth, seat);
    } else if (template.group === "clockwise_between_source_and_target") {
      const seat = normalizeSeat(entryValue(row, specField(template.seat, abilityData, "target")), truth);
      if (!seat) return "目标未填完";
      group = clockwiseBetween(truth, source.seat, seat);
      if (seat === source.seat || !group.length) return "目标须与你之间隔着至少一名玩家";
      const target = truth.bySeat.get(seat);
      if (template.targetMustBeGood) {
        const missing = requireAlignment([target]);
        if (missing) return missing;
        if (isEvil(target)) return `${seatLabel(seat)}是邪恶：须给错误信息`;
      }
    } else {
      const target = targetSeatsOf(template.seats, row, truth, abilityData);
      if (!target.filled || !target.seats.length) return "目标未填完";
      group = target.seats.map((seat) => truth.bySeat.get(seat));
    }
    const missing = requireAlignment(group);
    if (missing) return missing;
    const count = group.filter(isEvil).length;
    return exactResult({ [ref.key]: String(count) }, {}, group, {
      detail: group.length ? `统计：${group.map((player) => player.seat).sort((a, b) => a - b).map(seatLabel).join("、")}` : "",
    });
  },

  good_player(template, ctx) {
    const { truth, abilityData, source, resolveRole } = ctx;
    const seatRef = specField(template.seat, abilityData);
    const roleRef = specField(template.role, abilityData);
    if (!seatRef) return null;
    const good = truth.circle.filter((player) => player.seat !== source.seat && player.alignment === "good" && !player.traveller);
    const suggestions = good.map((player) => ({
      label: roleRef && player.role ? `${seatLabel(player.seat)} · ${player.role.name}` : seatLabel(player.seat),
      fill: { [seatRef.key]: String(player.seat), ...(roleRef && player.role ? { [roleRef.key]: player.role.name } : {}) },
    }));
    const unknown = truth.circle.filter((player) => player.seat !== source.seat && !player.alignment && !player.traveller);
    return optionResult(suggestions, unknown.length ? `任选一名善良玩家（${requireAlignment(unknown)}）` : "任选一名善良玩家", truth.circle, (current) => {
      const seat = normalizeSeat(entryValue(current, seatRef), truth);
      if (!seat) return true;
      const player = truth.bySeat.get(seat);
      if (player.alignment !== "good") return false;
      const role = roleRef ? entryValue(current, roleRef) : "";
      return !role || sameRole(player.role, role, resolveRole);
    });
  },

  role_in_group(template, ctx) {
    const { truth, abilityData, source, resolveRole } = ctx;
    const roleRef = specField(template.role, abilityData);
    const seatRefs = specFields(template.seats, abilityData);
    if (!roleRef || !seatRefs.length || seatRefs[0].source !== "result") return null;
    const types = roleRef.field?.roleTypes || [];
    const candidates = truth.circle.filter(
      (player) => player.seat !== source.seat && player.role && (!types.length || types.includes(player.role.type)),
    );
    const noneRef = fieldsOf(abilityData, "result").find((field) => field.type === "boolean" && /^no_/.test(field.key));
    const suggestions = candidates.map((player) => ({
      label: `${seatLabel(player.seat)} · ${player.role.name}`,
      fill: { [seatRefs[0].key]: String(player.seat), [roleRef.key]: player.role.name, ...(noneRef ? { [noneRef.key]: "" } : {}) },
    }));
    if (!candidates.length && noneRef) {
      const unknown = truth.circle.filter((player) => !player.role);
      if (unknown.length) return requireRole(unknown);
      const clear = Object.fromEntries([...seatRefs, roleRef].map((ref) => [ref.key, ""]));
      const result = exactResult({ [noneRef.key]: "yes" }, {}, truth.circle);
      result.suggestions = [{ label: `${noneRef.label || "无"}：是`, fill: { ...clear, [noneRef.key]: "yes" } }];
      return result;
    }
    const unknown = truth.circle.filter((player) => player.seat !== source.seat && !player.role);
    return optionResult(
      suggestions,
      candidates.length ? "另一名玩家由说书人任选" : `场上没有可给出的${types.length ? "该类型" : ""}身份${unknown.length ? `（${requireRole(unknown)}）` : ""}`,
      truth.circle.filter((player) => player.seat !== source.seat),
      (current) => {
        const roleValue = entryValue(current, roleRef);
        const seats = seatRefs.map((ref) => normalizeSeat(entryValue(current, ref), truth)).filter(Boolean);
        if (noneRef && readBoolean(current.result?.[noneRef.key]) === true) return !candidates.length;
        if (!roleValue || seats.length < seatRefs.length) return true;
        return seats.some((seat) => sameRole(truth.bySeat.get(seat).role, roleValue, resolveRole));
      },
    );
  },

  role_at_seat(template, ctx) {
    const { truth, row, abilityData } = ctx;
    const roleRef = specField(template.role, abilityData);
    if (!roleRef || roleRef.source !== "result") return null;
    const seat = normalizeSeat(entryValue(row, specField(template.seat, abilityData, "target")), truth);
    if (!seat) return "目标未填完";
    const target = truth.bySeat.get(seat);
    const missing = requireRole([target]);
    if (missing) return missing;
    return exactResult({ [roleRef.key]: target.role.name }, {}, [target]);
  },

  role_at_day_execution(template, ctx) {
    const { truth, row, abilityData, game } = ctx;
    const roleRef = specField(template.role, abilityData);
    if (!roleRef) return null;
    const day = dayNumberOf(row);
    if (!day) return "无法确定是哪一天的处决";
    const seat = normalizeSeat(getDayExecutionDeathSeat(game, day), truth);
    if (!seat) return `第${day}天没有记录处决`;
    const target = truth.bySeat.get(seat);
    const missing = requireRole([target]);
    if (missing) return missing;
    return exactResult({ [roleRef.key]: target.role.name }, {}, [target], { detail: `第${day}天处决 ${seatLabel(seat)}` });
  },

  demon_in_group(template, ctx) {
    const { truth, row, abilityData, sourceRole } = ctx;
    if (template.fixedValue !== undefined && template.seats?.source !== "target") {
      const refs = specFields(template.seats, abilityData);
      const demons = truth.circle.filter(isDemon);
      const missing = requireRole(truth.circle);
      if (missing) return missing;
      return optionResult(
        refs.length ? demons.map((player) => ({ label: seatLabel(player.seat), fill: { [refs[0].key]: String(player.seat) } })) : [],
        "须包含恶魔，另一名任选",
        truth.circle,
        (current) => {
          const seats = refs.map((ref) => normalizeSeat(entryValue(current, ref), truth));
          return seats.some((seat) => !seat) || seats.some((seat) => isDemon(truth.bySeat.get(seat))) === Boolean(template.fixedValue);
        },
      );
    }

    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const target = targetSeatsOf(template.seats, row, truth, abilityData);
    if (!target.filled || !target.seats.length) return "目标未填完";
    const group = target.seats.map((seat) => truth.bySeat.get(seat));
    const missing = requireRole(group);
    if (missing) return missing;
    const redHerringMarkers = (sourceRole?.reminders || []).filter((marker) => RED_HERRING_PATTERN.test(marker));
    const redHerrings = group.filter((player) => player.markers.some((marker) => redHerringMarkers.includes(marker)));
    const hit = group.some(isDemon) || redHerrings.length > 0;
    return exactResult({ [ref.key]: booleanValue(hit) }, {}, group, {
      extraNotes: redHerrings.map((player) => `${seatLabel(player.seat)}是${redHerringMarkers[0]}，按恶魔计算`),
    });
  },

  not_demon_group(template, ctx) {
    const { truth, abilityData } = ctx;
    const refs = specFields(template.seats, abilityData);
    if (!refs.length || refs[0].source !== "result") return null;
    const missing = requireRole(truth.circle);
    if (missing) return missing;
    const demons = truth.circle.filter(isDemon);
    return optionResult([], `不能包含恶魔（${demons.map((player) => seatLabel(player.seat)).join("、") || "无"}）`, truth.circle, (current) =>
      refs.every((ref) => {
        const seat = normalizeSeat(entryValue(current, ref), truth);
        return !seat || !isDemon(truth.bySeat.get(seat));
      }),
    );
  },

  team_relation(template, ctx) {
    const { truth, row, abilityData } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const target = targetSeatsOf(template.seats, row, truth, abilityData);
    if (!target.filled || target.seats.length !== 2) return "目标未填完";
    const group = target.seats.map((seat) => truth.bySeat.get(seat));
    const missing = requireAlignment(group);
    if (missing) return missing;
    return exactResult({ [ref.key]: booleanValue(group[0].alignment === group[1].alignment) }, {}, group);
  },

  either_role(template, ctx) {
    const { truth, row, abilityData, resolveRole } = ctx;
    const goodRef = specField(template.goodRole, abilityData);
    const evilRef = specField(template.evilRole, abilityData);
    if (!goodRef || !evilRef) return null;
    const seat = normalizeSeat(entryValue(row, specField(template.seat, abilityData, "target")), truth);
    if (!seat) return "目标未填完";
    const target = truth.bySeat.get(seat);
    const missing = requireRole([target]);
    if (missing) return missing;
    const ref = target.alignment === "evil" ? evilRef : goodRef;
    const other = ref === evilRef ? goodRef : evilRef;
    return optionResult(
      [{ label: target.role.name, fill: { [ref.key]: target.role.name } }],
      `${other.field?.label || "另一项"}由说书人任选`,
      [target],
      (current) => {
        const good = entryValue(current, goodRef);
        const evil = entryValue(current, evilRef);
        if (!good || !evil) return true;
        return sameRole(target.role, good, resolveRole) || sameRole(target.role, evil, resolveRole);
      },
    );
  },

  demon_voted_today(template, ctx) {
    const { truth, row, abilityData, game } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const day = dayNumberOf(row);
    if (!day) return "无法确定是哪一天";
    if (!hasDayActionHistory(game, day, "vote")) return `第${day}天没有记录投票`;
    const missing = requireRole(truth.circle);
    if (missing) return missing;
    const voters = new Set(getDayVotingSeats(game, day));
    const demons = truth.circle.filter(isDemon);
    return exactResult({ [ref.key]: booleanValue(demons.some((player) => voters.has(player.seat))) }, {}, truth.circle.filter((player) => voters.has(player.seat)));
  },

  minion_nominated_today(template, ctx) {
    const { truth, row, abilityData, game } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const day = dayNumberOf(row);
    if (!day) return "无法确定是哪一天";
    if (!hasDayActionHistory(game, day, "nomination")) return `第${day}天没有记录提名`;
    const nominators = getDayNominatorSeats(game, day).map((seat) => truth.bySeat.get(seat)).filter(Boolean);
    const missing = requireRole(nominators);
    if (missing) return missing;
    return exactResult({ [ref.key]: booleanValue(nominators.some(isMinion)) }, {}, nominators);
  },

  evil_dead_count(template, ctx) {
    const ref = specField(template.value, ctx.abilityData);
    if (!ref) return null;
    const dead = ctx.truth.circle.filter((player) => !player.alive);
    const missing = requireAlignment(dead);
    if (missing) return missing;
    return exactResult({ [ref.key]: String(dead.filter(isEvil).length) }, {}, dead);
  },

  demon_minion_distance(template, ctx) {
    const { truth, abilityData } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const missing = requireRole(truth.circle);
    if (missing) return missing;
    const demons = truth.circle.filter(isDemon);
    const minions = truth.circle.filter(isMinion);
    if (!demons.length || !minions.length) return "场上没有恶魔或爪牙";
    const distance = Math.min(...demons.flatMap((demon) => minions.map((minion) => circularSteps(truth, demon.seat, minion.seat))));
    return exactResult({ [ref.key]: String(distance) }, {}, truth.circle);
  },

  role_guess(template, ctx) {
    const { truth, row, abilityData, resolveRole } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const seat = normalizeSeat(entryValue(row, specField(template.seat, abilityData, "target")), truth);
    const guessed = entryValue(row, specField(template.role, abilityData, "target"));
    if (!seat || !guessed) return "目标未填完";
    const target = truth.bySeat.get(seat);
    const missing = requireRole([target]);
    if (missing) return missing;
    return exactResult({ [ref.key]: booleanValue(sameRole(target.role, guessed, resolveRole)) }, {}, [target]);
  },

  role_guess_count(template, ctx) {
    const { truth, rows, abilityData, resolveRole } = ctx;
    const ref = specField(template.value, abilityData);
    const seatRef = specField(template.guesses?.seat, abilityData, "target");
    const roleRef = specField(template.guesses?.role, abilityData, "target");
    if (!ref || !seatRef || !roleRef) return null;
    const guesses = rows
      .map((item) => ({ seat: normalizeSeat(entryValue(item, seatRef), truth), role: entryValue(item, roleRef) }))
      .filter((guess) => guess.seat && guess.role);
    if (!guesses.length) return "目标未填完";
    const players = guesses.map((guess) => truth.bySeat.get(guess.seat));
    const missing = requireRole(players);
    if (missing) return missing;
    const count = guesses.filter((guess) => sameRole(truth.bySeat.get(guess.seat).role, guess.role, resolveRole)).length;
    return exactResult({ [ref.key]: String(count) }, {}, players, { detail: `共${guesses.length}个猜测` });
  },

  nearest_evil_direction(template, ctx) {
    const { truth, abilityData, source } = ctx;
    const ref = specField(template.value, abilityData);
    if (!ref) return null;
    const others = truth.circle.filter((player) => player.seat !== source.seat);
    const missing = requireAlignment(others);
    if (missing) return missing;
    const evil = others.filter(isEvil);
    if (!evil.length) return "场上没有其他邪恶玩家";
    const clockwise = Math.min(...evil.map((player) => clockwiseSteps(truth, source.seat, player.seat)));
    const counter = Math.min(...evil.map((player) => clockwiseSteps(truth, player.seat, source.seat)));
    if (clockwise === counter) {
      return optionResult(
        ["clockwise", "counterclockwise"].map((value) => ({ label: valueLabel(value), fill: { [ref.key]: value } })),
        "两侧最近邪恶距离相同，说书人任选",
        others,
        () => true,
      );
    }
    return exactResult({ [ref.key]: clockwise < counter ? "clockwise" : "counterclockwise" }, {}, others);
  },
};

handlers.clockwise_evil_count = handlers.evil_count_group;

export function getTruthTemplateTypes() {
  return Object.keys(handlers);
}

function truthNotes(involved) {
  return involved
    .filter((player, index, list) => player && list.findIndex((item) => item?.seat === player.seat) === index)
    .flatMap((player) => {
      const note = MISREGISTER_ROLES[roleKey(player.role)];
      return note ? [`${seatLabel(player.seat)}${player.role.name}${note}`] : [];
    });
}

/**
 * @param {object} params
 * @param {object} params.abilityData   the acting ability's abilityData
 * @param {object} params.sourceRole    the acting role (for reminder tokens such as 干扰项)
 * @param {object} params.source        the acting player (seat, condition, storytellerNotes)
 * @param {Array}  params.players       all game players (true grimoire fields)
 * @param {object} params.game          the game (day records for executions / votes)
 * @param {object} params.row           { phaseType, phaseNumber, target, result }
 * @param {Array}  [params.rows]        every row of this ability (for all-target templates)
 * @param {Function} params.resolveRole name -> role
 */
export function computeRoleInfoTruth({ abilityData, sourceRole = null, source, players, game, row, rows = null, resolveRole }) {
  const deduction = abilityData?.deduction;
  if (deduction?.status !== "supported" || !Array.isArray(deduction.templates) || !deduction.templates.length) {
    return unsupported("此能力暂不支持自动计算");
  }
  // Auto-inferred templates are not reviewed against the ability text; do not present them as the truth.
  if (deduction.source === "inferred") {
    return unsupported("此能力的推理模板未经人工审核");
  }

  const truthPlayers = buildTruthPlayers(players, resolveRole);
  const truth = { circle: truthPlayers, bySeat: new Map(truthPlayers.map((player) => [player.seat, player])) };
  const sourcePlayer = truth.bySeat.get(Number(source?.seat));
  if (!sourcePlayer) {
    return unavailable("行动者座位无效");
  }

  const safeRow = { phaseType: row?.phaseType || "", phaseNumber: Number(row?.phaseNumber) || 0, target: row?.target || {}, result: row?.result || {} };
  const ctx = {
    abilityData,
    sourceRole,
    source: sourcePlayer,
    truth,
    game,
    row: safeRow,
    rows: (rows || [safeRow]).map((item) => ({ ...item, target: item?.target || {}, result: item?.result || {} })),
    resolveRole,
  };

  let outcome = null;
  let reason = "";
  for (const template of deduction.templates) {
    const handler = handlers[template?.type];
    if (!handler) continue;
    const value = handler(template, ctx);
    if (typeof value === "string") {
      reason ||= value;
      continue;
    }
    if (value) {
      outcome = value;
      break;
    }
  }

  if (!outcome) {
    return reason ? unavailable(reason) : unsupported("结果由说书人决定，暂不支持自动计算");
  }

  const misinfo =
    POISONED_CONDITIONS.has(sourcePlayer.condition) ||
    sourcePlayer.markers.some((marker) => POISON_MARKERS.has(marker)) ||
    Boolean(sourcePlayer.overlayRole); // 酒鬼 / 提线木偶 ... only believe they have this ability
  const notes = [...(outcome.extraNotes || []), ...truthNotes(outcome.involved || [])];
  return {
    status: "ok",
    reason: "",
    exact: outcome.exact,
    suggestions: outcome.suggestions,
    hint: outcome.hint || "",
    detail: outcome.detail || "",
    mismatch: outcome.validate ? outcome.validate(safeRow) === false : false,
    misinfo,
    notes,
  };
}
