import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_RELEASES,
  createModelChangeRecord,
  getModelRelease,
  createProposedModelRelease
} from "../src/modelRegistry.js";
import { promoteValidatedModelChange } from "../src/modelPromotion.js";

test("exposes a release record for the current model contract", () => {
  const release = getModelRelease("complement-twin-v1.1-contract");

  assert.equal(release.status, "active");
  assert.equal(release.formalModelChange, false);
  assert.match(release.summary, /traceability/i);
});

test("records a candidate change without promoting it", () => {
  const change = createModelChangeRecord({
    baseVersion: "complement-twin-v1.1-contract",
    candidateId: "AMD:alternativeMultiplier:seed-1",
    summary: "Review alternative pathway prior for AMD.",
    evidenceIds: ["seed:alternativeMultiplier"]
  });

  assert.equal(change.status, "candidate");
  assert.equal(change.promotedVersion, null);
  assert.equal(change.baseVersion, "complement-twin-v1.1-contract");
  assert.deepEqual(change.evidenceIds, ["seed:alternativeMultiplier"]);
});

test("returns null for an unknown release instead of inventing version history", () => {
  assert.equal(getModelRelease("does-not-exist"), null);
  assert.equal(Array.isArray(MODEL_RELEASES), true);
});

test("creates a proposed release from a promoted change without activating it", () => {
  const parameterSnapshot = { alternativeMultiplier: 1.2 };
  const change = promoteValidatedModelChange({
    changeRecord: createModelChangeRecord({
      candidateId: "candidate-2",
      summary: "Review C3 prior",
      evidenceIds: ["pmid:2"]
    }),
    validation: { status: "validated", validationRecordId: "validation:2" },
    nextVersion: "complement-twin-v1.2"
  });

  const release = createProposedModelRelease(change, { parameterSnapshot });

  assert.equal(release.version, "complement-twin-v1.2");
  assert.equal(release.status, "proposed");
  assert.equal(release.formalModelChange, true);
  assert.equal(release.changeRecordId, change.id);
  assert.equal(release.validationRecordId, "validation:2");
  assert.deepEqual(release.parameterSnapshot, { alternativeMultiplier: 1.2 });
  assert.equal(release.rollbackVersion, "complement-twin-v1.1-contract");
  parameterSnapshot.alternativeMultiplier = 99;
  assert.deepEqual(release.parameterSnapshot, { alternativeMultiplier: 1.2 });
});
