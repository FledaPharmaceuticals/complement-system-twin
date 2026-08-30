import { sha256Jcs } from "../quantitativeObservations/canonicalHash.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_CHECKS = [
  "normal_baseline_stability",
  "non_negativity",
  "mass_balance",
  "disease_ordering",
  "intervention_directionality",
  "reset_replay_determinism",
  "numerical_convergence"
];

function addIssue(issues, code, message) {
  if (!issues.some((issue) => issue.code === code)) issues.push({ code, message });
}

function improvement(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0 || after < 0) return null;
  return Math.round(((before - after) / before) * 1e12) / 1e12;
}

export function evaluateControlledRelease({ policy = {}, parameterPolicy = {}, evidenceGate = {}, envelope = {}, calibrationRun = {}, behaviorChecks = [] } = {}) {
  const issues = [];
  if (policy.status !== "dry_run" || !policy.policyId || !policy.policyVersion) addIssue(issues, "POLICY_INVALID", "A versioned dry-run policy is required");
  if (evidenceGate.status !== "passed") addIssue(issues, "EVIDENCE_GATE_FAILED", "Evidence gate did not pass");
  if (envelope.status !== "passed") addIssue(issues, "PARAMETER_ENVELOPE_FAILED", "Parameter envelope did not pass");
  if (calibrationRun.status !== "candidate") addIssue(issues, "CALIBRATION_RUN_INVALID", "A candidate calibration run is required");

  const objective = calibrationRun.objective ?? {};
  const trainingImprovement = improvement(objective.trainingBefore, objective.trainingAfter);
  const holdoutImprovement = improvement(objective.holdoutBefore, objective.holdoutAfter);
  if (trainingImprovement === null || trainingImprovement < parameterPolicy.trainingImprovementMinimum) {
    addIssue(issues, "TRAINING_IMPROVEMENT_BELOW_POLICY", "Training objective improvement is below policy");
  }
  if (holdoutImprovement === null || holdoutImprovement < parameterPolicy.holdoutImprovementMinimum) {
    addIssue(issues, "HOLDOUT_IMPROVEMENT_BELOW_POLICY", "Holdout objective improvement is below policy");
  }

  const checksByName = new Map(behaviorChecks.map((check) => [check.name, check]));
  for (const name of REQUIRED_CHECKS) {
    const check = checksByName.get(name);
    if (!check || check.passed !== true || !HASH_PATTERN.test(check.resultHash ?? "")) {
      addIssue(issues, "BEHAVIOR_CHECK_FAILED", `Required behavior check failed or lacks a result hash: ${name}`);
    }
  }
  for (const sentinel of parameterPolicy.sentinelEndpoints ?? []) {
    const check = checksByName.get(sentinel);
    if (!check || !Number.isFinite(check.degradation) || check.degradation > parameterPolicy.sentinelDegradationMaximum) {
      addIssue(issues, "SENTINEL_DEGRADATION_ABOVE_POLICY", `Sentinel degradation exceeds policy: ${sentinel}`);
    }
  }

  const provenance = calibrationRun.provenance ?? {};
  const hashes = [calibrationRun.candidateSnapshotHash, provenance.policyHash, provenance.environmentHash, ...(provenance.observationPackageHashes ?? [])];
  if (!hashes.length || hashes.some((hash) => !HASH_PATTERN.test(hash ?? ""))) {
    addIssue(issues, "PROVENANCE_HASH_MISSING", "Required calibration provenance hash is missing");
  }
  if (!calibrationRun.rollbackVersion || calibrationRun.rollbackVersion !== calibrationRun.baseVersion) {
    addIssue(issues, "ROLLBACK_VERSION_INVALID", "Rollback version must match the active base version");
  }

  const training = new Set(evidenceGate.trainingPublicationIds ?? []);
  if ((evidenceGate.holdoutPublicationIds ?? []).some((id) => training.has(id))) {
    addIssue(issues, "HOLDOUT_REUSED_FOR_TRAINING", "Holdout evidence was reused for training");
  }

  return {
    recordType: "fleda_controlled_release_decision",
    recordVersion: "1.0.0",
    status: issues.length ? "blocked" : "ready_for_auto_release",
    reasonCodes: issues.map((issue) => issue.code),
    errors: issues.map((issue) => issue.message),
    policyId: policy.policyId ?? null,
    policyVersion: policy.policyVersion ?? null,
    parameterId: calibrationRun.parameterId ?? parameterPolicy.parameterId ?? null,
    candidateSnapshotHash: calibrationRun.candidateSnapshotHash ?? null,
    evidenceGate: structuredClone(evidenceGate),
    envelope: structuredClone(envelope),
    metrics: { trainingImprovement, holdoutImprovement },
    behaviorChecks: structuredClone(behaviorChecks),
    baseVersion: calibrationRun.baseVersion ?? null,
    proposedVersion: calibrationRun.proposedVersion ?? null,
    rollbackVersion: calibrationRun.rollbackVersion ?? null,
    activationPermitted: false,
    formalModelChanged: false
  };
}

export function createPolicyApprovalRecord(decision = {}, { workloadIdentity, decidedAt = new Date().toISOString() } = {}) {
  if (decision.status !== "ready_for_auto_release") throw new Error("A ready_for_auto_release decision is required");
  if (!workloadIdentity) throw new Error("Workload identity is required");
  if (!HASH_PATTERN.test(decision.candidateSnapshotHash ?? "")) throw new Error("Candidate snapshot hash is required");

  return sha256Jcs({
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    candidateSnapshotHash: decision.candidateSnapshotHash,
    behaviorChecks: decision.behaviorChecks
  }).then((checkResultsHash) => ({
    approvalRecordId: `policy-approval:${decision.proposedVersion}`,
    approvalType: "policy_approval",
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    candidateSnapshotHash: decision.candidateSnapshotHash,
    checkResultsHash,
    workloadIdentity,
    decidedAt,
    status: "dry_run_approved",
    activationPermitted: false,
    formalModelChanged: false
  }));
}
