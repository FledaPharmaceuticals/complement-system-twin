import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createPolicyApprovalRecord, evaluateControlledRelease } from "../src/controlledRelease/releaseEvaluator.js";

const ROOT = new URL("../", import.meta.url);

async function fixture() {
  return JSON.parse(await readFile(new URL("fixtures/controlled-release/amd-dry-run.json", ROOT), "utf8"));
}

test("marks a fully compliant candidate ready without activating it", async () => {
  const decision = evaluateControlledRelease(await fixture());

  assert.equal(decision.status, "ready_for_auto_release");
  assert.equal(decision.formalModelChanged, false);
  assert.equal(decision.activationPermitted, false);
  assert.deepEqual(decision.errors, []);
  assert.equal(decision.policyVersion, "1.0.0");
});

test("blocks insufficient training and holdout improvement", async () => {
  const input = await fixture();
  input.calibrationRun.objective.trainingAfter = 0.91;
  input.calibrationRun.objective.holdoutAfter = 0.96;

  const result = evaluateControlledRelease(input);

  assert.equal(result.status, "blocked");
  assert.ok(result.reasonCodes.includes("TRAINING_IMPROVEMENT_BELOW_POLICY"));
  assert.ok(result.reasonCodes.includes("HOLDOUT_IMPROVEMENT_BELOW_POLICY"));
});

test("blocks sentinel degradation and failed behavior checks", async () => {
  const input = await fixture();
  input.behaviorChecks.find((check) => check.name === "retina_signal_ordering").degradation = 0.03;
  input.behaviorChecks.find((check) => check.name === "mass_balance").passed = false;

  const result = evaluateControlledRelease(input);

  assert.ok(result.reasonCodes.includes("SENTINEL_DEGRADATION_ABOVE_POLICY"));
  assert.ok(result.reasonCodes.includes("BEHAVIOR_CHECK_FAILED"));
});

test("blocks missing hashes, invalid rollback, and reused holdout evidence", async () => {
  const input = await fixture();
  input.calibrationRun.candidateSnapshotHash = null;
  input.calibrationRun.rollbackVersion = "wrong-version";
  input.evidenceGate.holdoutPublicationIds = [input.evidenceGate.trainingPublicationIds[0]];

  const result = evaluateControlledRelease(input);

  assert.ok(result.reasonCodes.includes("PROVENANCE_HASH_MISSING"));
  assert.ok(result.reasonCodes.includes("ROLLBACK_VERSION_INVALID"));
  assert.ok(result.reasonCodes.includes("HOLDOUT_REUSED_FOR_TRAINING"));
});

test("creates a dry-run policy approval only for a complete ready decision", async () => {
  const decision = evaluateControlledRelease(await fixture());
  const record = await createPolicyApprovalRecord(decision, {
    workloadIdentity: "fleda:dry-run:test",
    decidedAt: "2026-08-30T12:00:00Z"
  });

  assert.equal(record.approvalType, "policy_approval");
  assert.equal(record.status, "dry_run_approved");
  assert.equal(record.activationPermitted, false);
  assert.equal(record.formalModelChanged, false);
  assert.match(record.checkResultsHash, /^sha256:[0-9a-f]{64}$/);

  assert.throws(
    () => createPolicyApprovalRecord({ ...decision, status: "blocked" }, { workloadIdentity: "x" }),
    /ready_for_auto_release/i
  );
});

test("fails closed on incomplete policy registration and mismatched artifacts", async () => {
  const input = await fixture();
  input.policy.parameters = [];
  input.parameterPolicy = {};
  input.evidenceGate.parameterId = "different.parameter";
  input.envelope.parameterId = "different.parameter";
  input.calibrationRun.provenance.policyVersion = "9.9.9";

  const result = evaluateControlledRelease(input);

  assert.equal(result.status, "blocked");
  assert.ok(result.reasonCodes.includes("POLICY_INVALID"));
  assert.ok(result.reasonCodes.includes("PARAMETER_POLICY_MISMATCH"));
  assert.ok(result.reasonCodes.includes("ARTIFACT_IDENTITY_MISMATCH"));
});

test("approval binds the complete decision chain and rejects caller-fabricated ready records", async () => {
  const decision = evaluateControlledRelease(await fixture());
  const approval = await createPolicyApprovalRecord(decision, { workloadIdentity: "fleda:dry-run:test" });

  assert.match(approval.decisionChainHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(approval.signatureStatus, "not_signed_dry_run");
  assert.throws(
    () => createPolicyApprovalRecord({ status: "ready_for_auto_release", candidateSnapshotHash: decision.candidateSnapshotHash }, { workloadIdentity: "x" }),
    /complete controlled release decision/i
  );
});
