import test from "node:test";
import assert from "node:assert/strict";

import { normalizePubMedRecord } from "../src/publicEvidenceAdapter.js";

test("normalizes a PubMed record with PMID and DOI provenance", () => {
  const record = normalizePubMedRecord({
    uid: "12345678",
    title: "Alternative complement pathway in AMD",
    abstractText: "Factor H and C3 regulation are linked to retinal inflammation.",
    pubdate: "2024 Jan",
    publicationTypes: ["Review"],
    articleIds: [{ idType: "doi", value: "10.1000/example" }]
  }, { entityVocabulary: ["AMD", "Factor H", "C3"] });

  assert.equal(record.id, "pmid:12345678");
  assert.equal(record.sourceType, "publication");
  assert.equal(record.sourceLocator, "https://pubmed.ncbi.nlm.nih.gov/12345678/");
  assert.equal(record.evidenceLevel, "curated");
  assert.deepEqual(record.linkedEntities, ["AMD", "Factor H", "C3"]);
  assert.match(record.extractedClaim, /Factor H/);
  assert.equal(record.metadata.doi, "10.1000/example");
});

test("uses mechanistic evidence and unknown uncertainty when publication type is missing", () => {
  const record = normalizePubMedRecord({
    uid: "87654321",
    title: "C3bBb convertase kinetics",
    abstractText: "C3bBb amplification was measured in vitro."
  }, { entityVocabulary: ["C3bBb", "C5"] });

  assert.equal(record.evidenceLevel, "mechanistic");
  assert.equal(record.uncertainty, "unknown");
  assert.deepEqual(record.linkedEntities, ["C3bBb"]);
  assert.equal(record.metadata.doi, null);
});

test("rejects records without a stable PMID or title", () => {
  assert.equal(normalizePubMedRecord({ title: "Missing PMID" }), null);
  assert.equal(normalizePubMedRecord({ uid: "1" }), null);
});
