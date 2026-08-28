import { MODEL_VERSION } from "./modelContract.js";

const SIGNAL_PARAMETER_MAP = Object.freeze({
  c3Activation: "alternativeMultiplier",
  c5aSignal: "inflammatorySignalMultiplier",
  macFormation: "macFormationLocalRiskMultiplier",
  diseaseActivityProxy: "diseaseActivityMultiplier",
  infectionRisk: "infectionRiskMultiplier"
});

export function generateValidationCalibrationCandidates({
  comparison,
  currentParameters = {},
  minimumObservations = 3,
  minimumAbsoluteBias = 5
} = {}) {
  if (!comparison || comparison.recordType !== "fleda_validation_comparison") return [];
  if (comparison.boundary?.formalModelChanged !== false) return [];
  if (!comparison.datasetId) return [];
  const candidates = [];
  for (const [signal, metric] of Object.entries(comparison.metrics ?? {})) {
    const parameter = SIGNAL_PARAMETER_MAP[signal];
    if (!parameter || !metric || metric.n < minimumObservations || Math.abs(metric.bias) < minimumAbsoluteBias) continue;
    const currentValue = Number.isFinite(currentParameters[parameter]) ? currentParameters[parameter] : null;
    const direction = metric.bias > 0 ? "decrease" : "increase";
    candidates.push({
      id: `${comparison.diseaseContext ?? "unknown"}:${parameter}:validation:${comparison.datasetId}`,
      diseaseContext: comparison.diseaseContext ?? "unknown",
      parameter,
      signal,
      currentValue,
      suggestedValue: currentValue,
      suggestedRange: null,
      direction,
      rationale: `Validation proxy bias for ${signal} is ${metric.bias} across ${metric.n} observations; review the ${parameter} relationship before changing the model.`,
      evidenceIds: [`validation:${comparison.datasetId}`],
      evidenceLevel: "validation_proxy",
      uncertainty: "high",
      status: "candidate",
      modelVersion: MODEL_VERSION,
      formalModelChange: false
    });
  }
  return candidates;
}
