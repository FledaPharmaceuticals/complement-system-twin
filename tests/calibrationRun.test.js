import test from "node:test";
import assert from "node:assert/strict";

import { createCalibrationRunRecord } from "../src/controlledRelease/calibrationRun.js";

function validInput() {
  return {
    runId: "calibration:synthetic-amd-1",
    baseVersion: "complement-twin-v1.1-contract",
    proposedVersion: "complement-twin-v1.2-dry-run",
    parameterId: "amd.retinalAlternativeAmplification",
    rollbackVersion: "complement-twin-v1.1-contract",
    evidenceGate: {
      status: "passed",
      policyId: "fleda-complement-auto-release-policy",
      policyVersion: "1.0.0",
      parameterId: "amd.retinalAlternativeAmplification",
      evidenceSetHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      trainingPublicationIds: ["synthetic:p1", "synthetic:p2"],
      holdoutPublicationIds: ["synthetic:p3"]
    },
    provenance: {
      policyId: "fleda-complement-auto-release-policy",
      policyVersion: "1.0.0",
      policyHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evidenceGateHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      envelopeHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      observationPackageHashes: ["sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
      codeCommit: "test-commit-1309c8e",
      environmentHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      assignmentSeed: "synthetic-seed-1",
      solverId: "synthetic-weighted-fit",
      solverVersion: "1.0.0"
    },
    objective: { name: "weighted_rmse", trainingBefore: 1, trainingAfter: 0.85, holdoutBefore: 1, holdoutAfter: 0.92 },
    candidateSnapshotHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  };
}

test("records a reproducible immutable dry-run calibration candidate", () => {
  const input = validInput();
  const run = createCalibrationRunRecord(input);

  assert.equal(run.status, "candidate");
  assert.equal(run.formalModelChanged, false);
  assert.equal(run.provenance.policyVersion, "1.0.0");
  assert.equal(run.provenance.observationPackageHashes.length, 1);

  input.provenance.codeCommit = "mutated";
  input.objective.trainingAfter = 100;
  assert.equal(run.provenance.codeCommit, "test-commit-1309c8e");
  assert.equal(run.objective.trainingAfter, 0.85);
  assert.equal(Object.isFrozen(run), true);
});

test("rejects missing provenance, failed evidence, or unsafe version identity", () => {
  const missing = validInput();
  missing.provenance.environmentHash = null;
  assert.throws(() => createCalibrationRunRecord(missing), /environment hash/i);

  const failed = validInput();
  failed.evidenceGate.status = "blocked";
  assert.throws(() => createCalibrationRunRecord(failed), /evidence gate/i);

  const sameVersion = validInput();
  sameVersion.proposedVersion = sameVersion.baseVersion;
  assert.throws(() => createCalibrationRunRecord(sameVersion), /distinct proposed version/i);
});

test("rejects attempts to declare a formal model change during dry run", () => {
  assert.throws(
    () => createCalibrationRunRecord({ ...validInput(), formalModelChanged: true }),
    /formal model/i
  );
});
