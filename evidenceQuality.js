import { validateEvidenceRecord } from "./modelContract.js";

export function assessEvidenceRecord(record) {
  const issues = [];
  const warnings = [];
  if (!validateEvidenceRecord(record)) issues.push("record does not satisfy the shared evidence contract");
  if (!/^https?:\/\//i.test(String(record?.sourceLocator ?? "")) && !/^seed:\/\//i.test(String(record?.sourceLocator ?? ""))) {
    issues.push("source locator is not an approved http(s) or seed locator");
  }
  if (record?.sourceType === "publication" && !record?.metadata?.pmid) {
    warnings.push("publication record has no PMID metadata");
  }
  if (record?.extractionMethod === "public_database_metadata" && !record?.metadata?.publicationDate) {
    warnings.push("publication date was not supplied by the public metadata response");
  }
  return {
    status: issues.length ? "needs_review" : "accepted_metadata",
    issues,
    warnings
  };
}

export function attachEvidenceQuality(record) {
  const quality = assessEvidenceRecord(record);
  return {
    ...record,
    metadata: {
      ...(record?.metadata ?? {}),
      qualityStatus: quality.status,
      qualityIssues: quality.issues,
      qualityWarnings: quality.warnings
    }
  };
}
