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

test("AMD Factor D experiments use target-specific positive and negative trials", () => {
  const sources = selectLiteratureForExperiment({
    diseaseContext: "AMD",
    focus: ["Factor D", "Retina"],
    intervention: ["factorDInhibitor"]
  });
  const pmids = sources.map((record) => record.pmid);

  assert.ok(pmids.includes("29801123"));
  assert.ok(pmids.includes("28637922"));
  assert.ok(pmids.indexOf("29801123") < pmids.indexOf("28637922"));
  assert.equal(pmids.includes("37865470"), false);
  assert.equal(pmids.includes("42063338"), false);
  assert.match(sources.find((record) => record.pmid === "29801123").modelUse, /did not|no benefit|not confirm/i);
});

test("Lambris portfolio records carry PubMed-verified training boundaries", () => {
  const requiredPmids = ["42063338", "40243098", "39809101", "39666368"];
  const records = APPLIED_LITERATURE.filter((record) => requiredPmids.includes(record.pmid));

  assert.equal(records.length, requiredPmids.length);
  for (const record of records) {
    assert.equal(record.priorityAuthor, true);
    assert.equal(record.portfolioSource, "https://www.lambris.com/articles/");
    assert.ok(record.experimentalContext);
    assert.ok(record.mechanisticClaims.length >= 1);
    assert.ok(record.candidateEffects.length >= 1);
    assert.ok(record.transferLimits.length >= 1);
    assert.equal(record.formalModelChanged, false);
  }
});

test("disease-specific conversations exclude incompatible tissue contexts", () => {
  const sources = selectLiteratureForExperiment({
    diseaseContext: "sepsis",
    focus: ["C3", "C5a", "Inflammasome"],
    intervention: ["c3Inhibitor"]
  }, 10);

  assert.ok(sources.some((record) => record.pmid === "39809101"));
  assert.ok(sources.some((record) => record.pmid === "42063338"));
  assert.ok(!sources.some((record) => record.pmid === "39666368"));
  assert.ok(!sources.some((record) => record.linkedEntities.includes("AMD")));
});
