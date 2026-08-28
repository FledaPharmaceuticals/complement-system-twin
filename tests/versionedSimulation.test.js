import test from "node:test";
import assert from "node:assert/strict";

import { simulateVersioned } from "../src/versionedSimulation.js";
import { MODEL_VERSION } from "../src/modelContract.js";

test("versioned simulation preserves existing outputs and adds traceability", () => {
  const run = simulateVersioned({
    classical: 40,
    lectin: 40,
    alternative: 55,
    terminal: 35,
    factorH: 70,
    factorI: 70,
    cd55: 80,
    cd59: 80,
    diseaseContext: "AMD",
    c1sInhibition: 0,
    masp2Inhibition: 0,
    c3Inhibition: 0,
    factorBInhibition: 0,
    factorDInhibition: 0,
    c5Inhibition: 0,
    c5aRInhibition: 0
  }, { evidenceIds: ["pmid:00000001"] });

  assert.equal(run.modelVersion, MODEL_VERSION);
  assert.equal(run.isClinicalPrediction, false);
  assert.deepEqual(run.context.evidenceIds, ["pmid:00000001"]);
  assert.equal(typeof run.outputs.c3Activation, "number");
  assert.equal(run.outputs.diseaseLabel, "AMD");
});

test("versioned simulation uses a safe research default when input is omitted", () => {
  const run = simulateVersioned();

  assert.equal(run.status, "research_proxy");
  assert.equal(run.context.diseaseContext, "normal");
  assert.equal(run.isClinicalPrediction, false);
});
