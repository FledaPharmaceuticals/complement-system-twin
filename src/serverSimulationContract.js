import { createJcsResultId } from "./jcsResultHash.js";

export const PUBLIC_SIMULATION_OUTPUT_FIELDS = Object.freeze([
  "c3Activation",
  "c3aSignal",
  "c3bOpsonization",
  "c5Activation",
  "c5aSignal",
  "macFormation",
  "hostCellDamageRisk",
  "pathogenDefenseCompromise",
  "infectionRisk",
  "diseaseActivityProxy",
  "dominantDriver",
  "diseaseLabel"
]);

export const PUBLIC_SIMULATION_METADATA = Object.freeze({
  version: "0.2.0-local-parity",
  parameterSetVersion: "js-v1-parity",
  calibrationStatus: "teaching_candidate",
  reviewStatus: "not_clinically_validated"
});

export const C3G_LIMITATION_TERMS = Object.freeze([
  "C3GN",
  "dense deposit disease",
  "nephritic-factor status",
  "genetic drivers",
  "systemic biomarkers",
  "glomerular-local complement activity"
]);

export const FORBIDDEN_PUBLIC_FIELDS = Object.freeze([
  "mechanism_equations",
  "coefficient_values",
  "full_parameter_sets",
  "candidate_calibrations",
  "private_datasets",
  "training_data",
  "ai_extraction_records",
  "human_review_records",
  "raw_evidence_payloads",
  "internal_model_version_history",
  "private_audit_records",
  "source_artifacts",
  "prompts_or_reasoning",
  "secrets_or_credentials",
  "gummynology_or_gn_data",
  "raw_literature_artifacts",
  "observation_package_payloads",
  "extraction_prompts",
  "ai_reasoning",
  "raw_model_output",
  "candidate_parameter_values",
  "private_priors",
  "unpublished_calibration_values",
  "formal_parameter_history",
  "reviewer_identity",
  "private_review_notes",
  "conflict_details",
  "administrative_workflow_records",
  "database_ids",
  "source_paths",
  "migration_runs",
  "audit_events",
  "backup_metadata",
  "secrets_tokens_or_credentials",
  "patient_identity",
  "clinical_production_data",
  "gn_data"
]);

const FORBIDDEN_PUBLIC_FIELD_SET = new Set(FORBIDDEN_PUBLIC_FIELDS);

const NUMERIC_OUTPUT_FIELDS = new Set(PUBLIC_SIMULATION_OUTPUT_FIELDS.slice(0, 10));
const EXPECTED_TOP_LEVEL_FIELDS = [
  "scenario_id",
  "model_version",
  "research_use_only",
  "diagnostic_use",
  "outputs",
  "uncertainty",
  "publicResult"
];
const EXPECTED_PUBLIC_RESULT_FIELDS = [
  "schemaName",
  "schemaVersion",
  "resultId",
  "scenarioId",
  "model",
  "scope",
  "outputs",
  "validation",
  "warnings"
];
const EXPECTED_SCOPE = Object.freeze({
  use: "research_and_education_only",
  diagnosticUse: false,
  supportedOutputs: "core_simulation_indices_only",
  diseaseProfile: "unstratified"
});
const EXPECTED_VALIDATION = Object.freeze({
  method: "online_javascript_v1_parity",
  numericTolerance: 1e-9,
  deterministic: true,
  hashCanonicalization: "RFC8785-JCS"
});

export async function validatePublicSimulationResponse(response, {
  expectedScenarioId,
  diseaseContext = "normal",
  javascriptOutputs
} = {}) {
  try {
    if (!isPlainObject(response) || !hasExactKeys(response, EXPECTED_TOP_LEVEL_FIELDS)) {
      return failure("invalid_schema");
    }
    const forbiddenPath = findForbiddenPublicField(response);
    if (forbiddenPath) return failure("forbidden_public_field", forbiddenPath);
    if (response.model_version !== PUBLIC_SIMULATION_METADATA.version
        || response.research_use_only !== true
        || response.diagnostic_use !== false
        || !isPlainObject(response.uncertainty)) {
      return failure("invalid_schema");
    }

    const publicResult = response.publicResult;
    if (!isPlainObject(publicResult) || !hasExactKeys(publicResult, EXPECTED_PUBLIC_RESULT_FIELDS)) {
      return failure("invalid_schema");
    }
    if (publicResult.schemaName !== "FledaPublicSimulationResult"
        || publicResult.schemaVersion !== "1.0.0"
        || typeof publicResult.resultId !== "string"
        || !/^sha256:[0-9a-f]{64}$/.test(publicResult.resultId)
        || publicResult.scenarioId !== expectedScenarioId
        || response.scenario_id !== expectedScenarioId) {
      return failure("invalid_schema");
    }
    if (!matchesExactObject(publicResult.model, PUBLIC_SIMULATION_METADATA)
        || !matchesExactObject(publicResult.scope, EXPECTED_SCOPE)
        || !matchesExactObject(publicResult.validation, EXPECTED_VALIDATION)
        || !Array.isArray(publicResult.warnings)
        || publicResult.warnings.some((warning) => typeof warning !== "string")) {
      return failure("invalid_schema");
    }

    const publicOutputShape = validateOutputShape(publicResult.outputs);
    if (!publicOutputShape.ok) return publicOutputShape;
    const compatibilityShape = validateOutputShape(response.outputs);
    if (!compatibilityShape.ok) return compatibilityShape;
    if (!outputsEqualExactly(response.outputs, publicResult.outputs)) {
      return failure("invalid_schema");
    }
    if (diseaseContext === "C3G" && !hasC3gLimitations(publicResult.warnings)) {
      return failure("invalid_schema");
    }

    const hashPayload = structuredClone(publicResult);
    delete hashPayload.resultId;
    if (await createJcsResultId(hashPayload) !== publicResult.resultId) {
      return failure("invalid_result_hash");
    }
    if (!outputsAgreeWithinTolerance(publicResult.outputs, javascriptOutputs, 1e-9)) {
      return failure("result_mismatch");
    }

    return {
      ok: true,
      outputs: structuredClone(publicResult.outputs),
      resultId: publicResult.resultId,
      model: structuredClone(publicResult.model),
      warnings: [...publicResult.warnings]
    };
  } catch (error) {
    return failure("invalid_schema", error instanceof Error ? error.message : String(error));
  }
}

function validateOutputShape(outputs) {
  if (!isPlainObject(outputs)) return failure("invalid_schema");
  const keys = Object.keys(outputs);
  const missing = PUBLIC_SIMULATION_OUTPUT_FIELDS.filter((key) => !keys.includes(key));
  if (missing.length) return failure("missing_required_fields", missing.join(", "));
  if (!hasExactKeys(outputs, PUBLIC_SIMULATION_OUTPUT_FIELDS)) return failure("invalid_schema");
  for (const key of PUBLIC_SIMULATION_OUTPUT_FIELDS) {
    const value = outputs[key];
    if (NUMERIC_OUTPUT_FIELDS.has(key)) {
      if (typeof value !== "number" || !Number.isFinite(value)) return failure("invalid_schema");
    } else if (typeof value !== "string") {
      return failure("invalid_schema");
    }
  }
  return { ok: true };
}

function outputsEqualExactly(left, right) {
  return PUBLIC_SIMULATION_OUTPUT_FIELDS.every((key) => left[key] === right[key]);
}

function outputsAgreeWithinTolerance(serverOutputs, javascriptOutputs, tolerance) {
  if (!isPlainObject(javascriptOutputs)) return false;
  return PUBLIC_SIMULATION_OUTPUT_FIELDS.every((key) => {
    if (!(key in javascriptOutputs)) return false;
    if (NUMERIC_OUTPUT_FIELDS.has(key)) {
      const value = javascriptOutputs[key];
      return typeof value === "number"
        && Number.isFinite(value)
        && Math.abs(serverOutputs[key] - value) <= tolerance;
    }
    return serverOutputs[key] === javascriptOutputs[key];
  });
}

function hasC3gLimitations(warnings) {
  const text = warnings.join(" ").toLowerCase();
  return C3G_LIMITATION_TERMS.every((term) => text.includes(term.toLowerCase()));
}

function matchesExactObject(value, expected) {
  return isPlainObject(value)
    && hasExactKeys(value, Object.keys(expected))
    && Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

function hasExactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function findForbiddenPublicField(value, path = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenPublicField(value[index], [...path, String(index)]);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (FORBIDDEN_PUBLIC_FIELD_SET.has(key)) return childPath.join(".");
    const found = findForbiddenPublicField(child, childPath);
    if (found) return found;
  }
  return null;
}

function failure(reason, detail = null) {
  return { ok: false, reason, detail };
}
