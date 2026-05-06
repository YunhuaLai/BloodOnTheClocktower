import { getStandardSetup } from "../notes-core.js";

function combinations(items, size) {
  const results = [];
  const current = [];

  function visit(startIndex) {
    if (current.length === size) {
      results.push([...current]);
      return;
    }

    const remaining = size - current.length;
    for (let index = startIndex; index <= items.length - remaining; index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
    }
  }

  visit(0);
  return results;
}

export function generateWorlds(game, players) {
  const setup = getStandardSetup(game.playerCount);
  const evilCount = setup.minion + setup.demon;
  const seats = players.map((player) => Number(player.seat));
  const evilGroups = combinations(seats, evilCount);
  const worlds = [];

  evilGroups.forEach((evilSeats) => {
    evilSeats.forEach((demonSeat) => {
      const minionSeats = evilSeats.filter((seat) => seat !== demonSeat);
      worlds.push({
        demonSeat,
        minionSeats,
        evilSeats,
        evilSeatSet: new Set(evilSeats),
        minionSeatSet: new Set(minionSeats),
      });
    });
  });

  return { worlds, setup };
}

export function hasEvil(world, seat) {
  return world.evilSeatSet.has(Number(seat));
}

export function hasMinion(world, seat) {
  return world.minionSeatSet.has(Number(seat));
}

export function isDemon(world, seat) {
  return world.demonSeat === Number(seat);
}

export function formatSeatList(seats) {
  return [...seats].sort((a, b) => a - b).map((seat) => `${seat}号`).join("、");
}
