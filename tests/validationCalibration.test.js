import test from "node:test";
import assert from "node:assert/strict";
import { generateValidationCalibrationCandidates } from "../src/validationCalibration.js";

test("turns a material validation bias into a reviewable candidate", () => {
  const candidates = generateValidationCalibrationCandidates({
    comparison: {
      recordType: "fleda_validation_comparison",
      datasetId: "dataset-1",
      diseaseContext: "AMD",
      metrics: { c3Activation: { n: 4, mae: 12, bias: 8 } },
      boundary: { formalModelChanged: false }
    },
    currentParameters: { alternativeMultiplier: 1.2 }
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].parameter, "alternativeMultiplier");
  assert.equal(candidates[0].direction, "decrease");
  assert.equal(candidates[0].status, "candidate");
  assert.deepEqual(candidates[0].evidenceIds, ["validation:dataset-1"]);
  assert.equal(candidates[0].uncertainty, "high");
});

test("does not emit candidates for small or unsafe comparisons", () => {
  assert.deepEqual(generateValidationCalibrationCandidates({
    comparison: {
      recordType: "fleda_validation_comparison",
      datasetId: "dataset-2",
      metrics: { c3Activation: { n: 1, mae: 2, bias: 1 } },
      boundary: { formalModelChanged: true }
    }
  }), []);
});
