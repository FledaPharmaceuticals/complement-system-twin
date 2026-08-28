import test from "node:test";
import assert from "node:assert/strict";
import { preflightProposedModelRelease, activateApprovedModelRelease, applyApprovedModelRelease } from "../src/releaseValidation.js";

const release = {
  version: "complement-twin-v1.2",
  status: "proposed",
  formalModelChange: true,
  evidenceIds: ["validation:d1"],
  validationRecordId: "validation:1",
  rollbackVersion: "complement-twin-v1.1-contract",
  parameterSnapshot: { alternativeMultiplier: 1.2 }
};

test("preflight reports a proposed release as ready without changing the model", () => {
  const result = preflightProposedModelRelease({
    release,
    behaviorChecks: [{ name: "baseline regression", passed: true }]
  });

  assert.equal(result.status, "ready_for_review");
  assert.deepEqual(result.errors, []);
  assert.equal(result.formalModelChanged, false);
});

test("activation requires explicit approval and a passed preflight", () => {
  const preflight = preflightProposedModelRelease({ release, behaviorChecks: [] });
  assert.throws(
    () => activateApprovedModelRelease({ release, preflight, approval: { status: "pending" } }),
    /approved/i
  );

  const active = activateApprovedModelRelease({
    release,
    preflight,
    approval: { status: "approved", approvedBy: "research-review", approvalRecordId: "approval:1" }
  });
  assert.equal(active.status, "active");
  assert.equal(active.previousVersion, "complement-twin-v1.1-contract");
  assert.equal(active.activationRecordId, "approval:1");
  assert.equal(active.formalModelChange, true);
});

test("preflight rejects failed checks and invalid provenance", () => {
  const result = preflightProposedModelRelease({
    release: { ...release, evidenceIds: [] },
    behaviorChecks: [{ name: "regression", passed: false }]
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.formalModelChanged, false);
  assert.ok(result.errors.some((error) => /evidence/i.test(error)));
  assert.ok(result.errors.some((error) => /regression/i.test(error)));
});

test("applies only an approved release to a new immutable parameter state", () => {
  const preflight = preflightProposedModelRelease({ release, behaviorChecks: [] });
  const currentParameters = { alternativeMultiplier: 1.1 };
  const next = applyApprovedModelRelease({
    currentParameters,
    release,
    preflight,
    approval: { status: "approved", approvalRecordId: "approval:2" }
  });

  assert.equal(next.activeVersion, release.version);
  assert.deepEqual(next.parameters, release.parameterSnapshot);
  assert.deepEqual(currentParameters, { alternativeMultiplier: 1.1 });
  assert.equal(next.formalModelChanged, true);
});
