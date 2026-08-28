import test from "node:test";
import assert from "node:assert/strict";

import { generateCalibrationCandidates } from "../src/calibrationCandidates.js";

test("generates a reviewable hypothesis from a parameter prior", () => {
  const candidates = generateCalibrationCandidates({
    diseaseContext: "AMD",
    currentParameters: { alternativeMultiplier: 1.1 },
    evidenceRecords: [{
      id: "AMD-COMPLEMENT-001",
      sourceLocator: "https://pubmed.ncbi.nlm.nih.gov/1/",
      evidenceLevel: "genetic",
      uncertainty: "moderate",
      extractedClaim: "Alternative pathway activity is relevant to AMD biology.",
      parameterPriors: { alternativeMultiplier: { min: 1.2, median: 1.35, max: 1.6 } }
    }]
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].parameter, "alternativeMultiplier");
  assert.equal(candidates[0].suggestedValue, 1.35);
  assert.equal(candidates[0].status, "candidate");
  assert.equal(candidates[0].evidenceIds[0], "AMD-COMPLEMENT-001");
  assert.equal(candidates[0].modelVersion, "complement-twin-v1.1-contract");
});

test("does not emit a candidate from incomplete or contradictory priors", () => {
  const candidates = generateCalibrationCandidates({
    diseaseContext: "AMD",
    currentParameters: { factorHRegulationMultiplier: 0.9 },
    evidenceRecords: [
      { id: "missing-source", parameterPriors: { factorHRegulationMultiplier: { median: 0.8 } } },
      {
        id: "bad-range",
        sourceLocator: "https://example.org/paper",
        evidenceLevel: "mechanistic",
        uncertainty: "high",
        extractedClaim: "Invalid prior",
        parameterPriors: { factorHRegulationMultiplier: { min: 0.9, median: 0.7, max: 0.8 } }
      }
    ]
  });

  assert.deepEqual(candidates, []);
});
