import { canonicalizeJcs, sha256Jcs } from "../quantitativeObservations/canonicalHash.js";
import { getParameterPolicy, validateChangePolicy } from "./changePolicy.js";

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

export async function evaluateControlledRelease({ policy = {}, parameterPolicy = {}, evidenceGate = {}, envelope = {}, calibrationRun = {}, behaviorChecks = [] } = {}) {
  const issues = [];
  const policyValidation = validateChangePolicy(policy);
  if (!policyValidation.valid) addIssue(issues, "POLICY_INVALID", `A valid versioned dry-run policy is required: ${policyValidation.errors.join("; ")}`);
  const registeredPolicy = getParameterPolicy(policy, parameterPolicy.parameterId ?? calibrationRun.parameterId);
  if (!registeredPolicy || canonicalizeJcs(registeredPolicy) !== canonicalizeJcs(parameterPolicy)) {
    addIssue(issues, "PARAMETER_POLICY_MISMATCH", "Parameter policy must exactly match the registered policy manifest");
  }
  if (evidenceGate.status !== "passed") addIssue(issues, "EVIDENCE_GATE_FAILED", "Evidence gate did not pass");
  if (envelope.status !== "passed") addIssue(issues, "PARAMETER_ENVELOPE_FAILED", "Parameter envelope did not pass");
  if (calibrationRun.status !== "candidate") addIssue(issues, "CALIBRATION_RUN_INVALID", "A candidate calibration run is required");

  const expectedParameterId = registeredPolicy?.parameterId ?? null;
  const provenance = calibrationRun.provenance ?? {};
  const identityMatches = expectedParameterId
    && [parameterPolicy.parameterId, evidenceGate.parameterId, envelope.parameterId, calibrationRun.parameterId].every((value) => value === expectedParameterId)
    && evidenceGate.policyId === policy.policyId
    && evidenceGate.policyVersion === policy.policyVersion
    && provenance.policyId === policy.policyId
    && provenance.policyVersion === policy.policyVersion;
  let embeddedEvidenceMatches = false;
  try {
    embeddedEvidenceMatches = canonicalizeJcs(calibrationRun.evidenceGate) === canonicalizeJcs(evidenceGate);
  } catch {
    embeddedEvidenceMatches = false;
  }
  const hashBindingsMatch = HASH_PATTERN.test(evidenceGate.evidenceSetHash ?? "")
    && HASH_PATTERN.test(envelope.envelopeHash ?? "")
    && provenance.evidenceGateHash === evidenceGate.evidenceSetHash
    && provenance.envelopeHash === envelope.envelopeHash;
  if (!identityMatches || !embeddedEvidenceMatches || !hashBindingsMatch) {
    addIssue(issues, "ARTIFACT_IDENTITY_MISMATCH", "Policy, evidence, envelope, and calibration artifacts must share bound identities and hashes");
  }
  try {
    const computedPolicyHash = await sha256Jcs(policy);
    if (provenance.policyHash !== computedPolicyHash) addIssue(issues, "POLICY_HASH_MISMATCH", "Calibration policy hash does not match the supplied policy manifest");
  } catch {
    addIssue(issues, "POLICY_HASH_MISMATCH", "Calibration policy manifest cannot be canonically hashed");
  }

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

  const hashes = [calibrationRun.candidateSnapshotHash, provenance.policyHash, provenance.environmentHash, provenance.evidenceGateHash, provenance.envelopeHash, ...(provenance.observationPackageHashes ?? [])];
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
    provenance: {
      policyHash: provenance.policyHash ?? null,
      environmentHash: provenance.environmentHash ?? null,
      evidenceGateHash: provenance.evidenceGateHash ?? null,
      envelopeHash: provenance.envelopeHash ?? null,
      observationPackageHashes: structuredClone(provenance.observationPackageHashes ?? [])
    },
    baseVersion: calibrationRun.baseVersion ?? null,
    proposedVersion: calibrationRun.proposedVersion ?? null,
    rollbackVersion: calibrationRun.rollbackVersion ?? null,
    activationPermitted: false,
    formalModelChanged: false
  };
}

export function createPolicyApprovalRecord(decision = {}, { workloadIdentity, decidedAt = new Date().toISOString() } = {}) {
  if (decision.status !== "ready_for_auto_release") throw new Error("A ready_for_auto_release decision is required");
  const completeDecision = decision.recordType === "fleda_controlled_release_decision"
    && decision.recordVersion === "1.0.0"
    && decision.status === "ready_for_auto_release"
    && decision.activationPermitted === false
    && decision.formalModelChanged === false
    && Array.isArray(decision.reasonCodes) && decision.reasonCodes.length === 0
    && Array.isArray(decision.errors) && decision.errors.length === 0
    && decision.evidenceGate?.status === "passed"
    && decision.envelope?.status === "passed"
    && Number.isFinite(decision.metrics?.trainingImprovement)
    && Number.isFinite(decision.metrics?.holdoutImprovement)
    && decision.baseVersion && decision.proposedVersion && decision.rollbackVersion === decision.baseVersion
    && decision.policyId && decision.policyVersion && decision.parameterId
    && REQUIRED_CHECKS.every((name) => decision.behaviorChecks?.some((check) => check.name === name && check.passed === true && HASH_PATTERN.test(check.resultHash ?? "")))
    && [decision.provenance?.policyHash, decision.provenance?.environmentHash, decision.provenance?.evidenceGateHash, decision.provenance?.envelopeHash, ...(decision.provenance?.observationPackageHashes ?? [])]
      .every((hash) => HASH_PATTERN.test(hash ?? ""));
  if (!completeDecision) throw new Error("A complete controlled release decision is required");
  if (!workloadIdentity) throw new Error("Workload identity is required");
  if (!HASH_PATTERN.test(decision.candidateSnapshotHash ?? "")) throw new Error("Candidate snapshot hash is required");

  const decisionChain = {
    recordType: decision.recordType,
    recordVersion: decision.recordVersion,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    parameterId: decision.parameterId,
    candidateSnapshotHash: decision.candidateSnapshotHash,
    evidenceGate: decision.evidenceGate,
    envelope: decision.envelope,
    metrics: decision.metrics,
    behaviorChecks: decision.behaviorChecks,
    provenance: decision.provenance,
    baseVersion: decision.baseVersion,
    proposedVersion: decision.proposedVersion,
    rollbackVersion: decision.rollbackVersion
  };
  return Promise.all([sha256Jcs(decisionChain), sha256Jcs(decision.behaviorChecks)]).then(([decisionChainHash, checkResultsHash]) => ({
    approvalRecordId: `policy-approval:${decision.proposedVersion}`,
    approvalType: "policy_approval",
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    candidateSnapshotHash: decision.candidateSnapshotHash,
    decisionChainHash,
    checkResultsHash,
    workloadIdentity,
    decidedAt,
    status: "dry_run_approved",
    signatureStatus: "not_signed_dry_run",
    activationPermitted: false,
    formalModelChanged: false
  }));
}
