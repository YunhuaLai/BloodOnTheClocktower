import { checkObservation } from "./checkers.js";
import { explainFailure } from "./explainers.js";
import { extractObservations, getPlayerRole } from "./observations.js";
import { formatSeatList, generateWorlds, hasEvil, isDemon } from "./worlds.js";

function roleShapeCost(player, role, world) {
  if (!role) {
    return 0;
  }

  if (role.type === "demon" && !isDemon(world, player.seat)) {
    return 24;
  }

  if (role.type === "minion" && !world.minionSeatSet.has(Number(player.seat))) {
    return 16;
  }

  if ((role.type === "townsfolk" || role.type === "outsider") && hasEvil(world, player.seat)) {
    return 4;
  }

  return 0;
}

function manualJudgementCost(player, world) {
  const evil = hasEvil(world, player.seat);
  if (player.alignment === "good" && evil) {
    return 18;
  }

  if (player.alignment === "evil" && !evil) {
    return 16;
  }

  if (player.alignment === "suspect" && evil) {
    return -3;
  }

  if (player.alignment === "suspect" && !evil) {
    return 3;
  }

  return 0;
}

function statusCost(player, world) {
  if (player.status !== "alive" && isDemon(world, player.seat)) {
    return 22;
  }

  return 0;
}

function pushBaselineCost(costs, cost, text) {
  if (cost === 0) {
    return;
  }

  costs.push({
    type: "baseline",
    cost,
    text,
  });
}

function baselineCosts(world, context) {
  const costs = [];

  context.players.forEach((player) => {
    const role = getPlayerRole(player, context.game);
    const judgementCost = manualJudgementCost(player, world);
    pushBaselineCost(
      costs,
      roleShapeCost(player, role, world),
      `${player.seat}号自称${role?.name || player.claim || "未填身份"}，与此局势有张力`,
    );
    pushBaselineCost(
      costs,
      judgementCost,
      `${player.seat}号的手动判断与此局势${judgementCost < 0 ? "吻合" : "有张力"}`,
    );
    pushBaselineCost(
      costs,
      statusCost(player, world),
      `${player.seat}号已死亡/不存活，但此局势仍把他作为现任恶魔`,
    );
  });

  return costs;
}

function evaluateWorld(world, context) {
  const trueObservations = [];
  const falseObservations = [];
  const assumptions = [];
  const baseline = baselineCosts(world, context);
  let cost = baseline.reduce((sum, item) => sum + item.cost, 0);

  context.observations.forEach((observation) => {
    if (checkObservation(observation, world, context)) {
      trueObservations.push(observation);
      return;
    }

    const explanation = explainFailure(observation, world, context);
    cost += explanation.cost;
    falseObservations.push({
      observation,
      explanation,
    });
    assumptions.push(explanation);
  });

  const unexplainedCount = falseObservations.filter(
    (item) => item.explanation.type === "unexplained",
  ).length;

  return {
    world,
    cost: Math.max(0, Math.round(cost)),
    baseline,
    trueObservations,
    falseObservations,
    assumptions,
    unexplainedCount,
  };
}

function classifyWorld(result) {
  if (result.unexplainedCount > 0 || result.cost >= 70) {
    return "conspiracy";
  }

  if (result.cost >= 28 || result.falseObservations.length >= 3) {
    return "fragile";
  }

  return "stable";
}

const classificationLabels = {
  stable: "稳局势",
  fragile: "脆弱局势",
  conspiracy: "阴谋局势",
};

function normalizeLikelihood(results) {
  if (!results.length) {
    return [];
  }

  const best = Math.min(...results.map((result) => result.cost));
  return results.map((result) => {
    const gap = result.cost - best;
    const likelihood = Math.max(1, Math.round(96 - gap * 3.2));
    const classification = classifyWorld(result);
    return {
      ...result,
      likelihood,
      classification,
      classificationLabel: classificationLabels[classification],
      evilText: formatSeatList(result.world.evilSeats),
      minionText: formatSeatList(result.world.minionSeats),
    };
  });
}

function buildSignals(results, observations) {
  const top = results.slice(0, 12);
  return observations
    .map((observation) => {
      const trueCount = top.filter((result) =>
        result.trueObservations.some((item) => item.id === observation.id),
      ).length;
      const falseCount = top.length - trueCount;
      return {
        observation,
        trueCount,
        falseCount,
        swing: Math.abs(trueCount - falseCount),
      };
    })
    .filter((item) => item.trueCount && item.falseCount)
    .sort((left, right) => left.swing - right.swing)
    .slice(0, 4);
}

export function analyzeWorlds(game) {
  const extraction = extractObservations(game);
  const { players, observations, unsupported } = extraction;
  const { worlds, setup } = generateWorlds(game, players);
  const context = { game, players, observations };
  const evaluated = normalizeLikelihood(
    worlds
      .map((world) => evaluateWorld(world, context))
      .sort((left, right) => left.cost - right.cost)
      .slice(0, 20),
  );

  return {
    setup,
    players,
    observations,
    unsupported,
    worldsChecked: worlds.length,
    results: evaluated,
    signals: buildSignals(evaluated, observations),
  };
}
