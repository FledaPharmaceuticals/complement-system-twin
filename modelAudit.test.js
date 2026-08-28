import test from "node:test";
import assert from "node:assert/strict";
import { buildModelAuditSummary } from "../src/modelAudit.js";

test("summarizes release, review, validation, and knowledge provenance without implying promotion", () => {
  const summary = buildModelAuditSummary({
    releases: [{ version: "v1.1", status: "active", formalModelChange: false, evidenceIds: [] }],
    review: { candidates: [{ reviewStatus: "needs_review" }, { reviewStatus: "no_conflict_detected" }], conflicts: [{ id: "conflict:1" }] },
    validationComparisons: [{ metrics: { c3Activation: { mae: 4, bias: -1 } } }],
    validationCandidates: [{ reviewStatus: "needs_review" }],
    knowledgeRecords: [{ knowledgeLayer: "protein_annotation" }, { knowledgeLayer: "pathway_annotation" }]
  });

  assert.deepEqual(summary, {
    activeVersion: "v1.1",
    releaseCount: 1,
    formalChangeCount: 0,
    candidateCount: 3,
    candidatesNeedingReview: 2,
    conflictCount: 1,
    validationComparisonCount: 1,
    knowledgeRecordCount: 2,
    knowledgeLayers: { pathway_annotation: 1, protein_annotation: 1 },
    status: "review_required",
    formalModelChanged: false
  });
});

test("reports ready only when there are no unresolved candidates or conflicts", () => {
  const summary = buildModelAuditSummary({ releases: [{ version: "v1", status: "active" }] });
  assert.equal(summary.status, "no_open_review_items");
  assert.equal(summary.formalModelChanged, false);
});
