import test from "node:test";
import assert from "node:assert/strict";

import { runDynamicsSimulation } from "../src/modules/complement-system-twin/dynamics/runDynamicsSimulation.js";

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
