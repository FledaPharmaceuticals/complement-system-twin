import test from "node:test";
import assert from "node:assert/strict";

import { buildSimulationEvidenceSummary } from "../src/evidenceSummary.js";

const publications = [
  { id: "amd-1", title: "Complement in AMD", linked_entities: ["AMD", "Factor H"], evidence_type: "genetic" },
  { id: "qsp-1", title: "QSP complement pathway modeling", linked_entities: ["C3"], evidence_type: "qsp_model" },
  { id: "pnh-1", title: "Complement in PNH", linked_entities: ["PNH", "C5"], evidence_type: "clinical" }
];

test("summarizes disease-linked publications and preserves source identifiers", () => {
  const summary = buildSimulationEvidenceSummary("AMD", publications);

  assert.equal(summary.count, 1);
  assert.deepEqual(summary.types, ["genetic"]);
  assert.deepEqual(summary.publicationIds, ["amd-1"]);
  assert.equal(summary.uncertainty, "moderate");
});

test("uses the systems evidence set for the normal reference context", () => {
  const summary = buildSimulationEvidenceSummary("normal", publications);

  assert.equal(summary.count, 1);
  assert.deepEqual(summary.publicationIds, ["qsp-1"]);
  assert.equal(summary.uncertainty, "high");
});
