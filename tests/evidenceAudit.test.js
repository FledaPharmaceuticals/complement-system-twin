import test from "node:test";
import assert from "node:assert/strict";

import { auditEvidenceCatalog } from "../src/evidenceAudit.js";

const record = (id, linkedEntities = []) => ({
  id,
  title: "Public complement metadata",
  sourceType: "publication",
  sourceLocator: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
  evidenceLevel: "mechanistic",
  extractedClaim: "Metadata-only record.",
  uncertainty: "unknown",
  linkedEntities,
  parameterPriors: {},
  extractionMethod: "public_database_metadata",
  metadata: { pmid: id, publicationDate: "2025" }
});

test("reports accepted, linked, and unlinked evidence counts", () => {
  const audit = auditEvidenceCatalog([record("1", ["AMD"]), record("2")]);

  assert.equal(audit.totalCount, 2);
  assert.equal(audit.acceptedCount, 2);
  assert.equal(audit.needsReviewCount, 0);
  assert.equal(audit.linkedCount, 1);
  assert.equal(audit.unlinkedCount, 1);
  assert.equal(audit.status, "ready");
});

test("marks malformed evidence as needing review", () => {
  const audit = auditEvidenceCatalog([{ id: "bad", title: "" }]);
  assert.equal(audit.needsReviewCount, 1);
  assert.equal(audit.status, "needs_review");
});
