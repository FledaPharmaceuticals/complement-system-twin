function rounded(value) {
  return Math.round(value * 1e12) / 1e12;
}

export async function evaluateParameterEnvelope({ parameterPolicy = {}, anchorValue, activeValue, candidateValue } = {}) {
  parameterPolicy = parameterPolicy && typeof parameterPolicy === "object" && !Array.isArray(parameterPolicy) ? parameterPolicy : {};
  const errors = [];
  const values = { anchorValue, activeValue, candidateValue };
  for (const [label, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) errors.push(`${label} must be finite`);
  }
  if (Number.isFinite(anchorValue) && anchorValue === 0) errors.push("anchorValue must be non-zero");
  if (Number.isFinite(activeValue) && activeValue === 0) errors.push("activeValue must be non-zero");
  if (!Number.isFinite(parameterPolicy.lowerBound) || !Number.isFinite(parameterPolicy.upperBound)) errors.push("registered parameter bounds are required");
  if (!Number.isFinite(parameterPolicy.maxRelativeChange) || !Number.isFinite(parameterPolicy.maxCumulativeChange)) errors.push("registered change limits are required");

  if (Number.isFinite(candidateValue) && Number.isFinite(parameterPolicy.lowerBound) && Number.isFinite(parameterPolicy.upperBound)
      && (candidateValue < parameterPolicy.lowerBound || candidateValue > parameterPolicy.upperBound)) {
    errors.push("candidate value is outside registered bounds");
  }

  let relativeChange = null;
  let cumulativeChange = null;
  if (Number.isFinite(activeValue) && activeValue !== 0 && Number.isFinite(candidateValue)) {
    relativeChange = rounded(Math.abs(candidateValue - activeValue) / Math.abs(activeValue));
    if (Number.isFinite(parameterPolicy.maxRelativeChange) && relativeChange > parameterPolicy.maxRelativeChange) {
      errors.push("per-release relative change exceeds policy maximum");
    }
  }
  if (Number.isFinite(anchorValue) && anchorValue !== 0 && Number.isFinite(candidateValue)) {
    cumulativeChange = rounded(Math.abs(candidateValue - anchorValue) / Math.abs(anchorValue));
    if (Number.isFinite(parameterPolicy.maxCumulativeChange) && cumulativeChange > parameterPolicy.maxCumulativeChange) {
      errors.push("cumulative change exceeds policy maximum");
    }
  }

  const envelopeHash = await sha256Jcs({
    parameterId: parameterPolicy.parameterId ?? null,
    anchorValue: Number.isFinite(anchorValue) ? anchorValue : null,
    activeValue: Number.isFinite(activeValue) ? activeValue : null,
    candidateValue: Number.isFinite(candidateValue) ? candidateValue : null,
    relativeChange,
    cumulativeChange,
    errors
  });
  return {
    status: errors.length ? "blocked" : "passed",
    parameterId: parameterPolicy.parameterId ?? null,
    envelopeHash,
    relativeChange,
    cumulativeChange,
    errors,
    formalModelChanged: false
  };
}
import { sha256Jcs } from "../quantitativeObservations/canonicalHash.js";
