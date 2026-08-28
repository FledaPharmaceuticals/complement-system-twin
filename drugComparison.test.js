import test from "node:test";
import assert from "node:assert/strict";

import { compareDrugInterventions, DEFAULT_COMPARISON_SCENARIOS } from "../src/drugComparison.js";

const baseInput = {
  diseaseContext: "AMD",
  classical: 35,
  lectin: 38,
  alternative: 84,
  terminal: 66,
  c1sInhibition: 0,
  masp2Inhibition: 0,
  c3Inhibition: 0,
  factorBInhibition: 0,
  factorDInhibition: 0,
  c5Inhibition: 0,
  c5aRInhibition: 0,
  cd55: 85,
  cd59: 85
};

test("compares named interventions without mutating the base input", async () => {
  const original = structuredClone(baseInput);
  const rows = compareDrugInterventions(baseInput, [
    { id: "baseline", label: "No intervention", input: {} },
    { id: "c5", label: "C5 inhibition", input: { c5Inhibition: 80 } }
  ], (input) => ({ diseaseActivityProxy: input.c5Inhibition, c5Signal: input.c5Inhibition / 2 }));

  assert.deepEqual(baseInput, original);
  assert.deepEqual(rows.map((row) => row.id), ["baseline", "c5"]);
  assert.equal(rows[1].metrics.diseaseActivityProxy, 80);
  assert.equal(rows[1].status, "research_proxy");
});

test("default comparison scenarios include baseline and targeted complement interventions", () => {
  const ids = DEFAULT_COMPARISON_SCENARIOS.map((scenario) => scenario.id);

  assert.ok(ids.includes("baseline"));
  assert.ok(ids.includes("c3"));
  assert.ok(ids.includes("c5"));
  assert.ok(ids.includes("factor-b"));
  assert.ok(ids.includes("factor-d"));
});
