import test from "node:test";
import assert from "node:assert/strict";

import { getDynamicsSeriesMeta, runDynamicsSimulation } from "../src/modules/complement-system-twin/dynamics/runDynamicsSimulation.js";
import { generateAmdDiseaseSummary } from "../src/modules/complement-system-twin/dynamics/generateAmdDiseaseSummary.js";

function input(overrides = {}) {
  return {
    duration: 1,
    timeStep: 1,
    diseaseContext: "cancer microenvironment",
    initialConcentrations: { C3: 5400, C5: 500, FactorB: 2200, FactorD: 83, FactorH: 2950, FactorI: 380, CD55: 85, CD59: 85 },
    pathwayActivity: { classical: 54, lectin: 48, alternative: 78, terminal: 72 },
    interventionTime: 0,
    interventions: { c3Inhibitor: 0, factorBInhibitor: 0, factorDInhibitor: 0, c5Inhibitor: 0, c5aRInhibitor: 0, cd59Modifier: 100 },
    ...overrides
  };
}

test("ends exactly at a fractional requested duration", () => {
  const result = runDynamicsSimulation(input({ duration: 0.5, timeStep: 1 }));

  assert.equal(result.timePoints.at(-1).time, 0.5);
});

test("C5aR inhibition changes receptor signaling without consuming C5a ligand", () => {
  const untreated = runDynamicsSimulation(input());
  const treated = runDynamicsSimulation(input({
    interventions: { ...input().interventions, c5aRInhibitor: 90 }
  }));
  const endpoint = (result, name) => result.series.find((series) => series.name === name).data.at(-1).value;

  assert.equal(endpoint(treated, "C5a"), endpoint(untreated, "C5a"));
});

test("AMD uses cohort biomarkers instead of unstable acute intermediates", () => {
  const result = runDynamicsSimulation(input({ diseaseContext: "AMD", duration: 24, timeStep: 1 }));
  const names = result.series.map((series) => series.name);

  assert.deepEqual(names, [
    "C3",
    "C3a/C3",
    "C3d/C3",
    "Ba/Bb",
    "C5a/C5",
    "sC5b-9",
    "Factor D",
    "Factor H",
    "Factor I"
  ]);
  assert.ok(!names.includes("C3b"));
  assert.ok(!names.includes("C3bBb"));
  assert.ok(!names.includes("C5b"));
  assert.ok(!names.includes("MAC"));
  assert.ok(!names.includes("CD59"));
});

test("advanced explorer exposes the AMD plasma cohort group", () => {
  const groups = new Set(getDynamicsSeriesMeta().map((series) => series.group));
  assert.ok(groups.has("amd-plasma"));
});

test("AMD cohort trends preserve stable substrates and expose uncertainty", () => {
  const result = runDynamicsSimulation(input({ diseaseContext: "AMD", duration: 24, timeStep: 1 }));
  const byName = Object.fromEntries(result.series.map((series) => [series.name, series]));

  for (const name of ["C3", "Factor H", "Factor I"]) {
    const endpoint = byName[name].data.at(-1);
    assert.ok(endpoint.value >= 95 && endpoint.value <= 105, `${name} should stay near the control index`);
    assert.ok(endpoint.lower < endpoint.value);
    assert.ok(endpoint.upper > endpoint.value);
  }

  assert.ok(byName["C3d/C3"].data.at(-1).value >= 115);
  assert.ok(byName["Ba/Bb"].data.at(-1).value >= 115);
  assert.ok(new Set(result.series.map((series) => series.data.at(-1).value)).size > 4);
  assert.equal(result.modelFrame, "literature_calibrated_cohort_hypothesis");
  assert.match(result.summary, /not an observed individual natural history/i);
});

test("AMD keeps ocular and structural proxies outside the plasma series", () => {
  const result = runDynamicsSimulation(input({ diseaseContext: "AMD", duration: 24, timeStep: 1 }));

  assert.deepEqual(Object.keys(result.amdSpecificOutputs.layers), [
    "systemicPlasma",
    "localOcular",
    "retinalStructure"
  ]);
  assert.equal(result.amdSpecificOutputs.layers.localOcular.measurementContext, "aqueous, vitreous, or ocular tissue");
  assert.equal(result.amdSpecificOutputs.layers.retinalStructure.measurementContext, "OCT, fundus imaging, or tissue proxy");
  assert.equal(result.amdSpecificOutputs.vitalsPolicy, "baseline_unless_independent_driver");
  assert.ok(result.amdSpecificOutputs.evidenceBasis.length >= 3);
  assert.ok(result.amdSpecificOutputs.evidenceBasis.every((record) => record.doi && record.url));
});

test("AMD interpretation distinguishes cohort evidence from individual progression", () => {
  const summary = generateAmdDiseaseSummary({
    scores: { retinalComplementActivityScore: 70, RPEStressScore: 65, choroidalInflammationScore: 60 },
    selectedTargets: []
  });

  assert.match(summary, /cohort-level/i);
  assert.match(summary, /not an individual natural history/i);
  assert.doesNotMatch(summary, /reduced Factor H regulation increases/i);
});
