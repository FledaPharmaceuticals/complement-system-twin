import test from "node:test";
import assert from "node:assert/strict";

import { assessEvidenceRecord, attachEvidenceQuality } from "../src/evidenceQuality.js";

const validRecord = {
  id: "pmid:1",
  title: "AMD and complement",
  sourceType: "publication",
  sourceLocator: "https://pubmed.ncbi.nlm.nih.gov/1/",
  evidenceLevel: "mechanistic",
  extractedClaim: "Metadata-only record.",
  uncertainty: "unknown",
  linkedEntities: ["AMD"],
  parameterPriors: {},
  extractionMethod: "public_database_metadata",
  metadata: { pmid: "1", publicationDate: "2025" }
};

test("accepts a complete public metadata record", () => {
  assert.equal(assessEvidenceRecord(validRecord).status, "accepted_metadata");
  assert.equal(attachEvidenceQuality(validRecord).metadata.qualityStatus, "accepted_metadata");
});

test("marks malformed or unsafe evidence for review", () => {
  const result = assessEvidenceRecord({ ...validRecord, sourceLocator: "javascript:alert(1)", title: "" });
  assert.equal(result.status, "needs_review");
  assert.ok(result.issues.length >= 2);
});
