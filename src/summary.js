export function generateComplementTwinSummary(result, input) {
  const driver = driverLabel(result.dominantDriver);
  const intervention = strongestIntervention(input);
  const riskTone = result.infectionRisk > 60 ? "high" : result.infectionRisk > 35 ? "moderate" : "limited";
  const damageTone = result.hostCellDamageRisk > 65 ? "marked" : result.hostCellDamageRisk > 35 ? "moderate" : "low";
  const disease = result.diseaseLabel || input.diseaseContext;

  return `In this ${disease} simulation, ${driver} is the main driver of complement output. ${intervention} The model estimates ${damageTone} host-cell damage pressure and ${riskTone} infection-risk concern. This V1 result is rule-based and intended for research exploration only; it does not predict patient outcomes or replace experimental validation.`;
}

function driverLabel(driver) {
  const labels = {
    classical: "classical pathway activation",
    lectin: "lectin pathway activation",
    alternative: "alternative pathway activation",
    amplification: "alternative amplification",
    c5aSignal: "C5a inflammatory signaling",
    macFormation: "terminal MAC formation"
  };
  return labels[driver] ?? "combined pathway activation";
}

function strongestIntervention(input) {
  const entries = [
    ["C1s inhibition", input.c1sInhibition],
    ["MASP-2 inhibition", input.masp2Inhibition],
    ["C3 inhibition", input.c3Inhibition],
    ["Factor B inhibition", input.factorBInhibition],
    ["Factor D inhibition", input.factorDInhibition],
    ["C5 inhibition", input.c5Inhibition],
    ["C5aR inhibition", input.c5aRInhibition]
  ].sort((a, b) => b[1] - a[1]);
  if (!entries[0] || entries[0][1] < 5) return "No major drug target intervention is applied.";
  return `${entries[0][0]} is the strongest intervention and shifts downstream pathway behavior according to its target position.`;
}
