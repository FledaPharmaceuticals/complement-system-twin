import { MODEL_VERSION } from "./modelContract.js";

// Append-only release metadata. Parameter promotion belongs to a future governed workflow.
export const MODEL_RELEASES = Object.freeze([
  Object.freeze({
    version: MODEL_VERSION,
    status: "active",
    releasedAt: "2026-08-27",
    summary: "V1.1 contract adds simulation traceability for disease, evidence, and uncertainty.",
    formalModelChange: false,
    evidenceIds: []
  })
]);

export function getModelRelease(version = MODEL_VERSION) {
  return MODEL_RELEASES.find((release) => release.version === version) ?? null;
}

export function createModelChangeRecord({
  baseVersion = MODEL_VERSION,
  candidateId,
  summary,
  evidenceIds = []
} = {}) {
  return {
    id: `change:${baseVersion}:${candidateId}`,
    baseVersion,
    candidateId,
    summary,
    evidenceIds: [...evidenceIds],
    status: "candidate",
    promotedVersion: null,
    formalModelChange: false
  };
}

export function createProposedModelRelease(changeRecord = {}, options = {}) {
  if (changeRecord.status !== "promoted" || changeRecord.formalModelChange !== true) {
    throw new Error("A promoted formal change is required for a proposed release");
  }
  if (!changeRecord.promotedVersion || !changeRecord.evidenceIds?.length || !changeRecord.validation?.validationRecordId) {
    throw new Error("Proposed releases require version, evidence, and validation provenance");
  }
  const parameterSnapshot = options.parameterSnapshot ?? changeRecord.parameterSnapshot;
  if (!parameterSnapshot || typeof parameterSnapshot !== "object" || Array.isArray(parameterSnapshot)) {
    throw new Error("Proposed releases require a parameter snapshot");
  }
  const rollbackVersion = options.rollbackVersion ?? changeRecord.baseVersion;
  if (!rollbackVersion || rollbackVersion === changeRecord.promotedVersion) {
    throw new Error("Proposed releases require a distinct rollback version");
  }
  return {
    version: changeRecord.promotedVersion,
    status: "proposed",
    releasedAt: null,
    summary: changeRecord.summary,
    formalModelChange: true,
    evidenceIds: [...changeRecord.evidenceIds],
    changeRecordId: changeRecord.id,
    validationRecordId: changeRecord.validation.validationRecordId,
    parameterSnapshot: structuredClone(parameterSnapshot),
    rollbackVersion
  };
}
