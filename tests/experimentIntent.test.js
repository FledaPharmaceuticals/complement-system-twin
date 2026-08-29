import test from "node:test";
import assert from "node:assert/strict";

import { parseExperimentIntent } from "../src/experimentIntent.js";

test("prepares a retina-centered chronic AMD experiment", () => {
  const plan = parseExperimentIntent(
    "Model dry AMD with RPE stress, drusen and C3 activation over 12 months after factor D inhibition. Compare treated and untreated states."
  );

  assert.equal(plan.diseaseContext, "AMD");
  assert.equal(plan.timeScale, "chronic_months");
  assert.deepEqual(plan.intervention, ["factorDInhibitor"]);
  assert.ok(plan.focus.includes("C3"));
  assert.ok(plan.focus.includes("RPE"));
  assert.equal(plan.requestedComparison, true);
  assert.equal(plan.missingInformation.length, 0);
  assert.equal(plan.confidence, "high");
});

test("does not invent a disease for an incomplete experiment", () => {
  const plan = parseExperimentIntent("Show how complement changes after treatment.");

  assert.equal(plan.diseaseContext, "unknown");
  assert.equal(plan.timeScale, "unknown");
  assert.ok(plan.missingInformation.some((item) => /disease/i.test(item)));
  assert.ok(plan.missingInformation.some((item) => /time/i.test(item)));
  assert.equal(plan.confidence, "low");
});

test("keeps normal baseline free of an acute disease reaction", () => {
  const plan = parseExperimentIntent("Run a normal healthy baseline for 120 minutes without treatment.");

  assert.equal(plan.diseaseContext, "normal");
  assert.equal(plan.timeScale, "baseline");
  assert.deepEqual(plan.intervention, []);
  assert.ok(plan.assumptions.some((item) => /baseline/i.test(item)));
});

test("flags patient identifiers and clinical diagnosis requests", () => {
  const plan = parseExperimentIntent("Diagnose patient John Doe with PNH using his medical record.");

  assert.ok(plan.safetyNotes.some((item) => /patient/i.test(item)));
  assert.equal(plan.canRun, false);
});

