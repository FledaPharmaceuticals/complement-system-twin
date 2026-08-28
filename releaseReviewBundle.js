export function createReleaseReviewBundle({
  proposedRelease,
  preflight,
  comparisons = [],
  candidates = [],
  evidenceIds = [],
  createdAt = new Date().toISOString()
} = {}) {
  if (proposedRelease?.status !== "proposed" || preflight?.status !== "ready_for_review") {
    throw new Error("A proposed release with a ready preflight is required");
  }
  const combinedEvidenceIds = [...new Set([
    ...(proposedRelease.evidenceIds ?? []),
    ...evidenceIds,
    ...candidates.flatMap((candidate) => candidate?.evidenceIds ?? [])
  ].filter(Boolean))];
  if (!combinedEvidenceIds.length) throw new Error("Release review bundle requires evidence IDs");
  for (const comparison of comparisons) {
    if (comparison?.recordType !== "fleda_validation_comparison") {
      throw new Error("Release comparisons must use the validation comparison record type");
    }
    const boundary = comparison.boundary || {};
    if (boundary.containsPatientData !== false || boundary.containsProductionData !== false || boundary.formalModelChanged !== false) {
      throw new Error("Release comparisons must be anonymous and leave the formal model unchanged");
    }
  }
  return {
    bundleType: "fleda_release_review_bundle",
    bundleVersion: "1.0",
    createdAt,
    status: "review_only",
    formalModelChanged: false,
    proposedRelease: structuredClone(proposedRelease),
    preflight: structuredClone(preflight),
    comparisons: structuredClone(comparisons),
    candidates: structuredClone(candidates),
    evidenceIds: combinedEvidenceIds
  };
}
