import { assessEvidenceRecord } from "./evidenceQuality.js";

export function auditEvidenceCatalog(catalog = []) {
  const assessments = catalog.map((record) => assessEvidenceRecord(record));
  const byEvidenceLevel = {};
  catalog.forEach((record) => {
    const level = record?.evidenceLevel || "unknown";
    byEvidenceLevel[level] = (byEvidenceLevel[level] || 0) + 1;
  });
  const linkedCount = catalog.filter((record) => Array.isArray(record?.linkedEntities) && record.linkedEntities.length).length;
  const acceptedCount = assessments.filter((assessment) => assessment.status === "accepted_metadata").length;
  return {
    totalCount: catalog.length,
    acceptedCount,
    needsReviewCount: catalog.length - acceptedCount,
    linkedCount,
    unlinkedCount: catalog.length - linkedCount,
    byEvidenceLevel,
    status: assessments.some((assessment) => assessment.status === "needs_review") ? "needs_review" : "ready"
  };
}
