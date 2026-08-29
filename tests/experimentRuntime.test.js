import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEndpointComparison,
  formatSimulationTime,
  prepareEndpointComparisonInputs,
  normalizeExperimentDuration,
  resolvePlaybackResumeTime,
  resolveResearchHeartRate,
  resolveResearchVitalSigns,
  summarizeOrganImpact
} from "../src/experimentRuntime.js";

test("normalizes requested durations to the public simulator time axis", () => {
  assert.deepEqual(normalizeExperimentDuration({ value: 12, unit: "months" }, "chronic_months"), {
    duration: 12,
    unit: "months"
  });
  assert.deepEqual(normalizeExperimentDuration({ value: 2, unit: "hours" }, "acute_hours"), {
    duration: 120,
    unit: "min"
  });
  assert.deepEqual(normalizeExperimentDuration({ value: 1, unit: "year" }, "chronic_months"), {
    duration: 12,
    unit: "months"
  });
  assert.equal(normalizeExperimentDuration({ value: 0.005, unit: "minutes" }, "acute_hours"), null);
  assert.equal(formatSimulationTime(0.5, "min"), "0.5 min");
  assert.equal(formatSimulationTime(1, "months"), "1 month");
});

test("keeps heart rate physiologic unless the experiment supplies a cardiovascular driver", () => {
  assert.equal(resolveResearchHeartRate({ diseaseContext: "AMD", experimentText: "dry AMD over 12 months", vascularImpact: 90, inflammation: 90 }), 72);
  assert.equal(resolveResearchHeartRate({ diseaseContext: "cancer microenvironment", experimentText: "C5aR1 dendritic-cell migration", vascularImpact: 90, inflammation: 90 }), 72);
  assert.equal(resolveResearchHeartRate({ diseaseContext: "PNH", experimentText: "PNH with terminal complement activation", vascularImpact: 90, inflammation: 90 }), 72);
  assert.ok(resolveResearchHeartRate({ diseaseContext: "PNH", experimentText: "PNH with severe anemia and tachycardia", vascularImpact: 70, inflammation: 40 }) > 72);
  assert.ok(resolveResearchHeartRate({ diseaseContext: "sepsis", experimentText: "sepsis with systemic infection", vascularImpact: 70, inflammation: 70 }) > 72);
  assert.ok(resolveResearchHeartRate({ diseaseContext: "AMD", experimentText: "AMD with fever and tachycardia", vascularImpact: 70, inflammation: 70 }) > 72);
  assert.ok(resolveResearchHeartRate({ diseaseContext: "cancer microenvironment", experimentText: "cancer with bradycardia", vascularImpact: 70, inflammation: 70 }) < 72);
});

test("does not treat negated physiologic conditions as active drivers", () => {
  const vitals = resolveResearchVitalSigns({
    diseaseContext: "PNH",
    experimentText: "PNH with no anemia, no hypoxia, without fever, and no hemodynamic instability",
    vascularImpact: 90,
    lungImpact: 90,
    inflammation: 90
  });

  assert.deepEqual(vitals, {
    heartRate: 72,
    systolic: 120,
    diastolic: 80,
    respiratoryRate: 16
  });

  assert.deepEqual(resolveResearchVitalSigns({
    diseaseContext: "PNH",
    experimentText: "PNH with no anemia, hypoxia, fever, or hemodynamic instability",
    vascularImpact: 90,
    lungImpact: 90,
    inflammation: 90
  }), {
    heartRate: 72,
    systolic: 120,
    diastolic: 80,
    respiratoryRate: 16
  });
});

test("derives blood pressure and respiratory rate only from affirmed physiologic drivers", () => {
  const sepsis = resolveResearchVitalSigns({
    diseaseContext: "sepsis",
    experimentText: "sepsis with systemic infection, hypotension, and tachypnea",
    vascularImpact: 80,
    lungImpact: 75,
    inflammation: 85
  });
  const hypertension = resolveResearchVitalSigns({
    diseaseContext: "aHUS",
    experimentText: "aHUS with hypertension",
    vascularImpact: 70,
    lungImpact: 20,
    inflammation: 35
  });

  assert.ok(sepsis.heartRate > 72);
  assert.ok(sepsis.systolic < 120);
  assert.ok(sepsis.diastolic < 80);
  assert.ok(sepsis.respiratoryRate > 16);
  assert.ok(hypertension.systolic > 120);
  assert.ok(hypertension.diastolic > 80);
  assert.equal(hypertension.respiratoryRate, 16);
});

test("resumes playback from a paused time and restarts only from the endpoint", () => {
  assert.equal(resolvePlaybackResumeTime({ currentTime: 40, duration: 120 }), 40);
  assert.equal(resolvePlaybackResumeTime({ currentTime: 120, duration: 120 }), 0);
  assert.equal(resolvePlaybackResumeTime({ currentTime: 0, duration: 120 }), 0);
});

test("builds an explicit treated-versus-untreated endpoint comparison", () => {
  const comparison = buildEndpointComparison({
    untreated: { C3a: 82, C5a: 74, MAC: 69 },
    treated: { C3a: 42, C5a: 33, MAC: 29 }
  });

  assert.deepEqual(comparison.map((row) => row.signal), ["C3a", "C5a", "MAC"]);
  assert.deepEqual(comparison[0], { signal: "C3a", untreated: 82, treated: 42, delta: -40 });
});

test("C5aR intervention compares receptor signaling without claiming lower C5a ligand", () => {
  const inputs = prepareEndpointComparisonInputs({
    untreated: { C3a: 30, C5a: 80, MAC: 20 },
    treated: { C3a: 30, C5a: 80, MAC: 20 },
    targets: ["c5aRInhibitor"],
    strength: 75
  });

  assert.equal("C5a" in inputs.untreated, false);
  assert.equal(inputs.untreated["C5aR signaling"], 80);
  assert.equal(inputs.treated["C5aR signaling"], 20);
});

test("combined upstream and C5aR inhibition uses each arm's own ligand concentration", () => {
  const inputs = prepareEndpointComparisonInputs({
    untreated: { C5a: 80 },
    treated: { C5a: 40 },
    targets: ["c3Inhibitor", "c5aRInhibitor"],
    strength: 75
  });

  assert.equal(inputs.untreated["C5aR signaling"], 80);
  assert.equal(inputs.treated["C5aR signaling"], 10);
});

test("normal baseline interpretation does not invent a dominant organ", () => {
  assert.equal(
    summarizeOrganImpact("normal", [{ name: "Retina / Eye", score: 16 }]),
    "All modeled organ signals remain within the physiologic reference range. No dominant disease impact is assigned."
  );
});
