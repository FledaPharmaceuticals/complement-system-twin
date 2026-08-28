import test from "node:test";
import assert from "node:assert/strict";

import { buildEvidenceCatalog, findEvidenceForEntity } from "../src/evidenceCatalog.js";

test("normalizes seed publications into the shared evidence contract", () => {
  const catalog = buildEvidenceCatalog({
    publications: [{
      id: "complement-amd",
      title: "Complement in AMD",
      key_findings: "Alternative pathway relevance.",
      linked_entities: ["AMD", "Factor H"],
      evidence_type: "genetic"
    }]
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].id, "complement-amd");
  assert.equal(catalog[0].sourceType, "seed_publication");
  assert.equal(catalog[0].sourceLocator, "seed://publication/complement-amd");
  assert.deepEqual(catalog[0].linkedEntities, ["AMD", "Factor H"]);
  assert.equal(catalog[0].uncertainty, "moderate");
});

test("finds evidence by disease or component without mutating the catalog", () => {
  const catalog = buildEvidenceCatalog({
    publications: [
      { id: "amd", title: "AMD", key_findings: "a", linked_entities: ["AMD"], evidence_type: "genetic" },
      { id: "c3", title: "C3", key_findings: "b", linked_entities: ["C3"], evidence_type: "qsp_model" }
    ],
    externalRecords: [{ id: "pmid:1", linkedEntities: ["C3"] }]
  });

  assert.deepEqual(findEvidenceForEntity(catalog, "C3").map((record) => record.id), ["c3", "pmid:1"]);
  assert.equal(catalog.length, 3);
});

test("ignores malformed publication records", () => {
  assert.deepEqual(buildEvidenceCatalog({ publications: [{ id: "missing-title" }] }), []);
});
