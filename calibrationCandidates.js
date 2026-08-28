import { MODEL_VERSION } from "./modelContract.js";

export function generateCalibrationCandidates({
  diseaseContext,
  currentParameters = {},
  evidenceRecords = []
} = {}) {
  const candidates = [];

  for (const record of evidenceRecords) {
    if (!record?.id || !record.sourceLocator || !record.evidenceLevel || !record.uncertainty) continue;
    for (const [parameter, prior] of Object.entries(record.parameterPriors ?? {})) {
      if (!isValidPrior(prior)) continue;
      const currentValue = currentParameters[parameter];
      const suggestedValue = prior.median;
      const direction = Number.isFinite(currentValue)
        ? suggestedValue > currentValue ? "increase" : suggestedValue < currentValue ? "decrease" : "no_change"
        : "initialize";

      candidates.push({
        id: `${diseaseContext}:${parameter}:${record.id}`,
        diseaseContext,
        parameter,
        currentValue: Number.isFinite(currentValue) ? currentValue : null,
        suggestedValue,
        suggestedRange: { min: prior.min, max: prior.max },
        direction,
        rationale: record.extractedClaim,
        evidenceIds: [record.id],
        evidenceLevel: record.evidenceLevel,
        uncertainty: record.uncertainty,
        status: "candidate",
        modelVersion: MODEL_VERSION
      });
    }
  }

  return candidates;
}

function isValidPrior(prior) {
  return Boolean(
    prior &&
      Number.isFinite(prior.min) &&
      Number.isFinite(prior.median) &&
      Number.isFinite(prior.max) &&
      prior.min <= prior.median &&
      prior.median <= prior.max
  );
}
