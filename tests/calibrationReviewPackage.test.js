import test from "node:test";
import assert from "node:assert/strict";

import { createCalibrationReviewPackage } from "../src/calibrationReviewPackage.js";

test("creates a non-promoting, traceable calibration review package", () => {
  const reviewPackage = createCalibrationReviewPackage({
    diseaseContext: "AMD",
    modelVersion: "complement-twin-v1.1-contract",
    createdAt: "2026-08-27T00:00:00.000Z",
    candidates: [{ id: "candidate:1" }],
    conflicts: [{ id: "conflict:1" }],
    evidenceRecords: [{ id: "pmid:1" }]
  });

  assert.equal(reviewPackage.packageType, "fleda_calibration_review");
  assert.equal(reviewPackage.status, "candidate_review");
  assert.equal(reviewPackage.formalModelChange, false);
  assert.equal(reviewPackage.dataBoundary, "public_literature_metadata_and_model_candidates_only");
  assert.equal(reviewPackage.evidenceRecords[0].id, "pmid:1");
});
