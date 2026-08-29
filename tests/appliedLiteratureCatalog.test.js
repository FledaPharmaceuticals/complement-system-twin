import test from "node:test";
import assert from "node:assert/strict";

import {
  APPLIED_LITERATURE,
  rankAppliedLiterature,
  selectLiteratureForExperiment
} from "../src/appliedLiteratureCatalog.js";

test("catalog records preserve verifiable provenance and model-use boundaries", () => {
  assert.ok(APPLIED_LITERATURE.length >= 8);
  for (const record of APPLIED_LITERATURE) {
    assert.match(record.pmid, /^\d+$/);
    assert.match(record.url, /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
    assert.ok(record.title);
    assert.ok(record.year >= 2000);
    assert.ok(record.modelUse);
    assert.equal(record.formalModelChanged, false);
  }
});

test("ranking favors recent strong evidence and exposes every score contribution", () => {
  const ranked = rankAppliedLiterature([
    {
      id: "older-review", year: 2018, evidenceType: "review", recognition: 90,
      priorityAuthor: false, linkedEntities: ["C3"]
    },
    {
      id: "recent-trial", year: 2025, evidenceType: "randomized_trial", recognition: 80,
      priorityAuthor: false, linkedEntities: ["C3"]
    }
  ], { currentYear: 2026, entities: ["C3"] });

  assert.equal(ranked[0].id, "recent-trial");
  assert.ok(ranked[0].ranking.score > ranked[1].ranking.score);
  assert.deepEqual(Object.keys(ranked[0].ranking.contributions).sort(), [
    "evidence", "expertSource", "recency", "recognition", "relevance"
  ]);
});

test("Lambris priority is a transparent expert-source bonus, not a substitute for evidence", () => {
  const ranked = rankAppliedLiterature([
    {
      id: "lambris-commentary", year: 2025, evidenceType: "commentary", recognition: 40,
      priorityAuthor: true, linkedEntities: ["C3"]
    },
    {
      id: "independent-trial", year: 2025, evidenceType: "randomized_trial", recognition: 90,
      priorityAuthor: false, linkedEntities: ["C3"]
    }
  ], { currentYear: 2026, entities: ["C3"] });

  assert.equal(ranked[0].id, "independent-trial");
  assert.equal(ranked[1].ranking.contributions.expertSource, 8);
});

test("experiment literature selection returns disease and mechanism-relevant sources", () => {
  const sources = selectLiteratureForExperiment({
    diseaseContext: "AMD",
    focus: ["C3", "Retina"],
    intervention: ["C3 inhibition"]
  });

  assert.ok(sources.length >= 2);
  assert.ok(sources.some((record) => record.linkedEntities.includes("AMD")));
  assert.ok(sources.some((record) => record.linkedEntities.includes("C3")));
  assert.ok(sources.every((record) => record.formalModelChanged === false));
});
