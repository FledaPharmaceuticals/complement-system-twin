import test from "node:test";
import assert from "node:assert/strict";

import { createValidationDataset, compareValidationDataset, parseValidationDatasetJson } from "../src/validationDataset.js";

test("creates an anonymous aggregate validation dataset", () => {
  const dataset = createValidationDataset({
    datasetId: "demo-amd-01",
    diseaseContext: "AMD",
    source: "public literature aggregate",
    observations: [{ c3Activation: 40, c5aSignal: 20 }],
    containsPatientData: false,
    containsProductionData: false
  });

  assert.equal(dataset.recordType, "fleda_anonymous_validation_dataset");
  assert.equal(dataset.anonymous, true);
  assert.equal(dataset.observations.length, 1);
});

test("compares observed signals and returns transparent error metrics", () => {
  const dataset = createValidationDataset({
    datasetId: "demo-01",
    diseaseContext: "AMD",
    source: "public aggregate",
    observations: [{ c3Activation: 40, c5aSignal: 20 }],
    containsPatientData: false,
    containsProductionData: false
  });
  const result = compareValidationDataset(dataset, [{ c3Activation: 35, c5aSignal: 25 }]);

  assert.equal(result.metrics.c3Activation.mae, 5);
  assert.equal(result.metrics.c5aSignal.bias, 5);
  assert.equal(result.boundary.formalModelChanged, false);
});

test("rejects validation data without explicit safety boundary", () => {
  assert.throws(() => createValidationDataset({ datasetId: "unsafe", diseaseContext: "AMD", source: "unknown", observations: [] }), /containsPatientData/);
});

test("validation data remains local and does not imply model promotion", () => {
  const dataset = createValidationDataset({
    datasetId: "local", diseaseContext: "PNH", source: "aggregate",
    observations: [], containsPatientData: false, containsProductionData: false
  });
  assert.equal(dataset.boundary.formalModelChanged, false);
  assert.equal(dataset.boundary.containsPatientData, false);
});

test("parses a local JSON dataset and preserves its explicit safety boundary", () => {
  const dataset = parseValidationDatasetJson(JSON.stringify({
    datasetId: "public-demo",
    diseaseContext: "AMD",
    source: "public aggregate",
    observations: [{ c3Activation: 30 }, { c3Activation: 40 }],
    containsPatientData: false,
    containsProductionData: false
  }));

  assert.equal(dataset.datasetId, "public-demo");
  assert.equal(dataset.observations.length, 2);
  assert.equal(dataset.boundary.containsPatientData, false);
});

test("rejects malformed or unsafe local JSON datasets", () => {
  assert.throws(() => parseValidationDatasetJson("not json"), /valid JSON/);
  assert.throws(() => parseValidationDatasetJson(JSON.stringify({
    datasetId: "unsafe", diseaseContext: "AMD", source: "x", observations: [],
    containsPatientData: true, containsProductionData: false
  })), /containsPatientData/);
});

test("supports multiple observations for repeated validation runs", () => {
  const dataset = parseValidationDatasetJson(JSON.stringify({
    datasetId: "multi", diseaseContext: "PNH", source: "aggregate",
    observations: [{ c3Activation: 10 }, { c3Activation: 20 }],
    containsPatientData: false, containsProductionData: false
  }));
  const result = compareValidationDataset(dataset, [{ c3Activation: 15 }, { c3Activation: 25 }]);

  assert.equal(result.metrics.c3Activation.n, 2);
  assert.equal(result.metrics.c3Activation.mae, 5);
});

test("preserves explicit measurement scale and experimental context", () => {
  const dataset = createValidationDataset({
    datasetId: "contextual", diseaseContext: "AMD", source: "public aggregate",
    measurementScale: "normalized_0_100_proxy",
    experimentalContext: { species: "human", tissue: "retina", assay: "reported aggregate", diseaseStage: "mixed" },
    observations: [{ c3Activation: 40 }], containsPatientData: false, containsProductionData: false
  });

  assert.equal(dataset.measurementScale, "normalized_0_100_proxy");
  assert.equal(dataset.experimentalContext.tissue, "retina");
});

test("rejects proxy observations outside the declared 0-100 scale", () => {
  assert.throws(() => createValidationDataset({
    datasetId: "bad-range", diseaseContext: "AMD", source: "aggregate",
    observations: [{ c3Activation: 120 }], containsPatientData: false, containsProductionData: false
  }), /0 and 100/);
});
