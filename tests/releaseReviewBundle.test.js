import test from "node:test";
import assert from "node:assert/strict";
import { createReleaseReviewBundle } from "../src/releaseReviewBundle.js";

test("creates a review-only bundle with complete provenance", () => {
  const bundle = createReleaseReviewBundle({
    proposedRelease: {
      version: "v1.2",
      status: "proposed",
      evidenceIds: ["validation:d1"],
      validationRecordId: "validation:1",
      parameterSnapshot: { x: 1 },
      rollbackVersion: "v1.1"
    },
    preflight: { status: "ready_for_review", checksRun: 2, errors: [], formalModelChanged: false },
    comparisons: [{ recordType: "fleda_validation_comparison", datasetId: "d1", metrics: { c3Activation: { mae: 4, bias: 1 } }, boundary: { containsPatientData: false, containsProductionData: false, formalModelChanged: false } }],
    candidates: [{ id: "candidate:1", evidenceIds: ["validation:d1"], status: "candidate" }],
    evidenceIds: ["validation:d1", "pmid:123"]
  });

  assert.equal(bundle.bundleType, "fleda_release_review_bundle");
  assert.equal(bundle.status, "review_only");
  assert.equal(bundle.proposedRelease.version, "v1.2");
  assert.deepEqual(bundle.evidenceIds, ["validation:d1", "pmid:123"]);
  assert.equal(bundle.formalModelChanged, false);
});

test("rejects a bundle that is not backed by a ready proposed release", () => {
  assert.throws(
    () => createReleaseReviewBundle({ proposedRelease: { status: "active" }, preflight: { status: "blocked" } }),
    /proposed release.*ready/i
  );
});

test("rejects comparisons outside the anonymous unchanged-model boundary", () => {
  const proposedRelease = {
    version: "v1.2",
    status: "proposed",
    evidenceIds: ["validation:d1"]
  };
  assert.throws(
    () => createReleaseReviewBundle({
      proposedRelease,
      preflight: { status: "ready_for_review" },
      comparisons: [{ recordType: "fleda_validation_comparison", boundary: { containsPatientData: true, formalModelChanged: false } }]
    }),
    /patient|production|formal model/i
  );
});
