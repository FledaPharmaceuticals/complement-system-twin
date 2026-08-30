import test from "node:test";
import assert from "node:assert/strict";

import { parseExperimentIntent } from "../src/experimentIntent.js";

test("prepares a retina-centered chronic AMD experiment", () => {
  const plan = parseExperimentIntent(
    "Model dry AMD with RPE stress, drusen and C3 activation over 12 months with intravitreal factor D inhibition from baseline. Compare treated and untreated states."
  );

  assert.equal(plan.diseaseContext, "AMD");
  assert.equal(plan.timeScale, "chronic_months");
  assert.deepEqual(plan.intervention, ["factorDInhibitor"]);
  assert.ok(plan.focus.includes("C3"));
  assert.ok(plan.focus.includes("RPE"));
  assert.equal(plan.requestedComparison, true);
  assert.deepEqual(plan.interventionStart, { value: 0, unit: "months" });
  assert.equal(plan.interventionRoute, "intravitreal");
  assert.deepEqual(plan.duration, { value: 12, unit: "months" });
  assert.equal(plan.missingInformation.length, 0);
  assert.equal(plan.confidence, "high");
});

test("asks for AMD intervention timing and route instead of inventing them", () => {
  const plan = parseExperimentIntent(
    "Model dry AMD over 12 months with Factor D inhibition and compare treated and untreated states."
  );

  assert.equal(plan.canRun, false);
  assert.equal(plan.interventionStart, null);
  assert.equal(plan.interventionRoute, "unknown");
  assert.ok(plan.missingInformation.some((item) => /intervention start/i.test(item)));
  assert.ok(plan.missingInformation.some((item) => /intravitreal|systemic|route/i.test(item)));
});

test("extracts an explicit chronic intervention month", () => {
  const plan = parseExperimentIntent(
    "Model dry AMD for 12 months with intravitreal Factor D inhibition starting at month 6."
  );

  assert.deepEqual(plan.interventionStart, { value: 6, unit: "months" });
  assert.equal(plan.interventionRoute, "intravitreal");
  assert.equal(plan.canRun, true);
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
  assert.deepEqual(plan.duration, { value: 120, unit: "minutes" });
  assert.ok(plan.assumptions.some((item) => /baseline/i.test(item)));
});

test("flags patient identifiers and clinical diagnosis requests", () => {
  const plan = parseExperimentIntent("Diagnose patient John Doe with PNH using his medical record.");

  assert.ok(plan.safetyNotes.some((item) => /patient/i.test(item)));
  assert.equal(plan.canRun, false);
});

test("recognizes a cancer C5aR1 dendritic-cell experiment", () => {
  const plan = parseExperimentIntent(
    "Model a cancer microenvironment with C5aR1-driven tolerogenic dendritic-cell migration over 12 months after C5aR1 inhibition."
  );

  assert.equal(plan.diseaseContext, "cancer microenvironment");
  assert.equal(plan.timeScale, "chronic_months");
  assert.ok(plan.focus.includes("C5aR1"));
  assert.ok(plan.focus.includes("Dendritic cells"));
  assert.deepEqual(plan.intervention, ["c5aRInhibitor"]);
});

test("requires an intervention when treated-versus-untreated comparison is requested", () => {
  const plan = parseExperimentIntent("Compare treated and untreated PNH over 120 minutes.");

  assert.equal(plan.requestedComparison, true);
  assert.equal(plan.canRun, false);
  assert.ok(plan.missingInformation.some((item) => /intervention/i.test(item)));
});

test("rejects a duration unit that conflicts with an explicit time-scale override", () => {
  const plan = parseExperimentIntent("Model AMD over 120 minutes after Factor D inhibition.", { timeScale: "chronic_months" });

  assert.equal(plan.canRun, false);
  assert.ok(plan.missingInformation.some((item) => /duration unit/i.test(item)));
});
