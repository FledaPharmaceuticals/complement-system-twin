import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateQuantitativeObservation } from "../src/quantitativeObservations/validateObservation.js";

const ROOT = new URL("../", import.meta.url);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/quantitative-observations/${name}`, ROOT), "utf8"));
}

test("qualifies a complete supported AMD observation through deterministic gates", async () => {
  const result = validateQuantitativeObservation(await fixture("amd-systemic-clinical-valid.json"));

  assert.equal(result.valid, true);
  assert.equal(result.calibrationEligible, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.eligibilityReasons, ["ALL_DETERMINISTIC_GATES_PASSED"]);
});

test("keeps context-limited evidence available but ineligible", async () => {
  const result = validateQuantitativeObservation(await fixture("amd-invalid-missing-context.json"));

  assert.equal(result.valid, false);
  assert.equal(result.calibrationEligible, false);
  assert.ok(result.eligibilityReasons.includes("PRECISE_LOCATOR_REQUIRED"));
  assert.ok(result.eligibilityReasons.includes("BIOLOGICAL_CONTEXT_INCOMPLETE"));
  assert.ok(result.eligibilityReasons.includes("REVIEW_NOT_SUPPORTED"));
});

test("AI support cannot waive missing deterministic context", async () => {
  const observation = await fixture("amd-invalid-missing-context.json");
  observation.provenance.reviewResult = "supported";
  observation.provenance.ruleValidationResult = "passed";

  const result = validateQuantitativeObservation(observation);

  assert.equal(result.calibrationEligible, false);
  assert.ok(result.eligibilityReasons.includes("BIOLOGICAL_CONTEXT_INCOMPLETE"));
});

test("blocks unsupported review, unresolved conversion, and conflicted records", async () => {
  const observation = await fixture("amd-systemic-clinical-valid.json");
  observation.provenance.reviewResult = "partially_supported";
  observation.normalization.conversionStatus = "needs_review";
  observation.governance.workflowState = "conflicted";

  const result = validateQuantitativeObservation(observation);

  assert.equal(result.calibrationEligible, false);
  assert.ok(result.eligibilityReasons.includes("REVIEW_NOT_SUPPORTED"));
  assert.ok(result.eligibilityReasons.includes("NORMALIZATION_NOT_VALIDATED"));
  assert.ok(result.eligibilityReasons.includes("UNRESOLVED_CONFLICT"));
});

test("requires figure source hash and axis metadata", async () => {
  const observation = await fixture("amd-local-ex-vivo-valid.json");
  observation.provenance.sourceImageHash = null;
  observation.locator.axis = null;

  const result = validateQuantitativeObservation(observation);

  assert.equal(result.calibrationEligible, false);
  assert.ok(result.eligibilityReasons.includes("FIGURE_PROVENANCE_INCOMPLETE"));
});

test("rejects values outside the contract controlled vocabularies", async () => {
  const observation = await fixture("amd-systemic-clinical-valid.json");
  observation.experiment.groupRole = "experimental-case";
  observation.measurement.valueQualifier = "estimated-ish";

  const result = validateQuantitativeObservation(observation);

  assert.equal(result.calibrationEligible, false);
  assert.ok(result.eligibilityReasons.includes("CONTROLLED_VOCABULARY_INVALID"));
});
