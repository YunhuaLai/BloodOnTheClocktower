import { normalizeMatchText } from "../../notes-claims.js";
import { getPlayerBySeat, getPlayerRole } from "./observations.js";
import { hasEvil } from "./worlds.js";

const poisonKeywords = ["醉", "毒", "错误信息", "中毒", "酒鬼", "失去能力"];

function isMarkedPoisoned(player) {
  return player?.condition === "poisoned" || player?.condition === "drunk";
}

function canBeInformationDrunk(role) {
  return role?.type === "townsfolk" || role?.type === "outsider";
}

function hasPoisonHint(player) {
  const text = normalizeMatchText(
    [player?.claim, player?.extraInfo, player?.notes]
      .filter(Boolean)
      .join(" "),
  );
  return poisonKeywords.some((keyword) => text.includes(keyword));
}

function demonRoleName(world, context) {
  const demonPlayer = getPlayerBySeat(context.players, world.demonSeat);
  const role = getPlayerRole(demonPlayer, context.game);
  return role?.name || demonPlayer?.claim || "";
}

export function explainFailure(observation, world, context) {
  const source = getPlayerBySeat(context.players, observation.sourceSeat);
  const sourceRole = getPlayerRole(source, context.game);
  const explanations = [];

  if (isMarkedPoisoned(source)) {
    explanations.push({
      type: "marked_poison",
      cost: 4,
      text: `${observation.sourceSeat}号已标记醉/毒，信息可以失真`,
    });
  }

  if (hasEvil(world, observation.sourceSeat)) {
    explanations.push({
      type: "evil_lie",
      cost: 10,
      text: `${observation.sourceSeat}号在此局势中是邪恶方，可解释为假报信息`,
    });
  }

  if (source?.condition !== "sober" && (canBeInformationDrunk(sourceRole) || hasPoisonHint(source))) {
    explanations.push({
      type: "possible_poison",
      cost: 16,
      text: `需要假设${observation.sourceSeat}号当时醉/毒或失能`,
    });
  }

  const demonName = demonRoleName(world, context);
  if (demonName.includes("涡流") && sourceRole?.type === "townsfolk") {
    explanations.push({
      type: "global_false_info",
      cost: 8,
      text: `若${world.demonSeat}号是涡流，镇民信息应为错误`,
    });
  }

  if (demonName.includes("门之钥") && sourceRole?.type === "townsfolk") {
    explanations.push({
      type: "global_correct_info",
      cost: 18,
      text: `若${world.demonSeat}号是门之钥，需要额外解释为什么这条镇民信息仍错`,
    });
  }

  if (!explanations.length) {
    return {
      type: "unexplained",
      cost: 80,
      text: "暂时没有找到醉/毒、失能或邪恶假报解释",
    };
  }

  return explanations.sort((left, right) => left.cost - right.cost)[0];
}
