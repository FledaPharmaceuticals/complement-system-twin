import test from "node:test";
import assert from "node:assert/strict";

import { generateEvidenceParameterCandidates } from "../src/evidenceParameterCandidates.js";

test("generates high-uncertainty AMD candidates from explicit literature terms", () => {
  const candidates = generateEvidenceParameterCandidates({
    diseaseContext: "AMD",
    currentParameters: { alternativeMultiplier: 1.1 },
    evidenceRecords: [{
      id: "pmid:1",
      sourceLocator: "https://pubmed.ncbi.nlm.nih.gov/1/",
      title: "AMD and Factor H regulation",
      extractedClaim: "",
      evidenceLevel: "mechanistic",
      uncertainty: "unknown",
      parameterPriors: {}
    }]
  });

  assert.ok(candidates.some((candidate) => candidate.parameter === "alternativeMultiplier"));
  assert.ok(candidates.some((candidate) => candidate.parameter === "factorHRegulationMultiplier"));
  assert.equal(candidates[0].status, "candidate");
  assert.equal(candidates[0].evidenceLevel, "hypothesis");
  assert.equal(candidates[0].uncertainty, "high");
});

test("does not generate AMD candidates for another disease context", () => {
  assert.deepEqual(generateEvidenceParameterCandidates({
    diseaseContext: "PNH",
    evidenceRecords: [{ id: "pmid:2", title: "AMD and Factor H" }]
  }), []);
});
