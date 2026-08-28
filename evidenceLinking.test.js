import test from "node:test";
import assert from "node:assert/strict";

import { linkEvidenceRecords } from "../src/evidenceLinking.js";

test("links only explicit disease and component terms", () => {
  const [record] = linkEvidenceRecords([
    { id: "pmid:1", title: "AMD and Factor H regulation", linkedEntities: [], metadata: {} }
  ], [
    { id: "AMD", terms: ["AMD", "age-related macular degeneration"] },
    { id: "Factor H", terms: ["Factor H", "CFH"] },
    { id: "C3", terms: ["C3"] }
  ]);

  assert.deepEqual(record.linkedEntities, ["AMD", "Factor H"]);
  assert.equal(record.metadata.linkageMethod, "explicit_term_match");
  assert.equal(record.metadata.explicitTermLinks.length, 2);
});

test("does not link substrings inside unrelated words", () => {
  const [record] = linkEvidenceRecords([
    { id: "pmid:2", title: "Acute cancer outcomes", linkedEntities: [], metadata: {} }
  ], [{ id: "C3", terms: ["C3"] }]);

  assert.deepEqual(record.linkedEntities, []);
  assert.deepEqual(record.metadata.explicitTermLinks, []);
});
