import test from "node:test";
import assert from "node:assert/strict";
import { preflightValidationIntake } from "../src/validationIntake.js";

const validPayload = {
  datasetId: "amd-aggregate-01",
  diseaseContext: "AMD",
  source: {
    sourceType: "publication",
    title: "Anonymized aggregate complement observations",
    sourceLocator: "https://doi.org/10.example/record",
    retrievedAt: "2026-08-28"
  },
  measurementScale: "normalized_0_100_proxy",
  experimentalContext: {
    assay: "research assay",
    timeScale: "chronic_months",
    units: "normalized_0_100_proxy",
    conditions: "aggregate reference cohort"
  },
  observations: [{ c3Activation: 42 }],
  containsPatientData: false,
  containsProductionData: false
};

test("accepts a traceable aggregate validation intake for review", () => {
  const result = preflightValidationIntake(validPayload);

  assert.equal(result.status, "eligible_for_review");
  assert.equal(result.recordType, "fleda_validation_intake_preflight");
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.boundary.formalModelChanged, false);
});

test("rejects incomplete provenance and experimental context", () => {
  const result = preflightValidationIntake({
    ...validPayload,
    source: { sourceType: "publication" },
    experimentalContext: { assay: "unknown" }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.missingFields.includes("source.sourceLocator"));
  assert.ok(result.missingFields.includes("experimentalContext.timeScale"));
  assert.ok(result.missingFields.includes("experimentalContext.units"));
});

test("blocks sensitive identifiers even when boundary flags claim anonymous data", () => {
  const result = preflightValidationIntake({
    ...validPayload,
    observations: [{ c3Activation: 42, patientId: "redacted" }]
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.privacyFindings.some((finding) => finding.includes("patientId")));
});
