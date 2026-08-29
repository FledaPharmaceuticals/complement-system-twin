import test from "node:test";
import assert from "node:assert/strict";

import { calculateCancerMicroenvironmentImpacts } from "../src/modules/complement-system-twin/disease/cancerOutcomeProfile.js";

test("cancer scenario reports tumor immune endpoints instead of generic skin and joint impact", () => {
  const impacts = calculateCancerMicroenvironmentImpacts({ C3a: 58, C5a: 82, MAC: 44, C3b: 61, C3bBb: 64 });

  assert.equal(impacts[0].name, "Tumor Immune Microenvironment");
  assert.ok(impacts.some((impact) => impact.name === "Tolerogenic DC Migration"));
  assert.ok(impacts.some((impact) => impact.name === "Tumor-draining Lymph Node Signal"));
  assert.equal(impacts.some((impact) => /Skin|Joint/.test(impact.name)), false);
});

test("protective antitumor response never outranks the primary tumor-context signal", () => {
  const impacts = calculateCancerMicroenvironmentImpacts({ C3a: 3, C5a: 3, MAC: 2, C3b: 4, C3bBb: 3 });

  assert.equal(impacts[0].name, "Tumor Immune Microenvironment");
  assert.equal(impacts.find((impact) => impact.name === "Antitumor Immune Response")?.protective, true);
});

test("C5aR inhibition reduces receptor-driven cancer signals without changing ligand input", () => {
  const untreated = calculateCancerMicroenvironmentImpacts({ C3a: 30, C5a: 80, MAC: 20, C3b: 40, C3bBb: 45 });
  const treated = calculateCancerMicroenvironmentImpacts(
    { C3a: 30, C5a: 80, MAC: 20, C3b: 40, C3bBb: 45 },
    { c5aRInhibition: 75 }
  );
  const score = (rows, name) => rows.find((row) => row.name === name).score;

  assert.ok(score(treated, "Tolerogenic DC Migration") < score(untreated, "Tolerogenic DC Migration"));
  assert.ok(score(treated, "Antitumor Immune Response") > score(untreated, "Antitumor Immune Response"));
});
