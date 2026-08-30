import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCandidateReport } from "../src/quantitativeObservations/buildCandidateReport.js";

const ROOT = new URL("../", import.meta.url);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/quantitative-observations/${name}`, ROOT), "utf8"));
}

test("keeps local ex vivo and systemic clinical AMD observations in separate context groups", async () => {
  const systemic = await fixture("amd-systemic-clinical-valid.json");
  const local = await fixture("amd-local-ex-vivo-valid.json");

  const report = await buildCandidateReport([systemic, local]);

  assert.equal(report.observationCount, 2);
  assert.equal(report.eligibleCount, 2);
  assert.equal(report.knowledgeGraphOnlyCount, 0);
  assert.equal(report.contextGroups.length, 2);
  assert.deepEqual(report.contextGroups.map((group) => group.spatialScope).sort(), ["local_tissue", "systemic"]);
  assert.deepEqual(report.crossContextComparisons, []);
  assert.equal(report.formalModelChanged, false);
});

test("reports an explicit cross-context comparison without merging measurements", async () => {
  const systemic = await fixture("amd-systemic-clinical-valid.json");
  const local = await fixture("amd-local-ex-vivo-valid.json");
  local.experiment.comparisonId = systemic.experiment.comparisonId;

  const report = await buildCandidateReport([systemic, local]);

  assert.equal(report.contextGroups.length, 2);
  assert.deepEqual(report.crossContextComparisons, [{
    comparisonId: "synthetic-amd-v-control",
    observationIds: [systemic.observationId, local.observationId]
  }]);
});

test("retains conflicting duplicate identities instead of overwriting", async () => {
  const original = await fixture("amd-systemic-clinical-valid.json");
  const conflict = structuredClone(original);
  conflict.measurement.value = 2.5;
  conflict.measurement.reportedValueText = "2.5";

  const report = await buildCandidateReport([original, conflict]);

  assert.equal(report.observationCount, 2);
  assert.equal(report.conflictCount, 1);
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.knowledgeGraphOnlyCount, 2);
});
