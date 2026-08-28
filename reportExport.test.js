import test from "node:test";
import assert from "node:assert/strict";

import { buildSimulationReport } from "../src/reportExport.js";

test("builds a traceable research report without patient data", () => {
  const report = buildSimulationReport({
    modelVersion: "complement-twin-v1.1-contract",
    simulationInput: { diseaseContext: "AMD", duration: 120 },
    simulationOutput: { diseaseActivityProxy: 42, c3Activation: 35 },
    evidenceSummary: { count: 3, basis: "public literature" },
    comparisonRows: [{ id: "baseline", metrics: { diseaseActivityProxy: 42 } }],
    createdAt: "2026-08-27T00:00:00.000Z"
  });

  assert.equal(report.reportType, "fleda_complement_research_simulation");
  assert.equal(report.modelVersion, "complement-twin-v1.1-contract");
  assert.equal(report.createdAt, "2026-08-27T00:00:00.000Z");
  assert.equal(report.boundary.isClinicalPrediction, false);
  assert.equal(report.boundary.containsPatientData, false);
  assert.deepEqual(report.comparisonRows[0].metrics, { diseaseActivityProxy: 42 });
});

test("rejects reports without model version or simulation input", () => {
  assert.throws(() => buildSimulationReport({ simulationOutput: {} }), /modelVersion/);
});

test("report data is cloned so later UI changes do not rewrite the report", () => {
  const input = { diseaseContext: "AMD" };
  const output = { diseaseActivityProxy: 42 };
  const report = buildSimulationReport({ modelVersion: "v1", simulationInput: input, simulationOutput: output });

  input.diseaseContext = "PNH";
  output.diseaseActivityProxy = 99;
  assert.equal(report.simulationInput.diseaseContext, "AMD");
  assert.equal(report.simulationOutput.diseaseActivityProxy, 42);
});
