import { runComplementSimulation } from "./simulation.js";

export const DEFAULT_COMPARISON_SCENARIOS = [
  { id: "baseline", label: "No intervention", input: {} },
  { id: "c3", label: "C3 inhibition", input: { c3Inhibition: 80 } },
  { id: "c5", label: "C5 inhibition", input: { c5Inhibition: 80 } },
  { id: "factor-b", label: "Factor B inhibition", input: { factorBInhibition: 80 } },
  { id: "factor-d", label: "Factor D inhibition", input: { factorDInhibition: 80 } },
  { id: "c5a-r", label: "C5aR inhibition", input: { c5aRInhibition: 80 } }
];

const METRIC_KEYS = [
  "diseaseActivityProxy",
  "c3Activation",
  "c5aSignal",
  "macFormation",
  "hostCellDamageRisk",
  "infectionRisk"
];

export function compareDrugInterventions(
  baseInput,
  scenarios = DEFAULT_COMPARISON_SCENARIOS,
  simulate = runComplementSimulation
) {
  if (!baseInput || typeof baseInput !== "object") throw new TypeError("baseInput is required");
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError("scenarios must not be empty");

  const baseline = scenarios.find((scenario) => scenario.id === "baseline") || scenarios[0];
  const baselineOutput = simulate({ ...baseInput, ...(baseline.input || {}) });
  return scenarios.map((scenario) => {
    const metrics = simulate({ ...baseInput, ...(scenario.input || {}) });
    const selectedMetrics = Object.fromEntries(
      METRIC_KEYS.filter((key) => Number.isFinite(metrics[key])).map((key) => [key, metrics[key]])
    );
    const deltas = Object.fromEntries(
      Object.keys(selectedMetrics).map((key) => [key, selectedMetrics[key] - (baselineOutput[key] ?? 0)])
    );
    return {
      id: scenario.id,
      label: scenario.label,
      metrics: selectedMetrics,
      deltas,
      status: "research_proxy",
      isClinicalPrediction: false
    };
  });
}
