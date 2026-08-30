const DISCLOSURE_LEVELS = new Set(["public_exact", "public_normalized", "public_summary"]);
const REQUIRED_CONTEXT_FIELDS = ["disease", "tissue", "species", "assay", "timeContext", "spatialScope", "experimentalSetting"];

function finite(value) {
  return Number.isFinite(value);
}

export function validateChangePolicy(policy = {}) {
  const errors = [];
  if (!policy.policyId) errors.push("policy ID is required");
  if (!/^\d+\.\d+\.\d+$/.test(policy.policyVersion ?? "")) errors.push("semantic policy version is required");
  if (policy.status !== "dry_run") errors.push("Phase 1 policy status must be dry_run");
  if (!Number.isInteger(policy.minimumPublications) || policy.minimumPublications < 3) errors.push("minimum publications must be at least 3");
  if (!Number.isInteger(policy.minimumIndependentGroups) || policy.minimumIndependentGroups < 2) errors.push("minimum independent groups must be at least 2");
  if (policy.holdoutRequired !== true) errors.push("a locked holdout is required");
  if (!Array.isArray(policy.parameters) || !policy.parameters.length) errors.push("at least one registered parameter is required");

  const seen = new Set();
  const parameters = Array.isArray(policy.parameters) ? policy.parameters : [];
  for (const parameter of parameters) {
    const label = parameter.parameterId || "unnamed parameter";
    if (!parameter.parameterId || seen.has(parameter.parameterId)) errors.push(`${label}: unique parameter ID is required`);
    seen.add(parameter.parameterId);
    if (!parameter.moduleId || !parameter.unit) errors.push(`${label}: module and unit are required`);
    if (!parameter.scientificMeaning) errors.push(`${label}: scientific meaning is required`);
    if (!parameter.calibrationObjective) errors.push(`${label}: calibration objective is required`);
    if (!parameter.transformation) errors.push(`${label}: transformation is required`);
    if (!Array.isArray(parameter.contexts) || !parameter.contexts.length) errors.push(`${label}: at least one context is required`);
    for (const context of parameter.contexts ?? []) {
      for (const field of REQUIRED_CONTEXT_FIELDS) {
        if (!context?.[field]) errors.push(`${label}: context ${field.replaceAll(/([A-Z])/g, " $1").toLowerCase()} is required`);
      }
    }
    if (!Array.isArray(parameter.sentinelEndpoints) || !parameter.sentinelEndpoints.length) errors.push(`${label}: sentinel endpoints are required`);
    if (!finite(parameter.lowerBound) || !finite(parameter.upperBound) || parameter.lowerBound >= parameter.upperBound) {
      errors.push(`${label}: valid lower and upper bounds are required`);
    }
    for (const [field, description] of [
      ["maxRelativeChange", "relative change"],
      ["maxCumulativeChange", "cumulative change"],
      ["trainingImprovementMinimum", "training improvement"],
      ["holdoutImprovementMinimum", "holdout improvement"],
      ["sentinelDegradationMaximum", "sentinel degradation"]
    ]) {
      if (!finite(parameter[field]) || parameter[field] <= 0 || parameter[field] > 1) errors.push(`${label}: ${description} must be in (0, 1]`);
    }
    if (!DISCLOSURE_LEVELS.has(parameter.disclosureLevel)) errors.push(`${label}: invalid disclosure level`);
  }

  return { valid: errors.length === 0, errors };
}

export function getParameterPolicy(policy = {}, parameterId) {
  const parameter = policy.parameters?.find((item) => item.parameterId === parameterId);
  return parameter ? structuredClone(parameter) : null;
}
