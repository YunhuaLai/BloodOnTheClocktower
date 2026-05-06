import { hasEvil, hasMinion, isDemon } from "./worlds.js";

function countMatching(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function circularDistance(seatA, seatB, playerCount) {
  const a = Number(seatA);
  const b = Number(seatB);
  if (!a || !b || a === b) {
    return 0;
  }

  const distance = Math.abs(a - b);
  return Math.min(distance, playerCount - distance);
}

function adjacentEvilPairCount(world, playerCount) {
  let count = 0;
  for (let seat = 1; seat <= playerCount; seat += 1) {
    const nextSeat = seat === playerCount ? 1 : seat + 1;
    if (hasEvil(world, seat) && hasEvil(world, nextSeat)) {
      count += 1;
    }
  }
  return count;
}

function nearestDemonMinionDistance(world, playerCount) {
  if (!world.minionSeats.length) {
    return null;
  }

  return Math.min(
    ...world.minionSeats.map((seat) => circularDistance(world.demonSeat, seat, playerCount)),
  );
}

function roleMatchesSeat(role, seat, world) {
  if (!role?.type) {
    return false;
  }

  if (role.type === "demon") {
    return isDemon(world, seat);
  }

  if (role.type === "minion") {
    return hasMinion(world, seat);
  }

  if (role.type === "townsfolk" || role.type === "outsider") {
    return !hasEvil(world, seat);
  }

  return false;
}

export function checkObservation(observation, world, context) {
  switch (observation.kind) {
    case "adjacent_evil_pair_count":
      return adjacentEvilPairCount(world, context.game.playerCount) === observation.value;

    case "evil_count_group":
    case "clockwise_evil_count": {
      const count = countMatching(observation.targets, (seat) => hasEvil(world, seat));
      const targetIsAllowed =
        !observation.targetMustBeGood || !hasEvil(world, observation.targetSeat);
      return count === observation.value && targetIsAllowed;
    }

    case "good_player":
      return !hasEvil(world, observation.targetSeat);

    case "demon_in_group":
      return observation.targets.some((seat) => isDemon(world, seat)) === observation.value;

    case "not_demon_group":
      return observation.targets.every((seat) => !isDemon(world, seat));

    case "team_relation": {
      const [firstSeat, secondSeat] = observation.targets;
      return (hasEvil(world, firstSeat) === hasEvil(world, secondSeat)) === observation.value;
    }

    case "role_in_group":
      return observation.targets.some((seat) => roleMatchesSeat(observation.role, seat, world));

    case "not_role_type_group":
      return observation.targets.every((seat) => !roleMatchesSeat(observation.role, seat, world));

    case "either_role": {
      const goodMatch = observation.goodRole
        ? roleMatchesSeat(observation.goodRole, observation.targetSeat, world)
        : false;
      const evilMatch = observation.evilRole
        ? roleMatchesSeat(observation.evilRole, observation.targetSeat, world)
        : false;
      return Boolean(goodMatch || evilMatch);
    }

    case "evil_dead_count":
      return (
        context.players.filter((player) => player.status !== "alive" && hasEvil(world, player.seat))
          .length === observation.value
      );

    case "demon_minion_distance":
      return nearestDemonMinionDistance(world, context.game.playerCount) === observation.value;

    case "role_guess":
      return roleMatchesSeat(observation.role, observation.targetSeat, world) === observation.value;

    default:
      return false;
  }
}
