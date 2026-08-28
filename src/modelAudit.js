export function buildModelAuditSummary({
  releases = [],
  review = {},
  validationComparisons = [],
  validationCandidates = [],
  knowledgeRecords = []
} = {}) {
  const activeRelease = releases.find((release) => release.status === "active") ?? releases[0] ?? null;
  const candidates = Array.isArray(review.candidates) ? review.candidates : [];
  const observedCandidates = Array.isArray(validationCandidates) ? validationCandidates : [];
  const conflicts = Array.isArray(review.conflicts) ? review.conflicts : [];
  const knowledgeLayers = knowledgeRecords.reduce((counts, record) => {
    const layer = record?.knowledgeLayer || "unknown";
    counts[layer] = (counts[layer] || 0) + 1;
    return counts;
  }, {});
  const formalChangeCount = releases.filter((release) => release.formalModelChange === true).length;
  return {
    activeVersion: activeRelease?.version ?? null,
    releaseCount: releases.length,
    formalChangeCount,
    candidateCount: candidates.length + observedCandidates.length,
    candidatesNeedingReview: [...candidates, ...observedCandidates].filter((candidate) => candidate.reviewStatus === "needs_review" || candidate.status === "candidate").length,
    conflictCount: conflicts.length,
    validationComparisonCount: validationComparisons.length,
    knowledgeRecordCount: knowledgeRecords.length,
    knowledgeLayers: Object.fromEntries(Object.entries(knowledgeLayers).sort(([left], [right]) => left.localeCompare(right))),
    status: candidates.some((candidate) => candidate.reviewStatus === "needs_review") || observedCandidates.length > 0 || conflicts.length
      ? "review_required"
      : "no_open_review_items",
    formalModelChanged: formalChangeCount > 0
  };
}
