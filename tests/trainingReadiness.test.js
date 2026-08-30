import test from "node:test";
import assert from "node:assert/strict";

import { APPLIED_LITERATURE } from "../src/appliedLiteratureCatalog.js";
import {
  assessLiteratureRecordReadiness,
  summarizeTrainingReadiness
} from "../src/trainingReadiness.js";

const completeQuantitativePaper = {
  id: "pmid:90000001",
  pmid: "90000001",
  doi: "10.1000/example",
  title: "Quantitative complement time course",
  year: 2026,
  experimentalContext: "Human serum alternative-pathway assay",
  mechanisticClaims: ["C3 activation increased after stimulation."],
  candidateEffects: [{ target: "C3 activation", direction: "increase" }],
  quantitativeObservations: [{
    endpoint: "C3a",
    value: 42,
    unit: "ng/mL",
    timepoint: 30,
    timeUnit: "min",
    assay: "ELISA",
    species: "human",
    sampleSize: 24,
    variability: { type: "SD", value: 5.2 }
  }]
};

test("accepts a fully contextualized quantitative observation for candidate calibration", () => {
  const assessment = assessLiteratureRecordReadiness(completeQuantitativePaper);

  assert.equal(assessment.mechanisticGuidanceReady, true);
  assert.equal(assessment.quantitativeObservationCount, 1);
  assert.equal(assessment.calibrationEligible, true);
  assert.deepEqual(assessment.missingQuantitativeFields, []);
});

test("rejects numeric values that omit units and experimental design fields", () => {
  const assessment = assessLiteratureRecordReadiness({
    ...completeQuantitativePaper,
    quantitativeObservations: [{ endpoint: "C3a", value: 42 }]
  });

  assert.equal(assessment.calibrationEligible, false);
  assert.ok(assessment.missingQuantitativeFields.includes("unit"));
  assert.ok(assessment.missingQuantitativeFields.includes("timepoint"));
  assert.ok(assessment.missingQuantitativeFields.includes("sampleSize"));
  assert.ok(assessment.missingQuantitativeFields.includes("variability"));
});

test("reports the current catalog as evidence-guided but not quantitatively trainable", () => {
  const summary = summarizeTrainingReadiness(APPLIED_LITERATURE);

  assert.equal(summary.totalRecords, 13);
  assert.ok(summary.mechanisticGuidanceCount >= 4);
  assert.equal(summary.quantitativeObservationCount, 0);
  assert.equal(summary.calibrationEligibleRecordCount, 0);
  assert.equal(summary.stage, "evidence_guided_only");
  assert.equal(summary.formalModelChange, false);
  assert.ok(summary.nextRequirements.includes("harmonized quantitative observations"));
});
