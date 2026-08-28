export function promoteValidatedModelChange({
  changeRecord,
  validation,
  nextVersion,
  additionalEvidenceIds = []
} = {}) {
  if (!changeRecord || changeRecord.status !== "candidate") {
    throw new Error("Only candidate change records can be promoted");
  }
  if (!validation || validation.status !== "validated") {
    throw new Error("A validated review record is required before promotion");
  }
  if (!nextVersion || nextVersion === changeRecord.baseVersion) {
    throw new Error("A distinct promoted model version is required");
  }
  const evidenceIds = [...new Set([
    ...(changeRecord.evidenceIds ?? []),
    ...additionalEvidenceIds
  ].filter(Boolean))];
  if (!evidenceIds.length) {
    throw new Error("At least one evidence ID is required for promotion");
  }
  return {
    ...changeRecord,
    evidenceIds,
    status: "promoted",
    promotedVersion: nextVersion,
    formalModelChange: true,
    validation: structuredClone(validation),
    promotedAt: new Date().toISOString()
  };
}
