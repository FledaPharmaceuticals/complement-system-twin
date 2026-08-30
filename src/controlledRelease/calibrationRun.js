const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireHash(value, label) {
  if (!HASH_PATTERN.test(value ?? "")) throw new Error(`${label} is required and must be a SHA-256 hash`);
}

export function createCalibrationRunRecord(input = {}) {
  if (input.formalModelChanged === true) throw new Error("Dry-run calibration cannot declare a formal model change");
  for (const field of ["runId", "baseVersion", "proposedVersion", "parameterId", "rollbackVersion"]) {
    if (!input[field]) throw new Error(`${field} is required`);
  }
  if (input.baseVersion === input.proposedVersion) throw new Error("A distinct proposed version is required");
  if (input.rollbackVersion !== input.baseVersion) throw new Error("Rollback version must identify the active base version");
  if (input.evidenceGate?.status !== "passed") throw new Error("A passed evidence gate is required");

  const provenance = input.provenance ?? {};
  for (const field of ["policyId", "policyVersion", "codeCommit", "assignmentSeed", "solverId", "solverVersion"]) {
    if (!provenance[field]) throw new Error(`${field.replaceAll(/([A-Z])/g, " $1").toLowerCase()} is required`);
  }
  requireHash(provenance.policyHash, "policy hash");
  requireHash(provenance.environmentHash, "environment hash");
  if (!Array.isArray(provenance.observationPackageHashes) || !provenance.observationPackageHashes.length) {
    throw new Error("Observation package hashes are required");
  }
  provenance.observationPackageHashes.forEach((hash) => requireHash(hash, "observation package hash"));
  requireHash(input.candidateSnapshotHash, "candidate snapshot hash");

  const objective = input.objective ?? {};
  for (const field of ["trainingBefore", "trainingAfter", "holdoutBefore", "holdoutAfter"]) {
    if (!Number.isFinite(objective[field]) || objective[field] < 0) throw new Error(`Finite non-negative objective ${field} is required`);
  }
  if (!objective.name) throw new Error("Objective name is required");

  return deepFreeze({
    recordType: "fleda_calibration_run",
    recordVersion: "1.0.0",
    runId: input.runId,
    status: "candidate",
    baseVersion: input.baseVersion,
    proposedVersion: input.proposedVersion,
    parameterId: input.parameterId,
    rollbackVersion: input.rollbackVersion,
    evidenceGate: structuredClone(input.evidenceGate),
    provenance: structuredClone(provenance),
    objective: structuredClone(objective),
    candidateSnapshotHash: input.candidateSnapshotHash,
    formalModelChanged: false
  });
}
