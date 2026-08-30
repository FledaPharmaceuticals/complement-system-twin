export function preflightProposedModelRelease({ release = {}, behaviorChecks = [] } = {}) {
  const errors = [];
  if (release.status !== "proposed") errors.push("release must be proposed");
  if (release.formalModelChange !== true) errors.push("release must declare a formal model change");
  if (!release.version) errors.push("release version is required");
  if (!release.rollbackVersion || release.rollbackVersion === release.version) errors.push("distinct rollback version is required");
  if (!release.validationRecordId) errors.push("validation record ID is required");
  if (!Array.isArray(release.evidenceIds) || !release.evidenceIds.length) errors.push("at least one evidence ID is required");
  if (!release.parameterSnapshot || typeof release.parameterSnapshot !== "object" || Array.isArray(release.parameterSnapshot)) {
    errors.push("parameter snapshot is required");
  }
  for (const check of behaviorChecks) {
    if (!check?.name || check.passed !== true) errors.push(`behavior check failed: ${check?.name || "unnamed"}`);
  }
  return {
    status: errors.length ? "blocked" : "ready_for_review",
    version: release.version ?? null,
    errors,
    formalModelChanged: false,
    checksRun: behaviorChecks.length
  };
}

export function activateApprovedModelRelease({ release = {}, preflight = {}, approval = {} } = {}) {
  if (preflight.status !== "ready_for_review") throw new Error("A passed release preflight is required");
  if (approval.approvalType === "policy_approval" && (approval.status !== "approved" || approval.activationPermitted !== true)) {
    throw new Error("Policy approval does not permit formal release activation");
  }
  if (approval.status !== "approved" || !approval.approvalRecordId) throw new Error("An explicit approved status and approval record are required");
  return {
    ...structuredClone(release),
    status: "active",
    previousVersion: release.rollbackVersion,
    activationRecordId: approval.approvalRecordId,
    activatedBy: approval.approvedBy ?? "approved reviewer",
    activatedAt: new Date().toISOString(),
    formalModelChange: true
  };
}

export function applyApprovedModelRelease({ currentParameters = {}, release = {}, preflight = {}, approval = {} } = {}) {
  const activeRelease = activateApprovedModelRelease({ release, preflight, approval });
  return {
    activeVersion: activeRelease.version,
    previousVersion: activeRelease.previousVersion,
    parameters: structuredClone(activeRelease.parameterSnapshot),
    activationRecordId: activeRelease.activationRecordId,
    formalModelChanged: true,
    previousParameters: structuredClone(currentParameters)
  };
}
