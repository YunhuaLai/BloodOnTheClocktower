function clampPhaseNumber(value) {
  return Math.min(Math.max(Number(value) || 1, 1), 99);
}

export function getShiftedPhase(currentType, currentNumber, step) {
  let phaseType = currentType === "night" ? "night" : "day";
  let phaseNumber = clampPhaseNumber(currentNumber);
  const distance = Math.abs(Number(step) || 0);

  for (let index = 0; index < distance; index += 1) {
    if (step > 0) {
      if (phaseType === "night") {
        phaseType = "day";
      } else {
        phaseType = "night";
        phaseNumber = clampPhaseNumber(phaseNumber + 1);
      }
    } else if (phaseType === "day") {
      phaseType = "night";
    } else if (phaseNumber > 1) {
      phaseType = "day";
      phaseNumber = clampPhaseNumber(phaseNumber - 1);
    }
  }

  return { phaseType, phaseNumber };
}
