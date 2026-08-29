import test from "node:test";
import assert from "node:assert/strict";

import { APPLIED_LITERATURE, selectLiteratureForExperiment } from "../src/appliedLiteratureCatalog.js";
import { buildEvidenceGuidance } from "../src/evidenceGuidance.js";

test("C3 inhibition guidance exposes directional candidates without numeric transfer", () => {
  const plan = {
    diseaseContext: "sepsis",
    focus: ["C3", "C5a", "MAC", "Inflammasome"],
    intervention: ["c3Inhibitor"]
  };
  const records = selectLiteratureForExperiment(plan, 8);
  const guidance = buildEvidenceGuidance(plan, records);

  assert.equal(guidance.status, "candidate_review");
  assert.ok(guidance.sources.some((source) => source.pmid === "39809101"));
  assert.ok(guidance.candidateEffects.some((effect) => effect.target === "C3a" && effect.direction === "decrease"));
  assert.ok(guidance.candidateEffects.some((effect) => effect.target === "C5a" && effect.direction === "decrease"));
  assert.ok(guidance.candidateEffects.some((effect) => effect.target === "MAC" && effect.direction === "decrease"));
  assert.ok(guidance.transferLimits.some((item) => /venom|ex vivo/i.test(item)));
  assert.ok(guidance.candidateEffects.every((effect) => effect.numericValue == null));
  assert.equal(guidance.formalModelChanged, false);
});

test("cancer conversation retrieves the Lambris C5aR1 mechanism", () => {
  const plan = {
    diseaseContext: "cancer",
    focus: ["C5aR1", "Dendritic cells"],
    intervention: ["c5aRInhibitor"]
  };
  const records = selectLiteratureForExperiment(plan, 6);
  const guidance = buildEvidenceGuidance(plan, records);

  assert.ok(guidance.sources.some((source) => source.pmid === "39666368"));
  assert.ok(guidance.mechanisticClaims.some((claim) => /dendritic|tolerogenic/i.test(claim.text)));
  assert.ok(guidance.candidateEffects.some((effect) => effect.target === "Tolerogenic DC migration"));
});

test("guidance never invents sources outside the selected evidence set", () => {
  const records = APPLIED_LITERATURE.filter((record) => record.pmid === "42063338");
  const guidance = buildEvidenceGuidance({ diseaseContext: "normal", focus: ["C3"], intervention: [] }, records);

  assert.deepEqual(guidance.sources.map((source) => source.pmid), ["42063338"]);
  assert.ok(guidance.mechanisticClaims.every((claim) => claim.pmid === "42063338"));
  assert.ok(guidance.candidateEffects.every((effect) => effect.pmid === "42063338"));
});
